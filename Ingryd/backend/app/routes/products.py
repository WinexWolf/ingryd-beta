from fastapi import APIRouter, HTTPException, Query
from app.services.open_beauty_facts import lookup_barcode
from app.services.product_search import search_products, browse_products
from app.models.product import ProductResult, ProductSearchResponse, SkinProfile

router = APIRouter(prefix="/products", tags=["products"])


def _build_profile(
    skin_type: str | None,
    concerns: str | None,
    sensitivities: str | None,
) -> SkinProfile | None:
    if not skin_type and not concerns and not sensitivities:
        return None
    return SkinProfile(
        skin_type=skin_type,
        concerns=[c.strip() for c in concerns.split(",") if c.strip()] if concerns else [],
        sensitivities=[s.strip() for s in sensitivities.split(",") if s.strip()] if sensitivities else [],
    )


@router.get("/barcode/{barcode}", response_model=ProductResult)
async def get_product_by_barcode(
    barcode: str,
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
):
    if not barcode.isdigit() or len(barcode) not in (8, 12, 13, 14):
        raise HTTPException(status_code=400, detail="Invalid barcode format. Must be EAN-8, UPC-A, or EAN-13.")
    profile = _build_profile(skin_type, concerns, sensitivities)
    result = await lookup_barcode(barcode, profile)
    return result


@router.get("/search", response_model=ProductSearchResponse)
async def search(
    q: str = Query(..., min_length=2, description="Product name or brand to search for"),
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
):
    profile = _build_profile(skin_type, concerns, sensitivities)
    return await search_products(q, profile)


@router.get("/browse", response_model=ProductSearchResponse)
async def browse(
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
):
    profile = _build_profile(skin_type, concerns, sensitivities)
    return await browse_products(profile=profile)
