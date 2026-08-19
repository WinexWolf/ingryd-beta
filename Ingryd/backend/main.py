from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.products import router as products_router
from app.routes.skin import router as skin_router
from app.routes.routine import router as routine_router

app = FastAPI(title="Ingryd API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products_router, prefix="/api")
app.include_router(skin_router, prefix="/api")
app.include_router(routine_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
