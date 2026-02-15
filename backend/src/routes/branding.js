import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner } from '../middleware/auth.js';
import { asyncHandler, withUpload } from '../middleware/asyncHandler.js';
import { uploadLogo, uploadFavicon } from '../middleware/upload.js';
import { uploadFile, deleteFile, generateStorageKey, resolveFileUrl } from '../lib/storage.js';
import { ValidationError } from '../utils/errors.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

const BRANDING_SELECT = {
  appName: true,
  primaryColor: true,
  logo: true,
  favicon: true,
  name: true,
};

const DEFAULT_APP_NAME = process.env.APP_NAME || 'Groovi Support';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

async function resolveBranding(org) {
  return {
    appName: org.appName || DEFAULT_APP_NAME,
    primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
    logoUrl: await resolveFileUrl(org.logo),
    faviconUrl: await resolveFileUrl(org.favicon),
  };
}

// GET /api/branding — any authenticated member
router.get('/', asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: BRANDING_SELECT,
  });
  res.json(await resolveBranding(org));
}));

// PUT /api/branding — owner only
router.put('/', requireOwner, asyncHandler(async (req, res) => {
  const { appName, primaryColor } = req.body;
  const data = {};

  if (appName !== undefined) {
    if (appName && appName.length > 50) {
      throw new ValidationError('App name must be 50 characters or less');
    }
    data.appName = appName?.trim() || null;
  }

  if (primaryColor !== undefined) {
    if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      throw new ValidationError('Primary color must be a valid hex color (e.g., #2563eb)');
    }
    data.primaryColor = primaryColor || null;
  }

  const updated = await prisma.organization.update({
    where: { id: req.organization.id },
    data,
    select: BRANDING_SELECT,
  });
  res.json(await resolveBranding(updated));
}));

// POST /api/branding/logo — owner only
router.post('/logo', requireOwner, withUpload(uploadLogo, async (req, res) => {
  if (!req.file) throw new ValidationError('No file provided');

  const key = generateStorageKey('branding/logos', req.file.originalname);
  await uploadFile(req.file.buffer, key, req.file.mimetype);
  const s3Ref = `s3:${key}`;

  // Delete old logo if exists
  const current = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: { logo: true },
  });
  if (current?.logo?.startsWith('s3:')) {
    await deleteFile(current.logo.slice(3));
  }

  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { logo: s3Ref },
  });

  res.json({ logoUrl: await resolveFileUrl(s3Ref) });
}));

// DELETE /api/branding/logo — owner only
router.delete('/logo', requireOwner, asyncHandler(async (req, res) => {
  const current = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: { logo: true },
  });
  if (current?.logo?.startsWith('s3:')) {
    await deleteFile(current.logo.slice(3));
  }
  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { logo: null },
  });
  res.json({ success: true });
}));

// POST /api/branding/favicon — owner only
router.post('/favicon', requireOwner, withUpload(uploadFavicon, async (req, res) => {
  if (!req.file) throw new ValidationError('No file provided');

  const key = generateStorageKey('branding/favicons', req.file.originalname);
  await uploadFile(req.file.buffer, key, req.file.mimetype);
  const s3Ref = `s3:${key}`;

  // Delete old favicon if exists
  const current = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: { favicon: true },
  });
  if (current?.favicon?.startsWith('s3:')) {
    await deleteFile(current.favicon.slice(3));
  }

  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { favicon: s3Ref },
  });

  res.json({ faviconUrl: await resolveFileUrl(s3Ref) });
}));

// DELETE /api/branding/favicon — owner only
router.delete('/favicon', requireOwner, asyncHandler(async (req, res) => {
  const current = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: { favicon: true },
  });
  if (current?.favicon?.startsWith('s3:')) {
    await deleteFile(current.favicon.slice(3));
  }
  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { favicon: null },
  });
  res.json({ success: true });
}));

export default router;
