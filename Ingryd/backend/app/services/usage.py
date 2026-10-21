"""Caps on live YouCam scans, so a hackathon's worth of free units can't be burned by one
person or one bug. Counts live in Supabase (table youcam_usage) so they survive restarts;
if Supabase is unreachable we fall back to a per-process counter.

A "scan" here is one photo analysis (~14 YouCam units). A 3-photo scan (front + left + right)
uses 3; a front-only scan uses 1.

Caps (env, all optional):
  YOUCAM_USER_DAILY_CAP  photo analyses per user per day     (default 6  = two 3-photo scans)
  YOUCAM_DAILY_CAP       photo analyses per day, everyone    (default 60)
  YOUCAM_TOTAL_CAP       photo analyses ever, everyone       (default 70 ~ 980 units)
"""
import os
from datetime import datetime, timezone

from app.services.supabase_client import get_supabase

TABLE = "youcam_usage"


class LimitReached(Exception):
    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind          # "user" | "day" | "total"
        self.message = message


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def user_cap() -> int: return _int("YOUCAM_USER_DAILY_CAP", 6)
def day_cap() -> int: return _int("YOUCAM_DAILY_CAP", 60)
def total_cap() -> int: return _int("YOUCAM_TOTAL_CAP", 70)


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


_mem: dict[tuple[str, str], int] = {}   # (user, day) -> n


def _snapshot(uid: str, day: str) -> tuple[int, int, int]:
    """(this user today, everyone today, everyone ever)"""
    sb = get_supabase()
    if sb is not None:
        try:
            rows = sb.table(TABLE).select("user_id,day,n").execute().data or []
            mine = sum(r["n"] for r in rows if r["user_id"] == uid and r["day"] == day)
            today = sum(r["n"] for r in rows if r["day"] == day)
            return mine, today, sum(r["n"] for r in rows)
        except Exception as e:
            print(f"[usage] Supabase unavailable, using in-memory counts: {e}")
    return (
        _mem.get((uid, day), 0),
        sum(n for (u, d), n in _mem.items() if d == day),
        sum(_mem.values()),
    )


def _write(uid: str, day: str, delta: int) -> None:
    _mem[(uid, day)] = max(0, _mem.get((uid, day), 0) + delta)
    sb = get_supabase()
    if sb is None:
        return
    try:
        cur = sb.table(TABLE).select("n").eq("user_id", uid).eq("day", day).execute().data
        n = max(0, (cur[0]["n"] if cur else 0) + delta)
        sb.table(TABLE).upsert({"user_id": uid, "day": day, "n": n}).execute()
    except Exception as e:
        print(f"[usage] could not persist usage: {e}")


def reserve(uid: str, n: int = 1) -> None:
    """Take `n` photo analyses from the budget (all or nothing) or raise LimitReached."""
    day = _today()
    mine, today, total = _snapshot(uid, day)
    left = user_cap() - mine
    if left < n:
        if left >= 1:
            raise LimitReached("user", f"You have {left} photo analysis{'es' if left != 1 else ''} left today and this scan needs {n}. "
                                       "Remove a side photo to scan with fewer photos, or try again tomorrow.")
        raise LimitReached("user", f"You've used today's {user_cap()} photo analyses. Try again tomorrow, or open the sample scan.")
    if today + n > day_cap() or total + n > total_cap():
        raise LimitReached("day" if today + n > day_cap() else "total",
                           "Live skin scanning has reached its limit for now. The sample scan shows the full experience.")
    _write(uid, day, +n)


def release(uid: str, n: int = 1) -> None:
    """Give analyses back when YouCam failed (it only charges for successful analyses)."""
    _write(uid, _today(), -n)


def reset_for_tests() -> None:
    _mem.clear()
