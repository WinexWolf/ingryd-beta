import base64
import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.routes import skin as skin_route
from app.services import skin_youcam, usage
from app.services.auth import current_user
from app.services.youcam import ConcernScore, YouCamAnalysis, YouCamError

app = FastAPI()
app.include_router(skin_route.router, prefix="/api")
app.dependency_overrides[current_user] = lambda: "user-1"
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
    monkeypatch.setenv("YOUCAM_USER_DAILY_CAP", "5")
    monkeypatch.setenv("YOUCAM_DAILY_CAP", "50")
    monkeypatch.setenv("YOUCAM_TOTAL_CAP", "500")
    monkeypatch.setattr(usage, "get_supabase", lambda: None)
    usage.reset_for_tests()


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


# ---- caps
def test_user_cap_blocks_after_limit_and_release_gives_back():
    for _ in range(5):
        usage.reserve("user-1")
    with pytest.raises(usage.LimitReached) as e:
        usage.reserve("user-1")
    assert e.value.kind == "user"
    usage.release("user-1")
    usage.reserve("user-1")


def test_one_users_cap_does_not_block_another():
    for _ in range(5):
        usage.reserve("a")
    usage.reserve("b")


def test_day_and_total_caps(monkeypatch):
    monkeypatch.setenv("YOUCAM_DAILY_CAP", "2")
    usage.reserve("a"); usage.reserve("b")
    with pytest.raises(usage.LimitReached) as e:
        usage.reserve("c")
    assert e.value.kind == "day"
    usage.reset_for_tests()
    monkeypatch.setenv("YOUCAM_DAILY_CAP", "50"); monkeypatch.setenv("YOUCAM_TOTAL_CAP", "1")
    usage.reserve("a")
    with pytest.raises(usage.LimitReached) as e:
        usage.reserve("b")
    assert e.value.kind == "total"


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
    assert usage._mem.get(("user-1", usage._today()), 0) == 0


def test_route_422_when_photo_is_the_problem(monkeypatch):
    async def bad(b, ct): raise YouCamError("try a clearer photo", user_fixable=True)
    monkeypatch.setattr(skin_route, "analyze_image", bad)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 422 and "clearer" in r.json()["detail"]


def test_route_without_key_uses_heuristic(monkeypatch):
    monkeypatch.delenv("YOUCAM_API_KEY")
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 200 and r.json()["profile"]["source"] == "heuristic"


def test_route_429_when_user_cap_reached_and_503_when_service_cap_reached(monkeypatch):
    monkeypatch.setenv("YOUCAM_USER_DAILY_CAP", "0")
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 429 and "sample" in r.json()["detail"].lower()
    monkeypatch.setenv("YOUCAM_USER_DAILY_CAP", "5"); monkeypatch.setenv("YOUCAM_DAILY_CAP", "0")
    r = client.post("/api/skin/analyze", json={"image_base64": _photo()})
    assert r.status_code == 503


def test_route_requires_sign_in():
    saved = app.dependency_overrides.pop(current_user)
    try:
        assert client.post("/api/skin/analyze", json={"image_base64": _photo()}).status_code == 401
    finally:
        app.dependency_overrides[current_user] = saved


def test_sample_scan_is_free_unauthenticated_and_labelled(monkeypatch):
    saved = app.dependency_overrides.pop(current_user)
    try:
        async def boom(b, ct): raise AssertionError("must not call YouCam")
        monkeypatch.setattr(skin_route, "analyze_image", boom)
        r = client.post("/api/skin/sample")
        p = r.json()["profile"]
        assert r.status_code == 200 and p["is_sample"] is True and p["areas"] and p["masks"] == {}
        assert usage._mem == {}
    finally:
        app.dependency_overrides[current_user] = saved


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


# ---- multi-angle scans
def _used(): return usage._mem.get(("user-1", usage._today()), 0)


def test_merge_views_weights_front_double_and_flags_disagreement():
    front, left, right = _analysis(acne=60), _analysis(acne=80), _analysis(acne=90)
    m, view_scores, varies = skin_youcam.merge_views(front, {"left": left, "right": right})
    assert m.concerns["acne"].ui_score == round((2 * 60 + 80 + 90) / 4)      # 72.5 -> front counts double
    assert "acne" in varies and "pore" not in varies                         # 60 vs 90 differ by >= 15
    assert view_scores["left"]["acne"] == 80 and set(view_scores) == {"front", "left", "right"}
    assert m.skin_age == front.skin_age and m.skin_type == front.skin_type   # identity comes from the front photo


def test_merge_keeps_front_masks_only():
    front, left = _analysis(), _analysis()
    front.concerns["acne"].mask_url = "https://front/mask"
    left.concerns["acne"].mask_url = "https://left/mask"
    m, _, _ = skin_youcam.merge_views(front, {"left": left})
    assert m.concerns["acne"].mask_url == "https://front/mask"


def test_route_three_photos_charges_three_and_merges(monkeypatch):
    seen = []
    async def fake(b, ct):
        seen.append(len(b)); return _analysis(acne=[60, 80, 90][len(seen) - 1])
    monkeypatch.setattr(skin_route, "analyze_image", fake)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo(), "left_base64": _photo(), "right_base64": _photo()})
    p = r.json()["profile"]
    assert r.status_code == 200 and p["views"] == ["front", "left", "right"] and len(seen) == 3
    assert _used() == 3 and set(p["view_scores"]) == {"front", "left", "right"}


def test_route_failed_side_photo_is_refunded_and_explained(monkeypatch):
    calls = []
    async def flaky(b, ct):
        calls.append(1)
        if len(calls) == 2: raise YouCamError("angle too steep", user_fixable=True)
        return _analysis()
    monkeypatch.setattr(skin_route, "analyze_image", flaky)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo(), "left_base64": _photo(), "right_base64": _photo()})
    p = r.json()["profile"]
    assert r.status_code == 200 and len(p["views"]) == 2 and any("quarter turn" in n for n in p["view_notes"])
    assert _used() == 2   # only the two successful analyses count


def test_route_retries_transient_failure_once(monkeypatch):
    monkeypatch.setattr(skin_route, "RETRY_WAIT_S", 0)
    tries = {"n": 0}
    async def flaky(b, ct):
        tries["n"] += 1
        if tries["n"] == 2: raise YouCamError("rate limited", retryable=True)
        return _analysis()
    monkeypatch.setattr(skin_route, "analyze_image", flaky)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo(), "left_base64": _photo()})
    p = r.json()["profile"]
    assert r.status_code == 200 and p["views"] == ["front", "left"] and tries["n"] == 3 and p["view_notes"] == []


def test_route_front_failure_with_good_sides_is_a_clear_error(monkeypatch):
    calls = []
    async def front_bad(b, ct):
        calls.append(1)
        if len(calls) == 1: raise YouCamError("no face", user_fixable=True)
        return _analysis()
    monkeypatch.setattr(skin_route, "analyze_image", front_bad)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo(), "left_base64": _photo()})
    assert r.status_code == 422


def test_route_unreadable_side_photo_is_skipped(monkeypatch):
    async def fake(b, ct): return _analysis()
    monkeypatch.setattr(skin_route, "analyze_image", fake)
    r = client.post("/api/skin/analyze", json={"image_base64": _photo(), "left_base64": "garbage"})
    p = r.json()["profile"]
    assert r.status_code == 200 and p["views"] == ["front"] and any("left photo couldn't be read" in n for n in p["view_notes"])
    assert _used() == 1


def test_reserve_all_or_nothing_with_helpful_message(monkeypatch):
    monkeypatch.setenv("YOUCAM_USER_DAILY_CAP", "4")
    usage.reserve("u", 3)
    with pytest.raises(usage.LimitReached) as e:
        usage.reserve("u", 3)
    assert "1 photo analysis left" in e.value.message and usage._mem[("u", usage._today())] == 3
