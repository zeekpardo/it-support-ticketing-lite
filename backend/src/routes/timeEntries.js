import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { findTimeEntryOrFail } from '../utils/entityHelpers.js';
import { INBOX_SELECT_BRIEF, USER_SELECT } from '../utils/prismaFragments.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Get time entries (members see own, admins/owners see all)
router.get('/', asyncHandler(async (req, res) => {
  const { startDate, endDate, inboxId, userId } = req.query;
  const canViewAll = ['admin', 'owner'].includes(req.membership.role);

  const where = {
    organizationId: req.organization.id
  };

  // Members can only see their own entries
  if (!canViewAll) {
    where.userId = req.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (inboxId) {
    where.inboxId = inboxId;
  }

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      user: { select: USER_SELECT }
    },
    orderBy: { startTime: 'desc' }
  });

  res.json(entries);
}));

// Get single time entry
router.get('/:id', asyncHandler(async (req, res) => {
  const entry = await findTimeEntryOrFail(req.params.id, req.organization.id, {
    include: {
      inbox: true,
      user: { select: USER_SELECT }
    }
  });

  // Members can only view their own entries
  const canViewAll = ['admin', 'owner'].includes(req.membership.role);
  if (!canViewAll && entry.userId !== req.user.id) {
    throw new ForbiddenError('Access denied');
  }

  res.json(entry);
}));

// Create time entry (manual entry or start timer)
router.post('/', asyncHandler(async (req, res) => {
  const { inboxId, taskName, startTime, endTime, notes, isRunning } = req.body;

  if (!inboxId || !taskName) {
    throw new ValidationError('Inbox ID and task name are required');
  }

  // Verify inbox belongs to organization and is active
  const inbox = await prisma.inbox.findFirst({
    where: {
      id: inboxId,
      organizationId: req.organization.id,
      isActive: true
    }
  });
  if (!inbox) throw new NotFoundError('Inbox not found');

  // If starting a timer, stop any running timers for this user
  if (isRunning) {
    await prisma.timeEntry.updateMany({
      where: {
        userId: req.user.id,
        organizationId: req.organization.id,
        isRunning: true
      },
      data: {
        isRunning: false,
        endTime: new Date(),
        durationMins: null
      }
    });
  }

  // Calculate duration for manual entries
  let durationMins = null;
  if (!isRunning && startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    durationMins = Math.round((end - start) / 60000);
  }

  const entry = await prisma.timeEntry.create({
    data: {
      organizationId: req.organization.id,
      userId: req.user.id,
      inboxId,
      taskName,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : null,
      durationMins,
      isRunning: isRunning || false,
      notes
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      user: { select: USER_SELECT }
    }
  });

  res.status(201).json(entry);
}));

// Update time entry
router.put('/:id', asyncHandler(async (req, res) => {
  const entry = await findTimeEntryOrFail(req.params.id, req.organization.id);

  // Check permission
  const canEditAll = ['admin', 'owner'].includes(req.membership.role);
  if (!canEditAll && entry.userId !== req.user.id) {
    throw new ForbiddenError('Access denied');
  }

  const { inboxId, taskName, startTime, endTime, notes } = req.body;

  // Verify inbox if changing
  if (inboxId && inboxId !== entry.inboxId) {
    const newInbox = await prisma.inbox.findFirst({
      where: {
        id: inboxId,
        organizationId: req.organization.id,
        isActive: true
      }
    });
    if (!newInbox) throw new NotFoundError('Inbox not found');
  }

  // Calculate duration
  let durationMins = entry.durationMins;
  const newStartTime = startTime ? new Date(startTime) : entry.startTime;
  const newEndTime = endTime ? new Date(endTime) : entry.endTime;
  if (newStartTime && newEndTime) {
    durationMins = Math.round((newEndTime - newStartTime) / 60000);
  }

  const updated = await prisma.timeEntry.update({
    where: { id: req.params.id },
    data: {
      inboxId: inboxId || entry.inboxId,
      taskName: taskName || entry.taskName,
      startTime: newStartTime,
      endTime: newEndTime,
      durationMins,
      notes: notes !== undefined ? notes : entry.notes
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      user: { select: USER_SELECT }
    }
  });

  res.json(updated);
}));

// Stop running timer
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      user: { select: USER_SELECT }
    }
  });

  if (!entry) {
    throw new NotFoundError('Time entry not found');
  }

  // Only the owner of the timer or admin can stop it
  const canEditAll = ['admin', 'owner'].includes(req.membership.role);
  if (!canEditAll && entry.userId !== req.user.id) {
    throw new ForbiddenError('Access denied');
  }

  // Already stopped (e.g., auto-stopped by starting another timer) — return as-is
  if (!entry.isRunning) {
    return res.json(entry);
  }

  const endTime = new Date();
  const durationMins = Math.round((endTime - entry.startTime) / 60000);

  const updated = await prisma.timeEntry.update({
    where: { id: req.params.id },
    data: {
      isRunning: false,
      endTime,
      durationMins
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      user: { select: USER_SELECT }
    }
  });

  res.json(updated);
}));

// Get currently running timer for user
router.get('/running/current', asyncHandler(async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: {
      userId: req.user.id,
      organizationId: req.organization.id,
      isRunning: true
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      ticket: {
        select: {
          id: true,
          subject: true,
          inbox: { select: INBOX_SELECT_BRIEF }
        }
      }
    }
  });

  res.json(entry);
}));

// Delete time entry
router.delete('/:id', asyncHandler(async (req, res) => {
  const entry = await findTimeEntryOrFail(req.params.id, req.organization.id);

  // Check permission
  const canDeleteAll = ['admin', 'owner'].includes(req.membership.role);
  if (!canDeleteAll && entry.userId !== req.user.id) {
    throw new ForbiddenError('Access denied');
  }

  await prisma.timeEntry.delete({
    where: { id: req.params.id }
  });

  res.json({ message: 'Time entry deleted' });
}));

export default router;
