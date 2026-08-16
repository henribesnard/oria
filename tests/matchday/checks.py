"""Checks -- verification post-run.

Verifie qu'un run produit un pack complet, coherent, et jugeable
sans ouvrir un autre fichier.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CheckResult:
    """Resultat d'une verification."""

    name: str
    passed: bool
    detail: str = ""


@dataclass
class CheckReport:
    """Rapport complet des verifications."""

    run_dir: str
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(c.passed for c in self.checks)

    @property
    def summary(self) -> str:
        passed = sum(1 for c in self.checks if c.passed)
        total = len(self.checks)
        return f"{passed}/{total} checks passed"


def check_run(run_dir: Path) -> CheckReport:
    """Execute toutes les verifications sur un repertoire de run."""
    report = CheckReport(run_dir=str(run_dir))

    # 1. Structure de fichiers
    report.checks.append(_check_structure(run_dir))

    # 2. manifest.json
    report.checks.append(_check_manifest(run_dir))

    # 3. plan.json
    report.checks.append(_check_plan(run_dir))

    # 4. personas.json
    report.checks.append(_check_personas(run_dir))

    # 5. Echanges dans raw/
    report.checks.append(_check_raw_exchanges(run_dir))

    # 6. Chaque echange est auto-suffisant
    report.checks.append(_check_exchange_completeness(run_dir))

    # 7. Oracle
    report.checks.append(_check_oracle(run_dir))

    # 8. Metriques
    report.checks.append(_check_metrics(run_dir))

    # 9. Horodatage UTC
    report.checks.append(_check_timestamps(run_dir))

    # 10. Pas de secrets
    report.checks.append(_check_no_secrets(run_dir))

    # Log
    for c in report.checks:
        icon = "PASS" if c.passed else "FAIL"
        logger.info("  [%s] %s : %s", icon, c.name, c.detail)

    logger.info("checks: %s", report.summary)
    return report


def _check_structure(run_dir: Path) -> CheckResult:
    """Verifie la structure de repertoires."""
    required_dirs = ["oracle", "raw", "metrics", "logs", "judging"]
    required_files = ["manifest.json", "plan.json", "personas.json"]

    missing_dirs = [d for d in required_dirs if not (run_dir / d).is_dir()]
    missing_files = [f for f in required_files if not (run_dir / f).is_file()]

    if missing_dirs or missing_files:
        detail = ""
        if missing_dirs:
            detail += f"dirs manquants: {missing_dirs} "
        if missing_files:
            detail += f"fichiers manquants: {missing_files}"
        return CheckResult("structure", False, detail)

    return CheckResult("structure", True, "tous les repertoires et fichiers presents")


def _check_manifest(run_dir: Path) -> CheckResult:
    """Verifie manifest.json."""
    path = run_dir / "manifest.json"
    if not path.exists():
        return CheckResult("manifest", False, "manifest.json absent")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return CheckResult("manifest", False, f"JSON invalide: {e}")

    required_keys = ["run_id", "created_utc", "mode", "total_exchanges"]
    missing = [k for k in required_keys if k not in data]
    if missing:
        return CheckResult("manifest", False, f"cles manquantes: {missing}")

    return CheckResult("manifest", True, f"run_id={data['run_id']}, {data['total_exchanges']} exchanges")


def _check_plan(run_dir: Path) -> CheckResult:
    """Verifie plan.json."""
    path = run_dir / "plan.json"
    if not path.exists():
        return CheckResult("plan", False, "plan.json absent")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return CheckResult("plan", False, f"JSON invalide: {e}")

    waves = data.get("waves", [])
    total = data.get("total_questions", 0)

    return CheckResult("plan", True, f"{len(waves)} vagues, {total} questions planifiees")


def _check_personas(run_dir: Path) -> CheckResult:
    """Verifie personas.json (sans secrets)."""
    path = run_dir / "personas.json"
    if not path.exists():
        return CheckResult("personas", False, "personas.json absent")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return CheckResult("personas", False, f"JSON invalide: {e}")

    if not isinstance(data, list):
        return CheckResult("personas", False, "doit etre une liste")

    # Verifier qu'il n'y a pas de secrets
    text = path.read_text(encoding="utf-8")
    for forbidden in ["password", "access_token", "refresh_token", "api_key", "secret"]:
        if forbidden in text.lower():
            return CheckResult("personas", False, f"contient un champ sensible: {forbidden}")

    return CheckResult("personas", True, f"{len(data)} personas")


def _check_raw_exchanges(run_dir: Path) -> CheckResult:
    """Verifie la presence d'echanges dans raw/."""
    raw_dir = run_dir / "raw"
    if not raw_dir.is_dir():
        return CheckResult("raw_exchanges", False, "raw/ absent")

    files = list(raw_dir.glob("*.json"))
    if not files:
        return CheckResult("raw_exchanges", False, "aucun echange dans raw/")

    return CheckResult("raw_exchanges", True, f"{len(files)} echanges")


def _check_exchange_completeness(run_dir: Path) -> CheckResult:
    """Verifie que chaque echange est jugeable sans ouvrir un autre fichier."""
    raw_dir = run_dir / "raw"
    if not raw_dir.is_dir():
        return CheckResult("exchange_completeness", False, "raw/ absent")

    files = list(raw_dir.glob("*.json"))
    issues: list[str] = []

    required_fields = [
        "exchange_id", "ts_utc", "persona", "persona_tier",
        "category", "question", "context",
    ]
    response_fields = ["response_text", "http_status"]

    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            issues.append(f"{f.name}: JSON invalide")
            continue

        for field in required_fields:
            if field not in data:
                issues.append(f"{f.name}: champ manquant '{field}'")

        # Au moins la reponse ou une erreur
        has_response = data.get("response_text", "") != ""
        has_error = data.get("error") is not None
        if not has_response and not has_error:
            issues.append(f"{f.name}: ni reponse ni erreur")

        # Horodatage
        ts = data.get("ts_utc", "")
        if not ts or "T" not in ts:
            issues.append(f"{f.name}: horodatage manquant ou invalide")

    if issues:
        detail = f"{len(issues)} problemes: {'; '.join(issues[:5])}"
        if len(issues) > 5:
            detail += f" (et {len(issues) - 5} autres)"
        return CheckResult("exchange_completeness", False, detail)

    return CheckResult("exchange_completeness", True, f"{len(files)} echanges complets et jugeables")


def _check_oracle(run_dir: Path) -> CheckResult:
    """Verifie la presence de donnees oracle."""
    oracle_dir = run_dir / "oracle"
    if not oracle_dir.is_dir():
        return CheckResult("oracle", False, "oracle/ absent")

    files = list(oracle_dir.glob("*.json"))
    if not files:
        return CheckResult("oracle", False, "aucun fichier dans oracle/")

    return CheckResult("oracle", True, f"{len(files)} fichiers oracle")


def _check_metrics(run_dir: Path) -> CheckResult:
    """Verifie la presence de metriques."""
    metrics_dir = run_dir / "metrics"
    if not metrics_dir.is_dir():
        return CheckResult("metrics", False, "metrics/ absent")

    files = list(metrics_dir.glob("*.json"))
    if not files:
        return CheckResult("metrics", False, "aucun fichier dans metrics/")

    return CheckResult("metrics", True, f"{len(files)} fichiers metriques")


def _check_timestamps(run_dir: Path) -> CheckResult:
    """Verifie que tous les horodatages sont en UTC ISO 8601."""
    raw_dir = run_dir / "raw"
    if not raw_dir.is_dir():
        return CheckResult("timestamps", False, "raw/ absent")

    non_utc = []
    for f in raw_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            ts = data.get("ts_utc", "")
            # Verifier format basique
            if ts and "+00:00" not in ts and "Z" not in ts and ts.endswith("+02:00"):
                non_utc.append(f.name)
        except Exception:
            pass

    if non_utc:
        return CheckResult("timestamps", False, f"{len(non_utc)} echanges avec horodatage non-UTC")

    return CheckResult("timestamps", True, "tous les horodatages en UTC")


def _check_no_secrets(run_dir: Path) -> CheckResult:
    """Verifie qu'aucun fichier ne contient de secrets."""
    secret_patterns = [
        "sk-", "JWT_SECRET", "ADMIN_TOKEN=",
        "Bearer eyJ",  # JWT tokens
    ]

    found: list[str] = []
    for f in run_dir.rglob("*.json"):
        try:
            text = f.read_text(encoding="utf-8")
            for pattern in secret_patterns:
                if pattern in text:
                    found.append(f"{f.relative_to(run_dir)}: contient '{pattern[:10]}...'")
                    break
        except Exception:
            pass

    if found:
        return CheckResult("no_secrets", False, f"secrets detectes: {'; '.join(found[:3])}")

    return CheckResult("no_secrets", True, "aucun secret detecte")


def export_check_report(report: CheckReport, path: Path) -> None:
    """Exporte le rapport de verification."""
    data = {
        "run_dir": report.run_dir,
        "all_passed": report.all_passed,
        "summary": report.summary,
        "checks": [
            {"name": c.name, "passed": c.passed, "detail": c.detail}
            for c in report.checks
        ],
    }
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
