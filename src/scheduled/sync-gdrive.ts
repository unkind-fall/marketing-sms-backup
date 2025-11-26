import { getLatestXmlFromDrive } from '../lib/gdrive';
import { parseXmlContent } from '../lib/xml-parser';
import { batchInsertMessages, updatePhoneStats } from '../db/queries';
import type { Env } from '../index';

export async function syncFromGoogleDrive(env: Env): Promise<{
  success: boolean;
  fileName?: string;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
}> {
  try {
    if (!env.GDRIVE_CREDENTIALS) {
      return { success: false, error: 'GDRIVE_CREDENTIALS not configured' };
    }

    if (!env.GDRIVE_FOLDER_ID) {
      return { success: false, error: 'GDRIVE_FOLDER_ID not configured' };
    }

    const result = await getLatestXmlFromDrive(env.GDRIVE_CREDENTIALS, env.GDRIVE_FOLDER_ID);

    if (!result) {
      return { success: true, fileName: undefined, total: 0, inserted: 0, skipped: 0 };
    }

    const messages = await parseXmlContent(result.content);

    if (messages.length === 0) {
      return {
        success: true,
        fileName: result.fileName,
        total: 0,
        inserted: 0,
        skipped: 0,
      };
    }

    const { inserted, skipped } = await batchInsertMessages(env.DB, messages);

    // Update phone stats for all unique phones
    const uniquePhones = [...new Set(messages.map((m) => m.phone))];
    for (const phone of uniquePhones) {
      const contactName = messages.find((m) => m.phone === phone && m.contact_name)?.contact_name;
      await updatePhoneStats(env.DB, phone, contactName);
    }

    console.log(`Sync complete: ${result.fileName} - ${inserted} inserted, ${skipped} skipped`);

    return {
      success: true,
      fileName: result.fileName,
      total: messages.length,
      inserted,
      skipped,
    };
  } catch (error) {
    console.error('Google Drive sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
