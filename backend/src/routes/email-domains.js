import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import {
  addDomain,
  verifyDomain,
  refreshDomainStatus,
  removeDomain,
  setOrgDefault,
  clearOrgDefault,
  listDomains,
  getDomain,
} from '../services/emailDomainService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);
router.use(requireOwner);

// GET /api/email-domains — list all domains for current org
router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.organization.id;

  const domains = await listDomains(orgId);

  // Include which domain is the org default
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      defaultEmailDomainId: true,
      defaultFromUser: true,
      defaultFromName: true,
    },
  });

  res.json({
    domains,
    orgDefaults: {
      defaultEmailDomainId: org.defaultEmailDomainId,
      defaultFromUser: org.defaultFromUser,
      defaultFromName: org.defaultFromName,
    },
  });
}));

// POST /api/email-domains — add a domain
router.post('/', asyncHandler(async (req, res) => {
  const { domain } = req.body;

  if (!domain || typeof domain !== 'string') {
    throw new ValidationError('Domain name is required');
  }

  // Basic domain validation
  const trimmed = domain.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(trimmed)) {
    throw new ValidationError('Invalid domain format');
  }

  const emailDomain = await addDomain(req.organization.id, trimmed);
  res.status(201).json(emailDomain);
}));

// POST /api/email-domains/:id/verify — trigger verification
router.post('/:id/verify', asyncHandler(async (req, res) => {
  const updated = await verifyDomain(req.params.id, req.organization.id);
  res.json(updated);
}));

// POST /api/email-domains/:id/refresh — poll latest status
router.post('/:id/refresh', asyncHandler(async (req, res) => {
  const updated = await refreshDomainStatus(req.params.id, req.organization.id);
  res.json(updated);
}));

// PUT /api/email-domains/:id — update domain settings (currently no mutable fields on the domain itself)
router.put('/:id', asyncHandler(async (req, res) => {
  const domain = await getDomain(req.params.id, req.organization.id);
  if (!domain) {
    return res.status(404).json({ error: 'Domain not found' });
  }

  // No mutable fields on EmailDomain for now — sender identity lives on Org/Inbox
  res.json(domain);
}));

// DELETE /api/email-domains/:id — remove domain
router.delete('/:id', asyncHandler(async (req, res) => {
  await removeDomain(req.params.id, req.organization.id);
  res.json({ success: true });
}));

// PUT /api/email-domains/:id/set-default — set as org default
router.put('/:id/set-default', asyncHandler(async (req, res) => {
  await setOrgDefault(req.organization.id, req.params.id);
  res.json({ success: true });
}));

// DELETE /api/email-domains/org-default — clear org default
router.delete('/org-default', asyncHandler(async (req, res) => {
  await clearOrgDefault(req.organization.id);
  res.json({ success: true });
}));

// PUT /api/email-domains/org-defaults — update org-level sender defaults
router.put('/org-defaults', asyncHandler(async (req, res) => {
  const { defaultFromUser, defaultFromName } = req.body;
  const data = {};

  if (defaultFromUser !== undefined) {
    if (defaultFromUser && !/^[a-zA-Z0-9._%+-]+$/.test(defaultFromUser)) {
      throw new ValidationError('Invalid email local part (letters, numbers, dots, hyphens, underscores only)');
    }
    data.defaultFromUser = defaultFromUser?.trim() || null;
  }

  if (defaultFromName !== undefined) {
    if (defaultFromName && defaultFromName.length > 100) {
      throw new ValidationError('Display name must be 100 characters or less');
    }
    data.defaultFromName = defaultFromName?.trim() || null;
  }

  const updated = await prisma.organization.update({
    where: { id: req.organization.id },
    data,
    select: {
      defaultEmailDomainId: true,
      defaultFromUser: true,
      defaultFromName: true,
    },
  });

  res.json(updated);
}));

export default router;
