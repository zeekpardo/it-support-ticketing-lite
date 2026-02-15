import express from 'express';
import multer from 'multer';
import { prisma } from '../../lib/auth.js';
import { requireStaff } from '../../middleware/auth.js';
import { asyncHandler, withUpload } from '../../middleware/asyncHandler.js';
import { uploadAttachments } from '../../middleware/upload.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { findTicketOrFail, createTicketAttachments } from '../../utils/entityHelpers.js';
import { MEMBER_WITH_USER_BRIEF } from '../../utils/prismaFragments.js';
import { getPresignedUrl, deleteFile, uploadFile, generateAttachmentKey, isStorageConfigured } from '../../lib/storage.js';

const router = express.Router();

// Get ticket attachments (with presigned URLs for S3 files)
router.get('/:id/attachments', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: MEMBER_WITH_USER_BRIEF },
    },
  });

  // Generate presigned URLs for S3-stored files
  const withUrls = await Promise.all(attachments.map(async (att) => {
    if (att.fileUrl.startsWith('s3:')) {
      const key = att.fileUrl.slice(3);
      try {
        const url = await getPresignedUrl(key);
        return { ...att, fileUrl: url };
      } catch {
        return att;
      }
    }
    return att;
  }));

  res.json(withUrls);
}));

// Upload ticket attachments
router.post('/:id/attachments', requireStaff, withUpload(uploadAttachments, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ValidationError('No files provided');
  }

  await findTicketOrFail(req.params.id, req.organization.id);

  const attachments = await createTicketAttachments(
    req.params.id,
    req.membership.id,
    req.files,
    null,
    { include: { uploadedBy: { select: MEMBER_WITH_USER_BRIEF } } }
  );

  res.status(201).json(attachments);
}));

// Upload inline image (for rich text editor)
const uploadInlineImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  }
}).single('image');

router.post('/:id/inline-image', requireStaff, withUpload(uploadInlineImage, async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No image provided');
  }

  if (!isStorageConfigured()) {
    throw new ValidationError('File storage is not configured');
  }

  await findTicketOrFail(req.params.id, req.organization.id);

  const key = generateAttachmentKey(req.params.id, req.file.originalname);
  await uploadFile(req.file.buffer, key, req.file.mimetype);

  await prisma.ticketAttachment.create({
    data: {
      ticketId: req.params.id,
      uploadedById: req.membership.id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileUrl: `s3:${key}`,
      isInline: true,
    },
  });

  res.status(201).json({ key });
}));

// Delete attachment
router.delete('/:id/attachments/:attachmentId', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const attachment = await prisma.ticketAttachment.findFirst({
    where: {
      id: req.params.attachmentId,
      ticketId: req.params.id,
    },
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }

  // Delete file from S3
  if (attachment.fileUrl.startsWith('s3:')) {
    await deleteFile(attachment.fileUrl.slice(3));
  }

  await prisma.ticketAttachment.delete({
    where: { id: req.params.attachmentId },
  });

  res.json({ message: 'Attachment deleted' });
}));

export default router;
