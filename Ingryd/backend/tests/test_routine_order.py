from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import routine as routine_route
from app.models.routine import RoutineProduct
from app.services.routine_order import order_routine

_app = FastAPI()
_app.include_router(routine_route.router, prefix="/api")
client = TestClient(_app)


def P(name, slot, ings=None):
    return RoutineProduct(name=name, slot=slot, ingredients_parsed=ings or [])


def names(items):
    return [i.name for i in items]


def test_morning_order_thin_to_thick_sunscreen_last():
    r = order_routine([
        P("Daily SPF 50 Sunscreen", "am"), P("Rich Moisturizer", "am"), P("Hydrating Serum", "am"), P("Gentle Foaming Cleanser", "am"),
    ])
    assert names(r.am) == ["Gentle Foaming Cleanser", "Hydrating Serum", "Rich Moisturizer", "Daily SPF 50 Sunscreen"]
    assert [i.step for i in r.am] == [1, 2, 3, 4]
    assert r.tips == []


def test_evening_order_and_oil_last():
    r = order_routine([P("Night Cream moisturizer", "pm"), P("Face Oil", "pm"), P("Retinol Serum", "pm", ["retinol"]), P("Cleanser", "pm")])
    assert names(r.pm) == ["Cleanser", "Retinol Serum", "Night Cream moisturizer", "Face Oil"]


def test_acid_serum_before_hydrating_before_retinoid():
    r = order_routine([
        P("Retinol Serum", "pm", ["retinol"]), P("Hyaluronic Serum", "pm", ["hyaluronic acid"]), P("Glycolic Serum", "pm", ["glycolic acid"]),
    ])
    assert names(r.pm) == ["Glycolic Serum", "Hyaluronic Serum", "Retinol Serum"]


def test_tip_when_no_morning_sunscreen():
    r = order_routine([P("Cleanser", "am"), P("Moisturizer", "am")])
    assert any("no sunscreen" in t.lower() for t in r.tips)


def test_no_sunscreen_tip_when_no_morning_routine():
    assert order_routine([P("Cleanser", "pm")]).tips == []


def test_sunscreen_in_the_evening_is_flagged_and_not_a_step():
    r = order_routine([P("Cleanser", "pm"), P("Sunscreen SPF 30", "pm")])
    assert any("sunscreen" in t.lower() and "morning" in t.lower() for t in r.tips)


def test_retinoid_and_acid_in_the_morning_flagged():
    r = order_routine([P("Retinol Serum", "am", ["retinol"]), P("Sunscreen", "am")])
    assert any("evening" in t for t in r.tips)


def test_named_after_active_is_treated_as_serum():
    r = order_routine([P("Niacinamide 10% + Zinc 1%", "pm"), P("Cleanser", "pm"), P("Moisturizer", "pm")])
    assert names(r.pm) == ["Cleanser", "Niacinamide 10% + Zinc 1%", "Moisturizer"]
    assert "based on its name" in r.pm[1].note


def test_unknown_product_placed_after_serums_with_note():
    r = order_routine([P("Mystery Thing", "pm"), P("Cleanser", "pm"), P("Moisturizer", "pm")])
    assert names(r.pm) == ["Cleanser", "Mystery Thing", "Moisturizer"]
    assert "couldn't tell" in r.pm[1].note


def test_endpoint():
    r = client.post("/api/routine/order", json={"products": [
        {"name": "Moisturizer", "slot": "am"}, {"name": "Cleanser", "slot": "am"}]})
    assert r.status_code == 200
    assert [i["name"] for i in r.json()["am"]] == ["Cleanser", "Moisturizer"]
