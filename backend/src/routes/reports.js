import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { generateCSV } from '../utils/csv.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

// Get summary report
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, projectId, userId, groupBy = 'project' } = req.query;
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

    if (projectId) {
      where.projectId = projectId;
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
        project: { select: { id: true, name: true, projectCode: true, clientName: true } },
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    // Calculate totals
    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMins || 0), 0);

    // Group data
    let grouped = {};
    if (groupBy === 'project') {
      entries.forEach(entry => {
        const key = entry.projectId;
        if (!grouped[key]) {
          grouped[key] = {
            project: entry.project,
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
      entries.forEach(entry => {
        const key = entry.userId;
        if (!grouped[key]) {
          grouped[key] = {
            user: entry.user,
            totalMinutes: 0,
            entryCount: 0,
            projects: new Set()
          };
        }
        grouped[key].totalMinutes += entry.durationMins || 0;
        grouped[key].entryCount++;
        grouped[key].projects.add(entry.projectId);
      });

      Object.values(grouped).forEach(g => {
        g.projectCount = g.projects.size;
        delete g.projects;
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
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Export time entries to CSV
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, projectId, userId, format = 'csv' } = req.query;
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

    if (projectId) {
      where.projectId = projectId;
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
        project: { select: { name: true, projectCode: true, clientName: true } },
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
      'Project Code': entry.project.projectCode,
      'Project Name': entry.project.name,
      'Client': entry.project.clientName || '',
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
  } catch (error) {
    console.error('Error exporting time entries:', error);
    res.status(500).json({ error: 'Failed to export time entries' });
  }
});

// Get billing summary by client/project
router.get('/billing', async (req, res) => {
  try {
    const { startDate, endDate, hourlyRate } = req.query;
    const canViewAll = ['admin', 'owner'].includes(req.membership.role);

    if (!canViewAll) {
      return res.status(403).json({ error: 'Admin access required for billing reports' });
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
        project: { select: { id: true, name: true, projectCode: true, clientName: true } }
      }
    });

    // Group by client then project
    const byClient = {};
    entries.forEach(entry => {
      const clientName = entry.project.clientName || 'No Client';

      if (!byClient[clientName]) {
        byClient[clientName] = {
          client: clientName,
          totalMinutes: 0,
          projects: {}
        };
      }

      const projectKey = entry.project.id;
      if (!byClient[clientName].projects[projectKey]) {
        byClient[clientName].projects[projectKey] = {
          project: entry.project,
          totalMinutes: 0,
          entryCount: 0
        };
      }

      byClient[clientName].totalMinutes += entry.durationMins || 0;
      byClient[clientName].projects[projectKey].totalMinutes += entry.durationMins || 0;
      byClient[clientName].projects[projectKey].entryCount++;
    });

    const rate = parseFloat(hourlyRate) || 0;
    const result = Object.values(byClient).map(client => ({
      client: client.client,
      totalMinutes: client.totalMinutes,
      totalHours: Math.round(client.totalMinutes / 60 * 100) / 100,
      billableAmount: rate ? Math.round(client.totalMinutes / 60 * rate * 100) / 100 : null,
      projects: Object.values(client.projects).map(p => ({
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
  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({ error: 'Failed to generate billing report' });
  }
});

export default router;
