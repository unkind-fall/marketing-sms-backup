export interface NormalizedPhone {
  normalized: string;
  isAlphanumeric: boolean;
}

export function normalizePhone(raw: string): NormalizedPhone {
  if (!raw) {
    return { normalized: 'UNKNOWN', isAlphanumeric: true };
  }

  const cleaned = raw.replace(/\s+/g, '').trim();

  if (!cleaned) {
    return { normalized: 'UNKNOWN', isAlphanumeric: true };
  }

  // Check if alphanumeric sender (TPG, Uber, 321, etc.)
  // Alphanumeric if it contains any letter OR is very short (like "321")
  const digitsOnly = cleaned.replace(/\D/g, '');
  const hasLetters = /[a-zA-Z]/.test(cleaned);

  if (hasLetters) {
    return { normalized: cleaned.toUpperCase(), isAlphanumeric: true };
  }

  // Short codes (3-6 digits) - keep as-is
  if (digitsOnly.length <= 6) {
    return { normalized: digitsOnly, isAlphanumeric: true };
  }

  // Australian number normalization
  // Already E.164 format: +61...
  if (cleaned.startsWith('+61') && digitsOnly.length === 11) {
    return { normalized: `+${digitsOnly}`, isAlphanumeric: false };
  }

  // Starts with 61 (without +): 61450123456
  if (digitsOnly.startsWith('61') && digitsOnly.length === 11) {
    return { normalized: `+${digitsOnly}`, isAlphanumeric: false };
  }

  // Local format: 0450123456 -> +61450123456
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return { normalized: `+61${digitsOnly.slice(1)}`, isAlphanumeric: false };
  }

  // Missing leading 0: 450123456 -> +61450123456
  if (digitsOnly.startsWith('4') && digitsOnly.length === 9) {
    return { normalized: `+61${digitsOnly}`, isAlphanumeric: false };
  }

  // Other international numbers - add + if not present
  if (cleaned.startsWith('+')) {
    return { normalized: cleaned, isAlphanumeric: false };
  }

  // Default: assume international, add + prefix
  if (digitsOnly.length >= 7) {
    return { normalized: `+${digitsOnly}`, isAlphanumeric: false };
  }

  // Fallback: keep as-is
  return { normalized: cleaned, isAlphanumeric: true };
}
