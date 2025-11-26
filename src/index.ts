import { Hono } from 'hono';
import { cors } from 'hono/cors';
import webhook from './routes/webhook';
import upload from './routes/upload';
import phones from './routes/phones';
import messages from './routes/messages';
import { syncFromGoogleDrive } from './scheduled/sync-gdrive';

export interface Env {
  DB: D1Database;
  API_KEY: string;
  GDRIVE_CREDENTIALS: string;
  GDRIVE_FOLDER_ID: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors());

// API Key authentication middleware
app.use('*', async (c, next) => {
  // Skip auth for health check
  if (c.req.path === '/health') {
    return next();
  }

  const apiKey = c.req.header('X-API-Key');

  if (!c.env.API_KEY) {
    // If no API key is configured, allow all requests (dev mode)
    return next();
  }

  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.route('/webhook', webhook);
app.route('/upload', upload);
app.route('/phones', phones);
app.route('/messages', messages);

// Manual trigger for Google Drive sync
app.post('/sync', async (c) => {
  const result = await syncFromGoogleDrive(c.env);
  return c.json(result);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Scheduled handler for cron trigger
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        console.log('Starting scheduled Google Drive sync...');
        const result = await syncFromGoogleDrive(env);
        console.log('Sync result:', JSON.stringify(result));
      })()
    );
  },
};
