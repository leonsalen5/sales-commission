/**
 * Helper utility for SHA-256 encryption & hashing and auth constants.
 * Ensures passwords and permission codes are securely hashed.
 * NOTE: Plaintext passwords must NEVER be present in code or UI.
 */

// Hashes of system passwords
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '615ed7fb1504b0c724a296d7a69e6c7b2f9ea2c57c1d8206c5afdf392ebdfd25';

export const DEFAULT_VIEW_PASSWORD_HASH =
  '9800a8677d99e5f6968d7357e44006388b09d3b6a8676d0f930fbaa63d02330d';

export const ADMIN_PERMISSION_CODE_HASH =
  'b7b99ba738afaaf923fa742a27b26940a9c5e327507b1660cc4de9d72ff19d78';

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
