import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, admin, openAPI, magicLink } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { PrismaClient } from '@prisma/client';
import { sendVerificationEmail, sendPasswordResetEmail, sendInvitationEmail, sendMagicLinkEmail } from './email.js';

// Environment configuration
const isDev = process.env.NODE_ENV !== 'production';

const prisma = new PrismaClient();

// Define the access control statements
const statement = {
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  project: ['create', 'read', 'update', 'delete'],
  ticket: ['create', 'read', 'update', 'delete', 'assign'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
};

// Create access control
const ac = createAccessControl(statement);

// Define roles using the access control
const owner = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  project: ['create', 'read', 'update', 'delete'],
  ticket: ['create', 'read', 'update', 'delete', 'assign'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const manager = ac.newRole({
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  project: ['create', 'read', 'update', 'delete'],
  ticket: ['create', 'read', 'update', 'delete', 'assign'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const member = ac.newRole({
  project: ['read'],
  ticket: ['create', 'read', 'update'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const client = ac.newRole({
  project: ['read'],
  ticket: ['create', 'read'],
});

export const auth = betterAuth({
  basePath: '/api/auth',
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),

  // Email & Password Authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      // Use void to prevent timing attacks (don't await email sending)
      void sendPasswordResetEmail({ user, url });
    },
  },

  // Email verification
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Use void to prevent timing attacks (don't await email sending)
      void sendVerificationEmail({ user, url });
    },
  },

  // User management
  user: {
    changeEmail: {
      enabled: true,
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes cache
    },
    // Include impersonatedBy field in session responses
    additionalFields: {
      impersonatedBy: {
        type: 'string',
        required: false
      }
    }
  },

  // Rate limiting for security
  rateLimit: {
    window: 60, // 60 seconds
    max: 100, // max 100 requests per window
    // Stricter limits for auth endpoints
    customRules: {
      '/sign-in/*': { window: 60, max: 10 },
      '/sign-up/*': { window: 60, max: 5 },
      '/forgot-password': { window: 60, max: 3 }
    }
  },

  // Performance optimization
  experimental: {
    joins: true // 2-3x faster queries for session/organization fetching
  },

  // Plugins
  plugins: [
    // Magic link for passwordless client onboarding
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        void sendMagicLinkEmail({ email, url });
      },
      expiresIn: 300 // 5 minutes
    }),

    // Admin plugin for super admin features
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60 // 1 hour
    }),

    // Organization plugin with roles
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: 'owner',
      membershipLimit: 100,
      sendInvitationEmail: async (data) => {
        const inviteUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/accept-invitation?id=' + data.id;
        // Use void to prevent timing attacks (don't await email sending)
        void sendInvitationEmail({
          email: data.email,
          inviterName: data.inviter.user.name,
          organizationName: data.organization.name,
          inviteUrl
        });
      },
      ac,
      roles: {
        owner,
        manager,
        member,
        client
      }
    }),

    // OpenAPI documentation (dev only)
    ...(isDev ? [openAPI()] : [])
  ],

  // Trusted origins for CORS
  trustedOrigins: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000',
    process.env.FRONTEND_URL, // Production frontend
    'chrome-extension://cjcjnghodjkdjpilglboecgfellnnnfi' // Chrome extension
  ].filter(Boolean)
});

export { prisma };
