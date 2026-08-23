import os
from supabase import create_client, Client

_supabase_url = os.environ.get("SUPABASE_URL")
_supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

_client: Client | None = None


def get_supabase() -> Client | None:
    """Returns a cached Supabase client, or None if env vars aren't configured.

    Uses the service_role key deliberately — this backend writes to shared
    catalog tables (products/ingredients/product_ingredients), not per-user
    data, so it needs to bypass RLS rather than act as an authenticated user.
    """
    global _client
    if _client is not None:
        return _client
    if not _supabase_url or not _supabase_key:
        return None
    _client = create_client(_supabase_url, _supabase_key)
    return _client
