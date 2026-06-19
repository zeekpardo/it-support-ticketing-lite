import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ForbiddenError } from '../utils/errors.js';
import { generateCSV } from '../utils/csv.js';
import { INBOX_SELECT, USER_SELECT } from '../utils/prismaFragments.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

// Get summary report
router.get('/summary', asyncHandler(async (req, res) => {
  const { startDate, endDate, inboxId, userId, groupBy = 'inbox' } = req.query;
  const canViewAll = ['admin', 'owner'].includes(req.membership.role);

  const where = {
    organizationId: req.organization.id,
    isRunning: false
  };

  // Members can only see their own data
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
    if (endDate) {
      // Set to end of day (23:59:59.999 UTC) to include all entries on that date
      const end = new Date(endDate + 'T23:59:59.999Z');
      where.startTime.lte = end;
    }
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      inbox: { select: INBOX_SELECT },
      user: { select: USER_SELECT }
    },
    orderBy: { startTime: 'desc' }
  });

  // Calculate totals
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMins || 0), 0);

  // Group data
  let grouped = {};
  if (groupBy === 'inbox') {
    entries.forEach(entry => {
      const key = entry.inboxId;
      if (!grouped[key]) {
        grouped[key] = {
          inbox: entry.inbox,
          totalMinutes: 0,
          entryCount: 0,
          users: new Set()
        };
      }
      grouped[key].totalMinutes += entry.durationMins || 0;
      grouped[key].entryCount++;
      grouped[key].users.add(entry.userId);
    });

    // Convert Set to count
    Object.values(grouped).forEach(g => {
      g.userCount = g.users.size;
      delete g.users;
    });
  } else if (groupBy === 'user') {
    // Fetch hourly rates for all staff in this org
    const members = await prisma.member.findMany({
      where: { organizationId: req.organization.id },
      select: { userId: true, hourlyRate: true }
    });
    const rateByUserId = Object.fromEntries(members.map(m => [m.userId, m.hourlyRate]));

    entries.forEach(entry => {
      const key = entry.userId;
      if (!grouped[key]) {
        grouped[key] = {
          user: entry.user,
          hourlyRate: rateByUserId[entry.userId] || null,
          totalMinutes: 0,
          entryCount: 0,
          inboxes: new Set()
        };
      }
      grouped[key].totalMinutes += entry.durationMins || 0;
      grouped[key].entryCount++;
      grouped[key].inboxes.add(entry.inboxId);
    });

    Object.values(grouped).forEach(g => {
      g.inboxCount = g.inboxes.size;
      delete g.inboxes;
    });
  } else if (groupBy === 'date') {
    entries.forEach(entry => {
      const key = entry.startTime.toISOString().split('T')[0];
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          totalMinutes: 0,
          entryCount: 0
        };
      }
      grouped[key].totalMinutes += entry.durationMins || 0;
      grouped[key].entryCount++;
    });
  }

  res.json({
    summary: {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      totalEntries: entries.length,
      dateRange: {
        start: startDate || null,
        end: endDate || null
      }
    },
    groupedBy: groupBy,
    data: Object.values(grouped).map(item => ({
      ...item,
      totalHours: Math.round(item.totalMinutes / 60 * 100) / 100
    }))
  });
}));

// Export time entries to CSV
router.get('/export', asyncHandler(async (req, res) => {
  const { startDate, endDate, inboxId, userId, format = 'csv' } = req.query;
  const canViewAll = ['admin', 'owner'].includes(req.membership.role);

  const where = {
    organizationId: req.organization.id,
    isRunning: false
  };

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
    if (endDate) {
      where.startTime.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      inbox: { select: { name: true, inboxCode: true, clientName: true } },
      user: { select: { name: true, email: true } }
    },
    orderBy: { startTime: 'asc' }
  });

  // Format data for export
  const exportData = entries.map(entry => ({
    Date: entry.startTime.toISOString().split('T')[0],
    'Start Time': entry.startTime.toISOString(),
    'End Time': entry.endTime ? entry.endTime.toISOString() : '',
    'Duration (mins)': entry.durationMins || 0,
    'Duration (hrs)': entry.durationMins ? Math.round(entry.durationMins / 60 * 100) / 100 : 0,
    'Inbox Code': entry.inbox.inboxCode,
    'Inbox Name': entry.inbox.name,
    'Client': entry.inbox.clientName || '',
    'Task': entry.taskName,
    'User': entry.user.name,
    'Email': entry.user.email,
    'Notes': entry.notes || ''
  }));

  if (format === 'json') {
    res.json(exportData);
  } else {
    const csv = generateCSV(exportData);
    const filename = `time-entries-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}));

// Get billing summary by client/inbox
router.get('/billing', asyncHandler(async (req, res) => {
  const { startDate, endDate, hourlyRate } = req.query;
  const canViewAll = ['admin', 'owner'].includes(req.membership.role);

  if (!canViewAll) {
    throw new ForbiddenError('Admin access required for billing reports');
  }

  const where = {
    organizationId: req.organization.id,
    isRunning: false
  };

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) {
      where.startTime.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      inbox: { select: INBOX_SELECT }
    }
  });

  // Group by client then inbox
  const byClient = {};
  entries.forEach(entry => {
    const clientName = entry.inbox.clientName || 'No Client';

    if (!byClient[clientName]) {
      byClient[clientName] = {
        client: clientName,
        totalMinutes: 0,
        inboxes: {}
      };
    }

    const inboxKey = entry.inbox.id;
    if (!byClient[clientName].inboxes[inboxKey]) {
      byClient[clientName].inboxes[inboxKey] = {
        inbox: entry.inbox,
        totalMinutes: 0,
        entryCount: 0
      };
    }

    byClient[clientName].totalMinutes += entry.durationMins || 0;
    byClient[clientName].inboxes[inboxKey].totalMinutes += entry.durationMins || 0;
    byClient[clientName].inboxes[inboxKey].entryCount++;
  });

  const rate = parseFloat(hourlyRate) || 0;
  const result = Object.values(byClient).map(client => ({
    client: client.client,
    totalMinutes: client.totalMinutes,
    totalHours: Math.round(client.totalMinutes / 60 * 100) / 100,
    billableAmount: rate ? Math.round(client.totalMinutes / 60 * rate * 100) / 100 : null,
    inboxes: Object.values(client.inboxes).map(p => ({
      ...p,
      totalHours: Math.round(p.totalMinutes / 60 * 100) / 100,
      billableAmount: rate ? Math.round(p.totalMinutes / 60 * rate * 100) / 100 : null
    }))
  }));

  res.json({
    hourlyRate: rate || null,
    dateRange: { start: startDate || null, end: endDate || null },
    clients: result,
    grandTotal: {
      totalMinutes: result.reduce((sum, c) => sum + c.totalMinutes, 0),
      totalHours: Math.round(result.reduce((sum, c) => sum + c.totalMinutes, 0) / 60 * 100) / 100,
      billableAmount: rate ? Math.round(result.reduce((sum, c) => sum + c.totalMinutes, 0) / 60 * rate * 100) / 100 : null
    }
  });
}));

export default router;
