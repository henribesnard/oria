-- Migration 0005 : preferences, suivis, conversations

CREATE TABLE IF NOT EXISTS follows (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,  -- league | team | player
    entity_id   INTEGER NOT NULL,
    entity_name TEXT NOT NULL DEFAULT '',
    created_at  REAL NOT NULL,
    UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_type ON follows(entity_type);

CREATE TABLE IF NOT EXISTS notification_settings (
    user_id    TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    prematch   INTEGER NOT NULL DEFAULT 1,
    result     INTEGER NOT NULL DEFAULT 1,
    lineup     INTEGER NOT NULL DEFAULT 1,
    live_goal  INTEGER NOT NULL DEFAULT 0,
    digest     INTEGER NOT NULL DEFAULT 1,
    quiet_start TEXT NOT NULL DEFAULT '23:00',
    quiet_end   TEXT NOT NULL DEFAULT '08:00',
    timezone    TEXT NOT NULL DEFAULT 'Europe/Paris',
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL,  -- user | assistant
    text       TEXT NOT NULL,
    metadata   TEXT NOT NULL DEFAULT '{}',
    created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);

CREATE TABLE IF NOT EXISTS active_context (
    user_id    TEXT PRIMARY KEY,
    context    TEXT NOT NULL DEFAULT '{}',
    updated_at REAL NOT NULL
);
