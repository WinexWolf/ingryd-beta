"""
Order-aware analysis features that don't depend on any external data source —
just the ingredient list's own order, which cosmetic labeling law already
requires to be descending-by-concentration (down to ~1%, after which order
isn't regulated). These are estimates, not real percentages — no public
source has actual formulation data, so anyone claiming otherwise is guessing
too; the difference here is we say so.
"""

CONCENTRATION_TIERS = [
    (3, "likely >10%"),
    (7, "likely 1–10%"),
    (999, "likely <1% — order may not reflect concentration past this point"),
]

# Hero-ingredient keyword -> the ingredient-name substrings that count as
# "that ingredient" for marketing-dose purposes. Deliberately small and
# high-confidence rather than an exhaustive marketing-buzzword list.
HERO_INGREDIENT_MAP: dict[str, list[str]] = {
    "vitamin c": ["ascorbic acid", "sodium ascorbyl phosphate", "magnesium ascorbyl phosphate", "ascorbyl glucoside", "3-o-ethyl ascorbic acid", "tetrahexyldecyl ascorbate"],
    "retinol": ["retinol", "retinyl palmitate", "retinal", "retinaldehyde", "hydroxypinacolone retinoate", "granactive retinoid"],
    "niacinamide": ["niacinamide"],
    "hyaluronic acid": ["hyaluronic acid", "sodium hyaluronate"],
    "salicylic acid": ["salicylic acid"],
    "peptide": ["peptide"],
    "collagen": ["collagen"],
    "ceramide": ["ceramide"],
}

# Active-ingredient families for redundant-active detection across a routine.
ACTIVE_FAMILIES: dict[str, list[str]] = {
    "retinoid": ["retinol", "retinyl palmitate", "retinal", "retinaldehyde", "hydroxypinacolone retinoate"],
    "vitamin c": ["ascorbic acid", "sodium ascorbyl phosphate", "magnesium ascorbyl phosphate", "ascorbyl glucoside"],
    "niacinamide": ["niacinamide"],
    "salicylic acid (bha)": ["salicylic acid"],
    "glycolic/lactic acid (aha)": ["glycolic acid", "lactic acid", "mandelic acid"],
    "benzoyl peroxide": ["benzoyl peroxide"],
    "azelaic acid": ["azelaic acid"],
}


def tier_for_position(position: int) -> str:
    """1-indexed position in the ingredient list -> an estimated concentration
    tier, based on the standard cosmetic-labeling convention that ingredients
    are listed in descending concentration order (mandatory above ~1%)."""
    for threshold, label in CONCENTRATION_TIERS:
        if position <= threshold:
            return label
    return CONCENTRATION_TIERS[-1][1]


def concentration_tiers(ingredients: list[str]) -> list[dict]:
    """Returns [{name, position, tier}] for the full ingredient list."""
    return [
        {"name": ing, "position": i + 1, "tier": tier_for_position(i + 1)}
        for i, ing in enumerate(ingredients)
    ]


def detect_marketing_dose(product_name: str | None, ingredients: list[str]) -> list[dict]:
    """Checks whether any 'hero' ingredient implied by the product name is
    buried low enough in the ingredient list that it's unlikely to be
    present at an effective concentration. Uses the same tiering logic as
    concentration_tiers() for consistency — flags when the hero ingredient
    falls in the lowest tier (likely <1%), regardless of absolute position,
    rather than a separate arbitrary cutoff. Returns a list of flags — empty
    if nothing's implied by the name, or if the hero ingredient is
    reasonably high in the list."""
    if not product_name:
        return []

    name_lower = product_name.lower()
    flags = []

    for hero_keyword, ingredient_substrings in HERO_INGREDIENT_MAP.items():
        if hero_keyword not in name_lower:
            continue
        for i, ing in enumerate(ingredients):
            ing_lower = ing.lower()
            if any(sub in ing_lower for sub in ingredient_substrings):
                position = i + 1
                tier = tier_for_position(position)
                if tier == CONCENTRATION_TIERS[-1][1]:  # the "likely <1%" tier
                    flags.append({
                        "hero_ingredient": hero_keyword,
                        "matched_ingredient": ing,
                        "position": position,
                        "note": f"'{hero_keyword.title()}' is marketed on the front label, but {ing} appears at position "
                                f"{position} of {len(ingredients)} — likely present at a low, possibly ineffective dose.",
                    })
                break  # only flag the first/highest-positioned match for this hero ingredient
    return flags


def detect_redundant_actives(routine_items: list[dict], min_count: int = 3) -> list[dict]:
    """routine_items: [{"name": str, "ingredients_parsed": list[str]}, ...]
    Flags when the same active-ingredient family appears in >= min_count
    products across a routine (default 3, matching the intended use case:
    catching accidental over-layering, not routine analysis of every overlap)."""
    family_to_products: dict[str, list[str]] = {}

    for item in routine_items:
        product_name = item.get("name", "Unnamed product")
        ingredients = [i.lower() for i in item.get("ingredients_parsed", [])]
        matched_families = set()
        for family, substrings in ACTIVE_FAMILIES.items():
            if any(any(sub in ing for sub in substrings) for ing in ingredients):
                matched_families.add(family)
        for family in matched_families:
            family_to_products.setdefault(family, []).append(product_name)

    return [
        {
            "active_family": family,
            "product_count": len(products),
            "products": products,
            "note": f"{len(products)} products in your routine contain {family} — check you're not over-layering.",
        }
        for family, products in family_to_products.items()
        if len(products) >= min_count
    ]
