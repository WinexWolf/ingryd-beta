"""YouCam Skin Analysis client.

The API key is read from the environment and only ever sent to YouCam's own
host. Signed mask URLs in responses expire, so they are returned to the caller
for immediate display but must not be persisted.
"""
import asyncio
import os
import time

import httpx
from pydantic import BaseModel

BASE_URL = "https://yce-api-01.makeupar.com"
CONCERNS = [
    "moisture", "oiliness", "redness", "acne", "pore", "texture",
    "wrinkle", "age_spot", "dark_circle_v2", "skin_type",
]
POLL_TIMEOUT_S = 120
ACCEPTED_TYPES = {"image/jpeg", "image/png"}


class YouCamError(Exception):
    """Raised for any YouCam failure. Message is safe to log; never contains the key."""

    def __init__(self, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class ConcernScore(BaseModel):
    ui_score: int          # 0-100, higher = healthier
    raw_score: float
    mask_url: str | None = None


class YouCamAnalysis(BaseModel):
    concerns: dict[str, ConcernScore]
    skin_type: str | None = None             # whole-face, e.g. "Normal"
    skin_type_zones: dict[str, str] = {}     # {"t_zone": "Oily", "u_zone": "Dry"}
    overall_score: float | None = None
    skin_age: int | None = None


def parse_result(payload: dict) -> YouCamAnalysis:
    """Turn a finished task-poll payload into a YouCamAnalysis. Pure function."""
    try:
        output = payload["data"]["results"]["output"]
    except (KeyError, TypeError):
        raise YouCamError("Unexpected response from skin analysis service")

    concerns: dict[str, ConcernScore] = {}
    skin_type: str | None = None
    zones: dict[str, str] = {}
    overall: float | None = None
    skin_age: int | None = None

    for item in output:
        kind = item.get("type")
        if kind == "skin_type":
            value = item.get("skin_type")
            region = item.get("region")
            if region == "whole":
                skin_type = value
            elif region and value:
                zones[region] = value
        elif kind == "all":
            overall = item.get("score")
        elif kind == "skin_age":
            skin_age = item.get("score")
        elif kind in CONCERNS and item.get("ui_score") is not None:
            masks = item.get("mask_urls") or []
            concerns[kind] = ConcernScore(
                ui_score=int(item["ui_score"]),
                raw_score=float(item.get("raw_score") or 0),
                mask_url=masks[0] if masks else None,
            )

    if not concerns:
        raise YouCamError("No usable skin metrics were returned — try a clearer photo")
    return YouCamAnalysis(
        concerns=concerns, skin_type=skin_type, skin_type_zones=zones,
        overall_score=overall, skin_age=skin_age,
    )


def _check(resp: httpx.Response, step: str) -> dict:
    if resp.status_code == 401 or resp.status_code == 403:
        raise YouCamError(f"{step}: skin analysis service rejected our credentials")
    if resp.status_code == 429:
        raise YouCamError(f"{step}: rate limited", retryable=True)
    if resp.status_code >= 500:
        raise YouCamError(f"{step}: service error {resp.status_code}", retryable=True)
    if resp.status_code >= 400:
        raise YouCamError(f"{step}: request rejected ({resp.status_code})")
    try:
        return resp.json()
    except ValueError:
        raise YouCamError(f"{step}: invalid response")


async def analyze_image(image_bytes: bytes, content_type: str = "image/jpeg") -> YouCamAnalysis:
    key = os.environ.get("YOUCAM_API_KEY", "")
    if not key:
        raise YouCamError("YOUCAM_API_KEY is not configured")
    if content_type not in ACCEPTED_TYPES:
        raise YouCamError("Photo must be a JPG or PNG")

    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    ext = "jpg" if content_type == "image/jpeg" else "png"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            reg = _check(await client.post(
                f"{BASE_URL}/s2s/v2.0/file/skin-analysis", headers=headers,
                json={"files": [{"content_type": content_type,
                                 "file_name": f"scan.{ext}",
                                 "file_size": len(image_bytes)}]},
            ), "register")
            f = reg["data"]["files"][0]
            file_id, req = f["file_id"], f["requests"][0]

            # Upload goes to a pre-signed storage URL — do NOT send our API key there.
            up = await client.put(req["url"], headers=req.get("headers", {}), content=image_bytes)
            if up.status_code >= 400:
                raise YouCamError(f"upload: failed ({up.status_code})", retryable=up.status_code >= 500)

            task = _check(await client.post(
                f"{BASE_URL}/s2s/v2.0/task/skin-analysis", headers=headers,
                json={"src_file_id": file_id, "dst_actions": CONCERNS, "format": "json"},
            ), "create task")
            task_id = task["data"]["task_id"]

            delay, start = 2.0, time.monotonic()
            while time.monotonic() - start < POLL_TIMEOUT_S:
                await asyncio.sleep(delay)
                delay = min(delay * 1.3, 6)
                res = _check(await client.get(
                    f"{BASE_URL}/s2s/v2.0/task/skin-analysis/{task_id}", headers=headers,
                ), "poll")
                status = res.get("data", {}).get("task_status")
                if status == "success":
                    return parse_result(res)
                if status == "error":
                    raise YouCamError("Skin analysis failed — try a clearer, front-facing photo")
            raise YouCamError("Skin analysis timed out", retryable=True)
        except (KeyError, IndexError, TypeError):
            raise YouCamError("Unexpected response from skin analysis service")
        except httpx.HTTPError:
            raise YouCamError("Could not reach skin analysis service", retryable=True)