/**
 * Returns the URL if it uses http/https protocol, otherwise returns undefined.
 * Defense-in-depth: the backend also validates, but this prevents rendering
 * dangerous URIs (e.g. javascript:) from legacy data or bypassed validation.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    // invalid URL
  }
  return undefined;
}
