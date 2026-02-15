/**
 * Notification Type Registry
 *
 * Single source of truth for all notification types.
 * Each type defines how to generate title, message, and link from event data.
 * Optionally defines an email function to send email notifications.
 *
 * Branding: The `data.branding` object is injected by notificationService.js
 * before emails are sent, so all email functions receive org-specific branding.
 */

import {
  sendTicketCommentEmail,
  sendTicketAssignmentEmail,
  sendMentionEmail,
  sendAccessRequestEmail,
  sendAccessStatusEmail,
  sendTicketSubmittedEmail,
  sendNewTicketAssignedEmail,
  sendRenewalReminderEmail,
} from '../lib/email/index.js';

export const NOTIFICATION_TYPES = {
  // Ticket notifications
  TICKET_ASSIGNED: {
    key: 'ticket_assigned',
    title: () => 'Ticket assigned to you',
    message: (data) => `"${data.ticketSubject}" was assigned to you`,
    link: (data) => `/admin/tickets/${data.ticketId}`,
    icon: 'ticket',
    sendEmail: (recipient, data) => sendTicketAssignmentEmail({
      to: recipient.email,
      recipientName: recipient.name,
      ticketSubject: data.ticketSubject,
      ticketId: data.ticketId,
      branding: data.branding || {},
    }),
  },

  TICKET_COMMENT: {
    key: 'ticket_comment',
    title: () => 'New comment on ticket',
    message: (data) => `${data.authorName} commented on "${data.ticketSubject}"`,
    link: (data) => `/admin/tickets/${data.ticketId}`,
    icon: 'comment',
    sendEmail: (recipient, data) => sendTicketCommentEmail({
      to: recipient.email,
      recipientName: recipient.name,
      authorName: data.authorName,
      ticketSubject: data.ticketSubject,
      ticketId: data.ticketId,
      commentContent: data.commentContent || '',
      commentContentHtml: data.commentContentHtml || null,
      isPortal: false,
      branding: data.branding || {},
    }),
  },

  TICKET_COMMENT_CLIENT: {
    key: 'ticket_comment_client',
    title: () => 'New message on your ticket',
    message: (data) => `${data.authorName} replied to "${data.ticketSubject}"`,
    link: (data) => `/portal/tickets/${data.ticketId}`,
    icon: 'comment',
    sendEmail: (recipient, data) => sendTicketCommentEmail({
      to: recipient.email,
      recipientName: recipient.name,
      authorName: data.authorName,
      ticketSubject: data.ticketSubject,
      ticketId: data.ticketId,
      commentContent: data.commentContent || '',
      commentContentHtml: data.commentContentHtml || null,
      isPortal: true,
      branding: data.branding || {},
    }),
  },

  MENTION: {
    key: 'mention',
    title: () => 'You were mentioned',
    message: (data) => `${data.authorName} mentioned you in "${data.ticketSubject}"`,
    link: (data) => `/admin/tickets/${data.ticketId}`,
    icon: 'at',
    sendEmail: (recipient, data) => sendMentionEmail({
      to: recipient.email,
      recipientName: recipient.name,
      authorName: data.authorName,
      ticketSubject: data.ticketSubject,
      ticketId: data.ticketId,
      commentContent: data.commentContent || '',
      commentContentHtml: data.commentContentHtml || null,
      isPortal: false,
      branding: data.branding || {},
    }),
  },

  MENTION_CLIENT: {
    key: 'mention_client',
    title: () => 'You were mentioned',
    message: (data) => `${data.authorName} mentioned you in "${data.ticketSubject}"`,
    link: (data) => `/portal/tickets/${data.ticketId}`,
    icon: 'at',
    sendEmail: (recipient, data) => sendMentionEmail({
      to: recipient.email,
      recipientName: recipient.name,
      authorName: data.authorName,
      ticketSubject: data.ticketSubject,
      ticketId: data.ticketId,
      commentContent: data.commentContent || '',
      commentContentHtml: data.commentContentHtml || null,
      isPortal: true,
      branding: data.branding || {},
    }),
  },

  TICKET_STATUS_CHANGED: {
    key: 'ticket_status_changed',
    title: () => 'Ticket status updated',
    message: (data) => `"${data.ticketSubject}" moved to ${data.newStatus}`,
    link: (data) => `/portal/tickets/${data.ticketId}`,
    icon: 'ticket',
    // No email for status changes by default
  },

  TICKET_SUBMITTED: {
    key: 'ticket_submitted',
    title: () => 'Ticket submitted',
    message: (data) => `Your request "${data.ticketSubject}" has been received`,
    link: (data) => `/portal/tickets/${data.ticketId}`,
    icon: 'ticket',
    sendEmail: (recipient, data) => sendTicketSubmittedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      projectName: data.projectName,
      ticketSubject: data.ticketSubject,
      requestType: data.requestType,
      priorityLevel: data.priorityLevel,
      description: data.description,
      ticketId: data.ticketId,
      branding: data.branding || {},
    }),
  },

  NEW_TICKET_ASSIGNED: {
    key: 'new_ticket_assigned',
    title: () => 'New ticket assigned',
    message: (data) => `${data.clientName} submitted "${data.ticketSubject}"`,
    link: (data) => `/admin/tickets/${data.ticketId}`,
    icon: 'ticket',
    sendEmail: (recipient, data) => sendNewTicketAssignedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      clientName: data.clientName,
      projectName: data.projectName,
      ticketSubject: data.ticketSubject,
      requestType: data.requestType,
      priorityLevel: data.priorityLevel,
      description: data.description,
      ticketId: data.ticketId,
      branding: data.branding || {},
    }),
  },

  // Software access request notifications
  ACCESS_REQUEST_SUBMITTED: {
    key: 'access_request_submitted',
    title: () => 'New software access request',
    message: (data) => `${data.requesterName} requested access to ${data.softwareName}`,
    link: (data) => `/admin/projects/${data.projectId}/software/${data.projectSoftwareId}`,
    icon: 'software',
    sendEmail: (recipient, data) => sendAccessRequestEmail({
      to: recipient.email,
      recipientName: recipient.name,
      requesterName: data.requesterName,
      softwareName: data.softwareName,
      projectId: data.projectId,
      projectSoftwareId: data.projectSoftwareId,
      branding: data.branding || {},
    }),
  },

  ACCESS_REQUEST_APPROVED: {
    key: 'access_request_approved',
    title: () => 'Software access approved',
    message: (data) => `Your request for ${data.softwareName} was approved`,
    link: (data) => `/portal/software/requests`,
    icon: 'software',
    sendEmail: (recipient, data) => sendAccessStatusEmail({
      to: recipient.email,
      recipientName: recipient.name,
      softwareName: data.softwareName,
      status: 'APPROVED',
      branding: data.branding || {},
    }),
  },

  ACCESS_REQUEST_DECLINED: {
    key: 'access_request_declined',
    title: () => 'Software access declined',
    message: (data) => `Your request for ${data.softwareName} was declined`,
    link: (data) => `/portal/software/requests`,
    icon: 'software',
    sendEmail: (recipient, data) => sendAccessStatusEmail({
      to: recipient.email,
      recipientName: recipient.name,
      softwareName: data.softwareName,
      status: 'DECLINED',
      branding: data.branding || {},
    }),
  },

  ACCESS_REQUEST_REVOKED: {
    key: 'access_request_revoked',
    title: () => 'Software access revoked',
    message: (data) => `Your access to ${data.softwareName} was revoked`,
    link: (data) => `/portal/software/requests`,
    icon: 'software',
    sendEmail: (recipient, data) => sendAccessStatusEmail({
      to: recipient.email,
      recipientName: recipient.name,
      softwareName: data.softwareName,
      status: 'REVOKED',
      branding: data.branding || {},
    }),
  },

  // Software renewal reminders
  SOFTWARE_RENEWAL_REMINDER: {
    key: 'software_renewal_reminder',
    title: () => 'Software renewal coming up',
    message: (data) => `${data.softwareName} renews in ${data.daysUntilRenewal} day${data.daysUntilRenewal === 1 ? '' : 's'} (${data.renewalDateFormatted})`,
    link: (data) => `/admin/projects/${data.projectId}/software/${data.projectSoftwareId}`,
    icon: 'software',
    sendEmail: (recipient, data) => sendRenewalReminderEmail({
      to: recipient.email,
      recipientName: recipient.name,
      softwareName: data.softwareName,
      daysUntilRenewal: data.daysUntilRenewal,
      renewalDate: data.renewalDateFormatted,
      cost: data.cost,
      billingCycle: data.billingCycle,
      projectName: data.projectName,
      projectId: data.projectId,
      projectSoftwareId: data.projectSoftwareId,
      branding: data.branding || {},
    }),
  },
};

/**
 * Get notification config by type key
 * @param {string} typeKey - The notification type key (e.g., 'TICKET_ASSIGNED')
 * @returns {object|null} The notification type config or null if not found
 */
export function getNotificationType(typeKey) {
  return NOTIFICATION_TYPES[typeKey] || null;
}

/**
 * Get all notification type keys
 * @returns {string[]} Array of notification type keys
 */
export function getNotificationTypeKeys() {
  return Object.keys(NOTIFICATION_TYPES);
}
