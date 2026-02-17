import { escapeHtml } from '../../../utils/sanitize.js';
import { sendEmail, getFrontendUrl } from '../client.js';
import { buildHtmlEmail, buildTextEmail } from '../templates.js';
import { getFromAddress } from '../../../services/emailDomainService.js';

async function resolveSender(organizationId, projectId) {
  if (!organizationId) return null;
  const sender = await getFromAddress(organizationId, projectId);
  return sender.domain ? sender : null;
}

export async function sendAccessRequestEmail({ to, recipientName, requesterName, softwareName, inboxId, inboxSoftwareId, branding = {}, organizationId, projectId }) {
  const baseUrl = await getFrontendUrl(organizationId);
  const requestUrl = `${baseUrl}/admin/inboxes/${inboxId}/software/${inboxSoftwareId}`;
  const sender = await resolveSender(organizationId, projectId);

  return sendEmail({
    to,
    subject: `Software access request: ${softwareName}`,
    fromName: branding.appName,
    ...(sender && { from: sender.from }),
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${escapeHtml(requesterName)}</strong> has requested access to <strong>${escapeHtml(softwareName)}</strong>.`],
      button: { text: 'Review Request', url: requestUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${requesterName} has requested access to ${softwareName}.`],
      buttonText: 'Review the request',
      buttonUrl: requestUrl
    })
  });
}

export async function sendAccessStatusEmail({ to, recipientName, softwareName, status, branding = {}, organizationId, projectId }) {
  const baseUrl = await getFrontendUrl(organizationId);
  const requestsUrl = `${baseUrl}/portal/software/requests`;
  const sender = await resolveSender(organizationId, projectId);

  const statusMessages = {
    APPROVED: { verb: 'approved', color: '#22c55e' },
    DECLINED: { verb: 'declined', color: '#ef4444' },
    REVOKED: { verb: 'revoked', color: '#ef4444' },
  };

  const { verb, color } = statusMessages[status] || { verb: 'updated', color: '#6b7280' };

  return sendEmail({
    to,
    subject: `Software access ${verb}: ${softwareName}`,
    fromName: branding.appName,
    ...(sender && { from: sender.from }),
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        { html: `<p>Your access request for <strong>${escapeHtml(softwareName)}</strong> has been <span style="color: ${color}; font-weight: 600;">${verb}</span>.</p>` }
      ],
      button: { text: 'View My Requests', url: requestsUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`Your access request for ${softwareName} has been ${verb}.`],
      buttonText: 'View your requests',
      buttonUrl: requestsUrl
    })
  });
}

export async function sendRenewalReminderEmail({
  to, recipientName, softwareName, daysUntilRenewal, renewalDate,
  cost, billingCycle, inboxName, inboxId, inboxSoftwareId, branding = {},
  organizationId, projectId
}) {
  const baseUrl = await getFrontendUrl(organizationId);
  const softwareUrl = `${baseUrl}/admin/inboxes/${inboxId}/software/${inboxSoftwareId}`;
  const sender = await resolveSender(organizationId, projectId);
  const urgencyColor = daysUntilRenewal <= 3 ? '#ef4444' : '#f59e0b';

  const paragraphs = [
    { html: `<p><strong>${escapeHtml(softwareName)}</strong> for inbox <strong>${escapeHtml(inboxName)}</strong> renews on <span style="color: ${urgencyColor}; font-weight: 600;">${escapeHtml(renewalDate)}</span> (in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}).</p>` }
  ];

  if (cost) {
    paragraphs.push(`Cost: $${cost} (${billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly'})`);
  }

  const textParagraphs = [
    `${softwareName} for inbox ${inboxName} renews on ${renewalDate} (in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}).`
  ];

  if (cost) {
    textParagraphs.push(`Cost: $${cost} (${billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly'})`);
  }

  return sendEmail({
    to,
    subject: `Software renewal in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}: ${softwareName}`,
    fromName: branding.appName,
    ...(sender && { from: sender.from }),
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs,
      button: { text: 'View Software Details', url: softwareUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: textParagraphs,
      buttonText: 'View software details',
      buttonUrl: softwareUrl
    })
  });
}
