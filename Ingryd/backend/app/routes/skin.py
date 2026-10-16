import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.skin import SkinAnalysisRequest, SkinAnalysisResponse
from app.services import usage
from app.services.auth import current_user
from app.services.skin import analyze_skin_image
from app.services.skin_sample import sample_profile
from app.services.skin_youcam import map_to_profile, prepare_image
from app.services.youcam import YouCamError, analyze_image

router = APIRouter(prefix="/skin", tags=["skin"])
log = logging.getLogger("ingryd.skin")


@router.post("/analyze", response_model=SkinAnalysisResponse)
async def analyze(request: SkinAnalysisRequest, user_id: str = Depends(current_user)):
    # Validates + normalizes the photo; raises 400/422 with a user-readable message.
    jpeg = prepare_image(request.image_base64)

    if os.environ.get("YOUCAM_API_KEY"):
        try:
            usage.reserve(user_id)
        except usage.LimitReached as e:
            raise HTTPException(status_code=429 if e.kind == "user" else 503, detail=e.message)
        try:
            analysis = await analyze_image(jpeg, "image/jpeg")
            return SkinAnalysisResponse(profile=map_to_profile(analysis))
        except YouCamError as e:
            usage.release(user_id)  # YouCam only charges for successful analyses
            if e.user_fixable:
                raise HTTPException(status_code=422, detail=str(e))
            log.warning("YouCam unavailable, using fallback: %s", e)

    # Fallback: the original on-device-style heuristic (source="heuristic")
    profile = await run_in_threadpool(analyze_skin_image, request.image_base64)
    return SkinAnalysisResponse(profile=profile)


@router.post("/sample", response_model=SkinAnalysisResponse)
async def sample():
    """Canned example scan. No sign-in, no photo, no YouCam units."""
    return SkinAnalysisResponse(profile=sample_profile())
