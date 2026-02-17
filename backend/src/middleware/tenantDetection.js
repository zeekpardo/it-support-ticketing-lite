import { prisma } from '../lib/auth.js';

const SKIP_SUBDOMAINS = new Set(['app', 'api', 'www']);
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'groovi.support';

/**
 * Tenant detection middleware — resolves org from subdomain.
 *
 * Extracts the subdomain from the Host header (e.g., "acme" from "acme.groovi.support"),
 * looks up the Organization by slug, and attaches it to `req.tenantOrg`.
 * Also injects `X-Organization-Id` header so downstream `requireOrganization`
 * picks it up automatically.
 *
 * Skips when:
 * - Host is a known service subdomain (app, api, www)
 * - Host is localhost / IP (development)
 * - Request already has X-Organization-Id header
 * - No subdomain present
 */
export const tenantDetection = async (req, res, next) => {
  try {
    // Skip if client already specifies an org
    if (req.headers['x-organization-id']) {
      return next();
    }

    const host = (req.headers.host || '').split(':')[0].toLowerCase();

    // Skip localhost / IP addresses
    if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return next();
    }

    // Check if host ends with base domain
    if (!host.endsWith(`.${BASE_DOMAIN}`)) {
      return next();
    }

    // Extract subdomain: "acme.groovi.support" → "acme"
    const subdomain = host.slice(0, -(BASE_DOMAIN.length + 1));

    // Skip known service subdomains or empty/multi-level subdomains
    if (!subdomain || subdomain.includes('.') || SKIP_SUBDOMAINS.has(subdomain)) {
      return next();
    }

    // Look up org by slug (only if subdomain routing is enabled for the org)
    const org = await prisma.organization.findFirst({
      where: { slug: subdomain, subdomainEnabled: true },
      select: { id: true, name: true, slug: true, appName: true, primaryColor: true, logo: true, favicon: true },
    });

    if (!org) {
      return next();
    }

    // Attach tenant org for any downstream middleware/routes that need it
    req.tenantOrg = org;

    // Inject header so requireOrganization picks it up
    req.headers['x-organization-id'] = org.id;

    next();
  } catch (error) {
    console.error('[TenantDetection] Error resolving tenant:', error.message);
    next();
  }
};
