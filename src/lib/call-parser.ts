import { XMLParser } from 'fast-xml-parser';
import { normalizePhone } from './phone-utils';
import { generateCallId } from './call-id';
import type { Call } from '../db/queries';

interface CallElement {
  number: string;
  duration: string;
  date: string;
  type: string;
  readable_date: string;
  contact_name: string;
  subscription_id?: string;
}

interface ParsedCallsXml {
  calls: {
    call?: CallElement | CallElement[];
  };
}

function getCallTypeName(type: number): string {
  switch (type) {
    case 1:
      return 'incoming';
    case 2:
      return 'outgoing';
    case 3:
      return 'missed';
    case 4:
      return 'voicemail';
    case 5:
      return 'rejected';
    case 6:
      return 'blocked';
    default:
      return 'unknown';
  }
}

export async function parseCallsXml(xmlContent: string): Promise<Omit<Call, 'created_at'>[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
  });

  const parsed: ParsedCallsXml = parser.parse(xmlContent);
  const calls: Omit<Call, 'created_at'>[] = [];

  if (parsed.calls?.call) {
    const callArray = Array.isArray(parsed.calls.call) ? parsed.calls.call : [parsed.calls.call];

    for (const call of callArray) {
      // Skip calls with empty phone numbers (privacy blocked)
      if (!call.number) continue;

      const { normalized } = normalizePhone(call.number);
      const timestamp = parseInt(call.date, 10);
      const callTypeNum = parseInt(call.type, 10);
      const callType = getCallTypeName(callTypeNum);
      const duration = parseInt(call.duration, 10);

      const id = await generateCallId(normalized, timestamp, callTypeNum, duration);

      calls.push({
        id,
        phone: normalized,
        phone_raw: call.number || null,
        call_type: callType,
        duration,
        timestamp,
        readable_date: !call.readable_date || call.readable_date === 'null' ? null : call.readable_date,
        contact_name: !call.contact_name || call.contact_name === '(Unknown)' ? null : call.contact_name,
        subscription_id: call.subscription_id || null,
      });
    }
  }

  return calls;
}
