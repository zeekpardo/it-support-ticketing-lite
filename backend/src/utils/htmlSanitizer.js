/**
 * Basic HTML sanitization for email bodies
 * Strips scripts, styles, and dangerous tags while preserving basic formatting
 */
export function sanitizeHtml(html) {
  if (!html) return '';

  let cleaned = html;

  // Remove script tags and their content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers (onclick, onerror, onload, etc.)
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  cleaned = cleaned.replace(/data:text\/html/gi, '');

  // Strip all HTML tags to get plain text
  // This is a conservative approach - removes all formatting but ensures safety
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || '(Empty message)';
}

/**
 * Sanitize email body by removing quoted replies and dangerous content
 * Email clients often include previous messages starting with > or other markers
 */
export function sanitizeEmailBody(body) {
  if (!body) return '(Empty message)';

  // Remove quoted replies (lines starting with >)
  const lines = body.split('\n');
  const cleanLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at quoted reply markers
    if (trimmed.startsWith('>')) break;

    // Stop at common email signature markers
    if (trimmed === '--' || trimmed === '---') break;

    // Stop at "On ... wrote:" patterns (email threading)
    if (/^On .+ wrote:$/i.test(trimmed)) break;

    cleanLines.push(line);
  }

  let cleaned = cleanLines.join('\n').trim();

  // If the content appears to be HTML, sanitize it
  if (cleaned.includes('<') && cleaned.includes('>')) {
    cleaned = sanitizeHtml(cleaned);
  }

  return cleaned || '(Empty message)';
}
