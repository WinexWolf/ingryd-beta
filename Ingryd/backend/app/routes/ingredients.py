from fastapi import APIRouter, Depends, HTTPException
from app.models.ingredients import (
    IngredientAnalyzeRequest, IngredientAnalyzeResponse, ApproveResponse,
    NotifySubmissionRequest, NotifyResponse,
)
from app.models.product import SkinProfile
from app.services.ingredient_review import analyze_raw_ingredients, approve_pending_product, reject_pending_product
from app.services.email_notify import send_review_notification
from app.services.auth import require_admin
from app.services.ingredient_check import (
    assess_ingredient_text, extract_ingredient_text, has_ingredient_header, REJECT_MESSAGE, NO_LIST_MESSAGE,
)
from app.services.normalize import normalize_full_ingredients_text

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
    # Refuse text that isn't an ingredient list (a web page, a receipt...) rather
    # than scoring it: with nothing recognised the scorer would return a default 70.
    # Keep only the list itself: a photo of a pack also reads claims, directions and warnings.
    text = extract_ingredient_text(request.raw_text)
    check = assess_ingredient_text(request.raw_text, normalize_full_ingredients_text(text))
    if not check.ok:
        detail = REJECT_MESSAGE if has_ingredient_header(request.raw_text) else NO_LIST_MESSAGE
        raise HTTPException(status_code=422, detail=detail)
    normalized, scored = analyze_raw_ingredients(text, request.product_name, profile)
    return IngredientAnalyzeResponse(ingredients_parsed=normalized, score=scored)


@router.post("/review/{pending_id}/approve", response_model=ApproveResponse)
async def approve(pending_id: str, _admin: str = Depends(require_admin)):
    success, message = approve_pending_product(pending_id)
    return ApproveResponse(success=success, message=message)


@router.post("/review/{pending_id}/reject", response_model=ApproveResponse)
async def reject(pending_id: str, notes: str | None = None, _admin: str = Depends(require_admin)):
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
