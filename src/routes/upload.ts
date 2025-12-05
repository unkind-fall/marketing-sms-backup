import { Hono } from 'hono';
import { parseXmlContent } from '../lib/xml-parser';
import { parseCallsXml } from '../lib/call-parser';
import { batchInsertMessages, batchInsertCalls, batchUpdatePhoneStats } from '../db/queries';
import type { Env } from '../index';

const upload = new Hono<{ Bindings: Env }>();

upload.post('/', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';

    let xmlContent: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file uploaded' }, 400);
      }

      xmlContent = await file.text();
    } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      xmlContent = await c.req.text();
    } else {
      return c.json(
        { error: 'Invalid content type. Use multipart/form-data or application/xml' },
        400
      );
    }

    // Detect XML type by root element
    const isCallsXml = xmlContent.includes('<calls');
    const isMessagesXml = xmlContent.includes('<smses');

    if (!xmlContent || (!isCallsXml && !isMessagesXml)) {
      return c.json({ error: 'Invalid XML content. Expected <smses> or <calls> root element.' }, 400);
    }

    if (isCallsXml) {
      // Handle calls XML
      const calls = await parseCallsXml(xmlContent);

      if (calls.length === 0) {
        return c.json({
          success: true,
          type: 'calls',
          total: 0,
          inserted: 0,
          skipped: 0,
        });
      }

      const { inserted, skipped } = await batchInsertCalls(c.env.DB, calls);

      // Update phone stats for all unique phones
      const uniquePhones = [...new Set(calls.map((c) => c.phone))];
      const phoneStats = uniquePhones.map((phone) => ({
        phone,
        displayName: calls.find((c) => c.phone === phone && c.contact_name)?.contact_name,
      }));
      await batchUpdatePhoneStats(c.env.DB, phoneStats);

      return c.json({
        success: true,
        type: 'calls',
        total: calls.length,
        inserted,
        skipped,
        uniquePhones: uniquePhones.length,
      });
    } else {
      // Handle messages XML (SMS/MMS)
      const messages = await parseXmlContent(xmlContent);

      if (messages.length === 0) {
        return c.json({
          success: true,
          type: 'messages',
          total: 0,
          inserted: 0,
          skipped: 0,
        });
      }

      const { inserted, skipped } = await batchInsertMessages(c.env.DB, messages);

      // Update phone stats for all unique phones
      const uniquePhones = [...new Set(messages.map((m) => m.phone))];
      const phoneStats = uniquePhones.map((phone) => ({
        phone,
        displayName: messages.find((m) => m.phone === phone && m.contact_name)?.contact_name,
      }));
      await batchUpdatePhoneStats(c.env.DB, phoneStats);

      return c.json({
        success: true,
        type: 'messages',
        total: messages.length,
        inserted,
        skipped,
        uniquePhones: uniquePhones.length,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to process upload' }, 500);
  }
});

export default upload;
