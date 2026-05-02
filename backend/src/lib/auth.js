import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, admin, openAPI, magicLink } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import prisma from './prisma.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendInvitationEmail, sendMagicLinkEmail, sendWelcomeEmail, consumeWelcomeContext, consumePublicTicketContext, sendPublicTicketConfirmationEmail, getFrontendUrl } from './email/index.js';

// Environment configuration
const isDev = process.env.NODE_ENV !== 'production';
const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  try {
    const parsed = new URL(input);
    return parsed.origin;
  } catch {
    return input.replace(/\/+$/, '');
  }
};

// Define the access control statements
const statement = {
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  inbox: ['create', 'read', 'update', 'delete'],
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
  inbox: ['create', 'read', 'update', 'delete'],
  ticket: ['create', 'read', 'update', 'delete', 'assign'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const manager = ac.newRole({
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  inbox: ['create', 'read', 'update', 'delete'],
  ticket: ['create', 'read', 'update', 'delete', 'assign'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const member = ac.newRole({
  inbox: ['read'],
  ticket: ['create', 'read', 'update'],
  timeEntry: ['create', 'read', 'update', 'delete'],
  report: ['read'],
});

const client = ac.newRole({
  inbox: ['read'],
  ticket: ['create', 'read'],
});

export const auth = betterAuth({
  basePath: '/api/auth',
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  databaseHooks: {
    member: {
      create: {
        after: async (member) => {
          try {
            // When a member is created (e.g., from accepting an invitation),
            // apply any pre-assigned inbox assignments from the invitation.
            const user = await prisma.user.findUnique({ where: { id: member.userId } });
            if (!user) return;

            const invitation = await prisma.invitation.findFirst({
              where: {
                organizationId: member.organizationId,
                email: user.email,
                status: 'accepted'
              },
              orderBy: { createdAt: 'desc' },
              include: { invitationInboxes: true }
            });

            if (invitation?.invitationInboxes?.length > 0) {
              const inboxIds = invitation.invitationInboxes.map(ii => ii.inboxId);
              await prisma.inboxAssignment.createMany({
                data: inboxIds.map(inboxId => ({ memberId: member.id, inboxId })),
                skipDuplicates: true
              });
              await prisma.invitationInbox.deleteMany({
                where: { invitationId: invitation.id }
              });
            }
          } catch (err) {
            console.error('Failed to apply invitation inbox assignments:', err);
          }
        }
      }
    }
  },
  advanced: {
    defaultCookieAttributes: {
      // Using custom domain (app.groovi.support + api.groovi.support)
      // Cookies work as first-party, so we can use the more secure 'lax' instead of 'none'
      sameSite: 'lax',
      secure: !isDev, // Required for HTTPS
      // Set domain to .groovi.support to share cookies across subdomains
      domain: isDev ? undefined : '.groovi.support'
    }
  },

  // Email & Password Authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      // Check if this is a welcome email (admin just created the account)
      const welcomeCtx = consumeWelcomeContext(user.email);
      if (welcomeCtx) {
        void sendWelcomeEmail({
          to: user.email,
          name: welcomeCtx.name,
          organizationName: welcomeCtx.organizationName,
          setPasswordUrl: url
        });
      } else {
        void sendPasswordResetEmail({ user, url });
      }
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
    expiresIn: 60 * 60 * 4, // 4 hours
    updateAge: 60 * 60, // Refresh session every hour
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
        const ticketCtx = consumePublicTicketContext(email);
        if (ticketCtx) {
          void sendPublicTicketConfirmationEmail({ ...ticketCtx, magicLinkUrl: url });
        } else {
          void sendMagicLinkEmail({ email, url });
        }
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
        const baseUrl = await getFrontendUrl(data.organization.id);
        const inviteUrl = baseUrl + '/accept-invitation?id=' + data.id;
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

  // Trusted origins for CORS — supports *.groovi.support subdomains dynamically
  trustedOrigins: (request) => {
    const BASE_DOMAIN = process.env.BASE_DOMAIN || 'groovi.support';
    const subdomainPattern = new RegExp(`^https://[a-z0-9-]+\\.${BASE_DOMAIN.replace(/\./g, '\\.')}$`);

    const staticOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
      'chrome-extension://cjcjnghodjkdjpilglboecgfellnnnfi'
    ].map(normalizeOrigin).filter(Boolean);

    const trustIfSubdomain = (value) => {
      if (!value) return;
      const normalized = normalizeOrigin(value);
      if (normalized && subdomainPattern.test(normalized)) {
        staticOrigins.push(normalized);
      }
    };

    // CORS requests include an Origin header
    trustIfSubdomain(request?.headers?.get?.('origin') || request?.headers?.origin);

    // Magic link verify is a GET with no Origin header — extract origin from callbackURL query param
    try {
      const reqUrl = typeof request?.url === 'string' ? request.url : null;
      if (reqUrl) {
        const parsed = new URL(reqUrl, 'https://placeholder.invalid');
        trustIfSubdomain(parsed.searchParams.get('callbackURL'));
      }
    } catch {}

    return staticOrigins;
  }
});

export { prisma };
