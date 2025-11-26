import { XMLParser } from 'fast-xml-parser';
import { normalizePhone } from './phone-utils';
import { generateMessageId } from './message-id';
import type { Message } from '../db/queries';

interface SmsElement {
  address: string;
  date: string;
  type: string;
  body: string;
  readable_date: string;
  contact_name: string;
}

interface MmsElement {
  address: string;
  date: string;
  msg_box: string;
  readable_date: string;
  contact_name: string;
  parts?: {
    part: MmsPart | MmsPart[];
  };
}

interface MmsPart {
  ct: string;
  text: string;
}

interface ParsedXml {
  smses: {
    sms?: SmsElement | SmsElement[];
    mms?: MmsElement | MmsElement[];
  };
}

function extractMmsText(mms: MmsElement): string | null {
  if (!mms.parts?.part) return null;

  const parts = Array.isArray(mms.parts.part) ? mms.parts.part : [mms.parts.part];
  const textPart = parts.find((p) => p.ct === 'text/plain');

  return textPart?.text || null;
}

export async function parseXmlContent(xmlContent: string): Promise<Omit<Message, 'created_at'>[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
  });

  const parsed: ParsedXml = parser.parse(xmlContent);
  const messages: Omit<Message, 'created_at'>[] = [];

  // Parse SMS messages
  if (parsed.smses?.sms) {
    const smsArray = Array.isArray(parsed.smses.sms) ? parsed.smses.sms : [parsed.smses.sms];

    for (const sms of smsArray) {
      const { normalized } = normalizePhone(sms.address);
      const timestamp = parseInt(sms.date, 10);
      const direction = parseInt(sms.type, 10);
      const body = sms.body === 'null' ? null : sms.body;

      const id = await generateMessageId(normalized, timestamp, 'sms', direction, body);

      messages.push({
        id,
        phone: normalized,
        phone_raw: sms.address,
        type: 'sms',
        direction,
        body,
        timestamp,
        readable_date: sms.readable_date === 'null' ? null : sms.readable_date,
        contact_name: sms.contact_name === '(Unknown)' ? null : sms.contact_name,
      });
    }
  }

  // Parse MMS messages
  if (parsed.smses?.mms) {
    const mmsArray = Array.isArray(parsed.smses.mms) ? parsed.smses.mms : [parsed.smses.mms];

    for (const mms of mmsArray) {
      const { normalized } = normalizePhone(mms.address);
      const timestamp = parseInt(mms.date, 10);
      // msg_box: 1=received, 2=sent
      const direction = parseInt(mms.msg_box, 10);
      const body = extractMmsText(mms);

      const id = await generateMessageId(normalized, timestamp, 'mms', direction, body);

      messages.push({
        id,
        phone: normalized,
        phone_raw: mms.address,
        type: 'mms',
        direction,
        body,
        timestamp,
        readable_date: mms.readable_date === 'null' ? null : mms.readable_date,
        contact_name: mms.contact_name === '(Unknown)' ? null : mms.contact_name,
      });
    }
  }

  return messages;
}
