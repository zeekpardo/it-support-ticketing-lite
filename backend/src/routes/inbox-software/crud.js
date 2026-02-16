import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { findInboxOrFail, hasInboxAccess, isSoftwareOwner } from '../../utils/entityHelpers.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';
import { resolveFileUrl } from '../../lib/storage.js';

async function resolveNestedIcon(item) {
  if (!item?.software) return item;
  return { ...item, software: { ...item.software, iconUrl: await resolveFileUrl(item.software.iconUrl) } };
}

const router = express.Router();

// Get inbox's software list
router.get('/inboxes/:inboxId/software', asyncHandler(async (req, res) => {
  const { inboxId } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  // Check access
  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  const software = await prisma.inboxSoftware.findMany({
    where: { inboxId },
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

  const resolved = await Promise.all(software.map(resolveNestedIcon));
  res.json(resolved);
}));

// Get single inbox software detail
router.get('/inboxes/:inboxId/software/:id', asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  // Check access
  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  const software = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId },
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
    throw new NotFoundError('Software not found in inbox');
  }

  res.json(await resolveNestedIcon(software));
}));

// Add software from catalog to inbox
router.post('/inboxes/:inboxId/software/:softwareId', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, softwareId } = req.params;
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

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

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
  const existing = await prisma.inboxSoftware.findUnique({
    where: {
      inboxId_softwareId: { inboxId, softwareId }
    }
  });

  if (existing) {
    throw new ValidationError('Software already added to inbox');
  }

  // Create inbox software and make the adder an OWNER
  const inboxSoftware = await prisma.inboxSoftware.create({
    data: {
      inboxId,
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

  res.status(201).json(await resolveNestedIcon(inboxSoftware));
}));

// Update inbox software
router.put('/inboxes/:inboxId/software/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;
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

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const existing = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!existing) {
    throw new NotFoundError('Software not found in inbox');
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

  const software = await prisma.inboxSoftware.update({
    where: { id },
    data: updateData,
    include: {
      software: {
        include: { category: true }
      }
    }
  });

  res.json(await resolveNestedIcon(software));
}));

// Remove software from inbox
router.delete('/inboxes/:inboxId/software/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const existing = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!existing) {
    throw new NotFoundError('Software not found in inbox');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can remove');
  }

  await prisma.inboxSoftware.delete({
    where: { id }
  });

  res.json({ message: 'Software removed from inbox' });
}));

// Get budget summary for an inbox's software
router.get('/inboxes/:inboxId/software-budget', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const software = await prisma.inboxSoftware.findMany({
    where: { inboxId, cost: { not: null } },
    include: {
      software: { select: { name: true, iconUrl: true } },
      _count: {
        select: { accessRequests: { where: { status: 'APPROVED' } } }
      }
    }
  });

  let totalMonthly = 0;
  let totalYearly = 0;

  const breakdown = await Promise.all(software.map(async (sw) => {
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
      iconUrl: await resolveFileUrl(sw.software.iconUrl),
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
  }));

  res.json({
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalYearly: Math.round(totalYearly * 100) / 100,
    softwareCount: software.length,
    breakdown
  });
}));

export default router;
