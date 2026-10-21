# Ingryd

**Know what's on your skin, and whether it's right for _your_ skin.**

Ingryd turns one selfie into a skin read, then uses it to score every product, check your routine, and recommend what to buy next.

- Live app: https://ingryd-beta.vercel.app/
- Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (Devpost)
- Tester guide: [TESTING.md](TESTING.md)

> **Source code license:** All rights reserved. The repository is shared with the hackathon organizers and judges for evaluation only. See `LICENSE`.

---

## What's new since Sep 29 (hackathon work)

Ingryd already existed before the hackathon as an ingredient scanner. During the hackathon period I added the YouCam skin analysis and connected it to everything else in the app, so a scan now changes what the whole product shows you.

| Before Sep 29 (already built) | New for the hackathon |
|---|---|
| Barcode scanner (Open Beauty Facts only), ingredient-label OCR, product search | **Smarter barcode lookup:** every UPC/EAN spelling is tried, unknown barcodes are identified and matched to catalog products, and users can teach the app new products (shared only after review) |
| | **YouCam Skin Analysis API** replaces the old image heuristic: 9 concerns scored, skin type per zone, skin age, and per-concern masks |
| | **Guided 3-angle capture** (front, left, right) with live head-pose guidance, auto-capture, and an on-device photo check that rejects group shots and non-faces before any API units are spent |
| Ingredient scoring engine (0–100, grades, allergens, banned substances) | **Scan-aware Fit Score:** each ingredient adjustment is weighted by how weak that concern scored on your scan |
| Profile (skin type, concerns, sensitivities) | **"Apply to my profile"** turns a scan into your saved profile, including new *uneven texture* and *dark circles* concerns |
| Routine shelf with conflict checks | **Routine vs. your scan:** what is working for you, what works against you, which weak spots nothing targets, and what to add |
| Supabase product catalog (~2,800 products with full ingredient lists) | **Recommendations and "Better for you"** alternatives ranked by your Fit Score, with reasons |
| | **Results screen v2:** mask overlays on your photo, always-on focus areas, concern grid, next steps |
| | **Home hub and progress:** next best step, change since your last scan, routine changes between scans |
| | **Demo mode, consent, and cost controls** (see below) |

All of the above is in the commit history after Sep 29.

---

## How it works

```
  selfie ──► YouCam Skin Analysis API ──► 9 concern scores + masks + skin type/age
                                              │
              ┌───────────────────────────────┼─────────────────────────────┐
              ▼                               ▼                             ▼
      Focus areas + overlays        Saved to your profile          Progress vs last scan
                                              │
              ┌───────────────────────────────┼─────────────────────────────┐
              ▼                               ▼                             ▼
   Fit Score on every product     Routine gap check          Recommendations / "Better for you"
```

### How YouCam is used

The backend calls the YouCam Skin Analysis API (file upload → analysis task → poll) for moisture, oiliness, redness, acne, pores, texture, wrinkles, age spots, and dark circles, plus skin type and skin age.

- Scores are shown as returned (higher = healthier). Oiliness and redness are inverted only where the older UI needed "how much of the issue".
- Concerns scoring under 75 are treated as worth addressing. The same threshold drives the notes, ingredient suggestions, and the profile suggestion, so the screen never contradicts itself.
- Mask images are drawn over your own photo. They are signed links that expire in about 24 hours, so they are shown immediately and **never stored**.
- The API key lives only on the server. It is never sent to the browser or committed.

### One front photo, 15 concerns

The YouCam API analyzes one photo at a time and only accepts faces that look straight at the camera. In testing, even a slight head turn was rejected with `error_large_face_angle`, so the app asks for a single front-facing photo (the backend can still merge extra views, but the UI no longer offers them).

- One analysis returns up to 15 concerns: hydration, oiliness, redness, breakouts, pores, texture, fine lines, dark spots, dark circles, plus eye bags, under-eye hollows, firmness, radiance and eyelid droop (informational only), along with skin type and skin age.
- Before upload, a **face check runs on the phone** (nothing is uploaded for it): exactly one face, in frame, lit, sharp, head straight and level. Group photos and non-faces are stopped before they cost API units. The check is advisory where a face detector can be wrong (a missed face can be overridden), and strict for group photos.
- The photo is **cropped to the face** before upload, because YouCam wants the face to fill most of the frame, and downscaled to speed up the upload.
- If YouCam rejects the photo, the app says why (turned or tilted too far, too small, too dark) using YouCam's own error code.

### How a scan changes the Fit Score

Without a scan, Fit Score behaves as before. With one, each adjustment is scaled by severity (roughly 0.5x for a score near 95, about 1x near 73, up to 1.6x near 40):

- Comedogenic ingredients are penalized when pore or acne scores are low.
- Drying alcohols are penalized when hydration is low.
- Common sensitizers are penalized when redness is high.
- Actives that target your concerns earn a bonus. For example lactic acid for texture, caffeine for dark circles, salicylic acid and niacinamide for acne.
- Every reason cites your own number, e.g. "Comedogenic — can clog pores (your pore score: 73/100)".

### Recommendations and routine check

- The catalog is loaded in pages, cached, and ranked in memory per profile. Products with fewer than 5 ingredients, banned substances, or a low Fit Score are never recommended, and no brand appears more than twice in a list.
- "Better for you" shows same-type products that score higher for you and names the ingredients they skip.
- The routine panel lists each weak spot your scan flagged and whether a product in your routine targets it. For gaps it suggests a specific product. It also warns about a missing sunscreen or moisturizer.

### Progress

Your two latest scans are compared concern by concern. **Changes under 5 points are shown as "no meaningful change"**, because lighting and angle move scores on their own. The routine you had at each scan is saved with it, so a change can be tied to what you added or removed.

---

## Privacy, safety and cost controls

- **Consent:** a scan needs an explicit checkbox saying the photo goes to YouCam for analysis. The photo is re-encoded server-side (this strips location data) and is not kept by Ingryd.
- **Not medical advice:** Ingryd is not a medical device and does not diagnose.
- **Sign-in required for live scans**, verified on the server against Supabase Auth.
- **Scan limits** protect the free API units. Each photo analyzed counts as one: 6 per user per day (two full 3-photo scans), 60 per day overall, 70 total (all configurable). When a limit is reached, the user is told and offered the sample scan instead of being silently downgraded.
- **Sample scan:** a labelled example result that costs no API units and needs no photo. It is never saved to your history.
- **Demo data:** one tap on Home loads two earlier example scans and a starter routine, all labelled "Demo", and one tap removes exactly those rows. Demo scans are only ever compared with demo scans.
- **Admin routes** (catalog review) require a valid login belonging to an admin.
- **CORS** allows only the Ingryd site and its preview deploys.
- Supabase row-level security is on for user data. The usage-counter table is not readable from the browser at all.

---

## Existing features

- **Scan a product:** barcode (camera or manual) → ingredient breakdown, 0–100 score, grade, allergens, banned substances, comedogenic flags. Lookup order: our catalog → Open Beauty Facts → BarcodeNest (optional) → UPCitemdb (name only, optional). Every equivalent written form of the code is tried (UPC-A, EAN-13, EAN-8, UPC-E, GTIN-14). If no database has an ingredient list, the app says what the product appears to be, offers the closest catalog matches ("Is it one of these?"), and otherwise asks for a photo of the ingredient list.
- **Scan ingredients (OCR):** photograph an ingredient list for products not yet in the catalog. Text that doesn't look like an ingredient list is refused instead of scored. Submissions (with the barcode that led there) go to an admin review queue and only become visible to everyone once approved.
- **Search products:** browse and search the catalog, sort by Fit Score.
- **My routine:** AM/PM shelves with a rules engine for conflicts such as retinol + AHA.
- **Installable PWA** that works on a phone.

Baseline scoring: start at 70, then −15 per high-concern ingredient (cap −45), −8 per moderate concern (cap −24), +4 per beneficial active (cap +30).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, PWA — hosted on Vercel |
| Backend | Python, FastAPI, httpx — hosted on Render |
| Database and auth | Supabase (Postgres, Row Level Security, Auth) |
| Skin analysis | YouCam Skin Analysis API |
| Ingredient data | Own Supabase catalog, Open Beauty Facts, BarcodeNest, INCI enrichment |
| OCR | Tesseract |
| Photo check | face-api.js tiny detector + landmarks, run in the browser |

---

## Running locally

**Backend** (Python 3.10+)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# create backend/.env with the variables listed below; never commit this file
uvicorn main:app --reload --port 8000 --env-file .env
```

**Frontend**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Environment variables (names only):

| Where | Name | Purpose |
|---|---|---|
| Backend | `YOUCAM_API_KEY` | YouCam API key (server only) |
| Backend | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Catalog, auth checks, usage counts |
| Backend | `YOUCAM_USER_DAILY_CAP`, `YOUCAM_DAILY_CAP`, `YOUCAM_TOTAL_CAP` | Optional limits, counted in photo analyses (defaults 6 / 60 / 70) |
| Backend | `UPCITEMDB_USER_KEY`, `UPCITEMDB_DAILY_LIMIT` | Optional. Identifies unknown barcodes by name. Works without a key on UPCitemdb's free trial endpoint (about 100 lookups/day; the app stops at 90 by default and caches every answer) |
| Backend | `BARCODENEST_BASE_URL`, `BARCODENEST_API_KEY`, `INCIAPI_KEY` | Optional extra lookup and enrichment sources |
| Backend | `CORS_ORIGINS` | Optional comma-separated allowed origins |
| Frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public Supabase client settings |
| Frontend | `VITE_API_BASE_URL` | Backend URL in production |

**Database:** run the files in `db/migrations/` in order in the Supabase SQL editor (`001_scan_profile.sql`, `002_youcam_usage.sql`, `003_pending_barcode.sql`).

**Tests**
```bash
cd backend && pip install pytest && PYTHONPATH=. python -m pytest tests -q
cd frontend && npx tsc --noEmit -p .
```

**Catalog coverage report:** `PYTHONPATH=. python scripts/catalog_coverage.py` shows how many products per category are usable for recommendations.

---

## Known limits

- Scores come from ingredient lists and up to three photos. Lighting, makeup, and filters affect scan results; the app shows tips and checks the photos before each scan. The on-device face check is a best-effort filter, not a guarantee, and has not been validated across all skin tones.
- The skin-analysis API takes one photo per analysis, so a 3-photo scan costs three analyses of the free allowance. Side-photo accuracy depends on the API handling angled faces, which the app handles gracefully when it doesn't.
- No free database covers every product, especially imports. Barcode name lookups (UPCitemdb) give a name and brand but not ingredients, so a product nobody has logged still needs one photo of its ingredient list. Suggested catalog matches are by name and may differ in size or formula.
- Roughly a third of catalog products had no category; their type is inferred from the name, so a few may be misfiled.
- Live scanning is capped to stay inside the free API units, so the sample scan is always available.
