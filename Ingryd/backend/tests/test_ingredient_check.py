import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import ingredients as ingredients_route
from app.services import ingredient_review
from app.services.ingredient_check import assess_ingredient_text
from app.services.normalize import normalize_full_ingredients_text as norm

WEB_PAGE = (
    "Ontractor Beneficiaries, Pay, Then Handle The Shortfall And Collect Fees. Nts: Ed Account Setup, "
    "Then Per Employer Post /Global_accounts/Create, Post tion/Deposit/Create, Post /Beneficiaries/Validate, "
    "Post /Beneficiaries/Create, P tes/Create, Post /Fx/Conversions/Create, Post /Transfers/Create And Post "
    "tion/Transfers/{Id}/Transition, All With X—on-Behalf-Of, Then Post /Charges/Create - Out For: Ulate Swift "
    "Fees Before Converting. If You Convert Only The Payroll Total, The Last Contractor's P on Insufficient Funds."
)

REAL = [
    "INGREDIENTS: Aqua/Water/Eau, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Niacinamide, "
    "Phenoxyethanol, Ceramide NP, Sodium Hyaluronate, Carbomer, Xanthan Gum, Tocopherol",
    "Camellia Sinensis Leaf Extract, Butyrospermum Parkii (Shea) Butter, Citrus Aurantium Dulcis (Orange) Peel Oil, Squalane, Parfum",
    "Water, Caprylic/Capric Triglyceride, Iron Oxides (CI 77492, CI 77491), Silica, Aluminum Hydroxide",
    "Jojoba Seed Oil",
    "Ingredients: Aqua, Glycerln, Nlacinamide, Sodium Hyaluronate, Panthenol, Phenoxyethanol, Dimethicone",
]

NOT_LISTS = [
    WEB_PAGE,
    "2 cups flour, 1 tsp salt, 3 eggs, 1 cup sugar, 2 tbsp milk, vanilla",
    "This is a normal paragraph about my day. I went to the store, bought some apples, and came home.",
    "npm install, npm run build, git push origin main, python manage.py migrate",
    "12, 34, 56, 78, 90",
    "John Smith, Mary Jones, Peter Parker, Anna Lee",
    "",
]


@pytest.mark.parametrize("text", REAL)
def test_real_ingredient_lists_pass(text):
    assert assess_ingredient_text(text, norm(text)).ok


@pytest.mark.parametrize("text", NOT_LISTS)
def test_non_ingredient_text_is_rejected(text):
    assert not assess_ingredient_text(text, norm(text) if text else []).ok


app = FastAPI()
app.include_router(ingredients_route.router, prefix="/api")
client = TestClient(app)


def test_analyze_refuses_a_web_page_with_a_helpful_422(monkeypatch):
    def boom(*a, **k):  # must not reach scoring
        raise AssertionError("scored non-ingredient text")
    monkeypatch.setattr(ingredients_route, "analyze_raw_ingredients", boom)
    r = client.post("/api/ingredients/analyze", json={"raw_text": WEB_PAGE})
    assert r.status_code == 422
    assert "ingredient list" in r.json()["detail"]


def test_analyze_still_scores_a_real_list():
    r = client.post("/api/ingredients/analyze", json={"raw_text": REAL[0]})
    assert r.status_code == 200
    assert r.json()["score"]["total_ingredients"] >= 8


# ── Real photos of a pack read more than the list ─────────────────────────────

from app.services.ingredient_check import extract_ingredient_text, has_ingredient_header

FRONT_OF_PACK = (
    "The Ordinary,\nNiacinamide 10% + Zinc 1%\n\nHigh-Strength Vitamin and\nMineral Blemish Formula\n"
    "Ultra-Vitaminée et Minérale\nles Imperfections 30ml"
)
BACK_OF_PACK = (
    "Gently smooths skin. Helps provide antioxidant benefits.\nDirections: Wet skin with lukewarm water. Massage.\n"
    "INGREDIENTS: AQUA/WATER/EAU, COCAMIDOPROPYL\nHYDROXYSULTAINE, GLYCERIN, SODIUM LAUROYL\nSARCOSINATE, NIACINAMIDE, "
    "SALICYLIC ACID, PEG-150\nPENTAERYTHRITYL TETRASTEARATE.\nWarning: For external use only. Avoid contact with eyes.\nMade in USA"
)


def test_extract_takes_only_the_list_from_a_back_panel():
    out = extract_ingredient_text(BACK_OF_PACK)
    assert out.startswith("AQUA/WATER/EAU")
    assert "Directions" not in out and "Warning" not in out and "Made in" not in out
    assert "SODIUM LAUROYL SARCOSINATE" in out          # wrapped line joined


def test_extract_leaves_text_without_a_header_alone():
    assert extract_ingredient_text("Water, Glycerin, Niacinamide") == "Water, Glycerin, Niacinamide"


def test_extract_handles_other_separators():
    out = extract_ingredient_text("Ingredients: Water; Glycerin; Niacinamide; Panthenol")
    assert out == "Water, Glycerin, Niacinamide, Panthenol"


def test_back_panel_with_claims_and_warnings_scores():
    r = client.post("/api/ingredients/analyze", json={"raw_text": BACK_OF_PACK})
    assert r.status_code == 200, r.text
    assert "Niacinamide" in r.json()["ingredients_parsed"]


def test_front_of_pack_gets_a_turn_it_over_message():
    assert not has_ingredient_header(FRONT_OF_PACK)
    r = client.post("/api/ingredients/analyze", json={"raw_text": FRONT_OF_PACK})
    assert r.status_code == 422
    assert "front of the product" in r.json()["detail"] and "back or side panel" in r.json()["detail"]
    assert "ingredient list" in r.json()["detail"].lower()   # the app keys on this to stay on the text screen


def test_garbled_list_with_header_keeps_the_retake_message():
    r = client.post("/api/ingredients/analyze", json={"raw_text": "Ingredients: asdf qwer zxcv, lorem ipsum dolor sit amet consectetur adipiscing"})
    assert r.status_code == 422
    assert "doesn't look like an ingredient list" in r.json()["detail"]
