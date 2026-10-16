from fastapi import APIRouter
from app.models.ingredients import (
    IngredientAnalyzeRequest, IngredientAnalyzeResponse, ApproveResponse,
    NotifySubmissionRequest, NotifyResponse,
)
from app.models.product import SkinProfile
from app.services.ingredient_review import analyze_raw_ingredients, approve_pending_product, reject_pending_product
from app.services.email_notify import send_review_notification

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/analyze", response_model=IngredientAnalyzeResponse)
async def analyze(request: IngredientAnalyzeRequest):
    profile = None
    if request.skin_type or request.concerns or request.sensitivities or request.concern_scores:
        profile = SkinProfile(
            skin_type=request.skin_type,
            concerns=request.concerns,
            sensitivities=request.sensitivities,
            concern_scores=request.concern_scores,
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


@router.post("/notify-submission", response_model=NotifyResponse)
async def notify_submission(request: NotifySubmissionRequest):
    """Called by the frontend right after it inserts a new row into
    pending_products directly via Supabase (same pattern as routine_items
    etc.) — this endpoint's only job is firing the admin notification
    email. If it fails, the submission itself is already saved regardless."""
    sent = await send_review_notification(request.product_name, request.brand, request.ingredient_count)
    return NotifyResponse(sent=sent)
