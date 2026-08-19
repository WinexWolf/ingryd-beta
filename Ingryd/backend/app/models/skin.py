from pydantic import BaseModel


class SkinMetric(BaseModel):
    score: int  # 0-100
    label: str  # human-readable category, e.g. "Well hydrated"


class SkinProfile(BaseModel):
    hydration: SkinMetric
    oiliness: SkinMetric
    redness: SkinMetric
    texture: SkinMetric
    overall_score: int
    recommended_ingredients: list[str]
    notes: list[str]


class SkinAnalysisRequest(BaseModel):
    image_base64: str


class SkinAnalysisResponse(BaseModel):
    profile: SkinProfile
