-- SMS Backup Schema

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_raw TEXT,
  type TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT,
  timestamp INTEGER NOT NULL,
  readable_date TEXT,
  contact_name TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(phone, timestamp);

CREATE TABLE IF NOT EXISTS phones (
  phone TEXT PRIMARY KEY,
  display_name TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at INTEGER,
  call_count INTEGER DEFAULT 0,
  last_call_at INTEGER,
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Call History Table
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_raw TEXT,
  call_type TEXT NOT NULL,
  duration INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  readable_date TEXT,
  contact_name TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_calls_phone ON calls(phone);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(phone, timestamp);
