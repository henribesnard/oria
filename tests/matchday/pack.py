"""Pack -- assemblage du dossier de handoff.

Cree le manifest final, copie les fichiers, et genere l'archive ZIP
pour Cowork.
"""

from __future__ import annotations

import json
import logging
import shutil
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tests.matchday.checks import CheckReport, check_run, export_check_report

logger = logging.getLogger(__name__)


def create_manifest(
    run_dir: Path,
    mode: str,
    total_exchanges: int,
    matches_count: int,
    waves_count: int,
    api_calls_estimate: int = 0,
) -> dict[str, Any]:
    """Cree le manifest.json du run."""
    run_id = run_dir.name
    manifest = {
        "run_id": run_id,
        "created_utc": datetime.now(tz=UTC).isoformat(timespec="milliseconds"),
        "mode": mode,
        "total_exchanges": total_exchanges,
        "matches_count": matches_count,
        "waves_count": waves_count,
        "api_calls_estimate": api_calls_estimate,
        "structure": {
            "plan": "plan.json",
            "personas": "personas.json",
            "oracle": "oracle/",
            "raw_exchanges": "raw/",
            "metrics": "metrics/",
            "logs": "logs/",
            "anomalies": "anomalies/",
            "judging": "judging/ (vide, rempli par Cowork)",
        },
        "format_version": "1.0",
        "notes": (
            "Chaque fichier dans raw/ est un echange auto-suffisant. "
            "Il contient la question, la reponse ORIA, le contexte, "
            "l'horodatage UTC, le persona, la categorie, et la reference "
            "au match. Les donnees oracle dans oracle/fixtures.json "
            "fournissent la verite terrain pour appariement."
        ),
    }

    (run_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return manifest


def ensure_dirs(run_dir: Path) -> None:
    """Cree tous les sous-repertoires requis."""
    for d in ["oracle", "raw", "metrics", "traces", "logs", "anomalies", "judging"]:
        (run_dir / d).mkdir(parents=True, exist_ok=True)


def create_run_dir(base: Path | None = None) -> Path:
    """Cree le repertoire du run avec timestamp."""
    if base is None:
        base = Path(__file__).parent / "runs"

    ts = datetime.now(tz=UTC).strftime("%Y%m%d-%H%M")
    run_dir = base / f"matchday-{ts}"
    run_dir.mkdir(parents=True, exist_ok=True)
    ensure_dirs(run_dir)
    return run_dir


def build_pack(
    run_dir: Path,
    handoff_dir: Path | None = None,
) -> Path:
    """Construit le pack de handoff (ZIP)."""
    if handoff_dir is None:
        handoff_dir = Path(__file__).parent / "handoff"
    handoff_dir.mkdir(parents=True, exist_ok=True)

    # Verifications pre-pack
    logger.info("running checks before packing...")
    report = check_run(run_dir)
    export_check_report(report, run_dir / "checks_report.json")

    if not report.all_passed:
        logger.warning(
            "ATTENTION: %s — le pack sera cree mais avec des problemes",
            report.summary,
        )

    # Creer le ZIP
    zip_name = f"{run_dir.name}.zip"
    zip_path = handoff_dir / zip_name

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(run_dir.rglob("*")):
            if file_path.is_file():
                arcname = file_path.relative_to(run_dir.parent)
                zf.write(file_path, arcname)

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    logger.info("pack created: %s (%.1f Mo)", zip_path, size_mb)

    return zip_path
