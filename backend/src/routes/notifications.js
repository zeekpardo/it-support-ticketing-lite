import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../utils/errors.js';
import { getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService.js';
import notificationEmitter from '../services/notificationEmitter.js';

const router = express.Router();

// EventSource can't set custom headers, so accept org ID via query param
router.use((req, res, next) => {
  if (req.query.orgId && !req.headers['x-organization-id']) {
    req.headers['x-organization-id'] = req.query.orgId;
  }
  next();
});

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

/**
 * GET /notifications/stream
 * SSE endpoint — pushes unread count whenever it changes
 */
router.get('/stream', async (req, res) => {
  const memberId = req.membership.id;
  const organizationId = req.organization.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial count immediately
  const count = await getUnreadCount(prisma, memberId, organizationId);
  res.write(`data: ${JSON.stringify({ count })}\n\n`);

  // Keep connection alive through reverse proxy (Railway closes idle connections)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  // Push updates when this user's notifications change
  const onChange = async ({ recipientId, organizationId: orgId, notification }) => {
    if (recipientId === memberId && orgId === organizationId) {
      try {
        const count = await getUnreadCount(prisma, memberId, organizationId);
        res.write(`data: ${JSON.stringify({ count })}\n\n`);

        // Send notification details as a named event (for browser notifications)
        if (notification) {
          res.write(`event: notification\ndata: ${JSON.stringify({ title: notification.title, message: notification.message, link: notification.link, id: notification.id, type: notification.type })}\n\n`);
        }
      } catch {
        // Connection likely closed — listener will be cleaned up
      }
    }
  };

  notificationEmitter.on('change', onChange);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationEmitter.off('change', onChange);
  });
});

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

  notificationEmitter.emit('change', {
    recipientId: req.membership.id,
    organizationId: req.organization.id,
  });

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

  notificationEmitter.emit('change', {
    recipientId: req.membership.id,
    organizationId: req.organization.id,
  });

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

  if (!notification.isRead) {
    notificationEmitter.emit('change', {
      recipientId: req.membership.id,
      organizationId: req.organization.id,
    });
  }

  res.json({ success: true });
}));

export default router;
