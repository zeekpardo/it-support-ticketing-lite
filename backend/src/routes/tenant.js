import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveFileUrl } from '../lib/storage.js';

const router = express.Router();

const DEFAULT_APP_NAME = process.env.APP_NAME || 'Groovi Support';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

/**
 * GET /api/tenant
 *
 * Public endpoint (no auth required). Returns org info for the current subdomain.
 * The tenantDetection middleware resolves the subdomain → org and attaches req.tenantOrg.
 * Frontend calls this on init to detect which org to load branding for.
 */
router.get('/', asyncHandler(async (req, res) => {
  if (!req.tenantOrg) {
    return res.status(404).json({ error: 'No tenant found for this subdomain' });
  }

  const org = req.tenantOrg;
  res.json({
    organizationId: org.id,
    slug: org.slug,
    appName: org.appName || DEFAULT_APP_NAME,
    primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
    logo: await resolveFileUrl(org.logo),
    favicon: await resolveFileUrl(org.favicon),
  });
}));

export default router;
