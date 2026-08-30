from datetime import datetime, timezone
from app.models.product import SkinProfile
from app.services.normalize import normalize_full_ingredients_text
from app.services.scoring import score_ingredients
from app.services.catalog import _attach_order_analysis, write_back_to_catalog
from app.services.supabase_client import get_supabase


def analyze_raw_ingredients(raw_text: str, product_name: str | None, profile: SkinProfile | None):
    """Normalize + score raw OCR text. Deliberately does NOT run the
    quality-gate/category-allowlist checks — those exist to protect the
    SHARED catalog from junk, not to block a user from seeing an analysis
    of their own scan. Anyone can check any text; only approved submissions
    reach the shared catalog."""
    normalized = normalize_full_ingredients_text(raw_text)
    scored = score_ingredients(normalized, profile)
    _attach_order_analysis(scored, product_name, normalized)
    return normalized, scored


def approve_pending_product(pending_id: str) -> tuple[bool, str]:
    """Moves a reviewed submission from pending_products into the real
    catalog via the same write_back_to_catalog() used by the live barcode
    fallback path, then marks it approved.

    NOTE: this endpoint does not independently verify the caller is an
    admin — the frontend gates the Approve button behind a profile.is_admin
    check, but the backend itself trusts whoever calls it with a valid
    pending_id. Acceptable for a solo-operator beta; would need real JWT
    verification middleware before this scales beyond one trusted reviewer
    or gets exposed as a public API.
    """
    supabase = get_supabase()
    if supabase is None:
        return False, "Supabase not configured"

    try:
        rows = supabase.table("pending_products").select("*").eq("id", pending_id).execute().data
        if not rows:
            return False, "Submission not found"
        row = rows[0]

        if row["status"] != "pending":
            return False, f"Already {row['status']}"

        ingredients = row.get("ingredients_parsed") or []
        success = write_back_to_catalog(
            gtin=row.get("barcode") or "",
            brand=row.get("brand"),
            name=row.get("product_name"),
            category=row.get("category"),
            ingredients=ingredients,
            ingredients_raw=row.get("raw_text"),
        )

        if not success:
            return False, "Write-back to catalog failed — check brand/name are present and category is valid"

        supabase.table("pending_products").update({
            "status": "approved",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", pending_id).execute()

        return True, "Approved and added to catalog"
    except Exception as e:
        return False, f"Error: {e}"


def reject_pending_product(pending_id: str, notes: str | None = None) -> tuple[bool, str]:
    supabase = get_supabase()
    if supabase is None:
        return False, "Supabase not configured"
    try:
        supabase.table("pending_products").update({
            "status": "rejected",
            "reviewer_notes": notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", pending_id).execute()
        return True, "Rejected"
    except Exception as e:
        return False, f"Error: {e}"
