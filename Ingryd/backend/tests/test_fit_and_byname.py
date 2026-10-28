"""Fit Score no longer ties at 100, and catalog products without a barcode can be fetched by name."""
from fastapi.testclient import TestClient

from main import app
from app.models.product import ProductResult
from app.routes import products as products_route
from app.services.scoring import _soft_cap

client = TestClient(app)


def test_soft_cap_is_unchanged_up_to_80_and_never_reaches_100_easily():
    assert [_soft_cap(x) for x in (0, 40, 79, 80)] == [0, 40, 79, 80]
    assert _soft_cap(-5) == 0
    assert _soft_cap(100) < _soft_cap(120) < _soft_cap(140) < 100   # strong matches stay distinguishable
    assert _soft_cap(130) < 100


def test_by_name_returns_product_without_a_barcode(monkeypatch):
    async def fake(name, brand, profile=None):
        return ProductResult(barcode="", name=name, brand=brand, found=True)
    monkeypatch.setattr(products_route, "catalog_lookup_by_name", fake)
    r = client.get("/api/products/by-name", params={"name": "Low pH Morning Cleanser", "brand": "COSRX"})
    assert r.status_code == 200 and r.json()["name"] == "Low pH Morning Cleanser"


def test_by_name_404_when_missing(monkeypatch):
    async def none(name, brand, profile=None):
        return None
    monkeypatch.setattr(products_route, "catalog_lookup_by_name", none)
    r = client.get("/api/products/by-name", params={"name": "Nope"})
    assert r.status_code == 404
