import base64
import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.routes import skin as skin_route
from app.services import skin_youcam
from app.services.youcam import ConcernScore, YouCamAnalysis, YouCamError

app = FastAPI()
app.include_router(skin_route.router, prefix="/api")
client = TestClient(app)


def _photo(size=(640, 800)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 150, 130)).save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _analysis(**over):
    scores = {"moisture": 79, "oiliness": 78, "redness": 90, "acne": 77, "pore": 75,
              "texture": 96, "wrinkle": 79, "age_spot": 87, "dark_circle_v2": 67}
    scores.update(over)
    return YouCamAnalysis(
        concerns={k: ConcernScore(ui_score=v, raw_score=float(v)) for k, v in scores.items()},
        skin_type="Normal", skin_type_zones={"t_zone": "Oily", "u_zone": "Normal"},
        overall_score=80.9, skin_age=30,
    )


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.setenv("YOUCAM_API_KEY", "test-key")
    monkeypatch.setenv("YOUCAM_DAILY_CAP", "5")
    skin_youcam._usage.update(day="", n=0)


# ---- mapping
def test_mapping_inverts_issue_scores_and_flags_worst_concern():
    p = skin_youcam.map_to_profile(_analysis())
    assert p.source == "youcam" and p.overall_score == 81
    assert p.hydration.score == 79                 # higher = healthier (unchanged)
    assert p.oiliness.score == 22                  # inverted: higher = oilier
    assert p.redness.score == 10 and p.redness.label == "Calm"
    assert p.concerns["dark_circle_v2"] == 67
    assert p.recommended_ingredients[0] == "Caffeine"   # only dark circles < 75
    assert any("T-zone" in n for n in p.notes)


def test_mapping_all_healthy_gives_maintain_note():
    p = skin_youcam.map_to_profile(_analysis(dark_circle_v2=90))
    assert p.recommended_ingredients == []
    assert "maintain" in p.notes[0]


def test_mapping_missing_concern_is_neutral_not_crash():
    a = _analysis()
    del a.concerns["moisture"]
    assert skin_youcam.map_to_profile(a).hydration.score == 70


# ---- photo prep
def test_prepare_rejects_garbage_and_small():
    with pytest.raises(Exception) as e:
        skin_youcam.prepare_image("not-base64!!")
    assert e.value.status_code == 400
    with pytest.raises(Exception) as e:
        skin_youcam.prepare_image(_photo((300, 300)))
    assert e.value.status_code == 422


def test_prepare_downscales_large_photo():
    out = Image.open(io.BytesIO(skin_youcam.prepare_image(_photo((3000, 4000)))))
    assert max(out.size) <= skin_youcam.MAX_SIDE


# ---- cap
def test_cap_blocks_after_limit_and_release_gives_back():
    assert all(skin_youcam.reserve_call() for _ in range(5))
    assert not skin_youcam.reserve_call()
    skin_youcam.release_call()
    assert skin_youcam.reserve_call()


# ---- route
def test_route_uses_youcam(monkeypatch):
    async def fake(b, ct): return _analysis()
    monkeypatch.setattr(skin_route, "analyze_image", fake)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 200 and r.json()["profile"]["source"] == "youcam"


def test_route_falls_back_when_youcam_down_and_refunds(monkeypatch):
    async def boom(b, ct): raise YouCamError("down", retryable=True)
    monkeypatch.setattr(skin_route, "analyze_image", boom)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 200 and r.json()["profile"]["source"] == "heuristic"
    assert skin_youcam._usage["n"] == 0


def test_route_422_when_photo_is_the_problem(monkeypatch):
    async def bad(b, ct): raise YouCamError("try a clearer photo", user_fixable=True)
    monkeypatch.setattr(skin_route, "analyze_image", bad)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 422 and "clearer" in r.json()["detail"]


def test_route_without_key_uses_heuristic(monkeypatch):
    monkeypatch.delenv("YOUCAM_API_KEY")
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 200 and r.json()["profile"]["source"] == "heuristic"


def test_route_uses_fallback_when_cap_reached(monkeypatch):
    monkeypatch.setenv("YOUCAM_DAILY_CAP", "0")
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.json()["profile"]["source"] == "heuristic"


# ---- results screen v2: areas + masks
def test_areas_are_weakest_first_with_status_and_tips():
    p = skin_youcam.map_to_profile(_analysis())
    assert len(p.areas) == 9
    assert [a.score for a in p.areas] == sorted(a.score for a in p.areas)
    first = p.areas[0]
    assert first.key == "dark_circle_v2" and first.status == "attention"
    assert first.ingredients[0] == "Caffeine" and "darkness" in first.tip.lower()
    assert {a.status for a in p.areas} == {"attention", "watch", "good"}


def test_areas_still_exist_when_everything_is_healthy():
    p = skin_youcam.map_to_profile(_analysis(dark_circle_v2=95, pore=95, acne=95, moisture=95,
                                             oiliness=95, wrinkle=95, age_spot=95))
    assert len(p.areas) == 9 and all(a.status == "good" for a in p.areas[:3])
    assert "nothing to change" in p.areas[0].tip


def test_threshold_is_consistent_between_notes_and_suggested_concerns():
    # pore 73 and dark circles 71 used to be "healthy" in notes yet flagged for the profile
    p = skin_youcam.map_to_profile(_analysis(pore=73, dark_circle_v2=71, acne=99))
    assert "acne" in p.suggested_concerns
    assert not any("healthy across the board" in n for n in p.notes)


def test_masks_are_passed_through():
    a = _analysis()
    a.concerns["pore"].mask_url = "https://example.com/pore.png?sig=1"
    p = skin_youcam.map_to_profile(a)
    assert p.masks == {"pore": "https://example.com/pore.png?sig=1"}
