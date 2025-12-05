import { Hono } from 'hono';
import { getCalls, getCallsByPhone, getCallById, getPhoneHistory, getCallsByPhoneAndSubscription, getPhoneHistoryWithSubscription } from '../db/queries';
import { normalizePhone } from '../lib/phone-utils';
import type { Env } from '../index';

const calls = new Hono<{ Bindings: Env }>();

calls.get('/', async (c) => {
  try {
    const phoneQuery = c.req.query('phone');
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const includeMessages = c.req.query('include') === 'messages';
    const subscriptionId = c.req.query('subscription');

    if (phoneQuery) {
      // Filter by phone
      const { normalized } = normalizePhone(phoneQuery);

      if (includeMessages) {
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
        const callList = await getCallsByPhoneAndSubscription(c.env.DB, normalized, subscriptionId, limit, offset);

        return c.json({
          success: true,
          phone: normalized,
          subscription_id: subscriptionId || null,
          data: callList,
          pagination: {
            limit,
            offset,
            count: callList.length,
          },
        });
      }
    } else {
      // All calls
      const callList = await getCalls(c.env.DB, limit, offset);

      return c.json({
        success: true,
        data: callList,
        pagination: {
          limit,
          offset,
          count: callList.length,
        },
      });
    }
  } catch (error) {
    console.error('Get calls error:', error);
    return c.json({ error: 'Failed to fetch calls' }, 500);
  }
});

calls.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const call = await getCallById(c.env.DB, id);

    if (!call) {
      return c.json({ error: 'Call not found' }, 404);
    }

    return c.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error('Get call error:', error);
    return c.json({ error: 'Failed to fetch call' }, 500);
  }
});

export default calls;
