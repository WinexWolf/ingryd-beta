from app.models.product import IngredientFlag, ProductScore, SkinProfile, PersonalNote

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

    seen_high: set[str] = set()
    seen_moderate: set[str] = set()
    seen_beneficial: set[str] = set()

    for ingredient in ingredients:
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
    bonus_beneficial = min(len(beneficial) * 4, 30)

    raw = base - penalty_high - penalty_moderate + bonus_beneficial
    score = max(0, min(100, raw))
    grade = _grade_for(score)

    result = ProductScore(
        score=score,
        grade=grade,
        high_concern=high,
        moderate_concern=moderate,
        beneficial=beneficial,
        total_ingredients=len(ingredients),
        flagged_count=len(high) + len(moderate),
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

COMEDOGENIC = ["mineral oil", "petrolatum", "coconut oil", "lanolin", "isopropyl myristate", "cocoa butter"]
DRYING_ALCOHOLS = ["alcohol denat", "sd alcohol", "denatured alcohol", "isopropyl alcohol", "ethanol"]
SENSITIZERS = ["fragrance", "parfum", "essential oil", "citrus", "limonene", "linalool", "alcohol denat", "sd alcohol"]

CONCERN_BONUS_INGREDIENTS: dict[str, list[str]] = {
    "acne": ["salicylic acid", "niacinamide", "azelaic acid", "tea tree", "zinc"],
    "aging": ["retinol", "peptide", "ascorbic acid", "adenosine", "bakuchiol", "ferulic acid"],
    "hyperpigmentation": ["arbutin", "kojic acid", "ascorbic acid", "azelaic acid", "niacinamide"],
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
    notes: list[PersonalNote] = []
    adjustment = 0
    seen_adjustments: set[str] = set()

    norm_ingredients = [(ing, _normalize(ing)) for ing in ingredients]

    # Skin-type-based penalties
    if profile.skin_type == "oily":
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, COMEDOGENIC)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                adjustment -= 5
                notes.append(PersonalNote(ingredient=ing, reason="Comedogenic — can be heavy for oily skin", adjustment=-5))

    if profile.skin_type == "dry":
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, DRYING_ALCOHOLS)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                adjustment -= 5
                notes.append(PersonalNote(ingredient=ing, reason="Drying alcohol — can worsen dryness", adjustment=-5))

    if profile.skin_type == "sensitive":
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, SENSITIZERS)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                adjustment -= 8
                notes.append(PersonalNote(ingredient=ing, reason="Common sensitizer for reactive skin", adjustment=-8))

    # Concern-based bonuses
    for concern in profile.concerns:
        bonus_list = CONCERN_BONUS_INGREDIENTS.get(concern.lower())
        if not bonus_list:
            continue
        for ing, norm in norm_ingredients:
            hit = _any_match(norm, bonus_list)
            if hit and hit not in seen_adjustments:
                seen_adjustments.add(hit)
                adjustment += 6
                notes.append(PersonalNote(ingredient=ing, reason=f"Targets your {concern} concern", adjustment=6))

    # User-declared sensitivities — always penalized, regardless of skin type
    for sensitivity in profile.sensitivities:
        sens_norm = _normalize(sensitivity)
        if not sens_norm:
            continue
        for ing, norm in norm_ingredients:
            if sens_norm in norm or norm in sens_norm:
                key = f"sens:{sens_norm}"
                if key not in seen_adjustments:
                    seen_adjustments.add(key)
                    adjustment -= 12
                    notes.append(PersonalNote(ingredient=ing, reason=f"You flagged a sensitivity to {sensitivity}", adjustment=-12))

    fit_raw = result.score + adjustment
    fit_score = max(0, min(100, fit_raw))

    result.fit_score = fit_score
    result.fit_grade = _grade_for(fit_score)
    result.personal_notes = notes
