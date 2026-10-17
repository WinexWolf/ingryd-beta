"""Identify an unknown barcode (name + brand) via UPCitemdb.

UPCitemdb is a general product database, so it usually returns a name, brand,
category and picture but NOT an ingredient list. We use it only to find out what
the product *is*, so we can offer matching products from our own catalog.

Free "trial" endpoint: no key, about 100 lookups/day shared by everyone calling
from the same IP. A paid key can be supplied in UPCITEMDB_USER_KEY. Results are
cached so a repeat scan never spends quota, and we stop calling for the rest of
the day when the budget is spent or the API says 429.

NOTE: field names follow UPCitemdb's documented response (items[].title/brand/
category/images). That is not confirmed against a live call from this build
environment; every field is read defensively.
"""
import os
import re
import time
from datetime import datetime, timezone

import httpx

USER_KEY = os.environ.get("UPCITEMDB_USER_KEY")
DAILY_BUDGET = int(os.environ.get("UPCITEMDB_DAILY_LIMIT", "90"))  # free tier is 100/day
TRIAL_URL = "https://api.upcitemdb.com/prod/trial/lookup"
PAID_URL = "https://api.upcitemdb.com/prod/v1/lookup"

_HIT_TTL = 7 * 24 * 3600
_MISS_TTL = 6 * 3600
_CACHE: dict[str, tuple[float, dict | None]] = {}
_state = {"day": "", "used": 0, "blocked_until": 0.0}

_SIZE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:ml|l|g|kg|mg|oz|fl\.?\s*oz|fl|lb|lbs|ct|count|pcs|pc|pack|pk)\b\.?",
    re.IGNORECASE,
)


def clean_title(title: str, brand: str | None = None) -> str:
    """Drop sizes and a repeated brand prefix: 'CeraVe Foaming Cleanser 12 fl oz' -> 'Foaming Cleanser'."""
    t = _SIZE.sub(" ", title or "")
    t = re.sub(r"\s+", " ", t).strip(" -,/|")
    if brand and t.lower().startswith(brand.lower()):
        t = t[len(brand):].strip(" -,/|")
    return t


def _budget_left() -> bool:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _state["day"] != today:
        _state.update(day=today, used=0)
    return time.time() >= _state["blocked_until"] and (bool(USER_KEY) or _state["used"] < DAILY_BUDGET)


async def identify_barcode(code: str) -> dict | None:
    """-> {'name', 'brand', 'image_url', 'category', 'source'} or None."""
    if not code or not code.isdigit():
        return None
    now = time.time()
    hit = _CACHE.get(code)
    if hit and now < hit[0]:
        return hit[1]
    if not _budget_left():
        return None

    url = PAID_URL if USER_KEY else TRIAL_URL
    headers = {"user_key": USER_KEY, "key_type": "3scale"} if USER_KEY else {}
    _state["used"] += 1
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params={"upc": code}, headers=headers)
    except httpx.RequestError:
        return None

    if resp.status_code == 429:
        _state["blocked_until"] = now + 3600
        return None
    if resp.status_code != 200:
        return None

    try:
        data = resp.json()
    except ValueError:
        return None
    items = data.get("items") or []
    if not items:
        _CACHE[code] = (now + _MISS_TTL, None)
        return None

    item = items[0]
    title = (item.get("title") or "").strip()
    brand = (item.get("brand") or "").strip() or None
    if not title:
        _CACHE[code] = (now + _MISS_TTL, None)
        return None
    images = item.get("images") or []
    found = {
        "name": clean_title(title, brand) or title,
        "brand": brand,
        "image_url": images[0] if images else None,
        "category": item.get("category"),
        "source": "upcitemdb",
    }
    _CACHE[code] = (now + _HIT_TTL, found)
    return found
