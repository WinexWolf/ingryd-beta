from pydantic import BaseModel
from app.models.product import ProductScore


class IngredientAnalyzeRequest(BaseModel):
    raw_text: str
    product_name: str | None = None
    brand: str | None = None
    skin_type: str | None = None
    concerns: list[str] = []
    sensitivities: list[str] = []


class IngredientAnalyzeResponse(BaseModel):
    ingredients_parsed: list[str]
    score: ProductScore


class ApproveResponse(BaseModel):
    success: bool
    message: str
