import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import ingredients as ing_route
from app.services import auth
import main


def _client():
    app = FastAPI()
    app.include_router(ing_route.router, prefix="/api")
    return TestClient(app)


def _patch_review(monkeypatch):
    calls = []
    monkeypatch.setattr(ing_route, "approve_pending_product", lambda pid: (calls.append(pid) or True, "ok"))
    monkeypatch.setattr(ing_route, "reject_pending_product", lambda pid, notes: (calls.append(pid) or True, "ok"))
    return calls


def test_admin_routes_reject_anonymous_callers(monkeypatch):
    calls = _patch_review(monkeypatch)
    c = _client()
    assert c.post("/api/ingredients/review/x/approve").status_code == 401
    assert c.post("/api/ingredients/review/x/reject").status_code == 401
    assert calls == []


def test_admin_routes_reject_signed_in_non_admins(monkeypatch):
    calls = _patch_review(monkeypatch)

    async def verify(token): return "user-1"
    monkeypatch.setattr(auth, "verify_token", verify)
    monkeypatch.setattr(auth, "is_admin", lambda uid: False)
    r = _client().post("/api/ingredients/review/x/approve", headers={"Authorization": "Bearer t"})
    assert r.status_code == 403 and calls == []


def test_admin_routes_allow_admins(monkeypatch):
    calls = _patch_review(monkeypatch)

    async def verify(token): return "admin-1"
    monkeypatch.setattr(auth, "verify_token", verify)
    monkeypatch.setattr(auth, "is_admin", lambda uid: uid == "admin-1")
    c = _client()
    assert c.post("/api/ingredients/review/x/approve", headers={"Authorization": "Bearer t"}).status_code == 200
    assert c.post("/api/ingredients/review/y/reject", headers={"Authorization": "Bearer t"}).status_code == 200
    assert calls == ["x", "y"]


def test_bad_token_is_401(monkeypatch):
    async def verify(token): return None
    monkeypatch.setattr(auth, "verify_token", verify)
    r = _client().post("/api/ingredients/review/x/approve", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_cors_only_allows_our_frontend():
    c = TestClient(main.app)
    ok = c.options("/health", headers={"Origin": "https://ingryd-beta.vercel.app", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "https://ingryd-beta.vercel.app"
    preview = c.options("/health", headers={"Origin": "https://ingryd-beta-git-main-winexwolf.vercel.app", "Access-Control-Request-Method": "GET"})
    assert preview.headers.get("access-control-allow-origin") == "https://ingryd-beta-git-main-winexwolf.vercel.app"
    evil = c.options("/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in evil.headers
