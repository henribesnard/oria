-- Migration 0004 : billing & entitlements

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id           TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    tier              TEXT NOT NULL DEFAULT 'free',
    status            TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_sub_id     TEXT,
    current_period_end REAL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    updated_at        REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_events (
    id              TEXT PRIMARY KEY,
    user_id         TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,
    stripe_event_id TEXT UNIQUE,
    received_at     REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id);

CREATE TABLE IF NOT EXISTS usage_counters (
    user_id  TEXT NOT NULL,
    day      TEXT NOT NULL,
    feature  TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day, feature)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_day ON usage_counters(user_id, day);
