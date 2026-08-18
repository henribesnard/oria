#!/usr/bin/env bash
# CI check — lance pytest, mypy, ruff, build frontend, tsc mobile.
# Usage : bash scripts/check.sh
set -euo pipefail

echo "=== pytest ==="
uv run pytest --ignore=tests/matchday -q

echo ""
echo "=== mypy src ==="
uv run mypy src

echo ""
echo "=== ruff ==="
uv run ruff check .

echo ""
echo "=== frontend build ==="
(cd frontend && npm run build)

echo ""
echo "=== frontend lint ==="
(cd frontend && npm run lint)

echo ""
echo "=== mobile tsc ==="
(cd mobile && npx tsc --noEmit)

echo ""
echo "=== ALL CHECKS OK ==="
