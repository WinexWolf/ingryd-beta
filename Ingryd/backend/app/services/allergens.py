"""
EU Annex III fragrance allergens — Regulation (EC) No 1223/2009, as expanded
by Commission Regulation (EU) 2023/1545 (in force from 31 July 2026).

Source: compiled from Regulation (EU) 2023/1545 (Official Journal L 188,
27 July 2023) cross-checked against Registrar Corp, CIRS Group, and
COSlaw.eu summaries — not scraped from any single third party. This is the
CURRENT expanded list (80 substances), not the outdated pre-2023 24-entry
version.

An allergen must be individually labelled once its concentration in the
finished product exceeds 0.001% in leave-on products or 0.01% in rinse-off
products — we don't have concentration data, so this flags PRESENCE only;
whether it clears the legal labelling threshold in a specific product is a
separate question this can't answer.
"""

# The 24 historically-labelled allergens (Annex III entries 45, 67-92)
EU_ALLERGENS_HISTORIC = [
    "Amyl Cinnamal", "Amyl Cinnamyl Alcohol", "Benzyl Alcohol", "Benzyl Salicylate",
    "Cinnamyl Alcohol", "Cinnamal", "Citral", "Citronellol", "Coumarin", "Eugenol",
    "Farnesol", "Geraniol", "Hexyl Cinnamal", "Hydroxycitronellal", "Isoeugenol",
    "Anise Alcohol", "Benzyl Benzoate", "Benzyl Cinnamate", "Linalool", "Limonene",
    "Methyl 2-Octynoate", "Alpha-Isomethyl Ionone",
    "Evernia Prunastri Extract", "Evernia Furfuracea Extract",
]

# The 56 additional allergens added by Regulation (EU) 2023/1545 (entries 327-371)
EU_ALLERGENS_2023_ADDITIONS = [
    "Acetyl Cedrene", "Amyl Salicylate", "Anethole", "Benzaldehyde", "Camphor",
    "Beta-Caryophyllene", "Carvone", "Dimethyl Phenethyl Acetate", "Hexadecanolactone",
    "Hexamethylindanopyran", "Linalyl Acetate", "Menthol",
    "Trimethylcyclopentenyl Methylisopentenol", "Salicylaldehyde", "Santalol",
    "Sclareol", "Terpineol", "Tetramethyl Acetyloctahydronaphthalenes",
    "Trimethylbenzenepropanol", "Vanillin",
    "Cananga Odorata Oil", "Cananga Odorata Extract",
    "Cinnamomum Cassia Leaf Oil", "Cinnamomum Zeylanicum Bark Oil",
    "Citrus Aurantium Flower Oil", "Citrus Aurantium Peel Oil",
    "Citrus Aurantium Bergamia Peel Oil", "Citrus Limon Peel Oil",
    "Cymbopogon Oil", "Lemongrass Oil", "Eucalyptus Globulus Oil",
    "Eugenia Caryophyllus Oil", "Jasminum Oil", "Jasmine Oil", "Jasmine Extract",
    "Juniperus Virginiana Oil", "Laurus Nobilis Leaf Oil",
    "Lavandula Oil", "Lavandula Extract", "Lavender Oil",
    "Mentha Piperita Oil", "Peppermint Oil", "Mentha Viridis Leaf Oil", "Spearmint Oil",
    "Narcissus Extract", "Pelargonium Graveolens Oil", "Geranium Oil",
    "Pogostemon Cablin Oil", "Patchouli Oil",
    "Rosa Flower Oil", "Rose Flower Oil", "Rose Extract",
    "Santalum Album Oil", "Sandalwood Oil",
    "Eugenyl Acetate", "Geranyl Acetate", "Isoeugenyl Acetate", "Pinene",
]

EU_ALLERGENS_ALL = EU_ALLERGENS_HISTORIC + EU_ALLERGENS_2023_ADDITIONS

# Former allergens now banned outright (Annex II, not III) — seed list for the
# broader "regulatory status" flag. Deliberately small and high-confidence
# rather than a guessed comprehensive banned-substances list.
EU_PROHIBITED_SUBSTANCES = {
    "hydroxyisohexyl 3-cyclohexene carboxaldehyde": "Banned in the EU (Regulation 2017/1410) — formerly a fragrance allergen, prohibited outright.",
    "hicc": "Banned in the EU (Regulation 2017/1410) — formerly a fragrance allergen, prohibited outright.",
    "lyral": "Banned in the EU (Regulation 2017/1410) — formerly a fragrance allergen, prohibited outright.",
    "butylphenyl methylpropional": "Banned in the EU (Regulation 2021/1902) — reclassified as CMR (carcinogenic/mutagenic/reprotoxic).",
    "lilial": "Banned in the EU (Regulation 2021/1902) — reclassified as CMR (carcinogenic/mutagenic/reprotoxic).",
}


def match_allergen(ingredient_name: str) -> str | None:
    """Returns the matched EU Annex III allergen name if this ingredient is
    (or contains) a listed fragrance allergen, else None."""
    name_lower = ingredient_name.lower()
    for allergen in EU_ALLERGENS_ALL:
        if allergen.lower() in name_lower:
            return allergen
    return None


def match_prohibited(ingredient_name: str) -> str | None:
    """Returns a description if this ingredient is a substance banned
    outright in the EU, else None."""
    name_lower = ingredient_name.lower()
    for key, description in EU_PROHIBITED_SUBSTANCES.items():
        if key in name_lower:
            return description
    return None
