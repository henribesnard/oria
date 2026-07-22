-- Migration 0001 : tables initiales Oria

CREATE TABLE IF NOT EXISTS cache (
    key       TEXT    PRIMARY KEY,
    value     TEXT    NOT NULL,
    domain    TEXT    NOT NULL DEFAULT '',
    volatility TEXT  NOT NULL DEFAULT 'lent',
    fetched_at REAL  NOT NULL,
    ttl_seconds REAL NOT NULL DEFAULT 3600
);

CREATE INDEX IF NOT EXISTS idx_cache_domain ON cache(domain);

CREATE TABLE IF NOT EXISTS users (
    user_id    TEXT PRIMARY KEY,
    prefs      TEXT NOT NULL DEFAULT '{}',
    memory     TEXT NOT NULL DEFAULT '[]',
    follows    TEXT NOT NULL DEFAULT '[]',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE,
    applied_at REAL   NOT NULL
);
