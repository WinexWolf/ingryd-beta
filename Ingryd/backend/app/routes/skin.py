import asyncio
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.skin import SkinAnalysisRequest, SkinAnalysisResponse
from app.services import usage
from app.services.auth import current_user
from app.services.skin import analyze_skin_image
from app.services.skin_sample import sample_profile
from app.services.skin_youcam import map_to_profile, merge_views, prepare_image
from app.services.youcam import YouCamError, analyze_image

router = APIRouter(prefix="/skin", tags=["skin"])
log = logging.getLogger("ingryd.skin")


SIDE_NAMES = {"left": "left", "right": "right"}
RETRY_WAIT_S = 1.5


async def _analyze(img: bytes) -> object:
    """One photo -> YouCam, retrying once on a transient failure (rate limit, 5xx, timeout)."""
    try:
        return await analyze_image(img, "image/jpeg")
    except YouCamError as e:
        if not e.retryable:
            raise
        await asyncio.sleep(RETRY_WAIT_S)
        return await analyze_image(img, "image/jpeg")


def _side_note(view: str, err: Exception, others: str) -> str:
    if isinstance(err, YouCamError) and err.user_fixable:
        return (f"The skin-analysis engine couldn't read your {view} photo (it works best with faces turned only slightly, "
                f"about a quarter turn), so this result uses your {others}.")
    return f"Your {view} photo couldn't be analyzed right now, so this result uses your {others}. Try again in a minute."


@router.post("/analyze", response_model=SkinAnalysisResponse)
async def analyze(request: SkinAnalysisRequest, user_id: str = Depends(current_user)):
    # Validates + normalizes the front photo; raises 400/422 with a user-readable message.
    front_jpeg = prepare_image(request.image_base64)

    notes: list[str] = []
    side_jpegs: dict[str, bytes] = {}
    for view, raw in (("left", request.left_base64), ("right", request.right_base64)):
        if not raw:
            continue
        try:
            side_jpegs[view] = prepare_image(raw)
        except HTTPException:
            notes.append(f"Your {view} photo couldn't be read, so it was left out.")

    if os.environ.get("YOUCAM_API_KEY"):
        n = 1 + len(side_jpegs)
        try:
            usage.reserve(user_id, n)
        except usage.LimitReached as e:
            raise HTTPException(status_code=429 if e.kind == "user" else 503, detail=e.message)

        views = ["front", *side_jpegs]
        results = await asyncio.gather(
            *(_analyze(img) for img in (front_jpeg, *side_jpegs.values())),
            return_exceptions=True,
        )
        by_view = dict(zip(views, results))
        front = by_view["front"]
        sides = {}
        for view in side_jpegs:
            r = by_view[view]
            if isinstance(r, Exception):
                usage.release(user_id)  # failed analyses aren't charged
                log.warning("YouCam %s photo failed: %s", view, r)
                notes.append(_side_note(view, r, "other photos" if len(side_jpegs) > 1 else "front photo"))
            else:
                sides[view] = r

        if isinstance(front, Exception):
            usage.release(user_id)  # the failed front analysis isn't charged (successful side analyses were)
            if isinstance(front, YouCamError):
                if front.user_fixable:
                    raise HTTPException(status_code=422, detail=str(front))
                log.warning("YouCam unavailable, using fallback: %s", front)
            else:
                log.exception("Unexpected analysis error", exc_info=front)
        else:
            if sides:
                merged, view_scores, varies = merge_views(front, sides)
                profile = map_to_profile(merged)
                profile.views, profile.view_scores, profile.varies = ["front", *sides], view_scores, varies
            else:
                profile = map_to_profile(front)
                profile.views = ["front"]
            profile.view_notes = notes
            return SkinAnalysisResponse(profile=profile)

    # Fallback: the original on-device-style heuristic (source="heuristic"), front photo only
    profile = await run_in_threadpool(analyze_skin_image, request.image_base64)
    return SkinAnalysisResponse(profile=profile)


@router.post("/sample", response_model=SkinAnalysisResponse)
async def sample():
    """Canned example scan. No sign-in, no photo, no YouCam units."""
    return SkinAnalysisResponse(profile=sample_profile())
