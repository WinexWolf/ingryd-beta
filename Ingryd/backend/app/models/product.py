from pydantic import BaseModel
from typing import Optional


class IngredientFlag(BaseModel):
    name: str
    concern: str
    severity: str  # "high" | "moderate" | "beneficial"
    category: Optional[str] = None


class SkinProfile(BaseModel):
    skin_type: Optional[str] = None  # "dry" | "oily" | "combination" | "sensitive" | "normal"
    concerns: list[str] = []         # e.g. "acne", "aging", "hyperpigmentation", "redness", "dryness"
    sensitivities: list[str] = []    # free-text ingredient names the user reacts to
    concern_scores: dict[str, int] = {}  # latest scan, YouCam ui_score per concern (0-100, higher = healthier)


class PersonalNote(BaseModel):
    ingredient: str
    reason: str
    adjustment: int  # negative = penalty, positive = bonus


class ProductScore(BaseModel):
    score: int  # 0-100, universal/generic score
    grade: str  # "excellent" | "good" | "fair" | "poor" | "avoid"
    high_concern: list[IngredientFlag]
    moderate_concern: list[IngredientFlag]
    beneficial: list[IngredientFlag]
    comedogenic: list[IngredientFlag] = []  # informational — does not affect score
    allergens: list[IngredientFlag] = []  # EU Annex III fragrance allergens — informational
    prohibited: list[IngredientFlag] = []  # substances banned outright in the EU — treated as high concern
    ingredient_functions: dict[str, list[str]] = {}  # from INCI API enrichment, single-product lookups only
    pregnancy_safe: Optional[bool] = None
    pregnancy_concerns: list[str] = []
    external_safety_score: Optional[int] = None
    external_safety_source: Optional[str] = None
    concentration_tiers: list[dict] = []  # order-aware position/tier estimate per ingredient
    marketing_dose_flags: list[dict] = []  # hero ingredient buried too low to be effective
    total_ingredients: int
    flagged_count: int
    fit_score: Optional[int] = None       # personalized score, only present if a profile was supplied
    fit_grade: Optional[str] = None
    personal_notes: list[PersonalNote] = []


class ProductResult(BaseModel):
    barcode: str
    name: Optional[str] = None
    brand: Optional[str] = None
    categories: Optional[str] = None
    labels: Optional[str] = None
    image_url: Optional[str] = None
    ingredients_text: Optional[str] = None
    ingredients_parsed: list[str] = []
    score: Optional[ProductScore] = None
    found: bool = True


class ProductSearchResponse(BaseModel):
    query: str
    count: int  # number of results on this page
    total_count: int  # total matching products across all pages
    page: int
    page_size: int
    results: list[ProductResult]
