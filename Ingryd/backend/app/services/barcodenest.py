import os
import httpx

BARCODENEST_BASE_URL = os.environ.get("BARCODENEST_BASE_URL")  # e.g. "https://api.barcodenest.com"
BARCODENEST_API_KEY = os.environ.get("BARCODENEST_API_KEY")


async def lookup_barcodenest(barcode: str) -> dict | None:
    """Secondary fallback after OBF. Returns the raw product dict on a hit,
    None on miss/error/not-configured.

    NOTE: field names below match BarcodeNest's own documented example
    response, but that's explicitly unconfirmed against a real live response
    (per the spec this was built from). Validate against an actual API call
    before trusting this in production — if their real response shape
    differs, the .get() calls below will just silently return None for
    missing fields rather than crash, but the mapping may need adjusting.
    """
    if not BARCODENEST_BASE_URL or not BARCODENEST_API_KEY:
        return None

    url = f"{BARCODENEST_BASE_URL}/v1/products/{barcode}"
    headers = {"X-API-Key": BARCODENEST_API_KEY}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError:
        return None

    if response.status_code == 404:
        return None
    if response.status_code != 200:
        return None

    data = response.json()
    if not data.get("found"):
        return None

    product = data.get("product", {})
    return {
        "barcode": data.get("canonical_gtin") or data.get("barcode") or barcode,
        "name": product.get("name"),
        "brand": product.get("brand"),
        # BarcodeNest's documented example doesn't show an ingredients field
        # at all — only name/brand/quantity/allergens. If their real response
        # has no ingredient data, this source can confirm a product exists
        # but can't pass the quality gate (which requires ingredients_text),
        # so it likely can't be used for write-back on its own.
        "ingredients_text": product.get("ingredients_text"),
        "categories_tags": product.get("categories_tags"),
    }
