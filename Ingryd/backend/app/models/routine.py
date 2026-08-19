from pydantic import BaseModel
from typing import Literal


class RoutineProduct(BaseModel):
    name: str
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


class RoutineCheckResponse(BaseModel):
    conflicts: list[RoutineConflict]
    am_count: int
    pm_count: int
    clean: bool
