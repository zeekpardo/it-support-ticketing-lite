import prisma from '../prisma.js';
import { resolveFileUrl } from '../storage.js';
import { APP_NAME } from './client.js';

const DEFAULT_PRIMARY_COLOR = '#2563eb';

/**
 * Look up org branding and resolve logo URL.
 * Returns defaults if org not found or fields are null.
 */
export async function getOrgBranding(organizationId) {
  if (!organizationId) {
    return { appName: APP_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, logoUrl: null };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { appName: true, primaryColor: true, logo: true },
    });

    if (!org) {
      return { appName: APP_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, logoUrl: null };
    }

    const logoUrl = await resolveFileUrl(org.logo);

    return {
      appName: org.appName || APP_NAME,
      primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
      logoUrl,
    };
  } catch (err) {
    console.error('[Email] Failed to fetch org branding:', err);
    return { appName: APP_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, logoUrl: null };
  }
}
