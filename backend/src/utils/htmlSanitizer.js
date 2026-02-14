/**
 * Extract readable plain text from HTML email content.
 * Converts HTML structure to text with proper spacing,
 * replaces images with [Image] placeholders, and preserves links.
 */
export function extractTextFromHtml(html) {
  if (!html) return '';

  let cleaned = html;

  // Remove script tags and their content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove head section entirely
  cleaned = cleaned.replace(/<head\b[\s\S]*?<\/head>/gi, '');

  // Replace <img> tags with [Image] placeholder (preserve alt text if available)
  cleaned = cleaned.replace(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi, '[Image: $1]');
  cleaned = cleaned.replace(/<img\b[^>]*>/gi, '[Image]');

  // Replace <a> tags with text + URL
  cleaned = cleaned.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
    const linkText = text.replace(/<[^>]+>/g, '').trim();
    if (!linkText || linkText === url) return url;
    return `${linkText} (${url})`;
  });

  // Replace <br> tags with newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // Replace closing block-level tags with newlines
  cleaned = cleaned.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n');

  // Replace <hr> with separator
  cleaned = cleaned.replace(/<hr\b[^>]*>/gi, '\n---\n');

  // Remove all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Clean up whitespace: collapse spaces within lines, preserve line breaks
  cleaned = cleaned.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n');

  // Collapse excessive blank lines (3+ → 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Sanitize email body: extract text from HTML, remove quoted replies and signatures.
 * Designed for converting inbound emails into ticket descriptions/comments.
 */
export function sanitizeEmailBody(body) {
  if (!body) return '(Empty message)';

  let cleaned = body;

  // If the content is HTML, extract text first (before quoted reply detection)
  if (cleaned.includes('<html') || cleaned.includes('<div') || cleaned.includes('<p') || cleaned.includes('<br')) {
    cleaned = extractTextFromHtml(cleaned);
  }

  // Now remove quoted replies from the plain text
  const lines = cleaned.split('\n');
  const cleanLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at quoted reply markers (> at start of line in plain text)
    if (trimmed.startsWith('>') && !trimmed.startsWith('>>')) {
      // Only break if it looks like a quote, not just a single > character
      if (trimmed.length > 1) break;
    }

    // Stop at common email signature markers
    if (trimmed === '--' || trimmed === '---') break;

    // Stop at "On ... wrote:" patterns (email threading)
    if (/^On .+ wrote:$/i.test(trimmed)) break;

    // Stop at common mobile signatures that indicate the end of content
    if (/^Sent from my /i.test(trimmed)) break;
    if (/^Get Outlook for /i.test(trimmed)) break;

    cleanLines.push(line);
  }

  cleaned = cleanLines.join('\n').trim();

  return cleaned || '(Empty message)';
}
