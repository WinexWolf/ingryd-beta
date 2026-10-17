"""Barcode forms, OBF variant lookup, UPCitemdb identification and 'is this product...?' candidates."""
import asyncio

import pytest

from app.models.product import ProductResult
from app.services import barcodes, catalog, open_beauty_facts as obf, upcitemdb


# ---------------------------------------------------------------- forms / check digits
def test_check_digits():
    assert barcodes.gtin_check_ok("3606000537750")
    assert barcodes.gtin_check_ok("8809782558905")
    assert not barcodes.gtin_check_ok("8809782558906")
    assert not barcodes.gtin_check_ok("123")


def test_upce_expansion_matches_the_published_example():
    assert barcodes.expand_upce("04252614") == "042100005264"
    assert barcodes.gtin_check_ok("042100005264")
    assert barcodes.expand_upce("23456789") is None  # number system must be 0 or 1


def test_upca_forms_include_ean13_and_gtin14():
    forms = barcodes.barcode_forms("042100005264")
    assert forms[0] == "042100005264"
    assert "0042100005264" in forms and "00042100005264" in forms


def test_eight_digit_code_tries_upce_and_ean8_readings():
    forms = barcodes.barcode_forms("04252614")
    assert "042100005264" in forms           # as UPC-E
    assert "00000004252614" in forms         # as EAN-8, padded


def test_catalog_forms_are_14_digit_too():
    assert "00042100005264" in barcodes.catalog_forms("0042100005264")


# ---------------------------------------------------------------- Open Beauty Facts variants
def test_obf_finds_a_upc_stored_as_ean13(monkeypatch):
    asked = []

    async def fake_fetch(client, code):
        asked.append(code)
        if code == "0042100005264":
            return {"product_name": "Spot Gel", "brands": "Brandx", "ingredients_text": "Aqua, Glycerin"}
        return None

    monkeypatch.setattr(obf, "_fetch_one", fake_fetch)
    res = asyncio.run(obf.lookup_barcode("042100005264"))
    assert res.found and res.name == "Spot Gel" and res.barcode == "042100005264"
    assert "0042100005264" in asked and "042100005264" in asked


def test_obf_all_miss_is_not_found(monkeypatch):
    async def fake_fetch(client, code):
        return None
    monkeypatch.setattr(obf, "_fetch_one", fake_fetch)
    assert not asyncio.run(obf.lookup_barcode("8809782558905")).found


# ---------------------------------------------------------------- UPCitemdb
class _Resp:
    def __init__(self, status=200, body=None): self.status_code, self._b = status, body or {}
    def json(self): return self._b


def _fake_client(resp, calls):
    class C:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None, headers=None):
            calls.append((url, params))
            return resp
    return C


@pytest.fixture(autouse=True)
def _reset_upcitemdb():
    upcitemdb._CACHE.clear()
    upcitemdb._state.update(day="", used=0, blocked_until=0.0)
    yield


def test_identify_cleans_title_and_caches(monkeypatch):
    calls = []
    body = {"items": [{"title": "COSRX Advanced Snail 96 Mucin Power Essence 3.38 fl oz", "brand": "COSRX", "images": ["http://x/y.jpg"]}]}
    monkeypatch.setattr(upcitemdb.httpx, "AsyncClient", _fake_client(_Resp(200, body), calls))
    one = asyncio.run(upcitemdb.identify_barcode("8809782558905"))
    two = asyncio.run(upcitemdb.identify_barcode("8809782558905"))
    assert one == two and one["brand"] == "COSRX"
    assert one["name"] == "Advanced Snail 96 Mucin Power Essence"
    assert len(calls) == 1  # second answer came from the cache


def test_identify_backs_off_on_429(monkeypatch):
    calls = []
    monkeypatch.setattr(upcitemdb.httpx, "AsyncClient", _fake_client(_Resp(429), calls))
    assert asyncio.run(upcitemdb.identify_barcode("1111111111116")) is None
    assert asyncio.run(upcitemdb.identify_barcode("2222222222222")) is None
    assert len(calls) == 1  # blocked for the next hour, no more calls


def test_identify_stops_at_the_daily_budget(monkeypatch):
    calls = []
    monkeypatch.setattr(upcitemdb, "DAILY_BUDGET", 2)
    monkeypatch.setattr(upcitemdb.httpx, "AsyncClient", _fake_client(_Resp(200, {"items": []}), calls))
    for code in ("1000000000001", "1000000000002", "1000000000003"):
        asyncio.run(upcitemdb.identify_barcode(code))
    assert len(calls) == 2


# ---------------------------------------------------------------- candidates + unresolved flow
def _pr(barcode, brand, name):
    return ProductResult(barcode=barcode, brand=brand, name=name, found=True)


def _fake_search(rows):
    async def search(q, profile=None, page=1, page_size=12, sort="name"):
        from app.models.product import ProductSearchResponse
        return ProductSearchResponse(query=q, count=len(rows), total_count=len(rows), page=1, page_size=page_size, results=rows)
    return search


def test_candidates_rank_by_name_overlap_and_respect_brand(monkeypatch):
    rows = [
        _pr("1", "COSRX", "Advanced Snail 96 Mucin Power Essence"),
        _pr("2", "COSRX", "Low pH Good Morning Gel Cleanser"),
        _pr("3", "Other", "Advanced Snail 96 Mucin Power Essence"),
    ]
    monkeypatch.setattr(catalog, "catalog_search_products", _fake_search(rows))
    out = asyncio.run(catalog.find_candidates("COSRX", "Advanced Snail 96 Mucin Power Essence 100ml"))
    assert [c.barcode for c in out] == ["1"]            # wrong brand and weak match dropped
    assert out[0].match == 1.0


def test_unknown_barcode_returns_identity_and_candidates(monkeypatch):
    async def none_(*a, **k): return None
    async def obf_miss(*a, **k): return ProductResult(barcode="8809782558905", found=False)
    async def ident(code): return {"name": "Advanced Snail 96 Mucin Power Essence", "brand": "COSRX", "image_url": "http://x/i.jpg"}
    monkeypatch.setattr(catalog, "lookup_in_catalog", none_)
    monkeypatch.setattr(catalog, "lookup_obf", obf_miss)
    monkeypatch.setattr(catalog, "lookup_barcodenest", none_)
    monkeypatch.setattr(catalog, "identify_barcode", ident)
    monkeypatch.setattr(catalog, "catalog_search_products", _fake_search([_pr("9", "COSRX", "Advanced Snail 96 Mucin Power Essence")]))
    res = asyncio.run(catalog.lookup_barcode_with_fallback("8809782558905"))
    assert res.found is False
    assert res.identified_brand == "COSRX" and res.image_url == "http://x/i.jpg"
    assert [c.barcode for c in res.candidates] == ["9"]


def test_obf_name_without_ingredients_is_used_as_identity(monkeypatch):
    async def none_(*a, **k): return None
    async def obf_named(*a, **k): return ProductResult(barcode="1", found=True, name="Foaming Cleanser", brand="CeraVe")
    async def boom(code): raise AssertionError("should not need UPCitemdb: OBF already named it")
    monkeypatch.setattr(catalog, "lookup_in_catalog", none_)
    monkeypatch.setattr(catalog, "lookup_obf", obf_named)
    monkeypatch.setattr(catalog, "lookup_barcodenest", none_)
    monkeypatch.setattr(catalog, "identify_barcode", boom)
    monkeypatch.setattr(catalog, "catalog_search_products", _fake_search([]))
    res = asyncio.run(catalog.lookup_barcode_with_fallback("3606000537750"))
    assert not res.found and res.identified_name == "Foaming Cleanser" and res.identified_brand == "CeraVe"
