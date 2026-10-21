import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.product import AlternativesRequest, SkinProfile
from app.routes import products as products_route
from app.services import recommend as rec


def _row(gtin, name, brand, cat, ings):
    return {"gtin": gtin, "product_name": name, "brand": brand, "category": cat,
            "ingredients_ordered": [{"position": i, "inci_name": n} for i, n in enumerate(ings)]}


BASE = ["Water", "Glycerin", "Sodium Hyaluronate", "Panthenol", "Phenoxyethanol"]
ROWS = [
    # serums
    _row("1", "Clear Serum", "Alpha", "serum", ["Water", "Niacinamide", "Salicylic Acid", "Zinc PCA", "Glycerin", "Phenoxyethanol"]),
    _row("2", "Heavy Serum", "Beta", "serum", ["Water", "Isopropyl Myristate", "Coconut Oil", "Fragrance", "Glycerin", "Tocopherol"]),
    _row("3", "Plain Serum", "Gamma", "serum", ["Water", "Glycerin", "Butylene Glycol", "Carbomer", "Phenoxyethanol"]),
    _row("4", "Peel Serum", "Alpha", "serum", ["Water", "Lactic Acid", "Niacinamide", "Glycerin", "Panthenol", "Phenoxyethanol"]),
    _row("5", "Second Alpha", "Alpha", "serum", ["Water", "Niacinamide", "Zinc PCA", "Glycerin", "Panthenol", "Tocopherol"]),
    # eye care
    _row("6", "Bright Eye", "Delta", "eye_cream", ["Water", "Caffeine", "Niacinamide", "Glycerin", "Panthenol", "Tocopherol"]),
    _row("7", "Too Short", "Delta", "eye_cream", ["Water", "Caffeine"]),   # dropped: < 5 ingredients
    _row("8", "Plain Cleanser", "Eps", "cleanser", BASE),
]
PROFILE = SkinProfile(skin_type="combination", concerns=["acne", "texture", "dark circles"],
                      concern_scores={"pore": 73, "acne": 99, "texture": 80, "dark_circle_v2": 71})


@pytest.fixture(autouse=True)
def _catalog(monkeypatch):
    rec.clear_cache()
    monkeypatch.setattr(rec, "_fetch_rows", lambda: ROWS)
    yield
    rec.clear_cache()


def test_catalog_drops_rows_with_too_few_ingredients():
    assert "7" not in {r["barcode"] for r in rec.load_catalog()}


def test_recommend_prefers_products_that_target_the_user_and_explains_why():
    r = rec.recommend(PROFILE)
    assert r.personalized and r.catalog_size == 7
    assert r.top[0].barcode in {"1", "4", "6"}
    assert any("Targets your" in x for x in r.top[0].reasons)
    ids = [p.barcode for g in r.groups for p in g.picks]
    assert "2" not in ids                       # pore-clogging oils + fragrance fall below the bar


def test_groups_put_flagged_concern_categories_first():
    r = rec.recommend(PROFILE)
    order = [g.category for g in r.groups]
    assert order.index("eye_cream") < order.index("cleanser") if "cleanser" in order else True
    assert order[0] in {"exfoliant", "spot_treatment", "serum", "eye_cream"}


def test_brand_cap_keeps_lists_varied():
    r = rec.recommend(PROFILE, per_group=5)
    serums = next(g for g in r.groups if g.category == "serum")
    assert sum(1 for p in serums.picks if p.brand == "Alpha") <= 2


def test_without_profile_still_returns_generic_picks():
    r = rec.recommend(None)
    assert not r.personalized and r.top


def test_alternatives_are_same_category_and_strictly_better():
    cur = ROWS[1]  # Heavy Serum
    req = AlternativesRequest(barcode="2", profile=PROFILE, limit=3,
                              ingredients=[i["inci_name"] for i in cur["ingredients_ordered"]])
    out = rec.alternatives(req)
    assert out.category == "serum" and out.picks
    assert all(p.category == "serum" and p.barcode != "2" and p.delta and p.delta > 0 for p in out.picks)
    assert any("isopropyl myristate" in p.avoids or "coconut oil" in p.avoids for p in out.picks)


def test_alternatives_say_so_when_nothing_beats_the_current_product():
    best = rec.recommend(PROFILE).top[0]
    out = rec.alternatives(AlternativesRequest(barcode=best.barcode, profile=PROFILE, current_fit=100))
    assert out.picks == [] and "already" in out.message


def test_alternatives_unknown_category_is_graceful():
    out = rec.alternatives(AlternativesRequest(category="uncategorized", profile=PROFILE))
    assert out.picks == [] and out.message


def test_routes():
    app = FastAPI(); app.include_router(products_route.router, prefix="/api")
    c = TestClient(app)
    r = c.get("/api/products/recommend", params={"skin_type": "combination", "concerns": "acne,texture",
                                                  "concern_scores": "pore:73,texture:80"})
    assert r.status_code == 200 and r.json()["top"]
    a = c.post("/api/products/alternatives", json={"barcode": "2", "limit": 2,
                                                     "profile": PROFILE.model_dump()})
    assert a.status_code == 200 and a.json()["category"] == "serum"
