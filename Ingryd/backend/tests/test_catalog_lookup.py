"""Barcode lookup must find catalog rows stored as 14-digit GTINs, and search/suggest must survive odd input."""
import asyncio

from app.services import catalog


class _Resp:
    def __init__(self, data): self.data = data; self.count = len(data)


class _Query:
    def __init__(self, rows, log): self.rows, self.log = rows, log
    def select(self, *a, **k): return self
    def in_(self, col, vals): self.log.append(("in", col, list(vals))); self.rows = [r for r in self.rows if r[col] in vals]; return self
    def eq(self, col, val): self.log.append(("eq", col, val)); self.rows = [r for r in self.rows if r[col] == val]; return self
    def or_(self, f): self.log.append(("or", f)); return self
    def order(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def execute(self): return _Resp(self.rows)


class _Sb:
    def __init__(self, rows): self.rows, self.log = rows, []
    def table(self, name): return _Query(list(self.rows), self.log)


ROW = {"gtin": "03606000537750", "product_name": "Foaming Cleanser", "brand": "CeraVe",
       "category": "cleanser", "ingredients_ordered": [{"inci_name": "Aqua"}, {"inci_name": "Glycerin"}, {"inci_name": "Niacinamide"},
                                                      {"inci_name": "Ceramide NP"}, {"inci_name": "Sodium Lauroyl Sarcosinate"}]}


def test_13_digit_ean_finds_14_digit_catalog_row(monkeypatch):
    sb = _Sb([ROW])
    monkeypatch.setattr(catalog, "get_supabase", lambda: sb)
    res = asyncio.run(catalog.lookup_in_catalog("3606000537750"))
    assert res is not None and res.name == "Foaming Cleanser"


def test_already_14_digit_still_works(monkeypatch):
    monkeypatch.setattr(catalog, "get_supabase", lambda: _Sb([ROW]))
    assert asyncio.run(catalog.lookup_in_catalog("03606000537750")) is not None


def test_clean_query_removes_postgrest_breakers():
    assert "," not in catalog.clean_query("cerave, cleanser")
    assert "(" not in catalog.clean_query("a(b)")
    assert "L'Oreal" in catalog.clean_query("L'Oreal")


def test_suggest_ranks_prefix_first_and_dedupes(monkeypatch):
    rows = [{"gtin": "1", "product_name": "Hydrating Cerave Lotion", "brand": "X"},
            {"gtin": "2", "product_name": "Cerave Cleanser", "brand": "CeraVe"},
            {"gtin": "3", "product_name": "Cerave Cleanser", "brand": "CeraVe"}]
    catalog._SUGGEST_CACHE.clear()
    monkeypatch.setattr(catalog, "get_supabase", lambda: _Sb(rows))
    out = asyncio.run(catalog.catalog_suggest("cerave"))
    assert out[0]["name"] == "Cerave Cleanser" and len(out) == 2


def test_suggest_short_query_returns_nothing():
    assert asyncio.run(catalog.catalog_suggest("a")) == []
