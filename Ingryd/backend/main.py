import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.products import router as products_router
from app.routes.skin import router as skin_router
from app.routes.routine import router as routine_router
from app.routes.ingredients import router as ingredients_router

app = FastAPI(title="Ingryd API", version="1.0.0")

# Only our own frontend may call the API from a browser. Override with CORS_ORIGINS
# (comma-separated) if the site moves; Vercel preview deploys are allowed by pattern.
DEFAULT_ORIGINS = ["https://ingryd-beta.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"]
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()] or DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://ingryd-beta-[a-z0-9-]+\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(products_router, prefix="/api")
app.include_router(skin_router, prefix="/api")
app.include_router(routine_router, prefix="/api")
app.include_router(ingredients_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
