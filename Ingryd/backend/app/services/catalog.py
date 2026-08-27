from app.models.product import ProductResult, ProductSearchResponse, SkinProfile
from app.services.scoring import score_ingredients
from app.services.supabase_client import get_supabase
from app.services.normalize import normalize_full_ingredients_text
from app.services.quality_gate import is_skin_relevant, passes_quality_gate
from app.services.open_beauty_facts import lookup_barcode as lookup_obf
from app.services.barcodenest import lookup_barcodenest


def _extract_ingredient_name(item) -> str | None:
    """Confirmed shape (verified against a real product_full row): each item
    is {"position": int, "inci_name": str, "ingredient_id": uuid}."""
    if isinstance(item, dict):
        return item.get("inci_name")
    if isinstance(item, str):  # defensive fallback, shouldn't happen in practice
        return item
    return None


def _row_to_result(row: dict, profile: SkinProfile | None) -> ProductResult:
    raw_ingredients = row.get("ingredients_ordered") or []
    if not isinstance(raw_ingredients, list):
        raw_ingredients = []
    ingredients_parsed = [n for n in (_extract_ingredient_name(i) for i in raw_ingredients) if n]
    ingredients_text = ", ".join(ingredients_parsed)
    scored = score_ingredients(ingredients_parsed, profile) if ingredients_parsed else None
    return ProductResult(
        barcode=row.get("gtin") or "",
        name=row.get("product_name"),
        brand=row.get("brand"),
        categories=row.get("category"),
        labels=None,
        image_url=None,
        ingredients_text=ingredients_text,
        ingredients_parsed=ingredients_parsed,
        score=scored,
        found=True,
    )


def _row_to_result_safe(row: dict, profile: SkinProfile | None) -> ProductResult | None:
    """Same as _row_to_result, but never raises — one malformed row (bad
    data, an unexpected null, a scoring edge case) shouldn't take down an
    entire search/browse response for every user. Returns None on failure
    so the caller can just skip that row and keep the rest."""
    try:
        return _row_to_result(row, profile)
    except Exception as e:
        print(f"[catalog] Skipping unparseable row (gtin={row.get('gtin')}): {e}")
        return None


async def lookup_in_catalog(gtin: str, profile: SkinProfile | None = None) -> ProductResult | None:
    """Primary lookup: select * from product_full where gtin = $1

    Returns None both on a genuine cache miss AND on any Supabase-side error
    (bad credentials, RLS denial, network issue) — either way, the caller
    falls back to OBF/BarcodeNest rather than the request 500ing outright.
    """
    supabase = get_supabase()
    if supabase is None:
        return None

    try:
        response = supabase.table("product_full").select("*").eq("gtin", gtin).execute()
    except Exception as e:
        print(f"[catalog] Supabase lookup_in_catalog failed: {e}")
        return None

    rows = response.data
    if not rows:
        return None

    row = rows[0]
    return _row_to_result_safe(row, profile)


def normalize_and_gate(
    code: str,
    brand: str | None,
    name: str | None,
    categories_tags: str | None,
    ingredients_text: str | None,
) -> list[str] | None:
    """Runs a live-fetched (OBF/BarcodeNest) product through the same
    normalization + quality-gate + category-allowlist checks the bulk import
    uses, before it's eligible to be written into the catalog. Returns the
    normalized ingredient list if it passes, or None if it should be rejected
    (this is what stops a mis-scanned grocery item from polluting the catalog
    on a live scan, mirroring the bulk-import safeguard)."""
    if not passes_quality_gate(code, brand, name, ingredients_text):
        return None
    if not is_skin_relevant(categories_tags):
        return None
    return normalize_full_ingredients_text(ingredients_text)


CATEGORY_KEYWORDS = [
    ("sunscreen", ["sunscreen", "sun-care", "sun-protection", "spf"]),
    ("cleanser", ["cleanser", "facial-cleanser", "cleansing-milk", "face-wash"]),
    ("exfoliant", ["exfoliant", "peel"]),
    ("toner", ["toner"]),
    ("essence", ["essence"]),
    ("serum", ["serum"]),
    ("ampoule", ["ampoule"]),
    ("mask", ["mask"]),
    ("eye_cream", ["eye-cream", "eye-care"]),
    ("moisturizer", ["moisturizer", "moisturiser", "moisturising-cream", "cream", "lotion"]),
    ("oil", ["face-oil", "facial-oil", "oil"]),
    ("mist", ["mist", "spray"]),
    ("spot_treatment", ["spot-treatment", "acne-treatment"]),
]


def map_to_allowed_category(categories_tags_raw: str | None) -> str:
    """Maps a raw OBF/BarcodeNest category tag string down to one of the
    fixed CHECK-constraint values on products.category. Defaults to
    'uncategorized' rather than guessing — an unrecognized value would fail
    the DB constraint outright on insert."""
    if not categories_tags_raw:
        return "uncategorized"
    tags_lower = categories_tags_raw.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(kw in tags_lower for kw in keywords):
            return category
    return "uncategorized"


def to_gtin14(barcode: str) -> str | None:
    """products.gtin requires exactly 14 digits or NULL (CHECK gtin ~
    '^[0-9]{14}$'). Barcodes come in as 8/12/13/14-digit EAN/UPC codes —
    left-pad with zeros to 14, same as the enrichment scripts do."""
    if not barcode or not barcode.isdigit() or len(barcode) > 14:
        return None
    return barcode.zfill(14)


def _get_or_create_ingredient(supabase, inci_name: str) -> str | None:
    """ingredients.inci_name has a real (non-expression) unique constraint,
    so postgrest's upsert-with-ignore-duplicates targets it correctly."""
    insert_result = (
        supabase.table("ingredients")
        .upsert(
            {"inci_name": inci_name, "common_aliases": [], "source_refs": ["ingryd_live_scan"]},
            on_conflict="inci_name",
            ignore_duplicates=True,
        )
        .execute()
    )
    if insert_result.data:
        return insert_result.data[0]["ingredient_id"]

    # Conflict happened (row already existed, ignored) — fetch its real id.
    existing = (
        supabase.table("ingredients")
        .select("ingredient_id")
        .eq("inci_name", inci_name)
        .limit(1)
        .execute()
    )
    return existing.data[0]["ingredient_id"] if existing.data else None


def _get_or_create_product(supabase, gtin14: str | None, brand: str, name: str, category: str, ingredients_raw: str | None) -> str | None:
    """products' real unique constraints are a partial index on gtin and an
    EXPRESSION index on (lower(brand), lower(product_name)) — postgrest's
    upsert can't target an expression index (ON CONFLICT must match the
    index definition exactly), so this does an explicit select-then-insert
    instead of relying on upsert conflict semantics for the name/brand path.
    """
    if gtin14:
        existing = supabase.table("products").select("product_id").eq("gtin", gtin14).limit(1).execute()
        if existing.data:
            return existing.data[0]["product_id"]

    # .ilike(col, value) with no wildcard chars in value behaves as an exact
    # case-insensitive match — matches the lower(brand)/lower(product_name)
    # index semantics without needing raw SQL.
    existing = (
        supabase.table("products")
        .select("product_id")
        .ilike("brand", brand)
        .ilike("product_name", name)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["product_id"]

    inserted = (
        supabase.table("products")
        .insert({
            "gtin": gtin14,
            "brand": brand,
            "product_name": name,
            "category": category,
            "ingredients_raw": ingredients_raw,
            "sources": ["ingryd_live_scan"],
            "confidence_score": 0.5,  # live-fetched + gated, not bulk-verified
        })
        .execute()
    )
    return inserted.data[0]["product_id"] if inserted.data else None


def write_back_to_catalog(
    gtin: str,
    brand: str | None,
    name: str | None,
    category: str | None,
    ingredients: list[str],
    ingredients_raw: str | None,
) -> bool:
    """Writes a newly-fetched, normalized, quality-gated product into the
    catalog (products/ingredients/product_ingredients), so future scans of
    the same barcode hit the fast Supabase path instead of re-fetching.
    """
    supabase = get_supabase()
    if supabase is None or not brand or not name:
        return False

    gtin14 = to_gtin14(gtin)
    mapped_category = map_to_allowed_category(category)

    try:
        product_id = _get_or_create_product(supabase, gtin14, brand, name, mapped_category, ingredients_raw)
        if not product_id:
            return False

        for position, ingredient_name in enumerate(ingredients, start=1):
            ingredient_id = _get_or_create_ingredient(supabase, ingredient_name)
            if not ingredient_id:
                continue
            supabase.table("product_ingredients").upsert(
                {"product_id": product_id, "ingredient_id": ingredient_id, "position": position},
                on_conflict="product_id,ingredient_id,position",
                ignore_duplicates=True,
            ).execute()

        return True
    except Exception:
        # Write-back is a nice-to-have on the live-fallback path — the user
        # already has their scored result regardless. Never let a
        # catalog-write failure turn into a 500 for that person.
        return False


async def lookup_barcode_with_fallback(gtin: str, profile: SkinProfile | None = None) -> ProductResult:
    """The full pipeline: Supabase catalog first (fast, trusted) -> OBF ->
    BarcodeNest -> normalize -> quality-gate -> write back -> return.
    """
    # 1. Primary: Supabase catalog
    cached = await lookup_in_catalog(gtin, profile)
    if cached is not None:
        return cached

    # 2. Fallback: OBF (called with no profile — we rescore after normalizing,
    # rather than trust OBF's own ingredient parsing/scoring)
    obf_result = await lookup_obf(gtin, profile=None)

    name = obf_result.name if obf_result.found else None
    brand = obf_result.brand if obf_result.found else None
    categories = obf_result.categories if obf_result.found else None
    image_url = obf_result.image_url if obf_result.found else None
    ingredients_text = obf_result.ingredients_text if obf_result.found else None

    # 3. Fallback: BarcodeNest, only for whatever OBF didn't supply
    if not ingredients_text:
        bn = await lookup_barcodenest(gtin)
        if bn:
            name = name or bn.get("name")
            brand = brand or bn.get("brand")
            categories = categories or bn.get("categories_tags")
            ingredients_text = bn.get("ingredients_text")

    if not ingredients_text:
        # Nothing anywhere had usable ingredient data.
        return ProductResult(barcode=gtin, found=False)

    # 4. Normalize + quality-gate + category-allowlist before trusting this
    # data at all — same safeguard the bulk import uses, applied here so a
    # mis-scanned grocery item can't pollute the catalog on a live scan.
    normalized = normalize_and_gate(gtin, brand, name, categories, ingredients_text)
    if normalized is None:
        return ProductResult(barcode=gtin, found=False)

    # 5. Write back so the next scan of this barcode hits the fast path.
    write_back_to_catalog(gtin, brand, name, categories, normalized, ingredients_text)

    scored = score_ingredients(normalized, profile)
    return ProductResult(
        barcode=gtin,
        name=name,
        brand=brand,
        categories=categories,
        labels=None,
        image_url=image_url,
        ingredients_text=", ".join(normalized),
        ingredients_parsed=normalized,
        score=scored,
        found=True,
    )


async def catalog_search_products(
    query: str,
    profile: SkinProfile | None = None,
    page: int = 1,
    page_size: int = 12,
    sort: str = "name",
) -> ProductSearchResponse:
    """Search the Supabase catalog by product name or brand (case-insensitive
    partial match on either field). sort='name' paginates at the database
    level (fast, exact total count from postgrest). sort='score' has to
    fetch all matches and score them in Python first, since score depends on
    the (optionally personalized) scoring engine rather than being a stored
    column — fine at this catalog's size (~3k products).
    """
    supabase = get_supabase()
    empty = lambda: ProductSearchResponse(query=query, count=0, total_count=0, page=page, page_size=page_size, results=[])
    if supabase is None:
        return empty()

    filter_str = f"product_name.ilike.%{query}%,brand.ilike.%{query}%"

    if sort == "score":
        try:
            response = supabase.table("product_full").select("*").or_(filter_str).limit(3500).execute()
        except Exception as e:
            print(f"[catalog] Supabase search failed: {e}")
            return empty()

        all_results = [r for r in (_row_to_result_safe(row, profile) for row in response.data) if r is not None]
        all_results.sort(key=_sort_key, reverse=True)
        total = len(all_results)
        start = (page - 1) * page_size
        page_results = all_results[start:start + page_size]
        return ProductSearchResponse(query=query, count=len(page_results), total_count=total, page=page, page_size=page_size, results=page_results)

    start = (page - 1) * page_size
    end = start + page_size - 1
    try:
        response = (
            supabase.table("product_full")
            .select("*", count="exact")
            .or_(filter_str)
            .order("product_name")
            .range(start, end)
            .execute()
        )
    except Exception as e:
        print(f"[catalog] Supabase search failed: {e}")
        return empty()

    results = [r for r in (_row_to_result_safe(row, profile) for row in response.data) if r is not None]
    total = response.count if response.count is not None else len(results)
    return ProductSearchResponse(query=query, count=len(results), total_count=total, page=page, page_size=page_size, results=results)


def _sort_key(r: ProductResult):
    if r.score is None:
        return -1
    return r.score.fit_score if r.score.fit_score is not None else r.score.score


async def catalog_browse_products(
    profile: SkinProfile | None = None,
    page: int = 1,
    page_size: int = 30,
    sort: str = "name",
) -> ProductSearchResponse:
    """Product list for the Search page's default view. sort='name' (default)
    paginates at the database level with an exact total count. sort='score'
    fetches the whole catalog, scores each product, sorts, then slices the
    requested page — score isn't a stored column (and Fit Score depends on
    the viewer's own profile), so it can't be sorted at the DB level, but the
    catalog is small enough (~3k products) that doing this in Python per
    request is fine.
    """
    supabase = get_supabase()
    empty = lambda: ProductSearchResponse(query="", count=0, total_count=0, page=page, page_size=page_size, results=[])
    if supabase is None:
        return empty()

    if sort == "score":
        try:
            response = supabase.table("product_full").select("*").limit(3500).execute()
        except Exception as e:
            print(f"[catalog] Supabase browse failed: {e}")
            return empty()

        all_results = [r for r in (_row_to_result_safe(row, profile) for row in response.data) if r is not None]
        all_results.sort(key=_sort_key, reverse=True)
        total = len(all_results)
        start = (page - 1) * page_size
        page_results = all_results[start:start + page_size]
        return ProductSearchResponse(query="", count=len(page_results), total_count=total, page=page, page_size=page_size, results=page_results)

    start = (page - 1) * page_size
    end = start + page_size - 1
    try:
        response = (
            supabase.table("product_full")
            .select("*", count="exact")
            .order("product_name")
            .range(start, end)
            .execute()
        )
    except Exception as e:
        print(f"[catalog] Supabase browse failed: {e}")
        return empty()

    results = [r for r in (_row_to_result_safe(row, profile) for row in response.data) if r is not None]
    total = response.count if response.count is not None else len(results)
    return ProductSearchResponse(query="", count=len(results), total_count=total, page=page, page_size=page_size, results=results)
