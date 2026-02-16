import express from 'express';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import catalogRoutes from './inbox-software/catalog.js';
import crudRoutes from './inbox-software/crud.js';
import adminsRoutes from './inbox-software/admins.js';
import accessRequestRoutes from './inbox-software/access-requests.js';

const router = express.Router();

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(requireOrganization);

// Mount sub-routers
router.use(catalogRoutes);
router.use(crudRoutes);
router.use(adminsRoutes);
router.use(accessRequestRoutes);

export default router;
