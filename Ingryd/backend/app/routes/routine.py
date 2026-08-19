from fastapi import APIRouter
from app.models.routine import RoutineCheckRequest, RoutineCheckResponse
from app.services.routine import check_routine

router = APIRouter(prefix="/routine", tags=["routine"])


@router.post("/check", response_model=RoutineCheckResponse)
async def check(request: RoutineCheckRequest):
    return check_routine(request.products)
