-- Migration 0002 : comptes utilisateurs et identités multi-canal

-- La table users existante (0001) stockait prefs/memory/follows en JSON.
-- On la conserve telle quelle pour rétrocompatibilité (userstore),
-- et on crée la nouvelle table accounts pour le module identity.

CREATE TABLE IF NOT EXISTS accounts (
    id         TEXT PRIMARY KEY,
    status     TEXT NOT NULL DEFAULT 'active',   -- active | suspended | deleted
    role       TEXT NOT NULL DEFAULT 'user',      -- user | admin
    display_name TEXT NOT NULL DEFAULT '',
    locale     TEXT NOT NULL DEFAULT 'fr',
    timezone   TEXT NOT NULL DEFAULT 'Europe/Paris',
    created_at REAL NOT NULL,
    deleted_at REAL
);

CREATE TABLE IF NOT EXISTS identities (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    external_id TEXT NOT NULL,
    created_at  REAL NOT NULL,
    UNIQUE(provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_provider_ext ON identities(provider, external_id);
