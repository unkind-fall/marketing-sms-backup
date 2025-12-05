
export interface Message {
  id: string;
  phone: string;
  phone_raw: string | null;
  type: 'sms' | 'mms';
  direction: string;
  body: string | null;
  timestamp: number;
  readable_date: string | null;
  contact_name: string | null;
  subscription_id: string | null;
  sim_slot: string | null;
  created_at: number;
}

export interface Phone {
  phone: string;
  display_name: string | null;
  message_count: number;
  last_message_at: number | null;
  call_count: number;
  last_call_at: number | null;
  updated_at: number;
}

export interface Call {
  id: string;
  phone: string;
  phone_raw: string | null;
  call_type: string;
  duration: number;
  timestamp: number;
  readable_date: string | null;
  contact_name: string | null;
  subscription_id: string | null;
  created_at: number;
}

export interface PhoneHistory {
  messages: Message[];
  calls: Call[];
  counts: {
    messages: number;
    calls: number;
    total: number;
  };
}

export interface Subscription {
  subscription_id: string;
  phone_number: string | null;
  label: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export async function insertMessage(db: D1Database, message: Omit<Message, 'created_at'>): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR REPLACE INTO messages (id, phone, phone_raw, type, direction, body, timestamp, readable_date, contact_name, subscription_id, sim_slot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      message.contact_name,
      message.subscription_id,
      message.sim_slot
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
          `INSERT OR REPLACE INTO messages (id, phone, phone_raw, type, direction, body, timestamp, readable_date, contact_name, subscription_id, sim_slot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, m.phone, m.phone_raw, m.type, m.direction, m.body, m.timestamp, m.readable_date, m.contact_name, m.subscription_id, m.sim_slot)
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
      `INSERT INTO phones (phone, display_name, message_count, last_message_at, call_count, last_call_at, updated_at)
       VALUES (?, ?,
         (SELECT COUNT(*) FROM messages WHERE phone = ?),
         (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
         (SELECT COUNT(*) FROM calls WHERE phone = ?),
         (SELECT MAX(timestamp) FROM calls WHERE phone = ?),
         unixepoch() * 1000
       )
       ON CONFLICT(phone) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, phones.display_name),
         message_count = (SELECT COUNT(*) FROM messages WHERE phone = ?),
         last_message_at = (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
         call_count = (SELECT COUNT(*) FROM calls WHERE phone = ?),
         last_call_at = (SELECT MAX(timestamp) FROM calls WHERE phone = ?),
         updated_at = unixepoch() * 1000`
    )
    .bind(phone, displayName ?? null, phone, phone, phone, phone, phone, phone, phone, phone)
    .run();
}

export async function batchUpdatePhoneStats(
  db: D1Database,
  phones: Array<{ phone: string; displayName?: string | null }>
): Promise<void> {
  const BATCH_SIZE = 50;

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch = phones.slice(i, i + BATCH_SIZE);
    const statements = batch.map(({ phone, displayName }) =>
      db
        .prepare(
          `INSERT INTO phones (phone, display_name, message_count, last_message_at, call_count, last_call_at, updated_at)
           VALUES (?, ?,
             (SELECT COUNT(*) FROM messages WHERE phone = ?),
             (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
             (SELECT COUNT(*) FROM calls WHERE phone = ?),
             (SELECT MAX(timestamp) FROM calls WHERE phone = ?),
             unixepoch() * 1000
           )
           ON CONFLICT(phone) DO UPDATE SET
             display_name = COALESCE(excluded.display_name, phones.display_name),
             message_count = (SELECT COUNT(*) FROM messages WHERE phone = ?),
             last_message_at = (SELECT MAX(timestamp) FROM messages WHERE phone = ?),
             call_count = (SELECT COUNT(*) FROM calls WHERE phone = ?),
             last_call_at = (SELECT MAX(timestamp) FROM calls WHERE phone = ?),
             updated_at = unixepoch() * 1000`
        )
        .bind(phone, displayName ?? null, phone, phone, phone, phone, phone, phone, phone, phone)
    );

    await db.batch(statements);
  }
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

// Call queries

export async function batchInsertCalls(
  db: D1Database,
  calls: Omit<Call, 'created_at'>[]
): Promise<{ inserted: number; skipped: number }> {
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    const statements = batch.map((c) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO calls (id, phone, phone_raw, call_type, duration, timestamp, readable_date, contact_name, subscription_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(c.id, c.phone, c.phone_raw, c.call_type, c.duration, c.timestamp, c.readable_date, c.contact_name, c.subscription_id)
    );

    const results = await db.batch(statements);
    for (const r of results) {
      if (r.meta.changes > 0) inserted++;
      else skipped++;
    }
  }

  return { inserted, skipped };
}

export async function getCallsByPhone(db: D1Database, phone: string, limit = 100, offset = 0): Promise<Call[]> {
  const result = await db
    .prepare('SELECT * FROM calls WHERE phone = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
    .bind(phone, limit, offset)
    .all<Call>();

  return result.results;
}

export async function getCalls(db: D1Database, limit = 100, offset = 0): Promise<Call[]> {
  const result = await db
    .prepare('SELECT * FROM calls ORDER BY timestamp DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Call>();

  return result.results;
}

export async function getCallById(db: D1Database, id: string): Promise<Call | null> {
  const result = await db.prepare('SELECT * FROM calls WHERE id = ?').bind(id).first<Call>();

  return result;
}

export async function getPhoneHistory(
  db: D1Database,
  phone: string,
  limit = 100,
  offset = 0
): Promise<PhoneHistory> {
  const [messages, calls] = await Promise.all([
    getMessagesByPhone(db, phone, limit, offset),
    getCallsByPhone(db, phone, limit, offset)
  ]);

  return {
    messages,
    calls,
    counts: {
      messages: messages.length,
      calls: calls.length,
      total: messages.length + calls.length
    }
  };
}

// ============ Subscription Management ============

export async function getSubscriptions(db: D1Database, activeOnly = true): Promise<Subscription[]> {
  const query = activeOnly
    ? 'SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY label ASC'
    : 'SELECT * FROM subscriptions ORDER BY label ASC';

  const result = await db.prepare(query).all<Subscription>();
  return result.results;
}

export async function getSubscriptionById(db: D1Database, subscriptionId: string): Promise<Subscription | null> {
  const result = await db
    .prepare('SELECT * FROM subscriptions WHERE subscription_id = ?')
    .bind(subscriptionId)
    .first<Subscription>();

  return result;
}

export async function upsertSubscription(
  db: D1Database,
  subscription: {
    subscription_id: string;
    phone_number?: string | null;
    label: string;
    is_active?: number;
  }
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO subscriptions (subscription_id, phone_number, label, is_active, updated_at)
       VALUES (?, ?, ?, ?, unixepoch() * 1000)
       ON CONFLICT(subscription_id) DO UPDATE SET
         phone_number = COALESCE(excluded.phone_number, subscriptions.phone_number),
         label = excluded.label,
         is_active = COALESCE(excluded.is_active, subscriptions.is_active),
         updated_at = unixepoch() * 1000`
    )
    .bind(
      subscription.subscription_id,
      subscription.phone_number ?? null,
      subscription.label,
      subscription.is_active ?? 1
    )
    .run();

  return result.meta.changes > 0;
}

export async function deleteSubscription(db: D1Database, subscriptionId: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE subscriptions
       SET is_active = 0, updated_at = unixepoch() * 1000
       WHERE subscription_id = ?`
    )
    .bind(subscriptionId)
    .run();

  return result.meta.changes > 0;
}

export async function discoverSubscriptions(db: D1Database): Promise<string[]> {
  const messagesResult = await db
    .prepare('SELECT DISTINCT subscription_id FROM messages WHERE subscription_id IS NOT NULL')
    .all<{ subscription_id: string }>();

  const callsResult = await db
    .prepare('SELECT DISTINCT subscription_id FROM calls WHERE subscription_id IS NOT NULL')
    .all<{ subscription_id: string }>();

  const discovered = new Set<string>();
  messagesResult.results.forEach(r => discovered.add(r.subscription_id));
  callsResult.results.forEach(r => discovered.add(r.subscription_id));

  const subscriptionIds = Array.from(discovered);
  for (const subId of subscriptionIds) {
    const existing = await getSubscriptionById(db, subId);
    if (!existing) {
      await upsertSubscription(db, {
        subscription_id: subId,
        label: `SIM ${subId}`,
        is_active: 1
      });
    }
  }

  return subscriptionIds;
}

// ============ Filtered Query Functions ============

export async function getMessagesByPhoneAndSubscription(
  db: D1Database,
  phone: string,
  subscriptionId?: string,
  limit = 100,
  offset = 0
): Promise<Message[]> {
  let query = 'SELECT * FROM messages WHERE phone = ?';
  const bindings: any[] = [phone];

  if (subscriptionId) {
    query += ' AND subscription_id = ?';
    bindings.push(subscriptionId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<Message>();

  return result.results;
}

export async function getCallsByPhoneAndSubscription(
  db: D1Database,
  phone: string,
  subscriptionId?: string,
  limit = 100,
  offset = 0
): Promise<Call[]> {
  let query = 'SELECT * FROM calls WHERE phone = ?';
  const bindings: any[] = [phone];

  if (subscriptionId) {
    query += ' AND subscription_id = ?';
    bindings.push(subscriptionId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<Call>();

  return result.results;
}

export async function getPhoneHistoryWithSubscription(
  db: D1Database,
  phone: string,
  subscriptionId?: string,
  limit = 100,
  offset = 0
): Promise<PhoneHistory> {
  const [messages, calls] = await Promise.all([
    getMessagesByPhoneAndSubscription(db, phone, subscriptionId, limit, offset),
    getCallsByPhoneAndSubscription(db, phone, subscriptionId, limit, offset)
  ]);

  return {
    messages,
    calls,
    counts: {
      messages: messages.length,
      calls: calls.length,
      total: messages.length + calls.length
    }
  };
}

// ============ Bulk Lookup Functions ============

export interface ContactStatus {
  sent: number;
  received: number;
}

export async function bulkCheckContacted(
  db: D1Database,
  phones: string[],
  subscriptionId?: string
): Promise<Record<string, ContactStatus>> {
  if (phones.length === 0) {
    return {};
  }

  // Build placeholders for IN clause
  const placeholders = phones.map(() => '?').join(', ');

  // Build query with optional subscription filter
  const params: (string | null)[] = [...phones];
  let subscriptionFilter = '';
  if (subscriptionId) {
    subscriptionFilter = 'AND subscription_id = ?';
    params.push(subscriptionId);
  }

  // Query for both sent and received message counts per phone
  const query = `
    SELECT phone, direction, COUNT(*) as count
    FROM messages
    WHERE phone IN (${placeholders})
      ${subscriptionFilter}
    GROUP BY phone, direction
  `;

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<{ phone: string; direction: string; count: number }>();

  // Build result map with counts
  const countsMap = new Map<string, { sent: number; received: number }>();
  for (const row of result.results) {
    const existing = countsMap.get(row.phone) || { sent: 0, received: 0 };
    if (row.direction === 'sent') {
      existing.sent = row.count;
    } else if (row.direction === 'received') {
      existing.received = row.count;
    }
    countsMap.set(row.phone, existing);
  }

  // Build final result for all requested phones
  const results: Record<string, ContactStatus> = {};
  for (const phone of phones) {
    results[phone] = countsMap.get(phone) || { sent: 0, received: 0 };
  }

  return results;
}
