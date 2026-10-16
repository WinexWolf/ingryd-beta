import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.skin import SkinAnalysisRequest, SkinAnalysisResponse
from app.services.skin import analyze_skin_image
from app.services.skin_youcam import map_to_profile, prepare_image, release_call, reserve_call
from app.services.youcam import YouCamError, analyze_image

router = APIRouter(prefix="/skin", tags=["skin"])
log = logging.getLogger("ingryd.skin")


@router.post("/analyze", response_model=SkinAnalysisResponse)
async def analyze(request: SkinAnalysisRequest):
    # Validates + normalizes the photo; raises 400/422 with a user-readable message.
    jpeg = prepare_image(request.image_base64)

    if os.environ.get("YOUCAM_API_KEY"):
        if reserve_call():
            try:
                analysis = await analyze_image(jpeg, "image/jpeg")
                return SkinAnalysisResponse(profile=map_to_profile(analysis))
            except YouCamError as e:
                release_call()  # YouCam only charges for successful analyses
                if e.user_fixable:
                    raise HTTPException(status_code=422, detail=str(e))
                log.warning("YouCam unavailable, using fallback: %s", e)
        else:
            log.warning("YouCam daily cap reached, using fallback")

    # Fallback: the original on-device-style heuristic (source="heuristic")
    profile = await run_in_threadpool(analyze_skin_image, request.image_base64)
    return SkinAnalysisResponse(profile=profile)
