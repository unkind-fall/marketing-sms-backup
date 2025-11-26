import { Hono } from 'hono';
import { normalizePhone } from '../lib/phone-utils';
import { generateMessageId } from '../lib/message-id';
import { insertMessage, updatePhoneStats } from '../db/queries';
import type { Env } from '../index';

const webhook = new Hono<{ Bindings: Env }>();

interface SmsForwarderPayload {
  from: string;
  content: string;
  timestamp: string;
  sim_slot?: string;
}

webhook.post('/', async (c) => {
  try {
    const payload = await c.req.json<SmsForwarderPayload>();

    if (!payload.from || !payload.content) {
      return c.json({ error: 'Missing required fields: from, content' }, 400);
    }

    const { normalized } = normalizePhone(payload.from);
    const timestamp = payload.timestamp ? parseInt(payload.timestamp, 10) : Date.now();
    const direction = 1; // Received (SmsForwarder only sends incoming messages)

    const id = await generateMessageId(normalized, timestamp, 'sms', direction, payload.content);

    const inserted = await insertMessage(c.env.DB, {
      id,
      phone: normalized,
      phone_raw: payload.from,
      type: 'sms',
      direction,
      body: payload.content,
      timestamp,
      readable_date: new Date(timestamp).toISOString(),
      contact_name: null,
    });

    if (inserted) {
      await updatePhoneStats(c.env.DB, normalized);
    }

    return c.json({
      success: true,
      inserted,
      id,
      phone: normalized,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Failed to process webhook' }, 500);
  }
});

export default webhook;
