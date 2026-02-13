import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireStaff } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { findTicketOrFail } from '../../utils/entityHelpers.js';
import { USER_SELECT, USER_SELECT_BRIEF, PROJECT_SELECT_BRIEF } from '../../utils/prismaFragments.js';

const router = express.Router();

// Get time entries for ticket
router.get('/:id/time-entries', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const timeEntries = await prisma.timeEntry.findMany({
    where: { ticketId: req.params.id },
    orderBy: { startTime: 'desc' },
    include: {
      user: { select: USER_SELECT },
      project: { select: PROJECT_SELECT_BRIEF },
    },
  });

  res.json(timeEntries);
}));

// Start timer for ticket (creates a time entry linked to ticket)
router.post('/:id/time-entries', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      project: true,
    },
  });

  // Stop any running timers for this user
  const runningEntries = await prisma.timeEntry.findMany({
    where: {
      userId: req.user.id,
      organizationId: req.organization.id,
      isRunning: true,
    },
  });

  for (const entry of runningEntries) {
    const endTime = new Date();
    const durationMins = Math.round((endTime - entry.startTime) / 60000);
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { isRunning: false, endTime, durationMins },
    });
  }

  // Create new time entry linked to ticket
  const timeEntry = await prisma.timeEntry.create({
    data: {
      organizationId: req.organization.id,
      userId: req.user.id,
      projectId: ticket.projectId,
      ticketId: ticket.id,
      taskName: `Ticket: ${ticket.subject}`,
      startTime: new Date(),
      isRunning: true,
    },
    include: {
      user: { select: USER_SELECT_BRIEF },
      project: { select: PROJECT_SELECT_BRIEF },
      ticket: { select: { id: true, subject: true } },
    },
  });

  res.status(201).json(timeEntry);
}));

export default router;
