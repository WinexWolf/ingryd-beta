import httpx
from app.models.product import ProductResult, ProductSearchResponse, SkinProfile
from app.services.open_beauty_facts import _parse_ingredients_text, HEADERS
from app.services.scoring import score_ingredients

SEARCH_URL = "https://world.openbeautyfacts.org/cgi/search.pl"


async def search_products(query: str, profile: SkinProfile | None = None, page_size: int = 12) -> ProductSearchResponse:
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": page_size,
        "fields": "code,product_name,brands,categories,labels,image_front_url,image_url,ingredients_text",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(SEARCH_URL, params=params, headers=HEADERS)

    if response.status_code != 200:
        return ProductSearchResponse(query=query, count=0, results=[])

    data = response.json()
    products = data.get("products", [])

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

    return ProductSearchResponse(query=query, count=len(results), results=results)
