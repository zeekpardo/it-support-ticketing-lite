import multer from 'multer';
import { isAllowedMimeType } from '../utils/sanitize.js';

const memoryStorage = multer.memoryStorage();

// === AVATAR UPLOAD ===
export const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 512 * 1024 }, // 512KB
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
export const uploadIcon = multer({
  storage: memoryStorage,
  limits: { fileSize: 512 * 1024 }, // 512KB — small display icons only
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
const allowedAttachmentTypes = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text / data
  'text/plain',
  'text/csv',
];

export const uploadAttachments = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (isAllowedMimeType(file.mimetype, allowedAttachmentTypes)) {
      cb(null, true);
    } else {
      cb(new Error('This file type is not allowed. Accepted: images, PDF, Office documents, plain text, and CSV.'));
    }
  }
}).array('attachments', 5); // Up to 5 files

// === PUBLIC FORM ATTACHMENT UPLOAD (permissive — type filtering done in handler) ===
export const uploadPublicFormFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => cb(null, true), // accept all; handler filters
}).array('attachments', 5);

// === ORG LOGO UPLOAD ===
export const uploadLogo = multer({
  storage: memoryStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, WebP, and SVG images are allowed'));
    }
  }
}).single('logo');

// === ORG FAVICON UPLOAD ===
export const uploadFavicon = multer({
  storage: memoryStorage,
  limits: { fileSize: 256 * 1024 }, // 256KB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only ICO, PNG, and SVG files are allowed for favicon'));
    }
  }
}).single('favicon');
