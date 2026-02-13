import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner, requireAdmin, requireStaff } from '../middleware/auth.js';
import { uploadAvatar, deleteUploadedFile } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { findMemberOrFail, findProjectOrFail } from '../utils/entityHelpers.js';
import { USER_SELECT, MEMBER_WITH_USER } from '../utils/prismaFragments.js';

const router = express.Router();

// Generate a random ID similar to Better Auth's format
const generateId = () => crypto.randomBytes(16).toString('hex');

// Create a new user and add them directly to the organization
// POST /api/members/create-user
router.post('/create-user', authenticate, requireOrganization, requireOwner, asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, projectIds } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    throw new ValidationError('Name, email, and password are required');
  }

  // Validate role
  const validRoles = ['manager', 'member', 'client'];
  if (role && !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be manager, member, or client');
  }

  // Require project selection for clients
  if (role === 'client' && (!projectIds || projectIds.length === 0)) {
    throw new ValidationError('At least one project must be selected for client users');
  }

  // Check if user is a super admin
  if (req.user.role !== 'admin') {
    throw new ForbiddenError('Only super admins can create users directly');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    // User exists - check if they're already a member of this org
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

    // Add existing user to organization
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

    // Create project assignments for clients
    if (role === 'client' && projectIds && projectIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: projectIds.map(projectId => ({
          memberId: member.id,
          projectId
        }))
      });
    }

    return res.json({
      success: true,
      message: 'Existing user added to organization',
      member
    });
  }

  // Create new user directly via Prisma (since Better Auth admin API requires specific setup)
  // Hash password using Better Auth's internal method
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
        emailVerified: true, // Skip email verification for admin-created users
        role: 'user',
      }
    });

    // Create the account record for email/password auth
    await prisma.account.create({
      data: {
        id: generateId(),
        userId: newUser.id,
        accountId: newUser.id,
        providerId: 'credential',
        password: hashedPassword,
      }
    });

    // Create member record to add user to organization
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

    // Create project assignments for clients
    if (role === 'client' && projectIds && projectIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: projectIds.map(projectId => ({
          memberId: member.id,
          projectId
        }))
      });
    }

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

// ==========================================
// Project Assignment Endpoints
// ==========================================

// Get all clients with their project assignments
// GET /api/members/clients
router.get('/clients', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const clients = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: 'client'
    },
    include: {
      user: { select: USER_SELECT },
      projectAssignments: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              isActive: true
            }
          }
        }
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

// Get project assignments for a specific member
// GET /api/members/:memberId/projects
router.get('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  // Verify member belongs to this organization
  await findMemberOrFail(memberId, req.organization.id);

  const assignments = await prisma.projectAssignment.findMany({
    where: { memberId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
          isActive: true
        }
      }
    }
  });

  res.json(assignments);
}));

// Assign a project to a member (typically a client)
// POST /api/members/:memberId/projects
router.post('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    throw new ValidationError('Project ID is required');
  }

  // Verify member belongs to this organization
  await findMemberOrFail(memberId, req.organization.id);

  // Verify project belongs to this organization
  await findProjectOrFail(projectId, req.organization.id);

  // Check if assignment already exists
  const existingAssignment = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId }
    }
  });

  if (existingAssignment) {
    throw new ValidationError('Project is already assigned to this member');
  }

  const assignment = await prisma.projectAssignment.create({
    data: {
      memberId,
      projectId
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
          isActive: true
        }
      }
    }
  });

  res.status(201).json(assignment);
}));

// Remove a project assignment from a member
// DELETE /api/members/:memberId/projects/:projectId
router.delete('/:memberId/projects/:projectId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId, projectId } = req.params;

  // Verify member belongs to this organization
  await findMemberOrFail(memberId, req.organization.id);

  // Delete the assignment
  try {
    await prisma.projectAssignment.delete({
      where: {
        memberId_projectId: { memberId, projectId }
      }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new NotFoundError('Project assignment not found');
    }
    throw error;
  }

  res.json({ message: 'Project assignment removed' });
}));

// Bulk update project assignments for a member
// PUT /api/members/:memberId/projects
router.put('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { projectIds } = req.body;

  if (!Array.isArray(projectIds)) {
    throw new ValidationError('projectIds must be an array');
  }

  // Verify member belongs to this organization
  await findMemberOrFail(memberId, req.organization.id);

  // Verify all projects belong to this organization
  const projects = await prisma.project.findMany({
    where: {
      id: { in: projectIds },
      organizationId: req.organization.id
    }
  });

  if (projects.length !== projectIds.length) {
    throw new ValidationError('One or more projects not found');
  }

  // Delete all existing assignments and create new ones in a transaction
  await prisma.$transaction([
    prisma.projectAssignment.deleteMany({
      where: { memberId }
    }),
    ...projectIds.map(projectId =>
      prisma.projectAssignment.create({
        data: { memberId, projectId }
      })
    )
  ]);

  // Fetch updated assignments
  const assignments = await prisma.projectAssignment.findMany({
    where: { memberId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
          isActive: true
        }
      }
    }
  });

  res.json(assignments);
}));

// ==========================================
// Client Detail Endpoint
// ==========================================

// Get a single client with their tickets and software access
// GET /api/members/clients/:memberId
router.get('/clients/:memberId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  // Get client with user info and project assignments
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
      projectAssignments: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              isActive: true
            }
          }
        }
      }
    }
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Get all tickets for this client
  const tickets = await prisma.supportTicket.findMany({
    where: {
      clientId: memberId,
      organizationId: req.organization.id
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true
        }
      },
      owner: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Get all software access requests for this client
  const softwareAccess = await prisma.softwareAccessRequest.findMany({
    where: {
      requesterId: memberId,
      projectSoftware: {
        project: {
          organizationId: req.organization.id
        }
      }
    },
    include: {
      projectSoftware: {
        include: {
          software: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
              vendor: true
            }
          },
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true
            }
          }
        }
      },
      reviewer: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({
    ...client,
    tickets,
    softwareAccess
  });
}));

// ==========================================
// User Profile Endpoints
// ==========================================

// Update current user's profile (phone number)
// PUT /api/members/profile
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone: phone || null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  });

  res.json(updatedUser);
}));

// Get current user's profile
// GET /api/members/profile
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(user);
}));

// Upload profile photo
// POST /api/members/profile/avatar
router.post('/profile/avatar', authenticate, (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const imageUrl = `/uploads/avatars/${req.file.filename}`;

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { image: true }
      });

      if (currentUser?.image?.startsWith('/uploads/')) {
        deleteUploadedFile(currentUser.image);
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { image: imageUrl },
        select: { id: true, name: true, email: true, phone: true, image: true }
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });
});

// Delete profile photo
// DELETE /api/members/profile/avatar
router.delete('/profile/avatar', authenticate, asyncHandler(async (req, res) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { image: true }
  });

  if (currentUser?.image?.startsWith('/uploads/')) {
    deleteUploadedFile(currentUser.image);
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { image: null }
  });

  res.json({ message: 'Avatar removed' });
}));

export default router;
