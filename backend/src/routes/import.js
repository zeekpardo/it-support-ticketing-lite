import express from 'express';
import crypto from 'crypto';
import { prisma, auth } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import { findProjectOrFail } from '../utils/entityHelpers.js';
import { sendMagicLinkEmail } from '../lib/email/index.js';

const router = express.Router();

// Generate a random ID similar to Better Auth's format
const generateId = () => crypto.randomBytes(16).toString('hex');

// Validate email format
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Bulk import clients into a project
 * POST /api/import/clients
 */
router.post('/clients', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, clients } = req.body;

  if (!projectId) {
    throw new ValidationError('Project ID is required');
  }

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    throw new ValidationError('At least one client is required');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const results = [];
  const summary = {
    total: clients.length,
    created: 0,
    existingUsersAdded: 0,
    alreadyMembers: 0,
    failed: 0,
    magicLinksSent: 0
  };

  // Process each client (per-item try/catch to continue on individual failures)
  for (const client of clients) {
    const { firstName, lastName, email, phone } = client;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      results.push({
        email: email || 'unknown',
        status: 'error',
        message: 'First name, last name, and email are required'
      });
      summary.failed++;
      continue;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      results.push({
        email,
        status: 'error',
        message: 'Invalid email format'
      });
      summary.failed++;
      continue;
    }

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      let userId;
      let memberId;
      let isNewUser = false;

      if (existingUser) {
        userId = existingUser.id;

        // Check if already a member of this organization
        const existingMember = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId: req.organization.id,
              userId: existingUser.id
            }
          }
        });

        if (existingMember) {
          // Check if already assigned to this project
          const existingAssignment = await prisma.projectAssignment.findUnique({
            where: {
              memberId_projectId: {
                memberId: existingMember.id,
                projectId
              }
            }
          });

          if (existingAssignment) {
            results.push({
              email,
              status: 'already_member',
              message: 'User is already a client on this project'
            });
            summary.alreadyMembers++;
            continue;
          }

          // Add project assignment for existing member
          await prisma.projectAssignment.create({
            data: {
              memberId: existingMember.id,
              projectId
            }
          });

          memberId = existingMember.id;
          results.push({
            email,
            status: 'existing_added',
            message: 'Existing user added to project',
            memberId
          });
          summary.existingUsersAdded++;
        } else {
          // User exists but not a member - add them to org and project
          const member = await prisma.member.create({
            data: {
              id: generateId(),
              organizationId: req.organization.id,
              userId: existingUser.id,
              role: 'client'
            }
          });

          await prisma.projectAssignment.create({
            data: {
              memberId: member.id,
              projectId
            }
          });

          memberId = member.id;
          results.push({
            email,
            status: 'existing_added',
            message: 'Existing user added to organization and project',
            memberId
          });
          summary.existingUsersAdded++;
        }
      } else {
        // Create new user (without password - they'll use magic link)
        isNewUser = true;
        const newUser = await prisma.user.create({
          data: {
            id: generateId(),
            name: `${firstName} ${lastName}`,
            email,
            phone: phone || null,
            emailVerified: false,
            role: 'user'
          }
        });

        userId = newUser.id;

        // Create member record
        const member = await prisma.member.create({
          data: {
            id: generateId(),
            organizationId: req.organization.id,
            userId: newUser.id,
            role: 'client'
          }
        });

        // Create project assignment
        await prisma.projectAssignment.create({
          data: {
            memberId: member.id,
            projectId
          }
        });

        memberId = member.id;
        results.push({
          email,
          status: 'created',
          message: 'New client created and added to project',
          memberId
        });
        summary.created++;
      }

      // Send magic link email (non-blocking per item)
      try {
        const callbackUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard';

        // Use Better Auth's magic link API to send the email
        await auth.api.signInMagicLink({
          body: {
            email,
            callbackURL: callbackUrl
          }
        });

        summary.magicLinksSent++;
      } catch (emailError) {
        console.error(`Failed to send magic link to ${email}:`, emailError);
        // Update the result to note email failure
        const resultIndex = results.findIndex(r => r.email === email);
        if (resultIndex !== -1) {
          results[resultIndex].message += ' (magic link email failed to send)';
        }
      }
    } catch (error) {
      console.error(`Error processing client ${email}:`, error);
      results.push({
        email,
        status: 'error',
        message: error.message || 'Failed to process client'
      });
      summary.failed++;
    }
  }

  res.json({
    success: summary.failed < summary.total,
    summary,
    results
  });
}));

export default router;
