
export interface Message {
  id: string;
  phone: string;
  phone_raw: string | null;
  type: 'sms' | 'mms';
  direction: number;
  body: string | null;
  timestamp: number;
  readable_date: string | null;
  contact_name: string | null;
  created_at: number;
}

export interface Phone {
  phone: string;
  display_name: string | null;
  message_count: number;
  last_message_at: number | null;
  updated_at: number;
}

export async function insertMessage(db: D1Database, message: Omit<Message, 'created_at'>): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO messages (id, phone, phone_raw, type, direction, body, timestamp, readable_date, contact_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      message.id,
      message.phone,
      message.phone_raw,
      message.type,
      message.direction,
      message.body,
      message.timestamp,
      message.readable_date,
      message.contact_name
    )
    .run();

  return result.meta.changes > 0;
}

export async function batchInsertMessages(
  db: D1Database,
  messages: Omit<Message, 'created_at'>[]
): Promise<{ inserted: number; skipped: number }> {
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const statements = batch.map((m) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO messages (id, phone, phone_raw, type, direction, body, timestamp, readable_date, contact_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, m.phone, m.phone_raw, m.type, m.direction, m.body, m.timestamp, m.readable_date, m.contact_name)
    );

    const results = await db.batch(statements);
    for (const r of results) {
      if (r.meta.changes > 0) inserted++;
      else skipped++;
    }
  }

  return { inserted, skipped };
}

export async function updatePhoneStats(db: D1Database, phone: string, displayName?: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO phones (phone, display_name, message_count, last_message_at, updated_at)
       VALUES (?, ?,
         (SELECT COUNT(*) FROM messages WHERE phone = ?),
         (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
         unixepoch() * 1000
       )
       ON CONFLICT(phone) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, phones.display_name),
         message_count = (SELECT COUNT(*) FROM messages WHERE phone = ?),
         last_message_at = (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
         updated_at = unixepoch() * 1000`
    )
    .bind(phone, displayName, phone, phone, phone, phone)
    .run();
}

export async function getPhones(db: D1Database, limit = 100, offset = 0): Promise<Phone[]> {
  const result = await db
    .prepare('SELECT * FROM phones ORDER BY last_message_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Phone>();

  return result.results;
}

export async function getMessagesByPhone(
  db: D1Database,
  phone: string,
  limit = 100,
  offset = 0
): Promise<Message[]> {
  const result = await db
    .prepare('SELECT * FROM messages WHERE phone = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
    .bind(phone, limit, offset)
    .all<Message>();

  return result.results;
}

export async function getMessageById(db: D1Database, id: string): Promise<Message | null> {
  const result = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first<Message>();

  return result;
}
