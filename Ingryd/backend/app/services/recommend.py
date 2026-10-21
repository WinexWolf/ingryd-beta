"""Ranks the catalog against a user's profile + latest scan.

The catalog (~3k products) is loaded once and kept in memory for a few minutes, so a
recommendation request is just scoring in Python. Results are cached per profile.
"""
import json
import time

from app.models.product import (
    AlternativesRequest, AlternativesResponse, RecommendGroup, RecommendResponse,
    RecommendedProduct, SkinProfile,
)
from app.services.categorize import infer_category
from app.services.scoring import score_ingredients
from app.services.supabase_client import get_supabase
from app.services.concerns import APP_CONCERN_KEYS

ROWS_TTL_S = 600
RESULT_TTL_S = 300
MIN_INGREDIENTS = 5        # fewer than this is almost always a bad import
MIN_FIT = 55               # never recommend something that scores poorly for the user
PER_BRAND = 2              # keep a list from being five products from one brand
GROUP_ORDER = ["cleanser", "serum", "moisturizer", "sunscreen", "eye_cream", "exfoliant",
               "toner", "essence", "spot_treatment", "mask", "ampoule", "oil", "mist"]
GROUP_LABEL = {
    "cleanser": "Cleansers", "serum": "Serums", "moisturizer": "Moisturizers", "sunscreen": "Sunscreens",
    "eye_cream": "Eye care", "exfoliant": "Exfoliants", "toner": "Toners", "essence": "Essences",
    "spot_treatment": "Spot treatments", "mask": "Masks", "ampoule": "Ampoules", "oil": "Face oils", "mist": "Mists",
}
# A flagged concern moves the product types that tackle it to the front.
CONCERN_CATEGORIES = {
    "acne": ["spot_treatment", "exfoliant", "serum"],
    "texture": ["exfoliant", "serum"],
    "dark circles": ["eye_cream"],
    "hyperpigmentation": ["serum"],
    "aging": ["serum", "eye_cream"],
    "dryness": ["moisturizer", "serum"],
    "redness": ["serum", "moisturizer"],
}

_rows: dict = {"t": 0.0, "data": None}
_results: dict[str, tuple[float, object]] = {}


# ------------------------------------------------------------------ catalog
def _ingredient_names(raw) -> list[str]:
    out = []
    for item in raw if isinstance(raw, list) else []:
        name = item.get("inci_name") if isinstance(item, dict) else item if isinstance(item, str) else None
        if name:
            out.append(name)
    return out


def _fetch_rows() -> list[dict]:
    """All catalog rows, in pages (Supabase caps a single response at 1000 rows)."""
    sb = get_supabase()
    if sb is None:
        return []
    rows: list[dict] = []
    start = 0
    while True:
        resp = (sb.table("product_full")
                .select("gtin,product_name,brand,category,ingredients_ordered")
                .order("gtin").range(start, start + 999).execute())
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < 1000:
            break
        start += 1000
    return rows


def load_catalog() -> list[dict]:
    if _rows["data"] is not None and time.time() - _rows["t"] < ROWS_TTL_S:
        return _rows["data"]
    try:
        raw = _fetch_rows()
    except Exception as e:  # keep serving the old copy if Supabase hiccups
        print(f"[recommend] catalog load failed: {e}")
        return _rows["data"] or []
    data = []
    for r in raw:
        ings = _ingredient_names(r.get("ingredients_ordered"))
        if len(ings) >= MIN_INGREDIENTS and r.get("product_name"):
            cat = r.get("category") or "uncategorized"
            if cat == "uncategorized":
                cat = infer_category(r["product_name"], ings)
            data.append({"barcode": r.get("gtin") or "", "name": r["product_name"],
                         "brand": r.get("brand"), "category": cat, "ings": ings})
    _rows.update(t=time.time(), data=data)
    return data


def clear_cache() -> None:
    _rows.update(t=0.0, data=None)
    _results.clear()


# ----------------------------------------------------------------- ranking
def _has_profile(p: SkinProfile | None) -> bool:
    return bool(p and (p.skin_type or p.concerns or p.sensitivities or p.concern_scores))


def _reasons(score) -> tuple[list[str], list[str]]:
    """Why it fits / what to watch, from the scoring engine's own personal notes."""
    pos = sorted((n for n in score.personal_notes if n.adjustment > 0), key=lambda n: -n.adjustment)
    neg = sorted((n for n in score.personal_notes if n.adjustment < 0), key=lambda n: n.adjustment)
    reasons, seen = [], set()
    for n in pos:
        text = f"{n.ingredient}: {n.reason}"
        if text not in seen:
            seen.add(text)
            reasons.append(text)
    if not reasons and score.beneficial:
        reasons.append("Contains " + ", ".join(f.name for f in score.beneficial[:3]))
    cautions = [f"{n.ingredient}: {n.reason}" for n in neg[:2]]
    return reasons[:3], cautions


def _rank(profile: SkinProfile | None, category: str | None = None, exclude: set[str] | None = None,
          min_fit: int = MIN_FIT) -> list[RecommendedProduct]:
    exclude = exclude or set()
    out: list[RecommendedProduct] = []
    for row in load_catalog():
        if category and row["category"] != category:
            continue
        if row["barcode"] and row["barcode"] in exclude:
            continue
        try:
            s = score_ingredients(row["ings"], profile)
        except Exception:
            continue
        fit = s.fit_score if s.fit_score is not None else s.score
        if fit < min_fit or s.prohibited:
            continue
        reasons, cautions = _reasons(s)
        out.append(RecommendedProduct(
            barcode=row["barcode"], name=row["name"], brand=row["brand"], category=row["category"],
            score=s.score, fit_score=fit, fit_grade=s.fit_grade or s.grade,
            reasons=reasons, cautions=cautions, ingredients_parsed=row["ings"],
        ))
    out.sort(key=lambda p: (-p.fit_score, -len(p.reasons), p.name or ""))
    return out


def _diversify(items: list[RecommendedProduct], n: int) -> list[RecommendedProduct]:
    picked, brands, names = [], {}, set()
    for p in items:
        key = ((p.brand or "").lower(), (p.name or "").lower())
        if key in names or brands.get((p.brand or "").lower(), 0) >= PER_BRAND:
            continue
        names.add(key)
        brands[(p.brand or "").lower()] = brands.get((p.brand or "").lower(), 0) + 1
        picked.append(p)
        if len(picked) == n:
            break
    return picked


def _cached(key: str, build):
    hit = _results.get(key)
    if hit and time.time() - hit[0] < RESULT_TTL_S:
        return hit[1]
    value = build()
    if len(_results) > 200:
        _results.clear()
    _results[key] = (time.time(), value)
    return value


def _group_order(profile: SkinProfile | None) -> list[str]:
    front: list[str] = []
    if profile:
        scan = profile.concern_scores or {}
        wanted = [c for c in profile.concerns if c in CONCERN_CATEGORIES]
        # most severe first when we have scan numbers
        wanted.sort(key=lambda c: min((scan.get(k, 100) for k in APP_CONCERN_KEYS.get(c, [])), default=100))
        for c in wanted:
            for cat in CONCERN_CATEGORIES[c]:
                if cat not in front:
                    front.append(cat)
    return front + [c for c in GROUP_ORDER if c not in front]


def recommend(profile: SkinProfile | None, groups: int = 4, per_group: int = 3, top_n: int = 3) -> RecommendResponse:
    key = "rec:" + json.dumps([profile.model_dump() if profile else None, groups, per_group, top_n], sort_keys=True)

    def build() -> RecommendResponse:
        catalog = load_catalog()
        ranked = _rank(profile)
        by_cat: dict[str, list[RecommendedProduct]] = {}
        for p in ranked:
            by_cat.setdefault(p.category or "uncategorized", []).append(p)
        built: list[RecommendGroup] = []
        for cat in _group_order(profile):
            picks = _diversify(by_cat.get(cat, []), per_group)
            if picks:
                built.append(RecommendGroup(category=cat, label=GROUP_LABEL.get(cat, cat.title()), picks=picks))
            if len(built) == groups:
                break
        return RecommendResponse(
            personalized=_has_profile(profile), top=_diversify(ranked, top_n), groups=built, catalog_size=len(catalog),
        )

    return _cached(key, build)


# ------------------------------------------------------------ alternatives
def _find_category(req: AlternativesRequest) -> str | None:
    if req.barcode:
        for row in load_catalog():
            if row["barcode"] == req.barcode:
                return row["category"]
    if req.category and req.category not in GROUP_LABEL:
        from app.services.catalog import map_to_allowed_category  # raw Open Beauty Facts tags
        return map_to_allowed_category(req.category)
    return req.category


def alternatives(req: AlternativesRequest) -> AlternativesResponse:
    profile = req.profile
    category = _find_category(req)
    if not category or category == "uncategorized":
        return AlternativesResponse(category=category, picks=[], message="We can't tell what type of product this is, so we can't suggest a like-for-like swap.")

    current_fit = req.current_fit
    current_ings = req.ingredients
    if current_fit is None and current_ings:
        s = score_ingredients(current_ings, profile)
        current_fit = s.fit_score if s.fit_score is not None else s.score
    if not current_ings and req.barcode:
        current_ings = next((r["ings"] for r in load_catalog() if r["barcode"] == req.barcode), [])

    bad = set()
    if current_ings:
        cs = score_ingredients(current_ings, profile)
        bad = {n.ingredient.lower() for n in cs.personal_notes if n.adjustment < 0}

    ranked = _rank(profile, category=category, exclude={req.barcode} if req.barcode else set(),
                   min_fit=max(MIN_FIT, (current_fit or 0) + 1))
    picks = _diversify(ranked, max(1, min(req.limit, 6)))
    for p in picks:
        p.delta = p.fit_score - current_fit if current_fit is not None else None
        p.avoids = sorted(i for i in bad if i not in {x.lower() for x in p.ingredients_parsed})[:3]

    msg = None
    if not picks:
        msg = "Nothing in our catalog scores higher for you in this category — this is already a strong pick."
    return AlternativesResponse(category=category, current_fit=current_fit, picks=picks, message=msg)
