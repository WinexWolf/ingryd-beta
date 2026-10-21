"""Best-effort product type from a product name (the catalog's category column is
'uncategorized' for about a third of products, and routine items have no category)."""
from app.services.catalog import CATEGORY_KEYWORDS

# Name words the catalog's tag-based keywords don't cover.
EXTRA_KEYWORDS = [
    ("eye_cream", ["eye"]),
    ("cleanser", ["wash", "foam", "cleansing"]),
    ("serum", ["concentrate", "booster"]),
    ("moisturizer", ["gel-cream", "moisture"]),
]

SPF_ACTIVES = ["zinc oxide", "titanium dioxide", "avobenzone", "octocrylene", "homosalate",
               "ethylhexyl methoxycinnamate", "uvinul", "tinosorb", "octinoxate", "octisalate"]


def infer_category(name: str | None, ingredients: list[str] | None = None) -> str:
    text = (name or "").lower().replace(" ", "-")
    for category, keywords in [*CATEGORY_KEYWORDS, *EXTRA_KEYWORDS]:
        if any(kw in text for kw in keywords):
            return category
    if ingredients and any(any(a in i.lower() for a in SPF_ACTIVES) for i in ingredients):
        return "sunscreen"
    return "uncategorized"
