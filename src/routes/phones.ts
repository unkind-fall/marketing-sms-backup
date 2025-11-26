import { Hono } from 'hono';
import { getPhones } from '../db/queries';
import type { Env } from '../index';

const phones = new Hono<{ Bindings: Env }>();

phones.get('/', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const phoneList = await getPhones(c.env.DB, limit, offset);

    return c.json({
      success: true,
      data: phoneList,
      pagination: {
        limit,
        offset,
        count: phoneList.length,
      },
    });
  } catch (error) {
    console.error('Get phones error:', error);
    return c.json({ error: 'Failed to fetch phones' }, 500);
  }
});

export default phones;
