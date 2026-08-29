from app.models.routine import RoutineProduct, RoutineConflict, RoutineCheckResponse, RedundantActive
from app.services.order_analysis import detect_redundant_actives

# ---------------------------------------------------------------------------
# Known ingredient interaction rules.
# Each rule matches two ingredient "keys" (substring match, same as scoring.py)
# found in two DIFFERENT products applied in the SAME slot (both AM or both PM).
# ---------------------------------------------------------------------------

RULES: list[dict] = [
    {
        "a": "retinol", "b": "glycolic acid", "severity": "high",
        "reason": "Retinol + AHA compounds over-exfoliate and strip the skin barrier.",
        "advice": "Alternate nights, or use the AHA in AM and retinol at PM on separate days.",
    },
    {
        "a": "retinol", "b": "lactic acid", "severity": "high",
        "reason": "Retinol + AHA compounds over-exfoliate and strip the skin barrier.",
        "advice": "Alternate nights, or use the AHA in AM and retinol at PM on separate days.",
    },
    {
        "a": "retinol", "b": "salicylic acid", "severity": "high",
        "reason": "Combining retinol with a BHA increases irritation and peeling risk.",
        "advice": "Use on alternating nights rather than layering in the same routine.",
    },
    {
        "a": "retinol", "b": "benzoyl peroxide", "severity": "high",
        "reason": "Benzoyl peroxide can oxidize and deactivate retinol, reducing its effect.",
        "advice": "Use benzoyl peroxide in AM and retinol at PM, on different applications.",
    },
    {
        "a": "retinyl palmitate", "b": "glycolic acid", "severity": "moderate",
        "reason": "Retinoid + AHA together can be irritating, even with a gentler retinoid.",
        "advice": "Start on alternate nights and watch for redness or flaking.",
    },
    {
        "a": "salicylic acid", "b": "glycolic acid", "severity": "moderate",
        "reason": "Two exfoliating acids in one routine increases the risk of over-exfoliation.",
        "advice": "Use on alternate days, or one in AM and the other at PM.",
    },
    {
        "a": "salicylic acid", "b": "lactic acid", "severity": "moderate",
        "reason": "Two exfoliating acids in one routine increases the risk of over-exfoliation.",
        "advice": "Use on alternate days, or one in AM and the other at PM.",
    },
    {
        "a": "ascorbic acid", "b": "benzoyl peroxide", "severity": "moderate",
        "reason": "Benzoyl peroxide oxidizes vitamin C, reducing its antioxidant effect.",
        "advice": "Use vitamin C in AM and benzoyl peroxide in PM instead.",
    },
    {
        "a": "ascorbic acid", "b": "retinol", "severity": "moderate",
        "reason": "Vitamin C and retinol have different optimal pH ranges and can irritate together.",
        "advice": "Use vitamin C in the AM routine and retinol at PM.",
    },
    {
        "a": "ascorbic acid", "b": "glycolic acid", "severity": "moderate",
        "reason": "Layering vitamin C with an AHA in the same routine can heighten sensitivity.",
        "advice": "Space them out — vitamin C AM, acid exfoliant on alternate evenings.",
    },
]


def _match(ingredients: list[str], key: str) -> bool:
    norm = [i.lower() for i in ingredients]
    return any(key in ing or ing in key for ing in norm)


def check_routine(products: list[RoutineProduct]) -> RoutineCheckResponse:
    conflicts: list[RoutineConflict] = []
    am_count = sum(1 for p in products if p.slot == "am")
    pm_count = sum(1 for p in products if p.slot == "pm")

    for slot in ("am", "pm"):
        slot_products = [p for p in products if p.slot == slot]
        for i in range(len(slot_products)):
            for j in range(i + 1, len(slot_products)):
                p1, p2 = slot_products[i], slot_products[j]
                for rule in RULES:
                    a_in_1 = _match(p1.ingredients_parsed, rule["a"])
                    b_in_2 = _match(p2.ingredients_parsed, rule["b"])
                    a_in_2 = _match(p2.ingredients_parsed, rule["a"])
                    b_in_1 = _match(p1.ingredients_parsed, rule["b"])

                    if (a_in_1 and b_in_2) or (a_in_2 and b_in_1):
                        conflicts.append(
                            RoutineConflict(
                                severity=rule["severity"],
                                ingredient_a=rule["a"],
                                ingredient_b=rule["b"],
                                product_a=p1.name,
                                product_b=p2.name,
                                reason=rule["reason"],
                                advice=rule["advice"],
                            )
                        )

    redundant_raw = detect_redundant_actives([{"name": p.name, "ingredients_parsed": p.ingredients_parsed} for p in products])
    redundant_actives = [RedundantActive(**r) for r in redundant_raw]

    return RoutineCheckResponse(
        conflicts=conflicts,
        am_count=am_count,
        pm_count=pm_count,
        clean=len(conflicts) == 0,
        redundant_actives=redundant_actives,
    )
