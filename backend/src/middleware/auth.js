import { auth, prisma } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

// Middleware to authenticate user and get session
export const authenticate = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Middleware to require organization context
export const requireOrganization = async (req, res, next) => {
  try {
    const orgId = req.headers['x-organization-id'] || req.session?.activeOrganizationId;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    // Verify user is a member of this organization
    const member = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.id
        }
      },
      include: {
        organization: true
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    req.organization = member.organization;
    req.membership = member;
    next();
  } catch (error) {
    console.error('Org auth error:', error);
    return res.status(500).json({ error: 'Organization verification failed' });
  }
};

// Middleware to require manager or owner role
export const requireAdmin = (req, res, next) => {
  if (!req.membership) {
    return res.status(400).json({ error: 'Organization context required' });
  }

  if (req.membership.role !== 'manager' && req.membership.role !== 'owner') {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
};

// Middleware to require owner role
export const requireOwner = (req, res, next) => {
  if (!req.membership) {
    return res.status(400).json({ error: 'Organization context required' });
  }

  if (req.membership.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }

  next();
};

// Middleware to require staff (non-client) role
export const requireStaff = (req, res, next) => {
  if (!req.membership) {
    return res.status(400).json({ error: 'Organization context required' });
  }

  if (req.membership.role === 'client') {
    return res.status(403).json({ error: 'Staff access required' });
  }

  next();
};

// Middleware to require client role
export const requireClient = (req, res, next) => {
  if (!req.membership) {
    return res.status(400).json({ error: 'Organization context required' });
  }

  if (req.membership.role !== 'client') {
    return res.status(403).json({ error: 'Client access only' });
  }

  next();
};

// Check if user has a specific permission
export const hasPermission = (permission) => {
  return (req, res, next) => {
    const rolePermissions = {
      owner: [
        'organization:delete', 'organization:update',
        'member:create', 'member:delete', 'member:update',
        'invitation:create', 'invitation:cancel',
        'inbox:create', 'inbox:update', 'inbox:delete',
        'time-entry:view-all', 'time-entry:edit-all', 'time-entry:delete-all',
        'reports:view-all',
        'ticket:view-all', 'ticket:edit-all', 'ticket:delete', 'ticket:assign',
        'client:manage'
      ],
      manager: [
        'member:create', 'member:delete', 'member:update',
        'invitation:create', 'invitation:cancel',
        'inbox:create', 'inbox:update', 'inbox:delete',
        'time-entry:view-all', 'time-entry:edit-all', 'time-entry:delete-all',
        'reports:view-all',
        'ticket:view-all', 'ticket:edit-all', 'ticket:assign',
        'client:manage'
      ],
      member: [
        'inbox:view',
        'time-entry:create', 'time-entry:view-own', 'time-entry:edit-own', 'time-entry:delete-own',
        'reports:view-own',
        'ticket:view-all', 'ticket:edit-own'
      ],
      client: [
        'ticket:create', 'ticket:view-own', 'ticket:comment-public',
        'inbox:view-assigned'
      ]
    };

    const role = req.membership?.role;
    if (!role || !rolePermissions[role]?.includes(permission)) {
      return res.status(403).json({ error: `Permission denied: ${permission}` });
    }

    next();
  };
};
