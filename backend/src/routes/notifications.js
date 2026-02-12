import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

/**
 * GET /notifications
 * List notifications for the current user with pagination
 */
router.get('/', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /notifications/unread-count
 * Get unread notification count for badge display
 */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await getUnreadCount(
      prisma,
      req.membership.id,
      req.organization.id
    );

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * PUT /notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const result = await markAsRead(prisma, req.params.id, req.membership.id);

    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found or already read' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req, res) => {
  try {
    const result = await markAllAsRead(
      prisma,
      req.membership.id,
      req.organization.id
    );

    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        recipientId: req.membership.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
