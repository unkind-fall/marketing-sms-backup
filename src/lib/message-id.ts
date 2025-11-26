export async function generateMessageId(
  phone: string,
  timestamp: number,
  type: 'sms' | 'mms',
  direction: number,
  body: string | null
): Promise<string> {
  const payload = [
    phone,
    timestamp.toString(),
    type,
    direction.toString(),
    (body || '').slice(0, 100),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex and take first 16 characters
  return Array.from(hashArray.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
