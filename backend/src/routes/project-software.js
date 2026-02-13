import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin, requireStaff } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { findProjectOrFail } from '../utils/entityHelpers.js';
import { USER_SELECT } from '../utils/prismaFragments.js';

const router = express.Router();

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(requireOrganization);

// ==========================================
// Helper Functions
// ==========================================

// Check if user has access to a project (assigned or admin)
const hasProjectAccess = async (projectId, memberId, memberRole) => {
  // Admins/owners have access to all projects
  if (memberRole === 'owner' || memberRole === 'manager') {
    return true;
  }

  // Check project assignment
  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId }
    }
  });

  return !!assignment;
};

// Check if user is a software owner for a project software
const isSoftwareOwner = async (projectSoftwareId, memberId) => {
  const admin = await prisma.projectSoftwareAdmin.findFirst({
    where: { projectSoftwareId, memberId, role: 'OWNER' }
  });
  return !!admin;
};

// Check if user is a software admin (owner or admin role)
const isSoftwareAdmin = async (projectSoftwareId, memberId) => {
  const admin = await prisma.projectSoftwareAdmin.findFirst({
    where: { projectSoftwareId, memberId }
  });
  return !!admin;
};

// ==========================================
// Global Catalog (Read-only for org users)
// ==========================================

// Get approved software from global catalog
router.get('/catalog', requireStaff, asyncHandler(async (req, res) => {
  const { categoryId, search } = req.query;

  const where = { status: 'APPROVED' };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  const software = await prisma.softwareCatalog.findMany({
    where,
    include: {
      category: true
    },
    orderBy: { name: 'asc' }
  });

  res.json(software);
}));

// Get categories from global catalog
router.get('/catalog/categories', requireStaff, asyncHandler(async (req, res) => {
  const categories = await prisma.softwareCategory.findMany({
    orderBy: { name: 'asc' }
  });

  res.json(categories);
}));

// Submit new software for approval
router.post('/submit', requireAdmin, asyncHandler(async (req, res) => {
  const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

  if (!name) {
    throw new ValidationError('Name is required');
  }

  // Check for duplicate name
  const existing = await prisma.softwareCatalog.findUnique({
    where: { name }
  });

  if (existing) {
    throw new ValidationError('Software with this name already exists');
  }

  const software = await prisma.softwareCatalog.create({
    data: {
      name,
      description,
      iconUrl,
      vendor,
      websiteUrl,
      categoryId: categoryId || null,
      status: 'PENDING',
      submittedById: req.user.id
    },
    include: {
      category: true
    }
  });

  res.status(201).json(software);
}));

// ==========================================
// Project Software Management
// ==========================================

// Get project's software list
router.get('/projects/:projectId/software', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  // Check access
  const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this project');
  }

  const software = await prisma.projectSoftware.findMany({
    where: { projectId },
    include: {
      software: {
        include: { category: true }
      },
      addedBy: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      _count: {
        select: { admins: true, accessRequests: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(software);
}));

// Get single project software detail
router.get('/projects/:projectId/software/:id', asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  // Check access
  const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this project');
  }

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId },
    include: {
      software: {
        include: { category: true }
      },
      addedBy: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      admins: {
        include: {
          member: {
            include: {
              user: { select: USER_SELECT }
            }
          }
        }
      },
      accessRequests: {
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
      },
      _count: {
        select: {
          accessRequests: { where: { status: 'APPROVED' } }
        }
      }
    }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  res.json(software);
}));

// Add software from catalog to project
router.post('/projects/:projectId/software/:softwareId', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, softwareId } = req.params;
  const {
    notes,
    renewalDate,
    billingCycle,
    cost,
    costType,
    autoRenewal,
    licenseType,
    totalSeats,
    vendorContactEmail,
    vendorContactPhone,
    contractUrl,
    loginUrl
  } = req.body;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  // Verify software exists and is approved
  const catalogSoftware = await prisma.softwareCatalog.findUnique({
    where: { id: softwareId }
  });

  if (!catalogSoftware) {
    throw new NotFoundError('Software not found in catalog');
  }

  if (catalogSoftware.status !== 'APPROVED') {
    throw new ValidationError('Software is not approved');
  }

  // Check if already added
  const existing = await prisma.projectSoftware.findUnique({
    where: {
      projectId_softwareId: { projectId, softwareId }
    }
  });

  if (existing) {
    throw new ValidationError('Software already added to project');
  }

  // Create project software and make the adder an OWNER
  const projectSoftware = await prisma.projectSoftware.create({
    data: {
      projectId,
      softwareId,
      notes,
      addedById: req.membership.id,
      renewalDate: renewalDate ? new Date(renewalDate) : null,
      billingCycle: billingCycle || null,
      cost: cost != null && cost !== '' ? parseFloat(cost) : null,
      costType: costType || null,
      autoRenewal: autoRenewal || false,
      licenseType: licenseType || null,
      totalSeats: totalSeats != null && totalSeats !== '' ? parseInt(totalSeats) : null,
      vendorContactEmail: vendorContactEmail || null,
      vendorContactPhone: vendorContactPhone || null,
      contractUrl: contractUrl || null,
      loginUrl: loginUrl || null,
      admins: {
        create: {
          memberId: req.membership.id,
          role: 'OWNER'
        }
      }
    },
    include: {
      software: {
        include: { category: true }
      },
      addedBy: {
        include: {
          user: { select: USER_SELECT }
        }
      },
      admins: {
        include: {
          member: {
            include: {
              user: { select: USER_SELECT }
            }
          }
        }
      }
    }
  });

  res.status(201).json(projectSoftware);
}));

// Update project software
router.put('/projects/:projectId/software/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;
  const {
    notes,
    renewalDate,
    billingCycle,
    cost,
    costType,
    autoRenewal,
    licenseType,
    totalSeats,
    vendorContactEmail,
    vendorContactPhone,
    contractUrl,
    loginUrl
  } = req.body;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const existing = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!existing) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can update');
  }

  // Build update data - only include fields that were explicitly sent
  const updateData = {};
  if (notes !== undefined) updateData.notes = notes;
  if (renewalDate !== undefined) updateData.renewalDate = renewalDate ? new Date(renewalDate) : null;
  if (billingCycle !== undefined) updateData.billingCycle = billingCycle || null;
  if (cost !== undefined) updateData.cost = cost != null && cost !== '' ? parseFloat(cost) : null;
  if (costType !== undefined) updateData.costType = costType || null;
  if (autoRenewal !== undefined) updateData.autoRenewal = Boolean(autoRenewal);
  if (licenseType !== undefined) updateData.licenseType = licenseType || null;
  if (totalSeats !== undefined) updateData.totalSeats = totalSeats != null && totalSeats !== '' ? parseInt(totalSeats) : null;
  if (vendorContactEmail !== undefined) updateData.vendorContactEmail = vendorContactEmail || null;
  if (vendorContactPhone !== undefined) updateData.vendorContactPhone = vendorContactPhone || null;
  if (contractUrl !== undefined) updateData.contractUrl = contractUrl || null;
  if (loginUrl !== undefined) updateData.loginUrl = loginUrl || null;

  const software = await prisma.projectSoftware.update({
    where: { id },
    data: updateData,
    include: {
      software: {
        include: { category: true }
      }
    }
  });

  res.json(software);
}));

// Remove software from project
router.delete('/projects/:projectId/software/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const existing = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!existing) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can remove');
  }

  await prisma.projectSoftware.delete({
    where: { id }
  });

  res.json({ message: 'Software removed from project' });
}));

// Get budget summary for a project's software
router.get('/projects/:projectId/software-budget', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findMany({
    where: { projectId, cost: { not: null } },
    include: {
      software: { select: { name: true, iconUrl: true } },
      _count: {
        select: { accessRequests: { where: { status: 'APPROVED' } } }
      }
    }
  });

  let totalMonthly = 0;
  let totalYearly = 0;

  const breakdown = software.map(sw => {
    const costNum = parseFloat(sw.cost) || 0;
    const users = sw.costType === 'PER_USER' ? (sw._count.accessRequests || 1) : 1;
    const effectiveCost = costNum * users;

    let monthly, yearly;
    if (sw.billingCycle === 'MONTHLY') {
      monthly = effectiveCost;
      yearly = effectiveCost * 12;
    } else {
      // YEARLY or null - treat as yearly
      yearly = effectiveCost;
      monthly = effectiveCost / 12;
    }

    totalMonthly += monthly;
    totalYearly += yearly;

    return {
      id: sw.id,
      name: sw.software.name,
      iconUrl: sw.software.iconUrl,
      cost: costNum,
      costType: sw.costType,
      billingCycle: sw.billingCycle,
      users,
      effectiveCost,
      monthly: Math.round(monthly * 100) / 100,
      yearly: Math.round(yearly * 100) / 100,
      renewalDate: sw.renewalDate,
      autoRenewal: sw.autoRenewal
    };
  });

  res.json({
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalYearly: Math.round(totalYearly * 100) / 100,
    softwareCount: software.length,
    breakdown
  });
}));

// ==========================================
// Project Software Admins
// ==========================================

// Get software admins
router.get('/projects/:projectId/software/:id/admins', asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this project');
  }

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  const admins = await prisma.projectSoftwareAdmin.findMany({
    where: { projectSoftwareId: id },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.json(admins);
}));

// Add software admin
router.post('/projects/:projectId/software/:id/admins', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;
  const { memberId, role = 'ADMIN' } = req.body;

  if (!memberId) {
    throw new ValidationError('Member ID is required');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can add admins');
  }

  // Verify member exists in organization
  const member = await prisma.member.findUnique({
    where: { id: memberId }
  });

  if (!member || member.organizationId !== req.organization.id) {
    throw new NotFoundError('Member not found');
  }

  // Check if already an admin
  const existing = await prisma.projectSoftwareAdmin.findUnique({
    where: {
      projectSoftwareId_memberId: { projectSoftwareId: id, memberId }
    }
  });

  if (existing) {
    throw new ValidationError('Member is already an admin');
  }

  const admin = await prisma.projectSoftwareAdmin.create({
    data: {
      projectSoftwareId: id,
      memberId,
      role
    },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.status(201).json(admin);
}));

// Update admin role
router.put('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id, adminId } = req.params;
  const { role } = req.body;

  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    throw new ValidationError('Valid role is required (OWNER or ADMIN)');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can update admins');
  }

  const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  const admin = await prisma.projectSoftwareAdmin.update({
    where: { id: adminId },
    data: { role },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.json(admin);
}));

// Remove admin
router.delete('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id, adminId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can remove admins');
  }

  const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  // Prevent removing the last owner
  if (existingAdmin.role === 'OWNER') {
    const ownerCount = await prisma.projectSoftwareAdmin.count({
      where: { projectSoftwareId: id, role: 'OWNER' }
    });
    if (ownerCount <= 1) {
      throw new ValidationError('Cannot remove the last owner. Transfer ownership first.');
    }
  }

  await prisma.projectSoftwareAdmin.delete({
    where: { id: adminId }
  });

  res.json({ message: 'Admin removed' });
}));

// ==========================================
// Access Requests
// ==========================================

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
