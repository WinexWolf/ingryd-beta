from fastapi import APIRouter
from app.models.ingredients import IngredientAnalyzeRequest, IngredientAnalyzeResponse, ApproveResponse
from app.models.product import SkinProfile
from app.services.ingredient_review import analyze_raw_ingredients, approve_pending_product, reject_pending_product

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/analyze", response_model=IngredientAnalyzeResponse)
async def analyze(request: IngredientAnalyzeRequest):
    profile = None
    if request.skin_type or request.concerns or request.sensitivities:
        profile = SkinProfile(
            skin_type=request.skin_type,
            concerns=request.concerns,
            sensitivities=request.sensitivities,
        )
    normalized, scored = analyze_raw_ingredients(request.raw_text, request.product_name, profile)
    return IngredientAnalyzeResponse(ingredients_parsed=normalized, score=scored)


@router.post("/review/{pending_id}/approve", response_model=ApproveResponse)
async def approve(pending_id: str):
    success, message = approve_pending_product(pending_id)
    return ApproveResponse(success=success, message=message)


@router.post("/review/{pending_id}/reject", response_model=ApproveResponse)
async def reject(pending_id: str, notes: str | None = None):
    success, message = reject_pending_product(pending_id, notes)
    return ApproveResponse(success=success, message=message)
