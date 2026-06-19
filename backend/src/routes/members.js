import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner, requireAdmin, requireStaff } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { createInboxAssignments } from '../utils/entityHelpers.js';
import { USER_SELECT, MEMBER_WITH_USER } from '../utils/prismaFragments.js';
import { INBOX_ASSIGNMENT_INCLUDE, INBOX_SELECT_ACTIVE, INBOX_SELECT_BRIEF } from '../utils/prismaFragments.js';
import { markWelcomeEmail } from '../lib/email/index.js';
import { resolveFileUrl } from '../lib/storage.js';
import { auth } from '../lib/auth.js';

const router = express.Router();

const generateId = () => crypto.randomBytes(16).toString('hex');

// Create a new user and add them directly to the organization
// POST /api/members/create-user
router.post('/create-user', authenticate, requireOrganization, requireOwner, asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, inboxIds } = req.body;

  if (!name || !email || !password) {
    throw new ValidationError('Name, email, and password are required');
  }

  const validRoles = ['manager', 'member', 'client'];
  if (role && !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be manager, member, or client');
  }

  if (role === 'client' && (!inboxIds || inboxIds.length === 0)) {
    throw new ValidationError('At least one inbox must be selected for client users');
  }

  if (req.user.role !== 'admin') {
    throw new ForbiddenError('Only super admins can create users directly');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const existingMember = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.organization.id,
          userId: existingUser.id
        }
      }
    });

    if (existingMember) {
      throw new ValidationError('User is already a member of this organization');
    }

    const member = await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: req.organization.id,
        userId: existingUser.id,
        role: role || 'member'
      },
      include: {
        user: { select: USER_SELECT }
      }
    });

    if (inboxIds?.length > 0) {
      await createInboxAssignments(member.id, inboxIds);
    }

    return res.json({
      success: true,
      message: 'Existing user added to organization',
      member
    });
  }

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(password);
  const userId = generateId();

  try {
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        phone: phone || null,
        emailVerified: true,
        role: 'user',
      }
    });

    await prisma.account.create({
      data: {
        id: generateId(),
        userId: newUser.id,
        accountId: newUser.id,
        providerId: 'credential',
        password: hashedPassword,
      }
    });

    const member = await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: req.organization.id,
        userId: newUser.id,
        role: role || 'member'
      },
      include: {
        user: { select: USER_SELECT }
      }
    });

    if (inboxIds?.length > 0) {
      await createInboxAssignments(member.id, inboxIds);
    }

    // Stash context so the sendResetPassword callback sends a welcome email
    markWelcomeEmail(email, { name, organizationName: req.organization.name });
    // Trigger Better Auth's forgot-password flow to generate a set-password link
    void auth.api.forgetPassword({
      body: { email, redirectTo: '/reset-password' },
      headers: new Headers()
    });

    res.json({
      success: true,
      message: 'User created and added to organization',
      member
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      if (field === 'email') {
        throw new ConflictError('A user with this email already exists. Use "Send Invitation" to invite them to this organization instead.');
      }
      throw new ConflictError(`A record with this ${field} already exists`);
    }
    throw error;
  }
}));

// Get all invitation inbox assignments for pending invitations in this org
// GET /api/members/invitations/inboxes
router.get('/invitations/inboxes', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const invitationInboxes = await prisma.invitationInbox.findMany({
    where: {
      invitation: {
        organizationId: req.organization.id,
        status: 'pending'
      }
    },
    include: {
      inbox: {
        select: { id: true, name: true, inboxCode: true }
      }
    }
  });

  // Group by invitation ID
  const grouped = {};
  for (const ip of invitationInboxes) {
    if (!grouped[ip.invitationId]) grouped[ip.invitationId] = [];
    grouped[ip.invitationId].push(ip.inbox);
  }

  res.json(grouped);
}));

// Save inbox assignments for a pending invitation
// POST /api/members/invitations/:invitationId/inboxes
router.post('/invitations/:invitationId/inboxes', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const { inboxIds } = req.body;

  if (!inboxIds || !Array.isArray(inboxIds) || inboxIds.length === 0) {
    throw new ValidationError('At least one inbox ID is required');
  }

  // Verify invitation exists, belongs to this org, and is still pending
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId: req.organization.id,
      status: 'pending'
    }
  });

  if (!invitation) {
    throw new NotFoundError('Pending invitation not found');
  }

  // Verify all inboxes belong to this organization
  const inboxes = await prisma.inbox.findMany({
    where: {
      id: { in: inboxIds },
      organizationId: req.organization.id
    }
  });

  if (inboxes.length !== inboxIds.length) {
    throw new ValidationError('One or more inboxes not found in this organization');
  }

  // Delete existing invitation inboxes and create new ones (atomic)
  await prisma.$transaction([
    prisma.invitationInbox.deleteMany({ where: { invitationId } }),
    ...inboxIds.map(inboxId =>
      prisma.invitationInbox.create({ data: { invitationId, inboxId } })
    )
  ]);

  res.json({ success: true });
}));

// Get all clients with their inbox assignments
// GET /api/members/clients
router.get('/clients', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const clients = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: 'client'
    },
    include: {
      user: { select: USER_SELECT },
      inboxAssignments: {
        include: INBOX_ASSIGNMENT_INCLUDE
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(clients);
}));

// Get all staff members (non-clients) for ticket assignment
// GET /api/members/staff
router.get('/staff', authenticate, requireOrganization, requireStaff, asyncHandler(async (req, res) => {
  const staff = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] }
    },
    include: {
      user: { select: USER_SELECT }
    },
    orderBy: {
      user: { name: 'asc' }
    }
  });

  res.json(staff);
}));

// Update a staff member's hourly rate
// PATCH /api/members/staff/:memberId/rate
router.patch('/staff/:memberId/rate', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { hourlyRate } = req.body;

  if (hourlyRate !== null && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
    throw new ValidationError('Hourly rate must be a non-negative number or null');
  }

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] }
    }
  });

  if (!member) throw new NotFoundError('Staff member not found');

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { hourlyRate },
    include: { user: { select: USER_SELECT } }
  });

  res.json(updated);
}));

// Get a single client with their tickets and software access
// GET /api/members/clients/:memberId
router.get('/clients/:memberId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  const client = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId: req.organization.id,
      role: 'client'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      inboxAssignments: {
        include: INBOX_ASSIGNMENT_INCLUDE
      }
    }
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  const tickets = await prisma.supportTicket.findMany({
    where: {
      clientId: memberId,
      organizationId: req.organization.id
    },
    include: {
      inbox: {
        select: INBOX_SELECT_BRIEF
      },
      owner: {
        select: MEMBER_WITH_USER
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const softwareAccess = await prisma.softwareAccessRequest.findMany({
    where: {
      requesterId: memberId,
      inboxSoftware: {
        inbox: {
          organizationId: req.organization.id
        }
      }
    },
    include: {
      inboxSoftware: {
        include: {
          software: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
              vendor: true
            }
          },
          inbox: {
            select: INBOX_SELECT_BRIEF
          }
        }
      },
      reviewer: {
        select: MEMBER_WITH_USER
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const resolvedAccess = await Promise.all(softwareAccess.map(async (sa) => ({
    ...sa,
    inboxSoftware: {
      ...sa.inboxSoftware,
      software: { ...sa.inboxSoftware.software, iconUrl: await resolveFileUrl(sa.inboxSoftware.software.iconUrl) }
    }
  })));

  res.json({
    ...client,
    tickets,
    softwareAccess: resolvedAccess
  });
}));

// Update a client's user details (name, phone)
// PATCH /api/members/clients/:memberId
router.patch('/clients/:memberId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { name, phone } = req.body;

  const data = {};
  if (name !== undefined) {
    if (!name.trim()) throw new ValidationError('Name cannot be empty');
    data.name = name.trim();
  }
  if (phone !== undefined) {
    data.phone = phone.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields to update');
  }

  const client = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId: req.organization.id,
      role: 'client'
    }
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: client.userId },
    data,
    select: { id: true, name: true, email: true, phone: true }
  });

  res.json(updatedUser);
}));

export default router;
