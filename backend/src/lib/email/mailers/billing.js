import { escapeHtml } from '../../../utils/sanitize.js';
import { sendEmail, getFrontendUrl } from '../client.js';
import { buildHtmlEmail, buildTextEmail } from '../templates.js';
import { getFromAddress } from '../../../services/emailDomainService.js';

async function resolveSender(organizationId) {
  if (!organizationId) return null;
  const sender = await getFromAddress(organizationId);
  return sender.domain ? sender : null;
}

export async function sendBillingThresholdEmail({ to, recipientName, userName, amount, month, branding = {}, organizationId }) {
  const baseUrl = await getFrontendUrl(organizationId);
  const reportsUrl = `${baseUrl}/reports`;
  const sender = await resolveSender(organizationId);

  return sendEmail({
    to,
    subject: `Billing alert: ${userName} reached $${amount} in ${month}`,
    fromName: branding.appName,
    ...(sender && { from: sender.from }),
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `<strong>${escapeHtml(userName)}</strong> has reached <strong>$${amount}</strong> in billable hours for <strong>${escapeHtml(month)}</strong>.`,
        'You may want to review their time entries and billing details.'
      ],
      button: { text: 'View Reports', url: reportsUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `${userName} has reached $${amount} in billable hours for ${month}.`,
        'You may want to review their time entries and billing details.'
      ],
      buttonText: 'View Reports',
      buttonUrl: reportsUrl
    })
  });
}
