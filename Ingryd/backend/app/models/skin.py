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
    # Added for YouCam-powered analysis. All optional so older saved scans still load.
    source: str = "heuristic"          # "youcam" | "heuristic"
    skin_type: str | None = None       # e.g. "Normal", "Oily", "Dry", "Combination"
    skin_age: int | None = None
    concerns: dict[str, int] = {}      # YouCam ui_score per concern, 0-100, higher = healthier


class SkinAnalysisRequest(BaseModel):
    image_base64: str


class SkinAnalysisResponse(BaseModel):
    profile: SkinProfile
