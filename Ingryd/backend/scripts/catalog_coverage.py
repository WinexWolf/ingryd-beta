"""How well does the catalog cover each product type, and what would we recommend?

Run from Ingryd/backend (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env):
    PYTHONPATH=. python scripts/catalog_coverage.py

Prints, per category, how many products have a usable ingredient list and how many
score 70+ for a sample acne / texture / dark-circle profile. Read-only.
"""
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.models.product import SkinProfile  # noqa: E402
from app.services import recommend as rec  # noqa: E402

PROFILE = SkinProfile(
    skin_type="combination",
    concerns=["acne", "texture", "dark circles"],
    concern_scores={"pore": 73, "acne": 80, "texture": 78, "dark_circle_v2": 71, "oiliness": 80},
)

catalog = rec.load_catalog()
print(f"products usable for recommendations: {len(catalog)}\n")
usable = Counter(r["category"] for r in catalog)
good = Counter(p.category for p in rec._rank(PROFILE, min_fit=70))

print(f"{'category':<16}{'usable':>8}{'fit>=70':>9}")
for cat, n in usable.most_common():
    print(f"{cat:<16}{n:>8}{good.get(cat, 0):>9}")

print("\ntop picks for the sample profile:")
for p in rec.recommend(PROFILE).top:
    print(f"  {p.fit_score:>3}  {p.brand} - {p.name} [{p.category}]")
    for r in p.reasons[:2]:
        print(f"        + {r}")
