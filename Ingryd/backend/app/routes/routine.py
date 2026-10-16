from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.models.routine import RoutineCheckRequest, RoutineCheckResponse, RoutineFitRequest, RoutineFitResponse
from app.services.routine import check_routine
from app.services.routine_fit import check_fit

router = APIRouter(prefix="/routine", tags=["routine"])


@router.post("/check", response_model=RoutineCheckResponse)
async def check(request: RoutineCheckRequest):
    return check_routine(request.products)


@router.post("/fit", response_model=RoutineFitResponse)
async def fit(request: RoutineFitRequest):
    """Routine vs. the user's latest scan: what helps, what works against them, what's missing."""
    return await run_in_threadpool(check_fit, request.products, request.profile)
