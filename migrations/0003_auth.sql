-- Migration 0003 : authentification web (credentials, sessions, tokens)

CREATE TABLE IF NOT EXISTS credentials (
    user_id        TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at     REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credentials_email ON credentials(email);

CREATE TABLE IF NOT EXISTS sessions (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent         TEXT NOT NULL DEFAULT '',
    ip                 TEXT NOT NULL DEFAULT '',
    expires_at         REAL NOT NULL,
    revoked_at         REAL,
    created_at         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_token_hash);

CREATE TABLE IF NOT EXISTS tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,       -- email_verify | password_reset
    token_hash TEXT NOT NULL,
    expires_at REAL NOT NULL,
    used_at    REAL,
    created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_hash ON tokens(token_hash);
