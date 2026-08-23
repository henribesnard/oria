"""Test complet de connexion mobile <-> backend pour l'app Oria.

Vérifie que tous les endpoints utilisés par l'app mobile répondent
correctement sur le backend de production.

Usage :
    python audit/mobile_backend_test.py
    python audit/mobile_backend_test.py https://oria.wezon.fr
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://oria.wezon.fr"
EMAIL = os.environ.get("TEST_EMAIL", "premium@test.oria.gg")
TEST_PW = os.environ.get("TEST_PASSWORD", "test" + "1234")

results: list[dict] = []
token: str | None = None


def test(name: str, method: str, path: str, body: dict | None = None,
         auth: bool = False, expect_status: int = 200,
         check: callable | None = None):
    """Run a single test and record result."""
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if auth and token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            status = res.status
            resp_body = json.loads(res.read().decode())
            elapsed = round((time.time() - t0) * 1000)
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            resp_body = json.loads(e.read().decode())
        except Exception:
            resp_body = {}
        elapsed = round((time.time() - t0) * 1000)
    except Exception as e:
        status = 0
        resp_body = {"error": str(e)}
        elapsed = round((time.time() - t0) * 1000)

    ok = status == expect_status
    if ok and check:
        try:
            ok = check(resp_body)
        except Exception:
            ok = False

    icon = "PASS" if ok else "FAIL"
    results.append({"name": name, "ok": ok, "status": status, "ms": elapsed})
    print(f"  {icon} {name} [{status}] ({elapsed}ms)")
    return resp_body


# -----------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------

print(f"\n{'='*60}")
print(f"  Test mobile <-> backend : {BASE}")
print(f"{'='*60}\n")

# --- Health ---
print("[Santé]")
health = test("GET /health", "GET", "/health",
              check=lambda r: r.get("status") == "up")

# --- Auth ---
print("\n[Authentification]")
login_resp = test("POST /auth/login", "POST", "/auth/login",
                  body={"email": EMAIL, "password": TEST_PW},
                  check=lambda r: "access_token" in r)
token = login_resp.get("access_token")

test("POST /auth/login mauvais mot de passe", "POST", "/auth/login",
     body={"email": EMAIL, "password": "wrong"}, expect_status=401)

test("GET /me", "GET", "/me", auth=True,
     check=lambda r: r.get("email") == EMAIL)

# --- Catalog ---
print("\n[Catalogue]")
leagues = test("GET /catalog/leagues", "GET", "/catalog/leagues", auth=True,
               check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/leagues?country=France", "GET",
     "/catalog/leagues?country=France", auth=True,
     check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/fixtures/live", "GET", "/catalog/fixtures/live", auth=True,
     check=lambda r: isinstance(r, list))

test("GET /catalog/fixtures (Ligue 1)", "GET",
     "/catalog/fixtures?league_id=61&season=2026", auth=True,
     check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/fixtures avec dates", "GET",
     "/catalog/fixtures?league_id=61&season=2026&date_from=2026-08-01&date_to=2026-09-30",
     auth=True,
     check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/teams (Ligue 1)", "GET",
     "/catalog/teams?league_id=61&season=2026", auth=True,
     check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/squad (PSG id=85)", "GET",
     "/catalog/squad?team_id=85", auth=True,
     check=lambda r: isinstance(r, list) and len(r) > 0)

test("GET /catalog/search?q=Paris", "GET",
     "/catalog/search?q=Paris", auth=True,
     check=lambda r: "results" in r and len(r["results"]) > 0)

# --- Chat ---
print("\n[Chat]")
test("POST /chat (blocking)", "POST", "/chat",
     body={"text": "Bonjour", "context": {}}, auth=True,
     check=lambda r: "text" in r and len(r["text"]) > 0)

# SSE streaming (just check 200 response starts)
chat_stream_url = f"{BASE}/chat/stream"
stream_req = urllib.request.Request(
    chat_stream_url,
    data=json.dumps({"text": "Salut", "context": {}}).encode(),
    headers={"Content-Type": "application/json",
             "Authorization": f"Bearer {token}"},
    method="POST",
)
t0 = time.time()
try:
    with urllib.request.urlopen(stream_req, timeout=30) as res:
        status = res.status
        first_line = res.readline().decode().strip()
        elapsed = round((time.time() - t0) * 1000)
        ok = status == 200 and first_line.startswith("data:")
except Exception as e:
    status = 0
    ok = False
    elapsed = round((time.time() - t0) * 1000)

icon = "PASS" if ok else "FAIL"
results.append({"name": "POST /chat/stream (SSE)", "ok": ok, "status": status, "ms": elapsed})
print(f"  {icon} POST /chat/stream (SSE) [{status}] ({elapsed}ms)")

# --- Follows ---
print("\n[Suivis]")
test("GET /follows", "GET", "/follows", auth=True,
     check=lambda r: isinstance(r, list))

# --- Settings ---
print("\n[Paramètres]")
test("GET /settings/notifications", "GET", "/settings/notifications", auth=True,
     check=lambda r: isinstance(r, dict))

# --- Billing ---
print("\n[Abonnement]")
test("GET /billing/subscription", "GET", "/billing/subscription", auth=True,
     check=lambda r: isinstance(r, dict))

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
print(f"\n{'='*60}")
passed = sum(1 for r in results if r["ok"])
failed = sum(1 for r in results if not r["ok"])
total = len(results)

print(f"  Résultat : {passed}/{total} OK" + (f", {failed} ECHEC" if failed else ""))

if failed:
    print(f"\n  Echecs :")
    for r in results:
        if not r["ok"]:
            print(f"    FAIL {r['name']} [{r['status']}]")

avg_ms = round(sum(r["ms"] for r in results) / total) if total else 0
print(f"\n  Latence moyenne : {avg_ms}ms")
print(f"{'='*60}\n")

sys.exit(1 if failed else 0)
