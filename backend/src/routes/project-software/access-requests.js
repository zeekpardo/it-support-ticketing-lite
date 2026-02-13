import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin, requireStaff } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { createNotification } from '../../services/notificationService.js';
import { findProjectOrFail, isSoftwareAdmin } from '../../utils/entityHelpers.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';

const router = express.Router();

// Get all pending access requests for a project's software
router.get('/projects/:projectId/software/:id/requests', asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;
  const { status } = req.query;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Only admins or software admins can view requests
  const isAdmin = await isSoftwareAdmin(id, req.membership.id);
  if (!isAdmin && req.membership.role !== 'owner' && req.membership.role !== 'manager') {
    throw new ForbiddenError('Access denied');
  }

  const where = { projectSoftwareId: id };
  if (status) {
    where.status = status;
  }

  const requests = await prisma.softwareAccessRequest.findMany({
    where,
    include: {
      requester: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      reviewer: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(requests);
}));

// Get all pending requests across all projects in the organization
router.get('/requests/pending', requireStaff, asyncHandler(async (req, res) => {
  const { projectId } = req.query;

  const where = {
    status: 'PENDING',
    projectSoftware: {
      project: {
        organizationId: req.organization.id
      }
    }
  };

  // Optionally filter by project
  if (projectId) {
    where.projectSoftware.projectId = projectId;
  }

  const requests = await prisma.softwareAccessRequest.findMany({
    where,
    include: {
      projectSoftware: {
        include: {
          software: true,
          project: {
            select: { id: true, name: true, projectCode: true, defaultAssigneeId: true }
          }
        }
      },
      requester: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      assignee: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(requests);
}));

// Get all pending requests across all software in a project
router.get('/projects/:projectId/requests', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const requests = await prisma.softwareAccessRequest.findMany({
    where: {
      status: 'PENDING',
      projectSoftware: { projectId }
    },
    include: {
      projectSoftware: {
        include: {
          software: true
        }
      },
      requester: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(requests);
}));

// Assign a request to a staff member
router.put('/requests/:requestId/assign', requireStaff, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { assigneeId } = req.body;

  // Find the request and verify it belongs to this organization
  const request = await prisma.softwareAccessRequest.findFirst({
    where: {
      id: requestId,
      projectSoftware: {
        project: {
          organizationId: req.organization.id
        }
      }
    }
  });

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // If assigneeId provided, verify the member exists and is staff
  if (assigneeId) {
    const assignee = await prisma.member.findFirst({
      where: {
        id: assigneeId,
        organizationId: req.organization.id,
        role: { in: ['owner', 'manager', 'member'] }
      }
    });

    if (!assignee) {
      throw new ValidationError('Invalid assignee');
    }
  }

  const updated = await prisma.softwareAccessRequest.update({
    where: { id: requestId },
    data: { assigneeId: assigneeId || null },
    include: {
      projectSoftware: {
        include: {
          software: true,
          project: {
            select: { id: true, name: true, projectCode: true }
          }
        }
      },
      requester: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      assignee: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.json(updated);
}));

// Review/update access request status (approve/decline/revoke)
router.put('/projects/:projectId/software/:id/requests/:requestId', asyncHandler(async (req, res) => {
  const { projectId, id, requestId } = req.params;
  const { status, reviewNotes } = req.body;

  if (!status || !['APPROVED', 'DECLINED', 'REVOKED', 'PENDING'].includes(status)) {
    throw new ValidationError('Valid status is required (APPROVED, DECLINED, REVOKED, or PENDING)');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Only admins or software admins can review
  const isAdmin = await isSoftwareAdmin(id, req.membership.id);
  if (!isAdmin && req.membership.role !== 'owner' && req.membership.role !== 'manager') {
    throw new ForbiddenError('Access denied');
  }

  const request = await prisma.softwareAccessRequest.findUnique({
    where: { id: requestId }
  });

  if (!request || request.projectSoftwareId !== id) {
    throw new NotFoundError('Request not found');
  }

  const updated = await prisma.softwareAccessRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewNotes,
      reviewerId: req.membership.id
    },
    include: {
      requester: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      reviewer: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      projectSoftware: {
        include: {
          software: { select: { name: true } }
        }
      }
    }
  });

  // Send notification to the requester about status change
  if (status !== 'PENDING' && request.requesterId !== req.membership.id) {
    try {
      const notificationTypeMap = {
        APPROVED: 'ACCESS_REQUEST_APPROVED',
        DECLINED: 'ACCESS_REQUEST_DECLINED',
        REVOKED: 'ACCESS_REQUEST_REVOKED',
      };

      const notificationType = notificationTypeMap[status];
      if (notificationType) {
        await createNotification(prisma, {
          type: notificationType,
          recipientId: request.requesterId,
          organizationId: req.organization.id,
          data: {
            softwareName: updated.projectSoftware.software.name,
            projectId,
            projectSoftwareId: id,
          },
          entityType: 'access_request',
          entityId: requestId,
        });
      }
    } catch (notifError) {
      console.error('Error sending access request notification:', notifError);
      // Don't fail the request if notification fails
    }
  }

  res.json(updated);
}));

// Delete access request
router.delete('/projects/:projectId/software/:id/requests/:requestId', asyncHandler(async (req, res) => {
  const { projectId, id, requestId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Only admins or software admins can delete
  const isAdmin = await isSoftwareAdmin(id, req.membership.id);
  if (!isAdmin && req.membership.role !== 'owner' && req.membership.role !== 'manager') {
    throw new ForbiddenError('Access denied');
  }

  const request = await prisma.softwareAccessRequest.findUnique({
    where: { id: requestId }
  });

  if (!request || request.projectSoftwareId !== id) {
    throw new NotFoundError('Request not found');
  }

  await prisma.softwareAccessRequest.delete({
    where: { id: requestId }
  });

  res.json({ message: 'Access request deleted' });
}));

export default router;
