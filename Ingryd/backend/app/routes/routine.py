from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.models.routine import (
    RoutineCheckRequest, RoutineCheckResponse, RoutineFitRequest, RoutineFitResponse,
    RoutineOrderRequest, RoutineOrderResponse,
)
from app.services.routine import check_routine
from app.services.routine_fit import check_fit
from app.services.routine_order import order_routine

router = APIRouter(prefix="/routine", tags=["routine"])


@router.post("/check", response_model=RoutineCheckResponse)
async def check(request: RoutineCheckRequest):
    return check_routine(request.products)


@router.post("/fit", response_model=RoutineFitResponse)
async def fit(request: RoutineFitRequest):
    """Routine vs. the user's latest scan: what helps, what works against them, what's missing."""
    return await run_in_threadpool(check_fit, request.products, request.profile)


@router.post("/order", response_model=RoutineOrderResponse)
async def order(request: RoutineOrderRequest):
    """Suggested order to apply the routine's products, morning and evening, with a few tips."""
    return order_routine(request.products)
