import sanitizeHtml from 'sanitize-html';

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

    // Stop at common mobile/email client signatures
    if (/^Sent from my /i.test(trimmed)) break;
    if (/^Get Outlook for /i.test(trimmed)) break;
    if (/^Outlook for (iOS|Android)/i.test(trimmed)) break;

    cleanLines.push(line);
  }

  cleaned = cleanLines.join('\n').trim();

  // Remove trailing orphaned words from split signatures (e.g., lone "Get" from "Get Outlook for iOS")
  cleaned = cleaned.replace(/\nGet\s*$/i, '').trim();

  return cleaned || '(Empty message)';
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip quoted reply content and signatures from email HTML.
 * Must be called before sanitize-html since it removes entire DOM subtrees.
 */
function stripQuotedHtml(html) {
  let cleaned = html;

  // Gmail: <div class="gmail_quote">...</div>
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*$/i, '');

  // Outlook: <div id="appendonsend">
  cleaned = cleaned.replace(/<div[^>]*id="appendonsend"[^>]*>[\s\S]*$/i, '');

  // Outlook: border-top separator pattern
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*border-top:\s*solid[^"]*"[^>]*>[\s\S]*$/i, '');

  // Apple Mail: <blockquote type="cite">
  cleaned = cleaned.replace(/<blockquote[^>]*type="cite"[^>]*>[\s\S]*$/i, '');

  // Generic "On ... wrote:" in a block element
  cleaned = cleaned.replace(/<(div|p)[^>]*>[^<]*On [^<]*wrote:\s*<\/(div|p)>[\s\S]*$/i, '');

  // Signature divs
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*signature[^"]*"[^>]*>[\s\S]*$/i, '');

  // Mobile signatures as block elements
  cleaned = cleaned.replace(/<(div|p)[^>]*>[^<]*Sent from my [^<]*<\/(div|p)>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<(div|p)[^>]*>[^<]*Get Outlook for [^<]*<\/(div|p)>[\s\S]*$/gi, '');

  return cleaned;
}

/**
 * Sanitize email HTML for safe storage and rendering.
 * Replaces CID image references with s3: placeholders.
 * Strips quoted replies, signatures, and dangerous content.
 *
 * @param {string} html - Raw email HTML
 * @param {Map<string, string>} cidToS3Map - Maps content IDs to S3 keys
 * @returns {string|null} Sanitized HTML with s3: image sources, or null if no meaningful content
 */
export function sanitizeEmailHtml(html, cidToS3Map = new Map()) {
  if (!html) return null;

  // Step 1: Strip quoted replies and signatures from raw HTML
  let processed = stripQuotedHtml(html);

  // Step 2: Replace cid: references with s3: placeholders
  for (const [cid, s3Key] of cidToS3Map) {
    const cleanCid = cid.replace(/[<>]/g, '');
    // Handle both cid:xxx and cid:xxx@domain formats
    const cidPattern = new RegExp(`(src=["'])cid:${escapeRegex(cleanCid)}([^"']*)["']`, 'gi');
    processed = processed.replace(cidPattern, `$1s3:${s3Key}"`);
  }

  // Step 3: Sanitize HTML - allow safe tags, strip dangerous content
  const cleanHtml = sanitizeHtml(processed, {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height'],
      'td': ['colspan', 'rowspan'],
      'th': ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 's3'],
    allowedSchemesAppliedToAttributes: ['src', 'href'],
    transformTags: {
      'a': sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    },
  });

  // Step 4: Check if the result has meaningful content
  const textOnly = cleanHtml.replace(/<[^>]+>/g, '').trim();
  if (!textOnly && !cleanHtml.includes('<img')) {
    return null;
  }

  return cleanHtml;
}

/**
 * Sanitize comment HTML from the rich text editor.
 * Allows formatting tags but strips dangerous content.
 *
 * @param {string} html - Raw HTML from Tiptap editor
 * @returns {string|null} Sanitized HTML, or null if no meaningful content
 */
export function sanitizeCommentHtml(html) {
  if (!html) return null;

  const cleanHtml = sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt'],
      'span': ['class', 'data-type', 'data-id'],
    },
    allowedSchemes: ['http', 'https', 's3'],
    allowedSchemesAppliedToAttributes: ['src', 'href'],
    transformTags: {
      'a': sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    },
  });

  // Check if there's meaningful content
  const textOnly = cleanHtml.replace(/<[^>]+>/g, '').trim();
  if (!textOnly && !cleanHtml.includes('<img')) {
    return null;
  }

  return cleanHtml;
}
