# CI check — lance pytest, mypy, ruff, build frontend, tsc mobile.
# Usage : powershell scripts/check.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== pytest ===" -ForegroundColor Cyan
uv run pytest --ignore=tests/matchday -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== mypy src ===" -ForegroundColor Cyan
uv run mypy src
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== ruff ===" -ForegroundColor Cyan
uv run ruff check .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== frontend build ===" -ForegroundColor Cyan
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "`n=== frontend lint ===" -ForegroundColor Cyan
Push-Location frontend
npm run lint
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "`n=== mobile tsc ===" -ForegroundColor Cyan
Push-Location mobile
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "`n=== ALL CHECKS OK ===" -ForegroundColor Green
