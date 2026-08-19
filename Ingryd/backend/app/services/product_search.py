import httpx
from app.models.product import ProductResult, ProductSearchResponse, SkinProfile
from app.services.open_beauty_facts import _parse_ingredients_text, HEADERS
from app.services.scoring import score_ingredients

SEARCH_URL = "https://world.openbeautyfacts.org/cgi/search.pl"

RESULT_FIELDS = "code,product_name,brands,categories,labels,image_front_url,image_url,ingredients_text"


def _build_results(products: list[dict], profile: SkinProfile | None) -> list[ProductResult]:
    results: list[ProductResult] = []
    for product in products:
        barcode = product.get("code", "")
        if not barcode:
            continue
        ingredients_text = product.get("ingredients_text", "") or ""
        ingredients_parsed = _parse_ingredients_text(ingredients_text) if ingredients_text else []
        scored = score_ingredients(ingredients_parsed, profile) if ingredients_parsed else None

        results.append(
            ProductResult(
                barcode=barcode,
                name=product.get("product_name"),
                brand=product.get("brands"),
                categories=product.get("categories"),
                labels=product.get("labels"),
                image_url=product.get("image_front_url") or product.get("image_url"),
                ingredients_text=ingredients_text,
                ingredients_parsed=ingredients_parsed,
                score=scored,
                found=True,
            )
        )
    return results


async def search_products(query: str, profile: SkinProfile | None = None, page_size: int = 12) -> ProductSearchResponse:
    # NOTE: search_simple=1 uses OBF's fast tokenized-word matcher, which only matches
    # whole words (e.g. "innis" won't match "innisfree"). Dropping search_simple lets
    # OBF fall back to its fuller-text matching, which handles partial words better.
    # This is based on OBF's documented search.pl behavior — verify on live deploy,
    # since this sandbox can't reach world.openbeautyfacts.org to test directly.
    params = {
        "search_terms": query,
        "action": "process",
        "json": 1,
        "page_size": page_size,
        "fields": RESULT_FIELDS,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(SEARCH_URL, params=params, headers=HEADERS)

    if response.status_code != 200:
        return ProductSearchResponse(query=query, count=0, results=[])

    data = response.json()
    products = data.get("products", [])

    # Fallback: if the exact query returns nothing and it looks like a partial word,
    # retry once with a wildcard-style broadened term.
    if not products and len(query) >= 3:
        async with httpx.AsyncClient(timeout=10.0) as client:
            retry_params = {**params, "search_terms": f"{query}*"}
            response = await client.get(SEARCH_URL, params=retry_params, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])

    results = _build_results(products, profile)
    return ProductSearchResponse(query=query, count=len(results), results=results)


async def browse_products(
    category: str = "skin-care-products",
    profile: SkinProfile | None = None,
    page_size: int = 30,
) -> ProductSearchResponse:
    """Alphabetically-sorted product list for the Search page's default/empty-query view."""
    params = {
        "action": "process",
        "json": 1,
        "sort_by": "product_name",
        "page_size": page_size,
        "tagtype_0": "categories",
        "tag_contains_0": "contains",
        "tag_0": category,
        "fields": RESULT_FIELDS,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(SEARCH_URL, params=params, headers=HEADERS)

    if response.status_code != 200:
        return ProductSearchResponse(query="", count=0, results=[])

    data = response.json()
    products = data.get("products", [])
    results = _build_results(products, profile)
    return ProductSearchResponse(query="", count=len(results), results=results)
