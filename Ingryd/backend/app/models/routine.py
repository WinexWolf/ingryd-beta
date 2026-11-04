from pydantic import BaseModel
from typing import Literal, Optional

from app.models.product import RecommendedProduct, SkinProfile


class RoutineProduct(BaseModel):
    name: str
    brand: Optional[str] = None
    slot: Literal["am", "pm"]
    ingredients_parsed: list[str] = []


class RoutineConflict(BaseModel):
    severity: Literal["high", "moderate"]
    ingredient_a: str
    ingredient_b: str
    product_a: str
    product_b: str
    reason: str
    advice: str


class RoutineCheckRequest(BaseModel):
    products: list[RoutineProduct]


class RedundantActive(BaseModel):
    active_family: str
    product_count: int
    products: list[str]
    note: str


class RoutineCheckResponse(BaseModel):
    conflicts: list[RoutineConflict]
    am_count: int
    pm_count: int
    clean: bool
    redundant_actives: list[RedundantActive] = []


class RoutineFitRequest(BaseModel):
    products: list[RoutineProduct]
    profile: Optional[SkinProfile] = None


class RoutineProductFit(BaseModel):
    name: str
    brand: Optional[str] = None
    slot: Literal["am", "pm"]
    category: str
    fit_score: Optional[int] = None
    fit_grade: Optional[str] = None
    working_for: list[str] = []      # what in it helps the user's concerns
    working_against: list[str] = []  # what in it works against them


class RoutineGap(BaseModel):
    concern: str                     # app concern, e.g. "dark circles"
    label: str
    score: Optional[int] = None      # latest scan score for it, if there is one
    message: str
    suggestion: Optional[RecommendedProduct] = None


class RoutineCovered(BaseModel):
    concern: str
    label: str
    score: Optional[int] = None
    products: list[str]


class RoutineFitResponse(BaseModel):
    headline: str
    has_scan: bool
    products: list[RoutineProductFit]
    covered: list[RoutineCovered]
    gaps: list[RoutineGap]
    missing_basics: list[str]


class RoutineOrderRequest(BaseModel):
    products: list[RoutineProduct]


class RoutineOrderItem(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    note: str = ""
    step: int = 0


class RoutineOrderResponse(BaseModel):
    am: list[RoutineOrderItem]
    pm: list[RoutineOrderItem]
    tips: list[str] = []
