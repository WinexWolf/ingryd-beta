"""Shared vocabulary between YouCam scan scores and the app's own concern names.

YouCam ui_score is 0-100 where HIGHER = HEALTHIER. "Need" below is the inverse
(0 = no issue, 1 = worst), which is what ingredient weighting cares about.
"""

# The app's concern names (Profile page) -> the YouCam concerns that measure them.
APP_CONCERN_KEYS: dict[str, list[str]] = {
    "acne": ["acne", "pore"],
    "aging": ["wrinkle"],
    "hyperpigmentation": ["age_spot", "dark_circle_v2"],
    "redness": ["redness"],
    "sensitive": ["redness"],
    "dryness": ["moisture"],
}

# Human wording for each YouCam concern, used inside user-facing reasons.
LABEL: dict[str, str] = {
    "acne": "acne",
    "pore": "pore",
    "texture": "texture",
    "wrinkle": "fine-line",
    "age_spot": "dark-spot",
    "dark_circle_v2": "dark-circle",
    "redness": "redness",
    "moisture": "hydration",
    "oiliness": "oil-balance",
}

FLAG_BELOW = 75  # a concern scoring under this counts as "worth addressing"


def parse_concern_scores(raw: str | None) -> dict[str, int]:
    """Parse 'acne:77,pore:73' from a query string. Bad entries are ignored."""
    out: dict[str, int] = {}
    if not raw:
        return out
    for part in raw.split(","):
        key, _, val = part.partition(":")
        key = key.strip()
        if not key or key not in LABEL:
            continue
        try:
            out[key] = max(0, min(100, int(float(val))))
        except ValueError:
            continue
    return out


def worst(scores: dict[str, int], keys: list[str]) -> tuple[str, int] | None:
    """The lowest (= most in need) scan score among keys, or None if none were scanned."""
    present = [(k, scores[k]) for k in keys if k in scores]
    return min(present, key=lambda kv: kv[1]) if present else None


def need(scores: dict[str, int], keys: list[str]) -> float | None:
    w = worst(scores, keys)
    return None if w is None else 1 - w[1] / 100


def weight(scores: dict[str, int], keys: list[str]) -> float:
    """Multiplier for an ingredient adjustment. 1.0 when there is no scan data, so
    behaviour without a scan is exactly what it was. Roughly: a 95 score -> 0.5x,
    a 73 -> 0.94x, a 40 -> 1.6x."""
    n = need(scores, keys)
    if n is None:
        return 1.0
    return max(0.5, min(1.6, 0.4 + 2.0 * n))


def flagged(scores: dict[str, int], keys: list[str]) -> bool:
    w = worst(scores, keys)
    return w is not None and w[1] < FLAG_BELOW


def suffix(scores: dict[str, int], keys: list[str]) -> str:
    w = worst(scores, keys)
    return "" if w is None else f" (your {LABEL[w[0]]} score: {w[1]}/100)"
