from fastapi import APIRouter
from app.models.skin import SkinAnalysisRequest, SkinAnalysisResponse
from app.services.skin import analyze_skin_image

router = APIRouter(prefix="/skin", tags=["skin"])


@router.post("/analyze", response_model=SkinAnalysisResponse)
async def analyze(request: SkinAnalysisRequest):
    profile = analyze_skin_image(request.image_base64)
    return SkinAnalysisResponse(profile=profile)
