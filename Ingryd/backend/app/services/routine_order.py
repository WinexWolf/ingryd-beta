"""Suggested order to apply a routine's products, plus a few slot-specific tips.

This is general layering guidance, not medical advice: cleanse first, then thinner products before thicker ones,
treatments before moisturiser, oils after moisturiser, and sunscreen as the very last morning step.
Product type comes from the name/ingredients (categorize.infer_category); anything we can't place goes after the serums.
"""
from app.models.routine import RoutineOrderItem, RoutineOrderResponse, RoutineProduct
from app.services.categorize import infer_category

AM_ORDER = ["cleanser", "toner", "essence", "ampoule", "serum", "spot_treatment", "eye_cream", "moisturizer", "oil", "sunscreen"]
PM_ORDER = ["cleanser", "exfoliant", "toner", "essence", "ampoule", "serum", "spot_treatment", "eye_cream", "moisturizer", "oil"]
UNKNOWN_AFTER = "serum"

STEP_NOTE = {
    "cleanser": "Cleanse first, on a clean base for everything else.",
    "exfoliant": "Use a few nights a week, not every night.",
    "toner": "Thin and watery goes on early.",
    "essence": "Thin and watery goes on early.",
    "ampoule": "Concentrated, so it goes before heavier creams.",
    "serum": "Treatment step, before moisturiser.",
    "spot_treatment": "Dab on the spots only, after your serum.",
    "eye_cream": "Gently around the eyes, before your main moisturiser.",
    "moisturizer": "Seals in the layers underneath.",
    "oil": "Oils go over the moisturiser to lock it in.",
    "sunscreen": "Always the last morning step.",
    "mask": "Not a daily step; use it on its own evening, in place of your serum and moisturiser.",
    "mist": "Optional; a mist can go on at any point on clean skin.",
}

# Within the serum step, lower numbers go first (low-pH actives, then hydrators, then retinoids).
ACID_VITC = ["ascorbic acid", "glycolic acid", "lactic acid", "salicylic acid", "mandelic acid", "azelaic acid"]
HYDRATING = ["niacinamide", "hyaluronic", "peptide", "panthenol", "centella", "glycerin"]
RETINOID = ["retinol", "retinal", "retinoid", "retinyl", "bakuchiol", "adapalene"]


SERUM_NAME_HINTS = ["niacinamide", "retinol", "retinal", "vitamin c", "ascorbic", "hyaluronic", "peptide", "azelaic", "alpha arbutin",
                    "caffeine", "bakuchiol", "ceramide", "squalane", "centella", "salicylic", "glycolic", "lactic acid", "mandelic"]


def _has(ings: list[str], keys: list[str]) -> bool:
    low = [i.lower() for i in ings]
    return any(k in i for i in low for k in keys)


def _serum_rank(ings: list[str]) -> int:
    if _has(ings, ACID_VITC):
        return 0
    if _has(ings, RETINOID):
        return 2
    return 1


def order_routine(products: list[RoutineProduct]) -> RoutineOrderResponse:
    result: dict[str, list[RoutineOrderItem]] = {"am": [], "pm": []}
    tips: list[str] = []

    for slot, order in (("am", AM_ORDER), ("pm", PM_ORDER)):
        placed: list[tuple[float, int, RoutineOrderItem]] = []
        for idx, p in enumerate(products):
            if p.slot != slot:
                continue
            cat = infer_category(p.name, p.ingredients_parsed)
            guessed = False
            if cat == "uncategorized" and any(h in p.name.lower() for h in SERUM_NAME_HINTS):
                cat, guessed = "serum", True      # e.g. "Niacinamide 10% + Zinc 1%": named after its active, almost always a serum
            known = cat in order
            if cat == "uncategorized":
                pos = order.index(UNKNOWN_AFTER) + 0.5
                note = "We couldn't tell what type of product this is, so it is placed after your serums. Move it if that's wrong."
            elif not known:
                # masks, mists, or a type that doesn't belong in this slot (e.g. sunscreen in the evening)
                pos = order.index(UNKNOWN_AFTER) + 0.5
                note = STEP_NOTE.get(cat, "")
            else:
                pos = float(order.index(cat))
                note = STEP_NOTE.get(cat, "")
            if guessed:
                note = "Treated as a serum, based on its name. " + note
            if cat == "serum":
                pos += _serum_rank(p.ingredients_parsed) / 10
            placed.append((pos, idx, RoutineOrderItem(name=p.name, brand=p.brand, category=cat, note=note)))
        placed.sort(key=lambda t: (t[0], t[1]))
        steps = [item for _, _, item in placed]
        for n, item in enumerate(steps, 1):
            item.step = n
        result[slot] = steps

    am = [p for p in products if p.slot == "am"]
    pm = [p for p in products if p.slot == "pm"]
    am_cats = {infer_category(p.name, p.ingredients_parsed) for p in am}
    if am and "sunscreen" not in am_cats:
        tips.append("There's no sunscreen in your morning routine. It is the most important anti-ageing and dark-spot step, so add one as the last step.")
    for p in pm:
        if infer_category(p.name, p.ingredients_parsed) == "sunscreen":
            tips.append(f"{p.name} is a sunscreen, which is for the morning. In the evening you can skip it.")
    for p in am:
        if _has(p.ingredients_parsed, RETINOID[:3]) or _has(p.ingredients_parsed, ["glycolic acid", "lactic acid", "salicylic acid"]):
            tips.append(f"{p.name} contains a retinoid or exfoliating acid. These are usually better in the evening, since they make skin more sun-sensitive.")
    for p in pm:
        if _has(p.ingredients_parsed, ["ascorbic acid"]) and infer_category(p.name, p.ingredients_parsed) == "serum":
            tips.append(f"{p.name} contains vitamin C, which most people use in the morning under sunscreen. It still works in the evening if that suits you.")
    return RoutineOrderResponse(am=result["am"], pm=result["pm"], tips=list(dict.fromkeys(tips)))
