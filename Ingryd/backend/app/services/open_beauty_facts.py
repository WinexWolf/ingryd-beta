import httpx
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


async def lookup_barcode(barcode: str, profile: SkinProfile | None = None) -> ProductResult:
    url = f"{OBF_BASE}/{barcode}.json"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=HEADERS)

    if response.status_code != 200:
        return ProductResult(barcode=barcode, found=False)

    data = response.json()
    if data.get("status") == 0 or "product" not in data:
        return ProductResult(barcode=barcode, found=False)

    product = data["product"]

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
