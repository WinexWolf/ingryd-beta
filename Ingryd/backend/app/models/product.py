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
