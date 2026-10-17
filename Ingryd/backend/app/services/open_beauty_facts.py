import asyncio
import httpx
from app.services.barcodes import barcode_forms
from app.models.product import ProductResult, SkinProfile
from app.services.scoring import score_ingredients

OBF_BASE = "https://world.openbeautyfacts.org/api/v2/product"
HEADERS = {"User-Agent": "Ingryd/1.0 (contact@ingryd.app)"}


def _parse_ingredients_text(raw: str) -> list[str]:
    """Extract individual ingredient names from a raw ingredient string."""
    import re

    # Remove percentages, asterisks, footnote markers, and bracketed sub-lists
    cleaned = re.sub(r"\*+", "", raw)
    cleaned = re.sub(r"\d+(\.\d+)?%", "", cleaned)
    cleaned = re.sub(r"\(may contain:?[^)]*\)", "", cleaned, flags=re.IGNORECASE)

    # Split on comma or semicolon
    parts = re.split(r"[,;]", cleaned)
    result = []
    for part in parts:
        name = part.strip().strip(".").strip()
        if name and len(name) > 1:
            result.append(name)
    return result


def _to_result(barcode: str, product: dict, profile: SkinProfile | None) -> ProductResult:
    ingredients_text: str = product.get("ingredients_text", "") or ""
    ingredients_parsed = _parse_ingredients_text(ingredients_text) if ingredients_text else []
    scored = score_ingredients(ingredients_parsed, profile) if ingredients_parsed else None
    return ProductResult(
        barcode=barcode,
        name=product.get("product_name") or product.get("product_name_en"),
        brand=product.get("brands"),
        categories=product.get("categories"),
        labels=product.get("labels"),
        image_url=product.get("image_front_url") or product.get("image_url"),
        ingredients_text=ingredients_text,
        ingredients_parsed=ingredients_parsed,
        score=scored,
        found=True,
    )


async def _fetch_one(client: httpx.AsyncClient, code: str) -> dict | None:
    try:
        response = await client.get(f"{OBF_BASE}/{code}.json", headers=HEADERS)
    except httpx.RequestError:
        return None
    if response.status_code != 200:
        return None
    try:
        data = response.json()
    except ValueError:
        return None
    if data.get("status") == 0 or "product" not in data:
        return None
    return data["product"]


async def lookup_barcode(barcode: str, profile: SkinProfile | None = None) -> ProductResult:
    """Open Beauty Facts stores UPCs as EAN-13 (leading zero), so a scanned
    12-digit UPC can miss if we only ask for it as written. Ask for every
    equivalent written form at once and keep the best hit (one with ingredients)."""
    forms = [f for f in barcode_forms(barcode) if len(f) in (8, 12, 13)]
    if barcode not in forms:
        forms.insert(0, barcode)
    async with httpx.AsyncClient(timeout=10.0) as client:
        products = await asyncio.gather(*(_fetch_one(client, f) for f in forms))
    hits = [(f, p) for f, p in zip(forms, products) if p]
    if not hits:
        return ProductResult(barcode=barcode, found=False)
    best = next((h for h in hits if h[1].get("ingredients_text")), hits[0])
    return _to_result(barcode, best[1], profile)
