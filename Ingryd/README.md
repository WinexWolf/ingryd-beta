# Ingryd

Know what's in your skincare. Ingryd decodes the ingredient list on any beauty or personal care product and tells you what's good, what's questionable, and what to avoid — personalised to your skin type.

---

## Features

### ✅ Feature 1 — Barcode Scanner (Implemented)

Scan any EAN-8, EAN-13, or UPC-A barcode using your device camera, or enter a barcode manually. Ingryd queries the [Open Beauty Facts](https://world.openbeautyfacts.org/) database and runs the ingredient list through a weighted scoring engine.

**What you get:**
- Product name, brand, image, and category from Open Beauty Facts
- Every ingredient classified as **high concern**, **moderate concern**, or **beneficial**
- An overall score (0–100) and grade (Excellent / Good / Fair / Poor / Avoid)

**Scoring logic:**
| Category | Score impact | Cap |
|---|---|---|
| High concern (parabens, hormone disruptors, carcinogens, formaldehyde releasers, etc.) | −15 per ingredient | −45 |
| Moderate concern (fragrance, drying alcohols, PEG compounds, certain silicones, etc.) | −8 per ingredient | −24 |
| Beneficial actives (hyaluronic acid, ceramides, niacinamide, vitamin C, peptides, etc.) | +4 per ingredient | +30 |
| Baseline | 70 | — |

---

### 🔜 Feature 2 — Skin Analysis (Coming Soon)

Upload or take a photo of your skin to receive an AI-powered assessment covering hydration level, oiliness, acne severity, and inflammation. Returns personalised remediation advice and ingredient recommendations tailored to what your skin actually needs.

---

### 🔜 Feature 3 — Product Search (Coming Soon)

Search the Open Beauty Facts database by product name or brand without needing a camera. Returns the same ingredient breakdown and score as the barcode scanner. Includes side-by-side product comparison and filtering by safety score.

---

### 🔜 Feature 4 — Skincare Routine Builder (Coming Soon)

Build separate AM and PM routines. When adding a product, Ingryd checks it against everything else already in your routine and flags known conflicts (e.g. Retinol + AHA, Vitamin C + Niacinamide, acids at incompatible pH). Routine analysis requires a complete skin profile. Edge-case combinations are evaluated with an AI call; common conflicts are caught instantly by a rules engine.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, httpx |
| Ingredient data | Open Beauty Facts API |
| Fonts | Stardom (Fontshare), Inter |

---

## Running Locally

**Backend**
```bash
cd backend
.venv/bin/uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

To test Feature 1 without a camera, enter barcode `3606000537750` (CeraVe Foaming Facial Cleanser) in the manual entry field on the Scan page.

**To scan from a phone on the same network:**
```bash
cd frontend
npx vite --host
```
Then open the printed network URL on your phone.
