"""Barcode helpers: the same product can be written as UPC-A (12 digits), EAN-13,
EAN-8, UPC-E (the short 8-digit form) or GTIN-14, and different databases store
different forms. These helpers produce every equivalent form so a lookup can't
miss just because of padding."""
import re

# GTIN lengths we accept as input.
VALID_LENGTHS = (8, 12, 13, 14)


def digits_only(code: str | None) -> str:
    return re.sub(r"\D", "", code or "")


def gtin_check_ok(code: str) -> bool:
    """Standard GTIN mod-10 check digit (same algorithm for 8/12/13/14 digits)."""
    if not code or not code.isdigit() or len(code) not in VALID_LENGTHS:
        return False
    body, check = code[:-1], int(code[-1])
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check


def expand_upce(code: str) -> str | None:
    """UPC-E (8 digits, number system 0 or 1) -> UPC-A (12 digits)."""
    if len(code) != 8 or not code.isdigit() or code[0] not in "01":
        return None
    ns, a, b, c, d, e, f, check = code
    if f in "012":
        body = f"{ns}{a}{b}{f}0000{c}{d}{e}"
    elif f == "3":
        body = f"{ns}{a}{b}{c}00000{d}{e}"
    elif f == "4":
        body = f"{ns}{a}{b}{c}{d}00000{e}"
    else:
        body = f"{ns}{a}{b}{c}{d}{e}0000{f}"
    return body + check


def barcode_forms(code: str) -> list[str]:
    """Every equivalent written form of a barcode, most useful first.
    e.g. 036000291452 -> [036000291452, 0036000291452, 00036000291452]."""
    d = digits_only(code)
    if not d:
        return []
    seeds = [d]
    upca = expand_upce(d)
    if upca:
        seeds.append(upca)  # an 8-digit code starting 0/1 may be UPC-E *or* EAN-8: try both
    out: list[str] = []

    def add(x: str) -> None:
        if x and x not in out:
            out.append(x)

    for seed in seeds:
        add(seed)
        core = seed.lstrip("0") or "0"
        for length in (13, 12, 14, 8):  # 13 first: Open Beauty Facts stores UPCs as EAN-13
            if len(core) <= length:
                add(core.zfill(length))
    return out


def catalog_forms(code: str) -> list[str]:
    """Forms to try against the catalog (14-digit GTIN plus the written forms)."""
    forms = barcode_forms(code)
    return forms + [f for f in (x.zfill(14) for x in forms) if f not in forms]
