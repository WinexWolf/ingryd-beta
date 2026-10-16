from fastapi import APIRouter, HTTPException, Query
from app.services.catalog import lookup_barcode_with_fallback, catalog_search_products, catalog_browse_products, catalog_suggest
from app.models.product import ProductResult, ProductSearchResponse, SkinProfile
from app.services.concerns import parse_concern_scores
from app.models.product import AlternativesRequest, AlternativesResponse, RecommendResponse
from app.services import recommend as rec
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/products", tags=["products"])


def _build_profile(
    skin_type: str | None,
    concerns: str | None,
    sensitivities: str | None,
    concern_scores: str | None = None,
) -> SkinProfile | None:
    scores = parse_concern_scores(concern_scores)
    if not skin_type and not concerns and not sensitivities and not scores:
        return None
    return SkinProfile(
        concern_scores=scores,
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
    concern_scores: str | None = Query(None, description="Latest scan, e.g. acne:77,pore:73"),
):
    barcode = "".join(ch for ch in barcode if ch.isdigit())
    if len(barcode) not in (8, 12, 13, 14):
        raise HTTPException(status_code=400, detail="That doesn't look like a full barcode. Barcodes have 8, 12 or 13 digits — check for a missing digit.")
    profile = _build_profile(skin_type, concerns, sensitivities, concern_scores)
    result = await lookup_barcode_with_fallback(barcode, profile)
    return result


@router.get("/suggest")
async def suggest(q: str = Query(..., min_length=2, max_length=60)):
    """Type-ahead suggestions for any product search box."""
    return {"suggestions": await catalog_suggest(q)}


@router.get("/search", response_model=ProductSearchResponse)
async def search(
    q: str = Query(..., min_length=2, description="Product name or brand to search for"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    sort: str = Query("name", pattern="^(name|score)$"),
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
    concern_scores: str | None = Query(None, description="Latest scan, e.g. acne:77,pore:73"),
):
    profile = _build_profile(skin_type, concerns, sensitivities, concern_scores)
    return await catalog_search_products(q, profile, page=page, page_size=page_size, sort=sort)


@router.get("/browse", response_model=ProductSearchResponse)
async def browse(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    sort: str = Query("name", pattern="^(name|score)$"),
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
    concern_scores: str | None = Query(None, description="Latest scan, e.g. acne:77,pore:73"),
):
    profile = _build_profile(skin_type, concerns, sensitivities, concern_scores)
    return await catalog_browse_products(profile=profile, page=page, page_size=page_size, sort=sort)


@router.get("/recommend", response_model=RecommendResponse)
async def recommend(
    skin_type: str | None = Query(None),
    concerns: str | None = Query(None, description="Comma-separated concerns"),
    sensitivities: str | None = Query(None, description="Comma-separated sensitivities"),
    concern_scores: str | None = Query(None, description="Latest scan, e.g. acne:77,pore:73"),
    groups: int = Query(4, ge=1, le=8),
    per_group: int = Query(3, ge=1, le=6),
):
    """Best catalog picks for this user, overall and by product type."""
    profile = _build_profile(skin_type, concerns, sensitivities, concern_scores)
    return await run_in_threadpool(rec.recommend, profile, groups, per_group)


@router.post("/alternatives", response_model=AlternativesResponse)
async def alternatives(req: AlternativesRequest):
    """'Better for you': same-category products that score higher for this user."""
    return await run_in_threadpool(rec.alternatives, req)
