/**
 * Formats a phone number or JID strictly as an international phone number with country code.
 * Replaces names and hides technical account IDs (like @lid).
 */
export function formatPhoneNumber(numberOrJid?: string): string {
  if (!numberOrJid) return '';

  // Filter out internal WhatsApp LID identifiers
  if (numberOrJid.includes('@lid')) {
    const rawDigits = numberOrJid.split('@')[0].replace(/\D/g, '');
    // If it's a 14-15 digit internal LID without standard country code pattern, display as formatted or fallback
    return `+${rawDigits}`;
  }

  const clean = numberOrJid.split('@')[0].replace(/\D/g, '');
  if (!clean) return '';

  // Venezuela (+58)
  if (clean.startsWith('58') && clean.length >= 11) {
    const area = clean.slice(2, 5);
    const mid = clean.slice(5, 8);
    const rest = clean.slice(8);
    return `+58 ${area} ${mid} ${rest}`.trim();
  }

  // Colombia (+57)
  if (clean.startsWith('57') && clean.length >= 11) {
    const area = clean.slice(2, 5);
    const mid = clean.slice(5, 8);
    const rest = clean.slice(8);
    return `+57 ${area} ${mid} ${rest}`.trim();
  }

  // USA / Canada (+1)
  if (clean.startsWith('1') && clean.length === 11) {
    return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
  }

  // Spain (+34)
  if (clean.startsWith('34') && clean.length === 11) {
    return `+34 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }

  // Chile (+56)
  if (clean.startsWith('56') && clean.length >= 10) {
    return `+56 ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }

  // Default international format
  return `+${clean}`;
}

export function isLidAccount(jid?: string): boolean {
  return Boolean(jid && jid.includes('@lid'));
}
