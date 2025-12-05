-- Migration: Add subscription/SIM tracking support
-- Created: 2025-12-03
-- Description: Adds subscription_id tracking to messages and calls tables,
--              and creates a subscriptions table for managing SIM labels

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  phone_number TEXT,
  label TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);

-- 2. Alter messages table to add subscription tracking
ALTER TABLE messages ADD COLUMN subscription_id TEXT;
ALTER TABLE messages ADD COLUMN sim_slot TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_subscription ON messages(subscription_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone_subscription ON messages(phone, subscription_id);

-- 3. Alter calls table to add subscription tracking
ALTER TABLE calls ADD COLUMN subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_calls_subscription ON calls(subscription_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_subscription ON calls(phone, subscription_id);
