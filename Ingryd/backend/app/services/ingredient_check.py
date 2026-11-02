"""Does this text actually look like a cosmetic ingredient list?

The scorer starts every product at 70 and only moves it when it recognises a
concern or a benefit, so ANY text (a web page, a receipt, a recipe) used to
come back as a confident "70 / Good". This check runs first and refuses text
that doesn't look like an INCI-style list, instead of scoring it.

It is deliberately a *plausibility* test, not a dictionary lookup: the catalog
holds thousands of ingredients and new ones appear all the time, so we look at
the shape of the text (short comma-separated names, cosmetic-chemistry word
endings, few digits/symbols/sentences) plus a list of very common INCI words.
"""
import re
from dataclasses import dataclass

from app.services import scoring

# Whole words that are very common in INCI lists.
_COMMON = {
    "water", "aqua", "eau", "glycerin", "glycerine", "alcohol", "fragrance", "parfum", "flavor", "aroma",
    "oil", "butter", "extract", "acid", "wax", "gum", "silica", "talc", "mica", "dimethicone", "carbomer",
    "tocopherol", "retinol", "niacinamide", "panthenol", "allantoin", "urea", "squalane", "squalene", "ceramide",
    "peptide", "collagen", "hyaluronate", "citrate", "phenoxyethanol", "ethylhexylglycerin", "limonene",
    "linalool", "citronellol", "geraniol", "coumarin", "eugenol", "benzyl", "zinc", "oxide", "oxides",
    "titanium", "dioxide", "iron", "ci", "sodium", "potassium", "calcium", "magnesium", "stearate", "cetyl",
    "stearyl", "cetearyl", "caprylic", "capric", "triglyceride", "glyceryl", "peg", "ppg", "bht", "bha", "edta",
    "disodium", "trisodium", "hydroxide", "chloride", "sulfate", "lactate", "glycol", "propanediol", "butylene",
    "pentylene", "hexanediol", "xanthan", "cellulose", "polysorbate", "lecithin", "sorbitan", "isopropyl",
    "myristate", "avobenzone", "octocrylene", "homosalate", "octisalate", "lanolin", "petrolatum", "paraffin",
    "mineral", "vitamin", "ascorbic", "salicylic", "lactic", "glycolic", "citric", "hyaluronic", "kojic",
    "azelaic", "tranexamic", "ferulic", "benzoate", "sorbate", "paraben", "methylparaben", "propylparaben",
    "ethylparaben", "butylparaben", "tea", "dea", "mea", "pca", "pvp", "vp", "copolymer", "crosspolymer",
    "polymer", "ferment", "filtrate", "lysate", "hydrolysate", "powder", "juice", "leaf", "root", "seed",
    "flower", "fruit", "peel", "bark", "kernel", "stem", "algae", "bisabolol", "caffeine", "menthol",
    "camphor", "biotin", "glucose", "sucrose", "fructose", "starch", "protein", "amino", "keratin", "silk",
    "honey", "milk", "clay", "kaolin", "bentonite", "charcoal", "retinyl", "palmitate", "adenosine",
}

# Cosmetic-chemistry word endings (checked on single words).
_SUFFIX = re.compile(
    r"(ate|ide|ine|ene|ane|ol|yl|one|ose|ium|ester|ether|amide|amine|oate|onate|cone|"
    r"acid|oil|gum|wax|extract|butter|ferment|filtrate|lysate|hydrolysate|polymer|glucoside|"
    r"phosphate|carbonate|silicate|ceramide|peptide|tocopherol|alcohol|inol|ase|ein)$"
)

_BAD_CHARS = re.compile(r"[{}_\\<>@#=|\[\]]|https?:|www\.|\.com|\.org|\.io")
_WORD = re.compile(r"[A-Za-z][A-Za-z\-']*")


def _knowledge_words() -> set[str]:
    words: set[str] = set()
    for table in (scoring.HIGH_CONCERN, scoring.MODERATE_CONCERN, scoring.BENEFICIAL, scoring.COMEDOGENIC):
        for key in table:
            words.update(w.lower() for w in _WORD.findall(key))
    return words


_KNOWN = _knowledge_words()


def _inci_like(word: str) -> bool:
    w = word.lower()
    if w in _COMMON or w in _KNOWN:
        return True
    return len(w) >= 5 and bool(_SUFFIX.search(w))


def _token_flags(token: str) -> tuple[bool, bool]:
    """(looks_bad, looks_inci)."""
    words = _WORD.findall(token)
    digits = sum(c.isdigit() for c in token)
    letters = sum(c.isalpha() for c in token)
    bad = (
        bool(_BAD_CHARS.search(token))
        or token.lstrip().startswith("/")
        or len(words) > 7
        or (letters and digits > letters)          # "12345", "2024-10-16"
        or token.count("/") >= 2 and " " in token   # path-like or URL-like
        or token.rstrip().endswith((".", ":", "?", "!")) and len(words) > 3  # a sentence
    )
    inci = (not bad) and any(_inci_like(w) for w in words)
    return bad, inci


@dataclass
class IngredientCheck:
    ok: bool
    confidence: float
    reason: str | None = None


# Where the list starts and where the label moves on to something else.
_HEADER = re.compile(r"\b(?:ingredients?|ingr[eé]dients?|inci|composition|zutaten)\b\s*[:：.\-–—]?", re.I)
_STOP = re.compile(
    r"\b(?:directions?|how to use|usage|use:|warnings?|caution|precautions?|made in|manufactured|"
    r"distributed|dist\.|best before|exp(?:iry)?|batch|lot no|net w(?:t|eight)|questions\??|"
    r"call us|www\.|for external use|store in|keep out)\b", re.I)


def extract_ingredient_text(raw: str) -> str:
    """Pull just the ingredient list out of everything OCR read from a label.

    A photo of the back of a pack also contains marketing claims, directions and warnings. We
    start at the word "Ingredients" (if it is there), stop where directions or warnings begin,
    join wrapped lines, and treat bullets or semicolons as commas when the list uses those.
    """
    text = (raw or "").replace("\r", "\n")
    m = _HEADER.search(text)
    if m:
        text = text[m.end():]
        stop = _STOP.search(text)
        if stop:
            text = text[: stop.start()]
    text = re.sub(r"\s*\n\s*", " ", text)            # wrapped lines are one list
    if text.count(",") < 3 and len(re.findall(r"[;•·|]", text)) >= 3:
        text = re.sub(r"\s*[;•·|]\s*", ", ", text)    # lists that use other separators
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip(" ,.;:")


def has_ingredient_header(raw: str) -> bool:
    return bool(_HEADER.search(raw or ""))


NO_LIST_MESSAGE = (
    "We couldn't find an ingredient list in that photo. Many brands (The Ordinary, Medicube and others) "
    "print only the key actives on the bottle. Check the outer box, since the full list is often only there, "
    "or a small label on the back or bottom of the bottle. If the box is gone, search the product online and "
    "paste the ingredient list into the box below."
)

REJECT_MESSAGE = (
    "This doesn't look like an ingredient list, so we haven't scored it. "
    "Make sure the photo is of the ingredients panel (usually after “Ingredients:”), "
    "and that the ingredients are separated by commas."
)


def assess_ingredient_text(raw_text: str, tokens: list[str]) -> IngredientCheck:
    """`tokens` is the already-split/normalised ingredient list."""
    text = (raw_text or "").strip()
    if len(text) < 3 or not tokens:
        return IngredientCheck(False, 0.0, "empty")

    flags = [_token_flags(t) for t in tokens]
    n = len(tokens)
    bad_frac = sum(b for b, _ in flags) / n
    inci_frac = sum(i for _, i in flags) / n
    words_per_token = sorted(len(_WORD.findall(t)) for t in tokens)
    median_words = words_per_token[n // 2]
    has_header = bool(re.search(r"\bingredients?\b|\binci\b|\bcontains?\b", text, re.I))

    # A single product with 1-2 ingredients ("Jojoba Seed Oil") must fully look like INCI.
    if n <= 2:
        ok = inci_frac == 1.0 and bad_frac == 0.0
    else:
        need = 0.35 if has_header else 0.5
        ok = bad_frac <= 0.25 and inci_frac >= need and median_words <= 5

    # confidence is informational (0-1)
    confidence = max(0.0, min(1.0, inci_frac - bad_frac))
    return IngredientCheck(ok, round(confidence, 2), None if ok else "not_ingredient_list")
