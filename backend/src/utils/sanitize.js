import { ValidationError } from './errors.js';

/**
 * Validates a URL string to only allow http/https protocols.
 * Returns the URL if valid, null if empty/undefined, or throws on invalid protocol.
 */
export function sanitizeUrl(url) {
  if (url === null || url === undefined || url === '') return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
    return url;
  } catch {
    throw new ValidationError('screenRecordingLink must be a valid HTTP or HTTPS URL');
  }
}