"""Glue between the app and YouCam: photo prep, usage cap, result -> SkinProfile."""
import base64
import io

from fastapi import HTTPException
from PIL import Image, ImageOps

from app.models.skin import ConcernArea, SkinMetric, SkinProfile
from app.services.concerns import APP_CONCERN_KEYS, FLAG_BELOW, flagged
from app.services.youcam import ConcernScore, YouCamAnalysis

MIN_SIDE = 480          # YouCam requires short side >= 480px
MAX_SIDE = 1600         # plenty for analysis; keeps uploads small
ATTENTION_BELOW = FLAG_BELOW  # one threshold everywhere: notes, ingredients, suggested concerns
WATCH_BELOW = 85              # between the two: fine, but the weakest spot worth keeping an eye on


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


# --------------------------------------------------- scan -> profile suggestion
_VALID_TYPES = {"normal", "dry", "oily", "combination", "sensitive"}
_TYPE_ALIASES = {"mixed": "combination", "combo": "combination"}


def suggest_skin_type(whole: str | None, zones: dict[str, str]) -> str | None:
    """Map YouCam's skin type (+ T/U-zone readings) onto the app's skin types."""
    t, u = (zones.get("t_zone") or "").lower(), (zones.get("u_zone") or "").lower()
    if t and u and t != u and {t, u} & {"oily", "dry"}:
        return "combination"  # zones disagree in a way that matters
    if not whole:
        return None
    w = _TYPE_ALIASES.get(whole.lower(), whole.lower())
    return w if w in _VALID_TYPES else None


def suggest_concerns(ui: dict[str, int]) -> list[str]:
    """App concerns whose underlying scan scores are below the flag threshold."""
    return [c for c, keys in APP_CONCERN_KEYS.items() if c != "sensitive" and flagged(ui, keys)]


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


TITLE = {
    "moisture": "Hydration", "oiliness": "Oil balance", "redness": "Redness",
    "acne": "Breakouts", "pore": "Pores", "texture": "Texture", "wrinkle": "Fine lines",
    "age_spot": "Dark spots", "dark_circle_v2": "Dark circles",
}


def _status(score: int) -> str:
    return "attention" if score < ATTENTION_BELOW else "watch" if score < WATCH_BELOW else "good"


def build_areas(ui: dict[str, int]) -> list[ConcernArea]:
    """Every scanned concern, weakest first, each with a tip that fits its status."""
    out: list[ConcernArea] = []
    for k in sorted((k for k in ui if k in TITLE), key=lambda k: ui[k]):
        st, ings = _status(ui[k]), RECOMMEND.get(k, [])
        if st == "attention":
            tip = NOTES[k]
        elif st == "watch":
            tip = f"Your {TITLE[k].lower()} score is okay but not your strongest — {ings[0]} helps keep it from slipping."
        else:
            tip = f"{TITLE[k]} looks healthy — nothing to change here."
        out.append(ConcernArea(key=k, label=TITLE[k], score=ui[k], status=st, tip=tip, ingredients=ings[:3]))
    return out


def _label_hydration(s: int) -> str:
    return "Dehydrated" if s < 40 else "Balanced" if s < 70 else "Well hydrated"


def _label_oiliness(s: int) -> str:  # s is "how much oil issue" (higher = oilier)
    return "Well balanced" if s < 35 else "Slightly oily" if s < 65 else "Oily"


def _label_redness(s: int) -> str:
    return "Calm" if s < 35 else "Mild redness" if s < 65 else "High redness"


def _label_texture(s: int) -> str:
    return "Smooth" if s < 35 else "Some texture" if s < 65 else "Breakout-prone"


FRONT_WEIGHT, SIDE_WEIGHT = 2.0, 1.0   # front = 50% with two sides, 67% with one
VARIES_SPREAD = 15                    # points between views before we call a concern "uneven"


def merge_views(front: YouCamAnalysis, sides: dict[str, YouCamAnalysis]):
    """Combine the front analysis with side-photo analyses.

    Concern scores are a weighted mean (front counts double: it sees both cheeks and the T-zone
    squarely, and it is what the API is designed for). Skin type, skin age and the overlay masks
    come from the front photo only, since masks are drawn on the front photo.
    Returns (merged analysis, per-view concern scores, concerns where views disagree by >= VARIES_SPREAD).
    """
    views = {"front": front, **sides}
    weights = {"front": FRONT_WEIGHT, **{k: SIDE_WEIGHT for k in sides}}
    merged: dict[str, ConcernScore] = {}
    varies: list[str] = []
    for key, f in front.concerns.items():
        pts = [(weights[v], a.concerns[key].ui_score) for v, a in views.items() if key in a.concerns]
        total = sum(w for w, _ in pts)
        score = round(sum(w * s for w, s in pts) / total)
        merged[key] = ConcernScore(ui_score=score, raw_score=f.raw_score, mask_url=f.mask_url)
        vals = [s for _, s in pts]
        if len(vals) > 1 and max(vals) - min(vals) >= VARIES_SPREAD:
            varies.append(key)
    overall = [(weights[v], a.overall_score) for v, a in views.items() if a.overall_score is not None]
    overall_score = (sum(w * s for w, s in overall) / sum(w for w, _ in overall)) if len(overall) == len(views) else front.overall_score
    out = YouCamAnalysis(
        concerns=merged, skin_type=front.skin_type, skin_type_zones=front.skin_type_zones,
        overall_score=overall_score, skin_age=front.skin_age,
    )
    view_scores = {v: {k: c.ui_score for k, c in a.concerns.items()} for v, a in views.items()}
    return out, view_scores, varies


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
        skin_type_zones=a.skin_type_zones,
        suggested_skin_type=suggest_skin_type(a.skin_type, a.skin_type_zones),
        suggested_concerns=suggest_concerns(ui),
        areas=build_areas(ui),
        masks={k: v.mask_url for k, v in a.concerns.items() if v.mask_url},
    )
