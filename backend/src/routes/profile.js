import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../utils/errors.js';
import { uploadFile, deleteFile, generateStorageKey, resolveFileUrl } from '../lib/storage.js';

const router = express.Router();

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
};

// Get current user's profile
// GET /api/members/profile
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: PROFILE_SELECT
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(user);
}));

// Update current user's profile (phone number)
// PUT /api/members/profile
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone: phone || null },
    select: PROFILE_SELECT
  });

  res.json(updatedUser);
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
      const key = generateStorageKey('avatars', req.file.originalname);
      await uploadFile(req.file.buffer, key, req.file.mimetype);
      const s3Ref = `s3:${key}`;

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { image: true }
      });

      if (currentUser?.image?.startsWith('s3:')) {
        await deleteFile(currentUser.image.slice(3));
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { image: s3Ref },
        select: { ...PROFILE_SELECT, image: true }
      });

      res.json({ ...updatedUser, imageUrl: await resolveFileUrl(updatedUser.image) });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });
});

// Get resolved avatar URL
// GET /api/members/profile/avatar-url
router.get('/profile/avatar-url', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { image: true }
  });
  res.json({ url: await resolveFileUrl(user?.image) });
}));

// Delete profile photo
// DELETE /api/members/profile/avatar
router.delete('/profile/avatar', authenticate, asyncHandler(async (req, res) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { image: true }
  });

  if (currentUser?.image?.startsWith('s3:')) {
    await deleteFile(currentUser.image.slice(3));
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { image: null }
  });

  res.json({ message: 'Avatar removed' });
}));

export default router;
