/**
 * Notification Service
 *
 * Unified service for creating and managing notifications.
 * Uses the notification type registry for consistent notification formatting.
 * Supports sending email notifications alongside in-app notifications.
 */

import { NOTIFICATION_TYPES } from './notificationTypes.js';

/**
 * Create a single notification (with optional email)
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} params - Notification parameters
 * @param {string} params.type - Notification type key (e.g., 'TICKET_ASSIGNED')
 * @param {string} params.recipientId - Member ID of the recipient
 * @param {string} params.organizationId - Organization ID
 * @param {object} params.data - Data object for generating title/message/link
 * @param {string} [params.entityType] - Type of related entity (e.g., 'ticket', 'comment')
 * @param {string} [params.entityId] - ID of related entity
 * @param {boolean} [params.sendEmail=true] - Whether to send email notification
 * @returns {Promise<object>} Created notification
 */
export async function createNotification(prisma, { type, recipientId, organizationId, data, entityType, entityId, sendEmail = true }) {
  const config = NOTIFICATION_TYPES[type];
  if (!config) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  // Create in-app notification
  const notification = await prisma.notification.create({
    data: {
      type: config.key,
      title: config.title(data),
      message: config.message(data),
      link: config.link(data),
      recipientId,
      organizationId,
      entityType: entityType || null,
      entityId: entityId || null,
    },
  });

  // Send email notification if configured and enabled
  if (sendEmail && config.sendEmail) {
    try {
      // Fetch recipient's email and name
      const recipient = await prisma.member.findUnique({
        where: { id: recipientId },
        include: { user: { select: { email: true, name: true } } },
      });

      if (recipient?.user?.email) {
        await config.sendEmail(
          { email: recipient.user.email, name: recipient.user.name },
          data
        );
      }
    } catch (emailError) {
      // Log but don't fail - email is non-critical
      console.error('[NotificationService] Failed to send email:', emailError);
    }
  }

  return notification;
}

/**
 * Create multiple notifications in bulk
 * Useful for notifying multiple users about the same event
 *
 * @param {object} prisma - Prisma client instance
 * @param {Array<object>} notifications - Array of notification params (same as createNotification)
 * @returns {Promise<{count: number}>} Count of created notifications
 */
export async function createBulkNotifications(prisma, notifications) {
  const notificationData = notifications.map((n) => {
    const config = NOTIFICATION_TYPES[n.type];
    if (!config) {
      throw new Error(`Unknown notification type: ${n.type}`);
    }

    return {
      type: config.key,
      title: config.title(n.data),
      message: config.message(n.data),
      link: config.link(n.data),
      recipientId: n.recipientId,
      organizationId: n.organizationId,
      entityType: n.entityType || null,
      entityId: n.entityId || null,
    };
  });

  return prisma.notification.createMany({
    data: notificationData,
    skipDuplicates: true,
  });
}

/**
 * Create notifications for multiple recipients with the same content
 * Convenience wrapper for common pattern
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} params - Notification parameters
 * @param {string} params.type - Notification type key
 * @param {string[]} params.recipientIds - Array of member IDs
 * @param {string} params.organizationId - Organization ID
 * @param {object} params.data - Data object for generating title/message/link
 * @param {string} [params.entityType] - Type of related entity
 * @param {string} [params.entityId] - ID of related entity
 * @param {string} [params.excludeId] - Member ID to exclude (e.g., the author)
 * @param {boolean} [params.sendEmail=true] - Whether to send email notifications
 * @returns {Promise<{count: number}>} Count of created notifications
 */
export async function notifyMultiple(prisma, { type, recipientIds, organizationId, data, entityType, entityId, excludeId, sendEmail = true }) {
  const filteredIds = excludeId
    ? recipientIds.filter((id) => id !== excludeId)
    : recipientIds;

  if (filteredIds.length === 0) {
    return { count: 0 };
  }

  const notifications = filteredIds.map((recipientId) => ({
    type,
    recipientId,
    organizationId,
    data,
    entityType,
    entityId,
  }));

  // Create in-app notifications in bulk
  const result = await createBulkNotifications(prisma, notifications);

  // Send emails (non-blocking, fire-and-forget for performance)
  if (sendEmail) {
    const config = NOTIFICATION_TYPES[type];
    if (config?.sendEmail) {
      // Fetch all recipients' emails
      prisma.member.findMany({
        where: { id: { in: filteredIds } },
        include: { user: { select: { email: true, name: true } } },
      }).then((recipients) => {
        for (const recipient of recipients) {
          if (recipient?.user?.email) {
            config.sendEmail(
              { email: recipient.user.email, name: recipient.user.name },
              data
            ).catch((err) => {
              console.error('[NotificationService] Failed to send email:', err);
            });
          }
        }
      }).catch((err) => {
        console.error('[NotificationService] Failed to fetch recipients for email:', err);
      });
    }
  }

  return result;
}

/**
 * Send comment notifications: mentions, ticket owner, and ticket client.
 * Handles the full notification flow for a new comment on a ticket.
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} params
 * @param {object} params.ticket - Ticket record (needs id, subject, ownerId, clientId)
 * @param {object} params.comment - Created comment (needs id)
 * @param {string} params.authorName - Display name of comment author
 * @param {string} params.authorMemberId - Member ID of the comment author
 * @param {string} params.content - Raw comment content (for mention parsing)
 * @param {boolean} params.isInternal - Whether the comment is internal-only
 * @param {string} params.organizationId - Organization ID
 */
export async function sendCommentNotifications(prisma, {
  ticket,
  comment,
  authorName,
  authorMemberId,
  content,
  isInternal,
  organizationId,
}) {
  const notificationData = {
    ticketId: ticket.id,
    ticketSubject: ticket.subject,
    authorName,
    commentId: comment.id,
    commentContent: content,
  };

  const mentionedMemberIds = parseMentions(content);
  if (mentionedMemberIds.length > 0) {
    const mentionedMembers = await prisma.member.findMany({
      where: { id: { in: mentionedMemberIds } },
      select: { id: true, role: true },
    });

    for (const member of mentionedMembers) {
      if (member.id === authorMemberId) continue;

      const isClient = member.role === 'client';
      if (isClient && isInternal) continue;

      await createNotification(prisma, {
        type: isClient ? 'MENTION_CLIENT' : 'MENTION',
        recipientId: member.id,
        organizationId,
        data: notificationData,
        entityType: 'comment',
        entityId: comment.id,
      });
    }
  }

  if (ticket.ownerId &&
      ticket.ownerId !== authorMemberId &&
      !mentionedMemberIds.includes(ticket.ownerId)) {
    await createNotification(prisma, {
      type: 'TICKET_COMMENT',
      recipientId: ticket.ownerId,
      organizationId,
      data: notificationData,
      entityType: 'comment',
      entityId: comment.id,
    });
  }

  if (!isInternal &&
      ticket.clientId &&
      ticket.clientId !== authorMemberId &&
      !mentionedMemberIds.includes(ticket.clientId)) {
    await createNotification(prisma, {
      type: 'TICKET_COMMENT_CLIENT',
      recipientId: ticket.clientId,
      organizationId,
      data: notificationData,
      entityType: 'comment',
      entityId: comment.id,
    });
  }
}

/**
 * Parse @mentions from comment content and extract member IDs
 *
 * @param {string} content - Comment content with @mentions
 * @returns {string[]} Array of member IDs mentioned
 */
export function parseMentions(content) {
  // Match pattern: @[Name](memberId)
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const memberIds = [];
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    memberIds.push(match[2]); // Extract the member ID
  }

  return [...new Set(memberIds)]; // Remove duplicates
}

/**
 * Get unread notification count for a member
 *
 * @param {object} prisma - Prisma client instance
 * @param {string} memberId - Member ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Unread count
 */
export async function getUnreadCount(prisma, memberId, organizationId) {
  return prisma.notification.count({
    where: {
      recipientId: memberId,
      organizationId,
      isRead: false,
    },
  });
}

/**
 * Mark a notification as read
 *
 * @param {object} prisma - Prisma client instance
 * @param {string} notificationId - Notification ID
 * @param {string} memberId - Member ID (for verification)
 * @returns {Promise<object>} Updated notification
 */
export async function markAsRead(prisma, notificationId, memberId) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      recipientId: memberId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a member
 *
 * @param {object} prisma - Prisma client instance
 * @param {string} memberId - Member ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{count: number}>} Count of updated notifications
 */
export async function markAllAsRead(prisma, memberId, organizationId) {
  return prisma.notification.updateMany({
    where: {
      recipientId: memberId,
      organizationId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
