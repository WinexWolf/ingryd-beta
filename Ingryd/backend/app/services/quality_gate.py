SKIN_CATEGORY_ALLOWLIST = [
    "skin-care", "skincare", "facial-skin-care", "face-care", "body-care",
    "sun-care", "sunscreen", "sun-protection", "moisturizer", "moisturisers",
    "moisturising-creams", "creams", "lotions", "cleansers", "facial-cleansers",
    "cleansing-milks", "toners", "serums", "essences", "face-masks", "masks",
    "eye-care", "eye-creams", "exfoliants", "peels", "anti-aging",
    "anti-aging-products", "acne-treatments", "spot-treatments",
]


def is_skin_relevant(categories_tags_raw: str | None) -> bool:
    """Allow-list, not a block-list, deliberately — a product needs a real
    skincare-category tag to pass; no category tag data at all = rejected,
    rather than assumed innocent."""
    # categories_tags looks like "en:skin-care,en:facial-creams,en:anti-aging-products"
    if not categories_tags_raw:
        return False
    tags = [t.strip().lower() for t in categories_tags_raw.split(',')]
    return any(any(allowed in tag for allowed in SKIN_CATEGORY_ALLOWLIST) for tag in tags)


def passes_quality_gate(code: str | None, brand: str | None, name: str | None, ingredients_text: str | None) -> bool:
    """Real barcode, real brand, real product name, and ingredient text at
    least 10 characters. No minimum ingredient count beyond that — a genuine
    single-ingredient product with real text (e.g. "Jojoba Seed Oil") passes
    fine; this is a length-of-text floor, not a token-count floor."""
    if not code or not brand or not name:
        return False
    if not ingredients_text or len(ingredients_text) < 10:
        return False
    return True
