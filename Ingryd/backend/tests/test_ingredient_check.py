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
    assert "doesn't look like an ingredient list" in r.json()["detail"]


def test_analyze_still_scores_a_real_list():
    r = client.post("/api/ingredients/analyze", json={"raw_text": REAL[0]})
    assert r.status_code == 200
    assert r.json()["score"]["total_ingredients"] >= 8
