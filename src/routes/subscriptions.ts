import { Hono } from 'hono';
import {
  getSubscriptions,
  getSubscriptionById,
  upsertSubscription,
  deleteSubscription,
  discoverSubscriptions
} from '../db/queries';
import type { Env } from '../index';

const subscriptions = new Hono<{ Bindings: Env }>();

// GET /subscriptions - List all subscriptions
subscriptions.get('/', async (c) => {
  try {
    const activeOnly = c.req.query('active') !== 'false';
    const subs = await getSubscriptions(c.env.DB, activeOnly);

    return c.json({
      success: true,
      data: subs,
      count: subs.length
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return c.json({ error: 'Failed to fetch subscriptions' }, 500);
  }
});

// POST /subscriptions/discover - Auto-discover from data
subscriptions.post('/discover', async (c) => {
  try {
    const discovered = await discoverSubscriptions(c.env.DB);

    return c.json({
      success: true,
      discovered,
      count: discovered.length,
      message: 'Subscriptions auto-discovered and registered'
    });
  } catch (error) {
    console.error('Discover subscriptions error:', error);
    return c.json({ error: 'Failed to discover subscriptions' }, 500);
  }
});

// GET /subscriptions/:id - Get specific subscription
subscriptions.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sub = await getSubscriptionById(c.env.DB, id);

    if (!sub) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({
      success: true,
      data: sub
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

// PUT /subscriptions/:id - Create or update subscription
subscriptions.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      phone_number?: string;
      label: string;
      is_active?: boolean;
    }>();

    if (!body.label) {
      return c.json({ error: 'label is required' }, 400);
    }

    const updated = await upsertSubscription(c.env.DB, {
      subscription_id: id,
      phone_number: body.phone_number,
      label: body.label,
      is_active: body.is_active ? 1 : 0
    });

    return c.json({
      success: true,
      updated,
      subscription_id: id
    });
  } catch (error) {
    console.error('Upsert subscription error:', error);
    return c.json({ error: 'Failed to update subscription' }, 500);
  }
});

// DELETE /subscriptions/:id - Soft delete subscription
subscriptions.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteSubscription(c.env.DB, id);

    if (!deleted) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Subscription deactivated'
    });
  } catch (error) {
    console.error('Delete subscription error:', error);
    return c.json({ error: 'Failed to delete subscription' }, 500);
  }
});

export default subscriptions;
