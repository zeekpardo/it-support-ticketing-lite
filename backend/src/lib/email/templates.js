import { escapeHtml } from '../../utils/sanitize.js';
import { APP_NAME } from './client.js';

/**
 * Base email wrapper - provides consistent styling for all emails
 *
 * @param {string} content - Inner HTML content
 * @param {object} [branding] - Org branding overrides
 * @param {string} [branding.appName] - Custom app name for footer
 * @param {string} [branding.logoUrl] - Logo URL to display above content
 */
export function baseTemplate(content, branding = {}) {
  const appName = branding.appName || APP_NAME;
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${escapeHtml(appName)}" style="max-height: 40px; margin-bottom: 20px;" />`
    : '';

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      ${logoHtml}
      ${content}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">${escapeHtml(appName)}</p>
    </div>
  `;
}

/**
 * Primary action button component
 */
function buttonComponent(text, url, color = '#2563eb') {
  return `
    <p style="margin: 30px 0;">
      <a href="${url}" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        ${text}
      </a>
    </p>
  `;
}

/**
 * Link fallback text component
 */
function linkFallback(url) {
  return `
    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #6b7280; word-break: break-all;">${url}</p>
  `;
}

/**
 * Quote/content block component (for comments, descriptions, etc.)
 */
export function quoteBlock(content, borderColor = '#2563eb', isHtml = false) {
  return `
    <div style="background-color: #f9fafb; border-left: 4px solid ${borderColor}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      ${isHtml ? content : `<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(content)}</p>`}
    </div>
  `;
}

/**
 * Greeting component
 */
function greeting(name) {
  return `<p>Hi ${escapeHtml(name) || 'there'},</p>`;
}

/**
 * Header/title component
 */
function headerComponent(text) {
  return `<h2>${escapeHtml(text)}</h2>`;
}

/**
 * Build HTML email from components
 *
 * @param {object} options
 * @param {object} [options.branding] - Org branding (appName, primaryColor, logoUrl)
 */
export function buildHtmlEmail({ header, greeting: greetingName, paragraphs = [], quote, button, showLinkFallback = false, branding = {} }) {
  const primaryColor = branding.primaryColor || '#2563eb';
  let content = '';

  if (header) content += headerComponent(header);
  if (greetingName !== false) content += greeting(greetingName);

  for (const p of paragraphs) {
    content += typeof p === 'string' ? `<p>${p}</p>` : p.html;
  }

  // Use branding color for quote border when no explicit color is set
  if (quote) content += quoteBlock(quote.content, quote.borderColor || primaryColor, quote.isHtml);
  if (button) content += buttonComponent(button.text, button.url, button.color || primaryColor);
  if (showLinkFallback && button) content += linkFallback(button.url);

  return baseTemplate(content, branding);
}

/**
 * Build plain text email
 */
export function buildTextEmail({ greeting: greetingName, paragraphs = [], quote, buttonText, buttonUrl }) {
  let text = '';

  if (greetingName !== false) text += `Hi ${greetingName || 'there'},\n\n`;

  for (const p of paragraphs) {
    if (typeof p === 'string') {
      text += `${p}\n\n`;
    } else if (p.text) {
      text += `${p.text}\n\n`;
    }
  }

  if (quote) text += `${quote.content}\n\n`;
  if (buttonText && buttonUrl) text += `${buttonText}: ${buttonUrl}`;

  return text.trim();
}
