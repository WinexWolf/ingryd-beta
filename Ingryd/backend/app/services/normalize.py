import re

KNOWN_ACRONYMS = {
    "PEG", "PPG", "PVP", "PCA", "BHT", "BHA", "EDTA", "DMDM", "SPF", "UV", "VP", "PABA",
    "CI", "INCI", "HDI", "SE", "EO", "PG", "TEA", "DEA", "MEA", "PGA", "AHA",
    "GMO", "UVA", "UVB", "MMA", "EGCG", "DNA", "RNA", "ATP",
}
ALIAS_MAP = {
    "aqua": "Water", "eau": "Water", "aqua/water/eau": "Water",
    "water/aqua/eau": "Water",
}


# Step 1: split raw ingredient text on commas, but repair the case where a
# comma sits inside unbalanced parentheses (e.g. "Iron Oxides (CI 77492, CI 77491)"
# would otherwise get split into two fields).
def split_ingredients_text(text):
    tokens = text.split(',')
    fixed, buf = [], None
    for tok in tokens:
        tok = tok.strip()
        if not tok:
            continue
        buf = tok if buf is None else buf + ',' + tok
        if buf.count('(') <= buf.count(')'):
            fixed.append(buf)
            buf = None
    if buf is not None:
        fixed.append(buf)
    return fixed


# Step 2: OCR/typo repair on each individual ingredient string.
def fix_ocr_glitches(s):
    s = re.sub(r'\b(\d)\s+(\d)-', r'\1,\2-', s)   # "1 2-hexanediol" -> "1,2-Hexanediol"
    s = re.sub(r'([a-zA-Z])\(', r'\1 (', s)         # "Officinale(Dandelion)" -> add space before paren
    s = re.sub(r'\s{2,}', ' ', s)                   # collapse double spaces
    s = re.sub(r'^\*+', '', s)                      # strip leading footnote asterisks
    return s.strip(' .,').strip()                   # strip trailing periods/commas


# Step 3: title-case, preserving true INCI acronyms and any alphanumeric code.
def cap_alpha_preserving_prefix(p):
    if not p:
        return p
    m = re.search(r'[A-Za-z]', p)
    if not m:
        return p
    i = m.start()
    return p[:i] + p[i].upper() + p[i + 1:].lower()


def smart_title(word):
    core = re.sub(r'[^A-Za-z0-9]', '', word)
    if core.upper() in KNOWN_ACRONYMS or any(ch.isdigit() for ch in core):
        return word  # leave "PEG-60", "C13-14", "CI77499" untouched

    def cap_part(p):
        c = re.sub(r'[^A-Za-z0-9]', '', p)
        if c.upper() in KNOWN_ACRONYMS:
            return re.sub(r'[A-Za-z]+', c.upper(), p, count=1) if c else p
        if any(ch.isdigit() for ch in c):
            return p
        return cap_alpha_preserving_prefix(p)

    parts = re.split(r'(-|/)', word)
    return ''.join(cap_part(p) if p not in ('-', '/') else p for p in parts)


# Step 4: alias collapse (multi-name label conventions -> one canonical term),
# checked both before and after title-casing.
def normalize_ingredient(raw):
    cleaned = fix_ocr_glitches(raw.strip())
    key = cleaned.lower()
    if key in ALIAS_MAP:
        return ALIAS_MAP[key]
    titled = ' '.join(smart_title(w) for w in cleaned.split(' '))
    return ALIAS_MAP.get(titled.lower(), titled)


# Full pipeline on a raw ingredients string:
def normalize_full_ingredients_text(text):
    return [normalize_ingredient(tok) for tok in split_ingredients_text(text)]
