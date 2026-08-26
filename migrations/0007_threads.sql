-- Migration 0007 : threads de conversation (multi-conversation par user)

CREATE TABLE IF NOT EXISTS threads (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    context    TEXT NOT NULL DEFAULT '{}',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id, updated_at DESC);

-- Rattacher chaque message à un thread
ALTER TABLE conversations ADD COLUMN thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_id, created_at);
