import express from 'express';
import { authenticate } from '../middleware/auth.js';
import usersRoutes from './superAdmin/users.js';
import categoriesRoutes from './superAdmin/categories.js';
import softwareRoutes from './superAdmin/software.js';
import accountsRoutes from './superAdmin/accounts.js';

const router = express.Router();

// All super admin routes require authentication and admin role
router.use(authenticate);
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
});

// Mount sub-routers (categories BEFORE software/:id to avoid param capture)
router.use('/users', usersRoutes);
router.use('/software/categories', categoriesRoutes);
router.use('/software', softwareRoutes);
router.use('/accounts', accountsRoutes);

export default router;
