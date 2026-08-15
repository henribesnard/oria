"""Génération de rapports — markdown, JSON, CSV."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


@dataclass
class PhaseResult:
    """Résultat d'une phase."""

    name: str
    status: str = "pending"  # passed | failed | skipped | partial
    calls_used: int = 0
    calls_budget: int = 0
    duration_ms: float = 0
    tests_total: int = 0
    tests_passed: int = 0
    tests_failed: int = 0
    anomalies: list[dict[str, str]] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    details: str = ""


@dataclass
class CampaignMetrics:
    """Métriques globales de la campagne."""

    total_api_calls: int = 0
    budget_before: int = 0
    budget_after: int = 0
    duration_ms: float = 0
    phases: list[PhaseResult] = field(default_factory=list)
    reconciliation: dict[str, Any] = field(default_factory=dict)
    latencies: dict[str, dict[str, float]] = field(default_factory=dict)
    singleflight_matrix: list[dict[str, Any]] = field(default_factory=list)
    anomalies: list[dict[str, str]] = field(default_factory=list)


def create_run_dir() -> Path:
    """Crée le répertoire du run courant : tests/campaign/runs/<timestamp>/."""
    ts = datetime.now(tz=UTC).strftime("%Y%m%d_%H%M%S")
    run_dir = Path(__file__).parent / "runs" / ts
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def generate_report(metrics: CampaignMetrics, run_dir: Path) -> Path:
    """Génère REPORT.md dans le run_dir."""
    lines: list[str] = []

    lines.append(f"# Rapport de campagne Oria — {run_dir.name}")
    lines.append("")
    lines.append(f"Date : {datetime.now(tz=UTC).isoformat()}")
    lines.append("")

    # 1. Verdict en 10 lignes
    lines.append("## 1. Verdict")
    lines.append("")
    total_passed = sum(p.tests_passed for p in metrics.phases)
    total_tests = sum(p.tests_total for p in metrics.phases)
    total_anomalies = sum(len(p.anomalies) for p in metrics.phases)
    bloquantes = [
        a for p in metrics.phases for a in p.anomalies if a.get("severity") == "bloquant"
    ]

    lines.append(f"- **Phases exécutées** : {len(metrics.phases)}")
    lines.append(f"- **Tests** : {total_passed}/{total_tests} passés")
    lines.append(f"- **Appels API consommés** : {metrics.total_api_calls}")
    lines.append(f"- **Budget restant** : {metrics.budget_after}")
    lines.append(f"- **Anomalies** : {total_anomalies} (dont {len(bloquantes)} bloquantes)")
    lines.append(f"- **Durée** : {metrics.duration_ms / 1000:.1f} s")

    if bloquantes:
        lines.append("")
        lines.append("### Anomalies bloquantes")
        for a in bloquantes:
            lines.append(f"- **{a.get('title', '?')}** : {a.get('description', '')}")
    lines.append("")

    # 2. Tableau de bord
    lines.append("## 2. Tableau de bord")
    lines.append("")
    lines.append("| Phase | Statut | Appels | Budget | Tests | Anomalies | Durée |")
    lines.append("|-------|--------|--------|--------|-------|-----------|-------|")
    for p in metrics.phases:
        lines.append(
            f"| {p.name} | {p.status} | {p.calls_used} | {p.calls_budget} | "
            f"{p.tests_passed}/{p.tests_total} | {len(p.anomalies)} | "
            f"{p.duration_ms / 1000:.1f}s |"
        )
    lines.append("")

    # 3. Optimisation des appels
    lines.append("## 3. Optimisation des appels")
    lines.append("")
    if metrics.singleflight_matrix:
        lines.append("### Matrice single-flight (P4.3)")
        lines.append("")
        lines.append(
            "| Donnée cible | Nb formulations | Appels API observés | Appels attendus | Verdict |"
        )
        lines.append("|---|---|---|---|---|")
        for row in metrics.singleflight_matrix:
            verdict = "OK" if row["observed"] <= row["expected"] else "ANOMALIE"
            lines.append(
                f"| {row['target']} | {row['formulations']} | "
                f"{row['observed']} | {row['expected']} | {verdict} |"
            )
    lines.append("")

    # 4. Latences
    lines.append("## 4. Latences")
    lines.append("")
    if metrics.latencies:
        lines.append("| Catégorie | p50 | p90 | p95 | p99 | max | avg |")
        lines.append("|---|---|---|---|---|---|---|")
        for cat, stats in metrics.latencies.items():
            lines.append(
                f"| {cat} | {stats.get('p50', 0):.0f}ms | "
                f"{stats.get('p90', 0):.0f}ms | {stats.get('p95', 0):.0f}ms | "
                f"{stats.get('p99', 0):.0f}ms | {stats.get('max', 0):.0f}ms | "
                f"{stats.get('avg', 0):.0f}ms |"
            )
    lines.append("")

    # 5. Écarts spec/implémentation
    lines.append("## 5. Écarts spec/implémentation")
    lines.append("")
    spec_gaps = [a for p in metrics.phases for a in p.anomalies if a.get("type") == "spec_gap"]
    if spec_gaps:
        for a in spec_gaps:
            lines.append(f"- **{a.get('title', '?')}** : {a.get('description', '')}")
    else:
        lines.append("Aucun écart identifié.")
    lines.append("")

    # 6. Recommandations
    lines.append("## 6. Recommandations")
    lines.append("")
    recs = [a for p in metrics.phases for a in p.anomalies if a.get("recommendation")]
    for i, a in enumerate(recs, 1):
        lines.append(f"{i}. {a['recommendation']}")
    lines.append("")

    # 7. Réconciliation quota
    lines.append("## 7. Réconciliation quota")
    lines.append("")
    if metrics.reconciliation:
        for k, v in metrics.reconciliation.items():
            lines.append(f"- **{k}** : {v}")
    lines.append("")

    # 8. Anomalies complètes
    lines.append("## 8. Anomalies")
    lines.append("")
    all_anomalies = [{**a, "phase": p.name} for p in metrics.phases for a in p.anomalies]
    by_severity = {"bloquant": [], "majeur": [], "mineur": [], "observation": []}
    for a in all_anomalies:
        sev = a.get("severity", "observation")
        by_severity.setdefault(sev, []).append(a)

    for sev in ["bloquant", "majeur", "mineur", "observation"]:
        items = by_severity.get(sev, [])
        if items:
            lines.append(f"### {sev.upper()} ({len(items)})")
            for a in items:
                lines.append(
                    f"- [{a.get('phase', '?')}] **{a.get('title', '?')}** : "
                    f"{a.get('description', '')}"
                )
                if a.get("proof"):
                    lines.append(f"  - Preuve : {a['proof']}")
                if a.get("recommendation"):
                    lines.append(f"  - Recommandation : {a['recommendation']}")
            lines.append("")

    report_text = "\n".join(lines)
    report_path = run_dir / "REPORT.md"
    report_path.write_text(report_text, encoding="utf-8")

    # JSON
    metrics_path = run_dir / "metrics.json"
    metrics_dict = {
        "total_api_calls": metrics.total_api_calls,
        "budget_before": metrics.budget_before,
        "budget_after": metrics.budget_after,
        "duration_ms": metrics.duration_ms,
        "phases": [asdict(p) for p in metrics.phases],
        "reconciliation": metrics.reconciliation,
        "latencies": metrics.latencies,
        "singleflight_matrix": metrics.singleflight_matrix,
        "anomalies": all_anomalies,
    }
    metrics_path.write_text(
        json.dumps(metrics_dict, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    # Anomalies séparées
    anomalies_path = run_dir / "anomalies.md"
    anomalies_lines = ["# Anomalies de la campagne\n"]
    for sev in ["bloquant", "majeur", "mineur", "observation"]:
        items = by_severity.get(sev, [])
        if items:
            anomalies_lines.append(f"## {sev.upper()} ({len(items)})\n")
            for a in items:
                anomalies_lines.append(f"### [{a.get('phase', '?')}] {a.get('title', '?')}\n")
                anomalies_lines.append(f"**Sévérité** : {sev}\n")
                anomalies_lines.append(f"{a.get('description', '')}\n")
                if a.get("proof"):
                    anomalies_lines.append(f"**Preuve** : {a['proof']}\n")
                if a.get("recommendation"):
                    anomalies_lines.append(f"**Recommandation** : {a['recommendation']}\n")
                anomalies_lines.append("")
    anomalies_path.write_text("\n".join(anomalies_lines), encoding="utf-8")

    return report_path
