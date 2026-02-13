import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const generateFilename = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const hash = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${hash}${ext}`;
};

// === AVATAR UPLOAD ===
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_BASE, 'avatars');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  }
}).single('avatar');

// === SOFTWARE ICON UPLOAD ===
const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_BASE, 'icons');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

export const uploadIcon = multer({
  storage: iconStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, WebP, and SVG images are allowed'));
    }
  }
}).single('icon');

// === TICKET ATTACHMENT UPLOAD ===
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_BASE, 'attachments');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

export const uploadAttachments = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blockedExtensions.includes(ext)) {
      cb(new Error('This file type is not allowed'));
    } else {
      cb(null, true);
    }
  }
}).array('attachments', 5); // Up to 5 files

// Helper: delete a file from uploads
export const deleteUploadedFile = (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const filePath = path.join(process.cwd(), fileUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};
