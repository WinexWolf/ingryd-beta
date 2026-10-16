"""Verifies the Supabase access token the frontend sends, and checks admin rights.

The backend never trusts a user id from the request body: it asks Supabase Auth who the
token belongs to, then (for admin routes) reads profiles.is_admin with the service role.
"""
import os
import time

import httpx
from fastapi import Depends, Header, HTTPException

from app.services.supabase_client import get_supabase

_cache: dict[str, tuple[float, str]] = {}   # token -> (expires_at, user_id)
CACHE_TTL_S = 60


async def verify_token(token: str) -> str | None:
    """Supabase user id for a valid access token, else None."""
    hit = _cache.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(f"{url.rstrip('/')}/auth/v1/user", headers={"Authorization": f"Bearer {token}", "apikey": key})
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    uid = (r.json() or {}).get("id")
    if uid:
        if len(_cache) > 500:
            _cache.clear()
        _cache[token] = (time.time() + CACHE_TTL_S, uid)
    return uid


async def current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    uid = await verify_token(authorization.split(" ", 1)[1].strip())
    if not uid:
        raise HTTPException(status_code=401, detail="Your session has expired — please sign in again.")
    return uid


def is_admin(user_id: str) -> bool:
    sb = get_supabase()
    if sb is None:
        return False
    try:
        rows = sb.table("profiles").select("is_admin").eq("id", user_id).execute().data
    except Exception:
        return False
    return bool(rows and rows[0].get("is_admin"))


async def require_admin(user_id: str = Depends(current_user)) -> str:
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Catalog reviewers only.")
    return user_id
