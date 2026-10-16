from app.models.product import IngredientFlag, ProductScore, SkinProfile, PersonalNote
from app.services.allergens import match_allergen, match_prohibited
from app.services.concerns import APP_CONCERN_KEYS, flagged, suffix, weight

# ---------------------------------------------------------------------------
# Ingredient knowledge base
# ---------------------------------------------------------------------------

HIGH_CONCERN: dict[str, dict] = {
    "methylparaben": {"concern": "Endocrine disruptor"},
    "propylparaben": {"concern": "Endocrine disruptor"},
    "butylparaben": {"concern": "Endocrine disruptor"},
    "ethylparaben": {"concern": "Endocrine disruptor"},
    "isobutylparaben": {"concern": "Endocrine disruptor"},
    "isopropylparaben": {"concern": "Endocrine disruptor"},
    "sodium lauryl sulfate": {"concern": "Harsh surfactant, strips skin barrier"},
    "formaldehyde": {"concern": "Carcinogen and allergen"},
    "dmdm hydantoin": {"concern": "Formaldehyde-releasing preservative"},
    "imidazolidinyl urea": {"concern": "Formaldehyde-releasing preservative"},
    "diazolidinyl urea": {"concern": "Formaldehyde-releasing preservative"},
    "quaternium-15": {"concern": "Formaldehyde-releasing preservative"},
    "2-bromo-2-nitropropane-1,3-diol": {"concern": "Formaldehyde releaser"},
    "triclosan": {"concern": "Endocrine disruptor, antibiotic resistance risk"},
    "triclocarban": {"concern": "Endocrine disruptor"},
    "oxybenzone": {"concern": "Hormone disruptor, reef-damaging UV filter"},
    "benzophenone-3": {"concern": "Hormone disruptor"},
    "hydroquinone": {"concern": "Potential carcinogen, skin damage with overuse"},
    "coal tar": {"concern": "Known carcinogen"},
    "lead acetate": {"concern": "Neurotoxin"},
    "mercury": {"concern": "Neurotoxin"},
    "thimerosal": {"concern": "Mercury-based preservative"},
    "diethyl phthalate": {"concern": "Endocrine disruptor"},
    "dbp": {"concern": "Endocrine disruptor phthalate"},
    "polyethylene": {"concern": "Microplastic pollutant"},
}

MODERATE_CONCERN: dict[str, dict] = {
    "fragrance": {"concern": "Undisclosed allergen mixture"},
    "parfum": {"concern": "Undisclosed allergen mixture"},
    "alcohol denat": {"concern": "Can disrupt skin barrier at high concentrations"},
    "sd alcohol": {"concern": "Can disrupt skin barrier at high concentrations"},
    "bha": {"concern": "Potential endocrine disruptor"},
    "bht": {"concern": "Potential endocrine disruptor"},
    "petrolatum": {"concern": "Risk of PAH contamination if not refined"},
    "mineral oil": {"concern": "Comedogenic, occlusive"},
    "cyclopentasiloxane": {"concern": "Bioaccumulative silicone (environmental)"},
    "cyclohexasiloxane": {"concern": "Bioaccumulative silicone (environmental)"},
    "cyclotetrasiloxane": {"concern": "Bioaccumulative silicone (environmental)"},
    "propylene glycol": {"concern": "Potential irritant at high concentrations"},
    "sodium laureth sulfate": {"concern": "Milder sulfate but potential irritant"},
    "cocamide dea": {"concern": "Potential nitrosamine formation"},
    "diethanolamine": {"concern": "Potential nitrosamine formation"},
    "toluene": {"concern": "Neurotoxic solvent"},
}

BENEFICIAL: dict[str, dict] = {
    "hyaluronic acid": {"benefit": "Deep hydration plumper", "category": "hydrating"},
    "sodium hyaluronate": {"benefit": "Deep hydration, small molecule penetration", "category": "hydrating"},
    "glycerin": {"benefit": "Humectant, moisture retention", "category": "hydrating"},
    "glycerol": {"benefit": "Humectant, moisture retention", "category": "hydrating"},
    "aloe barbadensis": {"benefit": "Soothing and hydrating", "category": "soothing"},
    "aloe vera": {"benefit": "Soothing and hydrating", "category": "soothing"},
    "niacinamide": {"benefit": "Brightening, pore-minimizing, barrier repair", "category": "antioxidant"},
    "ascorbic acid": {"benefit": "Brightening vitamin C, antioxidant", "category": "antioxidant"},
    "ascorbyl glucoside": {"benefit": "Stable vitamin C derivative", "category": "antioxidant"},
    "sodium ascorbyl phosphate": {"benefit": "Stable vitamin C, antioxidant", "category": "antioxidant"},
    "tocopherol": {"benefit": "Vitamin E antioxidant", "category": "antioxidant"},
    "tocopheryl acetate": {"benefit": "Vitamin E antioxidant", "category": "antioxidant"},
    "retinol": {"benefit": "Anti-aging, accelerates cell turnover", "category": "anti-aging"},
    "retinyl palmitate": {"benefit": "Gentle vitamin A derivative", "category": "anti-aging"},
    "adenosine": {"benefit": "Anti-wrinkle, firming", "category": "anti-aging"},
    "centella asiatica": {"benefit": "Healing, anti-inflammatory", "category": "soothing"},
    "madecassoside": {"benefit": "Wound healing, anti-inflammatory", "category": "soothing"},
    "allantoin": {"benefit": "Skin-soothing and healing", "category": "soothing"},
    "bisabolol": {"benefit": "Anti-inflammatory, calming", "category": "soothing"},
    "panthenol": {"benefit": "Moisturizing, healing (pro-vitamin B5)", "category": "soothing"},
    "ceramide np": {"benefit": "Lipid barrier repair", "category": "hydrating"},
    "ceramide ap": {"benefit": "Lipid barrier repair", "category": "hydrating"},
    "ceramide eop": {"benefit": "Lipid barrier repair", "category": "hydrating"},
    "ceramide": {"benefit": "Lipid barrier repair", "category": "hydrating"},
    "arbutin": {"benefit": "Gentle brightening agent", "category": "brightening"},
    "alpha-arbutin": {"benefit": "Potent brightening agent", "category": "brightening"},
    "kojic acid": {"benefit": "Brightening, reduces hyperpigmentation", "category": "brightening"},
    "camellia sinensis": {"benefit": "Green tea antioxidant", "category": "antioxidant"},
    "resveratrol": {"benefit": "Powerful antioxidant", "category": "antioxidant"},
    "ferulic acid": {"benefit": "Antioxidant, vitamin C stabilizer", "category": "antioxidant"},
    "salicylic acid": {"benefit": "BHA exfoliant, acne-clearing", "category": "treatment"},
    "lactic acid": {"benefit": "Gentle AHA exfoliant, hydrating", "category": "treatment"},
    "glycolic acid": {"benefit": "AHA exfoliant, anti-aging", "category": "treatment"},
    "azelaic acid": {"benefit": "Anti-acne, brightening, anti-inflammatory", "category": "treatment"},
    "bakuchiol": {"benefit": "Plant-based retinol alternative", "category": "anti-aging"},
    "squalane": {"benefit": "Lightweight non-comedogenic moisturizer", "category": "hydrating"},
    "jojoba": {"benefit": "Skin-compatible moisturizing oil", "category": "hydrating"},
    "rosehip": {"benefit": "Vitamin A and C rich oil, anti-aging", "category": "anti-aging"},
    "shea butter": {"benefit": "Rich moisturizer, anti-inflammatory", "category": "hydrating"},
    "peptide": {"benefit": "Stimulates collagen, anti-aging", "category": "anti-aging"},
    "palmitoyl": {"benefit": "Collagen-stimulating peptide", "category": "anti-aging"},
    "zinc oxide": {"benefit": "Mineral UV filter, anti-inflammatory", "category": "treatment"},
    "titanium dioxide": {"benefit": "Mineral UV filter", "category": "treatment"},
}

# Comedogenic ratings (0-5 scale, standard dermatological comedogenicity scale).
# We only flag ingredients rated 3+ (moderate-to-high) — this is informational,
# shown to every user regardless of skin type, and does NOT affect the base score,
# since whether it matters depends entirely on the individual's skin (oily-skin
# profiles already get an extra Fit Score penalty for these in scoring personalization).
COMEDOGENIC: dict[str, dict] = {
    "isopropyl myristate": {"rating": 5},
    "algae extract": {"rating": 5},
    "wheat germ oil": {"rating": 5},
    "cocoa butter": {"rating": 5},
    "red algae": {"rating": 5},
    "isopropyl palmitate": {"rating": 4},
    "myristyl myristate": {"rating": 4},
    "oleic acid": {"rating": 4},
    "acetylated lanolin": {"rating": 4},
    "decyl oleate": {"rating": 4},
    "coconut oil": {"rating": 4},
    "mineral oil": {"rating": 3},
    "lanolin": {"rating": 3},
    "palm oil": {"rating": 3},
    "cetearyl alcohol": {"rating": 3},
    "peg-100 stearate": {"rating": 3},
    "isopropyl isostearate": {"rating": 3},
    "sodium lauryl sulfate": {"rating": 3},
}

# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _normalize(name: str) -> str:
    return name.lower().strip()


def _match_ingredient(ingredient: str, knowledge_base: dict[str, dict]) -> tuple[str, dict] | None:
    norm = _normalize(ingredient)
    for key, data in knowledge_base.items():
        if key in norm or norm in key:
            return key, data
    return None


def score_ingredients(ingredients: list[str], profile: SkinProfile | None = None) -> ProductScore:
    high: list[IngredientFlag] = []
    moderate: list[IngredientFlag] = []
    beneficial: list[IngredientFlag] = []
    comedogenic: list[IngredientFlag] = []
    allergens: list[IngredientFlag] = []
    prohibited: list[IngredientFlag] = []

    seen_high: set[str] = set()
    seen_moderate: set[str] = set()
    seen_beneficial: set[str] = set()
    seen_comedogenic: set[str] = set()
    seen_allergens: set[str] = set()
    seen_prohibited: set[str] = set()

    for ingredient in ingredients:
        # Comedogenic check runs independently of the categories below — an
        # ingredient can be both e.g. "moderate concern" AND "comedogenic",
        # since these are different axes and shouldn't gate each other out.
        comedo_match = _match_ingredient(ingredient, COMEDOGENIC)
        if comedo_match:
            key, data = comedo_match
            if key not in seen_comedogenic:
                seen_comedogenic.add(key)
                rating = data["rating"]
                comedogenic.append(
                    IngredientFlag(
                        name=ingredient,
                        concern="May clog pores for acne-prone or oily skin",
                        severity="moderate",
                        category=f"{rating}/5 comedogenic rating",
                    )
                )

        # EU Annex III fragrance allergen — independent of other categories,
        # informational (whether it matters depends on individual sensitization).
        allergen_match = match_allergen(ingredient)
        if allergen_match and allergen_match not in seen_allergens:
            seen_allergens.add(allergen_match)
            allergens.append(
                IngredientFlag(
                    name=ingredient,
                    concern="EU-regulated fragrance allergen — must be individually labelled above threshold",
                    severity="moderate",
                    category=allergen_match,
                )
            )

        # Substances banned outright in the EU — this DOES count against the
        # score, unlike the informational categories above, since this isn't
        # a matter of individual sensitivity — it's a legal prohibition.
        prohibited_match = match_prohibited(ingredient)
        if prohibited_match and ingredient not in seen_prohibited:
            seen_prohibited.add(ingredient)
            prohibited.append(
                IngredientFlag(
                    name=ingredient,
                    concern=prohibited_match,
                    severity="high",
                )
            )

        match = _match_ingredient(ingredient, HIGH_CONCERN)
        if match:
            key, data = match
            if key not in seen_high:
                seen_high.add(key)
                high.append(IngredientFlag(name=ingredient, concern=data["concern"], severity="high"))
            continue

        match = _match_ingredient(ingredient, MODERATE_CONCERN)
        if match:
            key, data = match
            if key not in seen_moderate:
                seen_moderate.add(key)
                moderate.append(IngredientFlag(name=ingredient, concern=data["concern"], severity="moderate"))
            continue

        match = _match_ingredient(ingredient, BENEFICIAL)
        if match:
            key, data = match
            if key not in seen_beneficial:
                seen_beneficial.add(key)
                beneficial.append(
                    IngredientFlag(
                        name=ingredient,
                        concern=data["benefit"],
                        severity="beneficial",
                        category=data["category"],
                    )
                )

    # Score calculation
    base = 70
    penalty_high = min(len(high) * 15, 45)
    penalty_moderate = min(len(moderate) * 8, 24)
    penalty_prohibited = min(len(prohibited) * 20, 40)  # steeper — this is a legal prohibition, not just a concern
    bonus_beneficial = min(len(beneficial) * 4, 30)

    raw = base - penalty_high - penalty_moderate - penalty_prohibited + bonus_beneficial
    score = max(0, min(100, raw))
    grade = _grade_for(score)

    result = ProductScore(
        score=score,
        grade=grade,
        high_concern=high,
        moderate_concern=moderate,
        beneficial=beneficial,
        comedogenic=comedogenic,
        allergens=allergens,
        prohibited=prohibited,
        total_ingredients=len(ingredients),
        flagged_count=len(high) + len(moderate) + len(prohibited),
    )

    if profile is not None:
        _apply_personalization(result, ingredients, profile)

    return result


def _grade_for(score: int) -> str:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 50:
        return "fair"
    if score >= 30:
        return "poor"
    return "avoid"


# ---------------------------------------------------------------------------
# Personalization — "Fit Score"
# ---------------------------------------------------------------------------

DRYING_ALCOHOLS = ["alcohol denat", "sd alcohol", "denatured alcohol", "isopropyl alcohol", "ethanol"]
SENSITIZERS = ["fragrance", "parfum", "essential oil", "citrus", "limonene", "linalool", "alcohol denat", "sd alcohol"]

CONCERN_BONUS_INGREDIENTS: dict[str, list[str]] = {
    "acne": ["salicylic acid", "niacinamide", "azelaic acid", "tea tree", "zinc"],
    "aging": ["retinol", "peptide", "ascorbic acid", "adenosine", "bakuchiol", "ferulic acid"],
    "hyperpigmentation": ["arbutin", "kojic acid", "ascorbic acid", "azelaic acid", "niacinamide"],
    "texture": ["lactic acid", "glycolic acid", "mandelic acid", "salicylic acid", "gluconolactone", "urea", "retinol"],
    "dark circles": ["caffeine", "phytonadione", "ascorbic acid", "niacinamide", "peptide"],
    "redness": ["centella", "allantoin", "panthenol", "bisabolol", "madecassoside"],
    "sensitive": ["centella", "allantoin", "panthenol", "bisabolol", "madecassoside"],
    "dryness": ["hyaluronic acid", "sodium hyaluronate", "glycerin", "ceramide", "squalane"],
}


def _any_match(ingredient_norm: str, keywords: list[str]) -> str | None:
    for kw in keywords:
        if kw in ingredient_norm:
            return kw
    return None


def _apply_personalization(result: ProductScore, ingredients: list[str], profile: SkinProfile) -> None:
    """Fit Score. Every adjustment is scaled by how severe the matching concern is
    on the user's latest scan (profile.concern_scores, YouCam ui_score where higher
    = healthier). With no scan data every weight is 1.0, so behaviour is unchanged
    for users who only filled in their profile by hand."""
    notes: list[PersonalNote] = []
    adjustment = 0
    seen_adjustments: set[str] = set()
    scan = profile.concern_scores or {}

    norm_ingredients = [(ing, _normalize(ing)) for ing in ingredients]

    def add(ing: str, reason: str, base: int, w: float) -> None:
        nonlocal adjustment
        amount = int(round(base * w))
        if amount == 0:
            amount = 1 if base > 0 else -1
        adjustment += amount
        notes.append(PersonalNote(ingredient=ing, reason=reason, adjustment=amount))

    # --- Pore-clogging ingredients: oily skin type, OR a scan showing pore/acne need
    oily = profile.skin_type == "oily"
    pores_flagged = flagged(scan, ["pore", "acne"])
    if oily or pores_flagged:
        w = max(
            weight(scan, ["oiliness"]) if oily else 0.0,
            weight(scan, ["pore", "acne"]) if pores_flagged else 0.0,
        )
        keys = ["pore", "acne"] if pores_flagged else ["oiliness"]
        reason = ("Comedogenic — can clog pores" if pores_flagged else "Comedogenic — can be heavy for oily skin") + suffix(scan, keys)
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, list(COMEDOGENIC.keys()))
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                add(ing, reason, -5, w)

    # --- Drying alcohols: dry skin type, OR a scan showing low hydration
    dry = profile.skin_type == "dry"
    hydration_flagged = flagged(scan, ["moisture"])
    if dry or hydration_flagged:
        w = weight(scan, ["moisture"])
        reason = "Drying alcohol — can worsen dryness" + suffix(scan, ["moisture"])
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, DRYING_ALCOHOLS)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                add(ing, reason, -5, w)

    # --- Sensitizers: sensitive skin type, OR a scan showing redness
    sensitive = profile.skin_type == "sensitive"
    redness_flagged = flagged(scan, ["redness"])
    if sensitive or redness_flagged:
        w = weight(scan, ["redness"])
        reason = "Common sensitizer for reactive skin" + suffix(scan, ["redness"])
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, SENSITIZERS)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                add(ing, reason, -8, w)

    # --- Concern-based bonuses, scaled by how severe that concern is
    for concern in profile.concerns:
        key = concern.lower()
        bonus_list = CONCERN_BONUS_INGREDIENTS.get(key)
        if not bonus_list:
            continue
        keys = APP_CONCERN_KEYS.get(key, [])
        w = weight(scan, keys)
        reason = f"Targets your {concern} concern" + suffix(scan, keys)
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, bonus_list)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                add(ing, reason, 6, w)

    # --- User-declared sensitivities: always penalized, regardless of scan
    for sensitivity in profile.sensitivities:
        sens_norm = _normalize(sensitivity)
        if not sens_norm:
            continue
        for ing, norm in norm_ingredients:
            if sens_norm in norm or norm in sens_norm:
                key = f"sens:{sens_norm}"
                if key not in seen_adjustments:
                    seen_adjustments.add(key)
                    add(ing, f"You flagged a sensitivity to {sensitivity}", -12, 1.0)

    fit_score = max(0, min(100, result.score + adjustment))

    result.fit_score = fit_score
    result.fit_grade = _grade_for(fit_score)
    result.personal_notes = notes
