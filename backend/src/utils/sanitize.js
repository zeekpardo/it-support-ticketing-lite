import { ValidationError } from './errors.js';

/**
 * Encodes & < > " ' for safe interpolation inside HTML strings.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Checks whether a MIME type is in the given allowlist.
 */
export function isAllowedMimeType(mimetype, allowlist) {
  return allowlist.includes(mimetype);
}

/**
 * Validates a URL string to only allow http/https protocols.
 * Returns the URL if valid, null if empty/undefined, or throws on invalid protocol.
 */
export function sanitizeUrl(url, fieldName = 'URL') {
  if (url === null || url === undefined || url === '') return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
    return url;
  } catch {
    throw new ValidationError(`${fieldName} must be a valid HTTP or HTTPS URL`);
  }
}