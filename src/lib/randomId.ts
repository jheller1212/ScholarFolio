/** A v4 UUID that works where `crypto.randomUUID` doesn't exist (Safari < 15.4,
 *  older Android WebViews, non-secure contexts). The fallback still draws from
 *  `crypto.getRandomValues` rather than Math.random, because one caller uses the
 *  value as the ORCID OAuth CSRF state and it must stay unguessable. */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
