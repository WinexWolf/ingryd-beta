from pydantic import BaseModel


class SkinMetric(BaseModel):
    score: int  # 0-100
    label: str  # human-readable category, e.g. "Well hydrated"


class ConcernArea(BaseModel):
    """One scanned concern, ready to show in the results grid."""
    key: str                   # YouCam concern key, e.g. "pore"
    label: str                 # e.g. "Pores"
    score: int                 # 0-100, higher = healthier
    status: str                # "attention" | "watch" | "good"
    tip: str
    ingredients: list[str] = []


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
    skin_type_zones: dict[str, str] = {}  # {"t_zone": "Oily", "u_zone": "Normal"}
    # What "Apply to my profile" would set, in the app's own vocabulary (see Profile page)
    suggested_skin_type: str | None = None
    suggested_concerns: list[str] = []
    # Results screen v2. `areas` is every scanned concern, weakest first (the first three
    # are the "focus areas", shown even when everything is healthy). `masks` holds signed
    # YouCam overlay URLs that expire in ~24h: show them right away, never store them.
    areas: list[ConcernArea] = []
    is_sample: bool = False    # canned demo result, not the user's skin
    masks: dict[str, str] = {}
    # Multi-angle scans: which photos were analyzed ("front", "left", "right"), each concern's score
    # per photo, concerns where the photos disagree by a lot, and plain-language notes
    # (e.g. a side photo that couldn't be analyzed). Masks always belong to the front photo.
    views: list[str] = []
    view_scores: dict[str, dict[str, int]] = {}
    varies: list[str] = []
    view_notes: list[str] = []


class SkinAnalysisRequest(BaseModel):
    image_base64: str                 # front photo (required)
    left_base64: str | None = None    # optional side photos: each is one more analysis
    right_base64: str | None = None


class SkinAnalysisResponse(BaseModel):
    profile: SkinProfile
