import { Hono } from 'hono';
import { parseXmlContent } from '../lib/xml-parser';
import { batchInsertMessages, updatePhoneStats } from '../db/queries';
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

    if (!xmlContent || !xmlContent.includes('<smses')) {
      return c.json({ error: 'Invalid XML content' }, 400);
    }

    const messages = await parseXmlContent(xmlContent);

    if (messages.length === 0) {
      return c.json({
        success: true,
        total: 0,
        inserted: 0,
        skipped: 0,
      });
    }

    const { inserted, skipped } = await batchInsertMessages(c.env.DB, messages);

    // Update phone stats for all unique phones
    const uniquePhones = [...new Set(messages.map((m) => m.phone))];
    for (const phone of uniquePhones) {
      const contactName = messages.find((m) => m.phone === phone && m.contact_name)?.contact_name;
      await updatePhoneStats(c.env.DB, phone, contactName);
    }

    return c.json({
      success: true,
      total: messages.length,
      inserted,
      skipped,
      uniquePhones: uniquePhones.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to process upload' }, 500);
  }
});

export default upload;
