import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.product import SkinProfile
from app.models.routine import RoutineProduct
from app.routes import routine as routine_route
from app.services import recommend as rec
from app.services.categorize import infer_category
from app.services.routine_fit import check_fit


def _row(gtin, name, brand, cat, ings):
    return {"gtin": gtin, "product_name": name, "brand": brand, "category": cat,
            "ingredients_ordered": [{"position": i, "inci_name": n} for i, n in enumerate(ings)]}


ROWS = [
    _row("6", "Bright Eye Cream", "Delta", "eye_cream", ["Water", "Caffeine", "Niacinamide", "Glycerin", "Panthenol", "Tocopherol"]),
    _row("1", "Clear Serum", "Alpha", "serum", ["Water", "Niacinamide", "Salicylic Acid", "Zinc PCA", "Glycerin", "Phenoxyethanol"]),
    _row("9", "Gentle Toner", "Eps", "uncategorized", ["Water", "Lactic Acid", "Glycerin", "Panthenol", "Phenoxyethanol"]),
]
PROFILE = SkinProfile(skin_type="combination", concerns=["acne", "texture", "dark circles"],
                      concern_scores={"pore": 73, "acne": 99, "texture": 74, "dark_circle_v2": 71, "moisture": 90})

CLEANSER = RoutineProduct(name="Gentle Foaming Cleanser", slot="am", ingredients_parsed=["Water", "Glycerin", "Coco-Glucoside"])
HEAVY = RoutineProduct(name="Rich Cream", slot="pm", ingredients_parsed=["Water", "Isopropyl Myristate", "Coconut Oil", "Glycerin"])
ACNE_SERUM = RoutineProduct(name="BHA Serum", slot="pm", ingredients_parsed=["Water", "Zinc PCA", "Tea Tree Leaf Oil"])


@pytest.fixture(autouse=True)
def _catalog(monkeypatch):
    rec.clear_cache()
    monkeypatch.setattr(rec, "_fetch_rows", lambda: ROWS)
    yield
    rec.clear_cache()


def test_infer_category_from_name_and_spf_actives():
    assert infer_category("CeraVe Foaming Cleanser") == "cleanser"
    assert infer_category("Bright Eye Concentrate") == "eye_cream"
    assert infer_category("Daily Shield", ["Zinc Oxide", "Water"]) == "sunscreen"
    assert infer_category("Mystery Thing") == "uncategorized"


def test_uncategorized_catalog_rows_get_a_category_from_their_name():
    cats = {r["barcode"]: r["category"] for r in rec.load_catalog()}
    assert cats["9"] == "toner"


def test_gaps_are_the_scan_concerns_nothing_targets_and_come_with_a_suggestion():
    r = check_fit([CLEANSER, ACNE_SERUM], PROFILE)
    assert r.has_scan
    assert [c.concern for c in r.covered] == ["acne"]
    assert {g.concern for g in r.gaps} == {"texture", "dark circles"}
    dc = next(g for g in r.gaps if g.concern == "dark circles")
    assert dc.score == 71 and "dark circles" in dc.message.lower()
    assert dc.suggestion and dc.suggestion.category == "eye_cream"
    assert "1 of 3" in r.headline


def test_working_against_flags_pore_cloggers_for_a_flagged_pore_scan():
    r = check_fit([HEAVY], PROFILE)
    cream = r.products[0]
    assert any("Isopropyl Myristate" in w for w in cream.working_against)
    assert cream.fit_score is not None and cream.category == "moisturizer"


def test_missing_basics_flags_no_spf_and_no_moisturizer():
    r = check_fit([CLEANSER], PROFILE)
    assert any("sunscreen" in b for b in r.missing_basics)
    assert any("moisturizer" in b for b in r.missing_basics)
    spf = RoutineProduct(name="Daily SPF", slot="am", ingredients_parsed=["Water", "Zinc Oxide"])
    assert not any("sunscreen" in b for b in check_fit([CLEANSER, spf], PROFILE).missing_basics)


def test_everything_covered_has_no_gaps():
    eye = RoutineProduct(name="Eye Cream", slot="pm", ingredients_parsed=["Water", "Caffeine"])
    peel = RoutineProduct(name="Peel", slot="pm", ingredients_parsed=["Water", "Lactic Acid"])
    r = check_fit([ACNE_SERUM, eye, peel], PROFILE)
    assert r.gaps == [] and "all 3" in r.headline


def test_without_scan_uses_listed_concerns_and_empty_routine_is_graceful():
    r = check_fit([CLEANSER], SkinProfile(concerns=["acne"]))
    assert not r.has_scan and [g.concern for g in r.gaps] == ["acne"] and r.gaps[0].score is None
    assert "Add a few products" in check_fit([], PROFILE).headline
    assert check_fit([CLEANSER], None).gaps == []


def test_route():
    app = FastAPI(); app.include_router(routine_route.router, prefix="/api")
    r = TestClient(app).post("/api/routine/fit", json={
        "products": [CLEANSER.model_dump()], "profile": PROFILE.model_dump()})
    assert r.status_code == 200 and r.json()["gaps"]
