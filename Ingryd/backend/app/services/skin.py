import base64
import io
from fastapi import HTTPException
from PIL import Image, ImageFilter
import numpy as np

from app.models.skin import SkinProfile, SkinMetric

# ---------------------------------------------------------------------------
# Ingredient recommendations by concern, pulled from the same beneficial-actives
# knowledge base used for product scoring (kept as a small local mirror here to
# avoid a circular import).
# ---------------------------------------------------------------------------

RECOMMEND_FOR = {
    "dry": ["Hyaluronic acid", "Glycerin", "Ceramides", "Squalane"],
    "oily": ["Niacinamide", "Salicylic acid", "Zinc oxide"],
    "red": ["Centella asiatica", "Panthenol", "Bisabolol", "Allantoin"],
    "textured": ["Salicylic acid", "Azelaic acid", "Lactic acid", "Retinol (start low, PM only)"],
}


def _decode_image(image_base64: str) -> Image.Image:
    try:
        if "," in image_base64 and image_base64.strip().startswith("data:"):
            image_base64 = image_base64.split(",", 1)[1]
        raw = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image. Please try another photo.")

    # Downscale for consistent, fast analysis
    img.thumbnail((512, 512))
    return img


def _skin_mask(arr: np.ndarray) -> np.ndarray:
    """Loose heuristic mask for likely skin-tone pixels (R > G > B, within range)."""
    r, g, b = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int)
    mask = (r > 60) & (r < 250) & (r > g) & (g >= b - 15) & (r - b > 10) & (r - b < 140)
    return mask


def _scale(value: float, lo: float, hi: float) -> int:
    """Map value in [lo, hi] to a 0-100 int score, clamped."""
    if hi == lo:
        return 50
    pct = (value - lo) / (hi - lo) * 100
    return int(max(0, min(100, round(pct))))


def analyze_skin_image(image_base64: str) -> SkinProfile:
    img = _decode_image(image_base64)
    arr = np.array(img)

    mask = _skin_mask(arr)
    if mask.sum() < 200:  # too few skin-like pixels — fall back to whole frame
        mask = np.ones(arr.shape[:2], dtype=bool)

    skin_pixels = arr[mask]
    r = skin_pixels[..., 0].astype(float)
    g = skin_pixels[..., 1].astype(float)
    b = skin_pixels[..., 2].astype(float)

    # --- Redness / inflammation proxy: how far red channel exceeds green ---
    redness_raw = float(np.mean(r - g))
    redness_score = _scale(redness_raw, 5, 45)  # higher = more redness signal

    # --- Oiliness proxy: proportion of near-highlight (specular) skin pixels ---
    brightness = (r + g + b) / 3
    shine_ratio = float(np.mean(brightness > 205))
    oiliness_score = _scale(shine_ratio, 0.01, 0.25)

    # --- Texture proxy: edge density on grayscale (bumps/flaking/roughness) ---
    gray = img.convert("L")
    edges = np.array(gray.filter(ImageFilter.FIND_EDGES))
    edge_density = float(np.mean(edges > 30))
    texture_score = _scale(edge_density, 0.02, 0.30)

    # --- Hydration proxy: smoother texture + more even brightness = higher ---
    brightness_std = float(np.std(brightness))
    unevenness = _scale(brightness_std, 10, 55)  # higher std = less even = drier-looking
    hydration_score = max(0, 100 - int(round((unevenness * 0.6) + (texture_score * 0.4))))

    def label_hydration(s: int) -> str:
        return "Dehydrated" if s < 40 else "Balanced" if s < 70 else "Well hydrated"

    def label_oiliness(s: int) -> str:
        return "Dry / low oil" if s < 30 else "Balanced" if s < 65 else "Oily"

    def label_redness(s: int) -> str:
        return "Calm" if s < 35 else "Mild redness" if s < 65 else "High redness"

    def label_texture(s: int) -> str:
        return "Smooth" if s < 35 else "Some texture" if s < 65 else "Breakout-prone"

    overall = int(round(
        (hydration_score * 0.3)
        + ((100 - oiliness_score) * 0.2 if oiliness_score > 65 else oiliness_score * 0.2 + 20)
        + ((100 - redness_score) * 0.25)
        + ((100 - texture_score) * 0.25)
    ))
    overall = max(0, min(100, overall))

    recommended: list[str] = []
    notes: list[str] = []

    if hydration_score < 45:
        recommended += RECOMMEND_FOR["dry"]
        notes.append("Skin is reading dehydrated — prioritise a humectant + occlusive layering routine.")
    if oiliness_score > 65:
        recommended += RECOMMEND_FOR["oily"]
        notes.append("Higher shine detected — a lightweight niacinamide serum can help balance oil.")
    if redness_score > 55:
        recommended += RECOMMEND_FOR["red"]
        notes.append("Some redness detected — patch-test new actives and lean on soothing ingredients.")
    if texture_score > 55:
        recommended += RECOMMEND_FOR["textured"]
        notes.append("Texture/breakout signal detected — introduce exfoliants slowly, 2-3x/week.")
    if not notes:
        notes.append("Skin is reading balanced across all four metrics — maintain your current routine.")

    # de-dupe while preserving order
    seen = set()
    recommended = [x for x in recommended if not (x in seen or seen.add(x))]

    return SkinProfile(
        hydration=SkinMetric(score=hydration_score, label=label_hydration(hydration_score)),
        oiliness=SkinMetric(score=oiliness_score, label=label_oiliness(oiliness_score)),
        redness=SkinMetric(score=redness_score, label=label_redness(redness_score)),
        texture=SkinMetric(score=texture_score, label=label_texture(texture_score)),
        overall_score=overall,
        recommended_ingredients=recommended[:8],
        notes=notes,
    )
