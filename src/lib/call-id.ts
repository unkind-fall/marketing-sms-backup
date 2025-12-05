export async function generateCallId(
  phone: string,
  timestamp: number,
  callType: number,
  duration: number
): Promise<string> {
  const payload = [phone, timestamp.toString(), callType.toString(), duration.toString()].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex and take first 16 characters
  return Array.from(hashArray.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
