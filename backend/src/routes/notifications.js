import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../utils/errors.js';
import { getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

/**
 * GET /notifications
 * List notifications for the current user with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, unreadOnly } = req.query;

  const where = {
    recipientId: req.membership.id,
    organizationId: req.organization.id,
  };

  if (unreadOnly === 'true') {
    where.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    notifications,
    total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
}));

/**
 * GET /notifications/unread-count
 * Get unread notification count for badge display
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await getUnreadCount(
    prisma,
    req.membership.id,
    req.organization.id
  );

  res.json({ count });
}));

/**
 * PUT /notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', asyncHandler(async (req, res) => {
  const result = await markAsRead(prisma, req.params.id, req.membership.id);

  if (result.count === 0) {
    throw new NotFoundError('Notification not found or already read');
  }

  res.json({ success: true });
}));

/**
 * PUT /notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', asyncHandler(async (req, res) => {
  const result = await markAllAsRead(
    prisma,
    req.membership.id,
    req.organization.id
  );

  res.json({ success: true, count: result.count });
}));

/**
 * DELETE /notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      recipientId: req.membership.id,
    },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  await prisma.notification.delete({
    where: { id: req.params.id },
  });

  res.json({ success: true });
}));

export default router;
