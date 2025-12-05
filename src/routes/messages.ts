import { Hono } from 'hono';
import { getMessagesByPhone, getMessageById, getPhoneHistory, getMessagesByPhoneAndSubscription, getPhoneHistoryWithSubscription } from '../db/queries';
import { normalizePhone } from '../lib/phone-utils';
import type { Env } from '../index';

const messages = new Hono<{ Bindings: Env }>();

messages.get('/', async (c) => {
  try {
    const phoneQuery = c.req.query('phone');

    if (!phoneQuery) {
      return c.json({ error: 'phone query parameter is required' }, 400);
    }

    const { normalized } = normalizePhone(phoneQuery);
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const includeCalls = c.req.query('include') === 'calls';
    const subscriptionId = c.req.query('subscription');

    if (includeCalls) {
      const history = await getPhoneHistoryWithSubscription(c.env.DB, normalized, subscriptionId, limit, offset);

      return c.json({
        success: true,
        phone: normalized,
        subscription_id: subscriptionId || null,
        data: {
          messages: history.messages,
          calls: history.calls
        },
        pagination: {
          limit,
          offset,
          messageCount: history.counts.messages,
          callCount: history.counts.calls,
          totalCount: history.counts.total
        }
      });
    } else {
      const messageList = await getMessagesByPhoneAndSubscription(c.env.DB, normalized, subscriptionId, limit, offset);

      return c.json({
        success: true,
        phone: normalized,
        subscription_id: subscriptionId || null,
        data: messageList,
        pagination: {
          limit,
          offset,
          count: messageList.length,
        },
      });
    }
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

messages.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const message = await getMessageById(c.env.DB, id);

    if (!message) {
      return c.json({ error: 'Message not found' }, 404);
    }

    return c.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Get message error:', error);
    return c.json({ error: 'Failed to fetch message' }, 500);
  }
});

export default messages;
