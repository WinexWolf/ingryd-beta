"""Glue between the app and YouCam: photo prep, usage cap, result -> SkinProfile."""
import base64
import io
import os
from datetime import datetime, timezone

from fastapi import HTTPException
from PIL import Image, ImageOps

from app.models.skin import SkinMetric, SkinProfile
from app.services.youcam import YouCamAnalysis

MIN_SIDE = 480          # YouCam requires short side >= 480px
MAX_SIDE = 1600         # plenty for analysis; keeps uploads small
ATTENTION_BELOW = 70    # a concern scoring under this gets recommendations/notes


# ---------------------------------------------------------------- photo prep
def prepare_image(image_base64: str) -> bytes:
    """Decode a (data-URL) base64 photo into clean JPEG bytes ready for YouCam."""
    try:
        if image_base64.strip().startswith("data:") and "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(image_base64)))
        img = ImageOps.exif_transpose(img).convert("RGB")  # fix phone rotation
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image. Please try another photo.")

    if min(img.size) < MIN_SIDE:
        raise HTTPException(
            status_code=422,
            detail=f"Photo is too small — it needs to be at least {MIN_SIDE}px on its short side.",
        )
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90)  # re-encoding also strips EXIF/location data
    return out.getvalue()


# ------------------------------------------------------------- usage cap
# In-memory and per-process: fine for a single Render instance. It resets on restart,
# so treat it as a safety net rather than a billing guarantee.
_usage = {"day": "", "n": 0}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def daily_cap() -> int:
    try:
        return int(os.environ.get("YOUCAM_DAILY_CAP", "60"))
    except ValueError:
        return 60


def reserve_call() -> bool:
    """Take one slot from today's budget. Returns False if the cap is reached."""
    if _usage["day"] != _today():
        _usage["day"], _usage["n"] = _today(), 0
    if _usage["n"] >= daily_cap():
        return False
    _usage["n"] += 1
    return True


def release_call() -> None:
    """Give the slot back when a call failed (YouCam only charges on success)."""
    if _usage["n"] > 0:
        _usage["n"] -= 1


# ------------------------------------------------------------- mapping
RECOMMEND = {
    "moisture": ["Hyaluronic acid", "Glycerin", "Ceramides", "Squalane"],
    "oiliness": ["Niacinamide", "Salicylic acid", "Zinc oxide"],
    "redness": ["Centella asiatica", "Panthenol", "Bisabolol", "Allantoin"],
    "acne": ["Salicylic acid", "Niacinamide", "Azelaic acid", "Zinc oxide"],
    "pore": ["Salicylic acid", "Niacinamide", "Lactic acid"],
    "texture": ["Lactic acid", "Azelaic acid", "Salicylic acid", "Retinol (start low, PM only)"],
    "wrinkle": ["Retinol (start low, PM only)", "Peptides", "Vitamin C", "Hyaluronic acid"],
    "age_spot": ["Vitamin C", "Niacinamide", "Azelaic acid", "Tranexamic acid"],
    "dark_circle_v2": ["Caffeine", "Vitamin C", "Niacinamide"],
}

NOTES = {
    "moisture": "Skin is reading dehydrated — layer a humectant under a moisturizer.",
    "oiliness": "Oil balance needs attention — a lightweight niacinamide serum can help.",
    "redness": "Some redness detected — patch-test new actives and lean on soothing ingredients.",
    "acne": "Breakout signal detected — introduce exfoliating acids slowly, 2-3x/week.",
    "pore": "Pores are more visible — niacinamide and a gentle BHA can help refine them.",
    "texture": "Uneven texture detected — gentle chemical exfoliation helps smooth it over time.",
    "wrinkle": "Fine lines are showing — retinoids, peptides and daily sunscreen are the biggest levers.",
    "age_spot": "Dark spots detected — vitamin C in the morning and strict sunscreen use.",
    "dark_circle_v2": "Under-eye darkness detected — caffeine or vitamin C eye products plus sleep and SPF.",
}


def _label_hydration(s: int) -> str:
    return "Dehydrated" if s < 40 else "Balanced" if s < 70 else "Well hydrated"


def _label_oiliness(s: int) -> str:  # s is "how much oil issue" (higher = oilier)
    return "Well balanced" if s < 35 else "Slightly oily" if s < 65 else "Oily"


def _label_redness(s: int) -> str:
    return "Calm" if s < 35 else "Mild redness" if s < 65 else "High redness"


def _label_texture(s: int) -> str:
    return "Smooth" if s < 35 else "Some texture" if s < 65 else "Breakout-prone"


def map_to_profile(a: YouCamAnalysis) -> SkinProfile:
    # YouCam ui_score: higher = healthier. The app's oiliness/redness/texture metrics
    # are "higher = more of the issue", so those are inverted. A missing concern is
    # treated as neutral (70) rather than guessed.
    ui = {k: v.ui_score for k, v in a.concerns.items()}
    get = lambda k: ui.get(k, 70)  # noqa: E731

    hydration = get("moisture")
    oiliness = 100 - get("oiliness")
    redness = 100 - get("redness")
    texture_parts = [100 - get(k) for k in ("texture", "pore", "acne")]
    texture = round(sum(texture_parts) / len(texture_parts))

    overall = round(a.overall_score) if a.overall_score is not None else round(sum(ui.values()) / len(ui))

    # Worst concerns first
    flagged = sorted((k for k, v in ui.items() if v < ATTENTION_BELOW and k in RECOMMEND), key=lambda k: ui[k])
    recommended: list[str] = []
    for k in flagged:
        for ing in RECOMMEND[k]:
            if ing not in recommended:
                recommended.append(ing)
    notes = [NOTES[k] for k in flagged[:3]]

    if not notes:
        notes.append("Skin is reading healthy across the board — maintain your current routine.")
    t, u = a.skin_type_zones.get("t_zone"), a.skin_type_zones.get("u_zone")
    if t and u and t != u:
        notes.append(f"Your T-zone reads {t.lower()} while your cheeks read {u.lower()} — treat the zones differently.")

    return SkinProfile(
        hydration=SkinMetric(score=hydration, label=_label_hydration(hydration)),
        oiliness=SkinMetric(score=oiliness, label=_label_oiliness(oiliness)),
        redness=SkinMetric(score=redness, label=_label_redness(redness)),
        texture=SkinMetric(score=texture, label=_label_texture(texture)),
        overall_score=max(0, min(100, overall)),
        recommended_ingredients=recommended[:8],
        notes=notes,
        source="youcam",
        skin_type=a.skin_type,
        skin_age=a.skin_age,
        concerns=ui,
    )
