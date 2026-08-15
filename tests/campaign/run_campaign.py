"""Script de lancement de la campagne consolidée.

Génère le rapport final dans tests/campaign/runs/<timestamp>/.

Lancer : uv run python -m tests.campaign.run_campaign
Ou via pytest (recommandé) :
  uv run pytest tests/campaign/phases/ -m integration -s --tb=short
"""

from __future__ import annotations

import logging

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
logger = logging.getLogger("campaign")


def main() -> None:
    """Point d'entrée CLI pour la campagne."""
    logger.info("=" * 60)
    logger.info("CAMPAGNE DE VALIDATION ORIA")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Utilisation recommandée :")
    logger.info("  # Phases froides (P1-P4)")
    logger.info("  uv run pytest tests/campaign/phases/p1_endpoints.py -m integration -s")
    logger.info("  uv run pytest tests/campaign/phases/p2_pertinence.py -m integration -s")
    logger.info("  uv run pytest tests/campaign/phases/p3_cache.py -m integration -s")
    logger.info("  uv run pytest tests/campaign/phases/p4_singleflight.py -m integration -s")
    logger.info("")
    logger.info("  # Phases de charge (P5)")
    logger.info("  uv run pytest tests/campaign/phases/p5_load.py -m integration -s")
    logger.info("")
    logger.info("  # Phases longues (P6-P9)")
    logger.info("  uv run pytest tests/campaign/phases/p6_ingestion.py -m integration -s")
    logger.info("  uv run pytest tests/campaign/phases/p7_live.py -m 'integration and live' -s")
    logger.info("  uv run pytest tests/campaign/phases/p8_degradation.py -m integration -s")
    logger.info("  uv run pytest tests/campaign/phases/p9_e2e.py -m integration -s")
    logger.info("")
    logger.info("  # Soak")
    logger.info("  uv run python -m tests.campaign.phases.p10_soak --duration 4h")
    logger.info("")
    logger.info("  # Toutes les phases froides d'un coup :")
    logger.info("  uv run pytest tests/campaign/phases/ -m integration -s --tb=short")
    logger.info("")
    logger.info("Budget : 7500 appels/jour, 300/min")
    logger.info("Planification : P1-P6+P8-P9 (~2700 appels) le jour 1")
    logger.info("               P7+P10 (~3200 appels) un soir de matchs")


if __name__ == "__main__":
    main()
