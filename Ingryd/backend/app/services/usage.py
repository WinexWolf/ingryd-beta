"""Caps on live YouCam scans, so a hackathon's worth of free units can't be burned by one
person or one bug. Counts live in Supabase (table youcam_usage) so they survive restarts;
if Supabase is unreachable we fall back to a per-process counter.

Caps (env, all optional):
  YOUCAM_USER_DAILY_CAP  scans per user per day              (default 3)
  YOUCAM_DAILY_CAP       scans per day across everyone       (default 30)
  YOUCAM_TOTAL_CAP       scans ever, across everyone         (default 60 ~ 840 units)
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


def user_cap() -> int: return _int("YOUCAM_USER_DAILY_CAP", 3)
def day_cap() -> int: return _int("YOUCAM_DAILY_CAP", 30)
def total_cap() -> int: return _int("YOUCAM_TOTAL_CAP", 60)


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


def reserve(uid: str) -> None:
    """Take one scan from the budget or raise LimitReached."""
    day = _today()
    mine, today, total = _snapshot(uid, day)
    if mine >= user_cap():
        raise LimitReached("user", f"You've used today's {user_cap()} skin scans. Try again tomorrow, or open the sample scan.")
    if today >= day_cap() or total >= total_cap():
        raise LimitReached("day" if today >= day_cap() else "total",
                           "Live skin scanning has reached its limit for now. The sample scan shows the full experience.")
    _write(uid, day, +1)


def release(uid: str) -> None:
    """Give a scan back when YouCam failed (it only charges for successful analyses)."""
    _write(uid, _today(), -1)


def reset_for_tests() -> None:
    _mem.clear()
