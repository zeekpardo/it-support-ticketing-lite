import express from 'express';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import crudRoutes from './tickets/crud.js';
import commentsRoutes from './tickets/comments.js';
import timeEntriesRoutes from './tickets/time-entries.js';
import attachmentsRoutes from './tickets/attachments.js';

const router = express.Router();

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(requireOrganization);

// Mount sub-routers
router.use(crudRoutes);
router.use(commentsRoutes);
router.use(timeEntriesRoutes);
router.use(attachmentsRoutes);

export default router;
