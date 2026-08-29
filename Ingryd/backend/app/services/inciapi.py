import os
import httpx

INCIAPI_KEY = os.environ.get("INCIAPI_KEY")
INCIAPI_BASE_URL = "https://inciapi.com"


async def lookup_inciapi_by_barcode(barcode: str) -> dict | None:
    """Enrichment source, not a primary lookup — called when we already have
    a product (from our catalog, OBF, or BarcodeNest) and want to layer on
    per-ingredient function tags, pregnancy-safety, and a second, sourced
    safety score for transparency.

    NOTE: shape below matches INCI API's own documented example response.
    That's unconfirmed against a real live call (this sandbox can't reach
    inciapi.com — same restriction as every other external API in this
    build) — verify on a real deploy before fully trusting field names.
    """
    if not INCIAPI_KEY:
        return None

    url = f"{INCIAPI_BASE_URL}/v1/products/{barcode}/safety"
    headers = {"X-API-Key": INCIAPI_KEY}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError:
        return None

    if response.status_code != 200:
        return None

    return response.json()


async def analyze_inci_text(ingredients: list[str]) -> dict | None:
    """Analyze a raw ingredient list directly (no barcode needed) — this is
    the path an OCR pipeline would use: extract text from a label photo,
    split it into a list, hand it here for function/safety/allergen data.
    Also useful right now for any product whose ingredients we already have
    but that INCI API doesn't recognize by barcode.
    """
    if not INCIAPI_KEY:
        return None

    url = f"{INCIAPI_BASE_URL}/v1/analyze"
    headers = {"X-API-Key": INCIAPI_KEY, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json={"ingredients": ingredients})
    except httpx.RequestError:
        return None

    if response.status_code != 200:
        return None

    return response.json()


def extract_functions_map(inciapi_response: dict) -> dict[str, list[str]]:
    """Returns {ingredient_name_lower: [functions]} from an INCI API response,
    so callers can look up function tags per ingredient by name."""
    result: dict[str, list[str]] = {}
    for ing in inciapi_response.get("ingredients", []):
        name = ing.get("inciName")
        functions = ing.get("functions")
        if name and functions:
            result[name.lower()] = functions
    return result


def extract_pregnancy_safety(inciapi_response: dict) -> tuple[bool | None, list[str]]:
    """Returns (is_pregnancy_safe, concerning_ingredient_names)."""
    overall = inciapi_response.get("pregnancySafe")
    concerns = [
        ing.get("inciName")
        for ing in inciapi_response.get("ingredients", [])
        if ing.get("isPregnancySafe") is False and ing.get("inciName")
    ]
    return overall, concerns
