"""One-off smoke test for the YouCam Skin Analysis API.

Run from Ingryd/backend:
    .venv/bin/python scripts/youcam_smoke.py ~/path/to/selfie.jpg

Costs roughly 14 units. Writes a sanitized response to scripts/out/ (gitignored).
"""
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from PIL import Image

BACKEND = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND / ".env")

BASE = "https://yce-api-01.makeupar.com"
KEY = os.environ.get("YOUCAM_API_KEY", "")
HEADERS = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
CONCERNS = ["moisture", "oiliness", "redness", "acne", "pore", "texture",
            "wrinkle", "age_spot", "dark_circle_v2", "skin_type"]


def die(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def sanitize(obj):
    """Replace signed URLs so output is safe to paste/share."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, str) and obj.startswith("http"):
        return obj.split("?")[0] + "?<redacted>"
    return obj


def show(label: str, resp: httpx.Response) -> dict:
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text[:500]}
    print(f"{label}: HTTP {resp.status_code}")
    if resp.status_code >= 400:
        print(json.dumps(sanitize(body), indent=2)[:1500])
        die(f"{label} failed")
    return body


def main() -> None:
    if not KEY:
        die("YOUCAM_API_KEY missing in Ingryd/backend/.env")
    if len(sys.argv) < 2:
        die("usage: youcam_smoke.py /path/to/selfie.jpg")
    path = Path(sys.argv[1]).expanduser()
    if not path.exists():
        die(f"photo not found: {path}")

    with Image.open(path) as im:
        w, h = im.size
        fmt = (im.format or "").upper()
    size = path.stat().st_size
    print(f"photo: {w}x{h} {fmt} {size/1e6:.1f}MB")
    if fmt not in ("JPEG", "PNG"):
        die("photo must be JPG or PNG")
    if min(w, h) < 480 or size > 10_000_000:
        die("short side must be >=480px and file <10MB")
    ctype = "image/jpeg" if fmt == "JPEG" else "image/png"

    with httpx.Client(timeout=60) as c:
        # 1) register upload
        r = c.post(f"{BASE}/s2s/v2.0/file/skin-analysis", headers=HEADERS,
                   json={"files": [{"content_type": ctype, "file_name": path.name,
                                    "file_size": size}]})
        reg = show("file register", r)
        out = Path(__file__).parent / "out"
        out.mkdir(exist_ok=True)
        (out / "file_response.sanitized.json").write_text(
            json.dumps(sanitize(reg), indent=2))
        try:
            f = reg["data"]["files"][0]
            file_id = f["file_id"]
            req = f["requests"][0]
            upload_url, up_headers = req["url"], req.get("headers", {})
        except (KeyError, IndexError, TypeError):
            die("unexpected file response shape; see scripts/out/file_response.sanitized.json")

        # 2) upload bytes
        up = c.put(upload_url, headers=up_headers, content=path.read_bytes())
        print(f"upload: HTTP {up.status_code}")
        if up.status_code >= 400:
            die("upload failed")

        # 3) create task
        r = c.post(f"{BASE}/s2s/v2.0/task/skin-analysis", headers=HEADERS,
                   json={"src_file_id": file_id, "dst_actions": CONCERNS,
                         "format": "json"})
        task = show("task create", r)
        try:
            task_id = task["data"]["task_id"]
        except (KeyError, TypeError):
            die("no task_id in response")

        # 4) poll with backoff
        delay, start = 3.0, time.time()
        while time.time() - start < 180:
            time.sleep(delay)
            delay = min(delay * 1.3, 8)
            r = c.get(f"{BASE}/s2s/v2.0/task/skin-analysis/{task_id}", headers=HEADERS)
            res = show("poll", r)
            status = res.get("data", {}).get("task_status")
            print(f"  status={status}")
            if status == "success":
                break
            if status == "error":
                (out / "skin_response.sanitized.json").write_text(
                    json.dumps(sanitize(res), indent=2))
                die("task errored; see scripts/out/skin_response.sanitized.json")
        else:
            die("timed out after 180s")

    clean = sanitize(res)
    (out / "skin_response.sanitized.json").write_text(json.dumps(clean, indent=2))
    print("\nscores:")
    for item in res["data"].get("results", {}).get("output", []):
        print(f"  {item.get('type'):<18} ui={item.get('ui_score')}  raw={item.get('raw_score')}")
    print(f"\nsaved: {out/'skin_response.sanitized.json'}")


if __name__ == "__main__":
    main()