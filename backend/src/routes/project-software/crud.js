import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { findProjectOrFail, hasProjectAccess, isSoftwareOwner } from '../../utils/entityHelpers.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';

const router = express.Router();

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

export default router;
