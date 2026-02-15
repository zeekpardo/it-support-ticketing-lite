import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireClient } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import ticketRoutes from './portal/tickets.js';
import commentRoutes from './portal/comments.js';

const router = express.Router();

// All routes require authentication, organization context, and client role
router.use(authenticate);
router.use(requireOrganization);
router.use(requireClient);

// Mount sub-routers
router.use('/tickets', ticketRoutes);
router.use('/tickets', commentRoutes);  // /tickets/:id/messages

// Get projects assigned to client
router.get('/projects', asyncHandler(async (req, res) => {
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      memberId: req.membership.id
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
          description: true,
          isActive: true,
          _count: {
            select: {
              tickets: {
                where: { clientId: req.membership.id }
              }
            }
          }
        }
      }
    }
  });

  const projects = assignments
    .filter(a => a.project.isActive)
    .map(a => ({
      ...a.project,
      ticketCount: a.project._count.tickets
    }));

  res.json(projects);
}));

// Get dashboard stats for client
router.get('/dashboard', asyncHandler(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    select: { status: true }
  });

  const stats = {
    total: tickets.length,
    newRequest: tickets.filter(t => t.status === 'NEW_REQUEST').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    waitingForInfo: tickets.filter(t => t.status === 'WAITING_FOR_INFO').length,
    review: tickets.filter(t => t.status === 'REVIEW').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length
  };

  const recentTickets = await prisma.supportTicket.findMany({
    where: {
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      project: { select: { id: true, name: true } }
    }
  });

  res.json({ stats, recentTickets });
}));

export default router;
