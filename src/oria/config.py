"""Configuration centralisée via pydantic-settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Toute la configuration d'Oria, chargée depuis l'environnement / .env."""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # --- Secrets / accès ---
    apifootball_key: str = ""
    deepseek_api_key: str = ""
    weather_api_key: str = ""
    admin_token: str = ""

    # --- API-Football ---
    apifootball_base_url: str = "https://v3.football.api-sports.io"
    apifootball_auth_mode: str = "direct"  # "direct" | "rapidapi"

    # --- Activation modules optionnels ---
    enable_llm: bool = True
    enable_ingestion: bool = False
    enable_live: bool = False
    enable_push: bool = False
    enable_odds: bool = False
    enable_weather: bool = False

    # --- Quota / résilience ---
    apifootball_daily_budget: int = 7500
    apifootball_rate_per_min: int = 300
    breaker_fail_max: int = 5
    breaker_reset_seconds: float = 30.0
    default_timeout_seconds: float = 8.0

    # --- Modèles LLM ---
    llm_model_fast: str = "deepseek-v4-flash"
    llm_model_deep: str = "deepseek-v4-pro"

    # --- Base ---
    db_path: str = "./oria.db"
    log_level: str = "INFO"

    # --- Monitoring ---
    enable_monitoring: bool = True
    monitoring_persist: bool = False
    trace_sample_rate: float = 1.0
    trace_buffer_size: int = 500
    slow_request_ms: float = 2500.0
    stage_budget_ms: float = 1500.0
