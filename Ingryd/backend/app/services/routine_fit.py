"""Checks a routine against the user's scan: what is working for them, what is working
against them, and which weak spots nothing in the routine addresses yet."""
from app.models.product import SkinProfile
from app.models.routine import (
    RoutineCovered, RoutineFitResponse, RoutineGap, RoutineProduct, RoutineProductFit,
)
from app.services import recommend as rec
from app.services.categorize import SPF_ACTIVES, infer_category
from app.services.concerns import FLAG_BELOW, worst
from app.services.scoring import CONCERN_BONUS_INGREDIENTS, score_ingredients

# App concern -> (label, scan keys that measure it, product types that tackle it)
CONCERNS = {
    "acne": ("Breakouts & pores", ["acne", "pore"], ["spot_treatment", "serum", "exfoliant", "toner"]),
    "texture": ("Uneven texture", ["texture"], ["exfoliant", "serum", "toner"]),
    "dark circles": ("Dark circles", ["dark_circle_v2"], ["eye_cream"]),
    "hyperpigmentation": ("Dark spots", ["age_spot"], ["serum"]),
    "aging": ("Fine lines", ["wrinkle"], ["serum", "eye_cream"]),
    "dryness": ("Hydration", ["moisture"], ["moisturizer", "serum", "essence"]),
    "redness": ("Redness", ["redness"], ["serum", "moisturizer"]),
}
MAX_GAPS = 3


def _hits(ings: list[str], keywords: list[str]) -> list[str]:
    low = [i.lower() for i in ings]
    return [k for k in keywords if any(k in i for i in low)]


def _concerns_to_check(profile: SkinProfile | None) -> list[tuple[str, int | None]]:
    """Weakest-first when we have scan scores; otherwise whatever the user listed."""
    if not profile:
        return []
    scan = profile.concern_scores or {}
    if scan:
        found = []
        for concern, (_label, keys, _cats) in CONCERNS.items():
            w = worst(scan, keys)
            if w is not None and w[1] < FLAG_BELOW:
                found.append((concern, w[1]))
        return sorted(found, key=lambda x: x[1])
    return [(c, None) for c in profile.concerns if c in CONCERNS]


def _suggest(profile: SkinProfile, concern: str, have: set[str]):
    """Best catalog product that targets this concern, from a product type the user lacks first."""
    boosted = profile.model_copy(update={"concerns": list(dict.fromkeys([*profile.concerns, concern]))})
    cats = CONCERNS[concern][2]
    ordered = [c for c in cats if c not in have] + [c for c in cats if c in have]
    for cat in ordered:
        picks = [p for p in rec._rank(boosted, category=cat, min_fit=70) if p.reasons]
        picks = rec._diversify(picks, 1)
        if picks:
            return picks[0]
    return None


def check_fit(products: list[RoutineProduct], profile: SkinProfile | None) -> RoutineFitResponse:
    scan = (profile.concern_scores if profile else {}) or {}
    has_scan = bool(scan)

    fits: list[RoutineProductFit] = []
    for p in products:
        cat = infer_category(p.name, p.ingredients_parsed)
        item = RoutineProductFit(name=p.name, brand=p.brand, slot=p.slot, category=cat)
        if p.ingredients_parsed:
            s = score_ingredients(p.ingredients_parsed, profile)
            item.fit_score = s.fit_score if s.fit_score is not None else s.score
            item.fit_grade = s.fit_grade or s.grade
            item.working_for = [f"{n.ingredient}: {n.reason}" for n in sorted(
                (n for n in s.personal_notes if n.adjustment > 0), key=lambda n: -n.adjustment)][:2]
            item.working_against = [f"{n.ingredient}: {n.reason}" for n in sorted(
                (n for n in s.personal_notes if n.adjustment < 0), key=lambda n: n.adjustment)][:2]
        fits.append(item)

    covered: list[RoutineCovered] = []
    gaps: list[RoutineGap] = []
    have_cats = {f.category for f in fits}
    checks = _concerns_to_check(profile)
    for concern, score in checks:
        label = CONCERNS[concern][0]
        keywords = CONCERN_BONUS_INGREDIENTS.get(concern, [])
        who = [p.name for p in products if _hits(p.ingredients_parsed, keywords)]
        if who:
            covered.append(RoutineCovered(concern=concern, label=label, score=score, products=who))
        elif len(gaps) < MAX_GAPS:
            how = f" (scan: {score}/100)" if score is not None else ""
            gaps.append(RoutineGap(
                concern=concern, label=label, score=score,
                message=f"Nothing in your routine targets {label.lower()}{how}.",
                suggestion=_suggest(profile, concern, have_cats) if profile else None,
            ))

    basics: list[str] = []
    am = [p for p in products if p.slot == "am"]
    if am and not any(_hits(p.ingredients_parsed, SPF_ACTIVES) or infer_category(p.name) == "sunscreen" for p in am):
        basics.append("No sunscreen in your morning routine — the single biggest help for dark spots, fine lines and dark circles.")
    if products and not any(f.category == "moisturizer" for f in fits):
        basics.append("No moisturizer spotted in your routine.")

    n = len(checks)
    if not products:
        headline = "Add a few products to see how your routine lines up with your scan."
    elif not n:
        headline = "Nothing is flagged on your latest scan, so there are no gaps to fill."
    elif not gaps:
        headline = f"Your routine covers all {n} of your focus areas."
    elif covered:
        headline = f"Your routine covers {len(covered)} of {n} focus areas — {len(gaps)} still have nothing working on them."
    else:
        headline = f"Nothing in your routine targets your {n} focus area{'s' if n != 1 else ''} yet."
    return RoutineFitResponse(headline=headline, has_scan=has_scan, products=fits, covered=covered, gaps=gaps, missing_basics=basics)
