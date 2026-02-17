import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { AppError } from './utils/errors.js';
import timeEntriesRoutes from './routes/timeEntries.js';
import inboxesRoutes from './routes/inboxes.js';
import ticketStagesRoutes from './routes/ticketStages.js';
import reportsRoutes from './routes/reports.js';
import ticketsRoutes from './routes/tickets.js';
import portalRoutes from './routes/portal.js';
import membersRoutes from './routes/members.js';
import memberInboxesRoutes from './routes/memberInboxes.js';
import profileRoutes from './routes/profile.js';
import superAdminRoutes from './routes/superAdmin.js';
import inboxSoftwareRoutes from './routes/inbox-software.js';
import portalSoftwareRoutes from './routes/portal-software.js';
import importRoutes from './routes/import.js';
import notificationsRoutes from './routes/notifications.js';
import inboundEmailWebhook from './routes/webhooks/inbound-email.js';
import emailRulesRoutes from './routes/email-rules.js';
import brandingRoutes from './routes/branding.js';
import emailDomainRoutes from './routes/email-domains.js';
import clientSignupRoutes from './routes/clientSignup.js';
import publicTicketRoutes from './routes/publicTicket.js';
import { adminRouter as orgPublicFormAdminRoutes, publicRouter as orgPublicFormPublicRoutes } from './routes/orgPublicForm.js';
import tenantRoutes from './routes/tenant.js';
import { tenantDetection } from './middleware/tenantDetection.js';
import { startCronJobs } from './services/cronService.js';

const app = express();
const PORT = process.env.PORT || 3001;

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  try {
    const parsed = new URL(input);
    return parsed.origin.toLowerCase();
  } catch {
    return input.replace(/\/+$/, '').toLowerCase();
  }
};

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://*.railway.app"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// CORS configuration
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'groovi.support';
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
]
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOriginSet = new Set(allowedOrigins);

// Match any *.groovi.support subdomain origin
const subdomainPattern = new RegExp(`^https://[a-z0-9-]+\\.${BASE_DOMAIN.replace(/\./g, '\\.')}$`);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow listed origins (localhost, FRONTEND_URL)
    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin && allowedOriginSet.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow any *.groovi.support subdomain
    if (normalizedOrigin && subdomainPattern.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    console.error('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Tenant detection — resolve org from subdomain (e.g., acme.groovi.support)
app.use(tenantDetection);

// Better Auth handler - must be before express.json() for auth routes
app.all('/api/auth/*', toNodeHandler(auth));

// Webhook routes (before express.json() for raw body access)
app.use('/api/webhooks/inbound-email', inboundEmailWebhook);

// JSON parsing for other routes
app.use(express.json());

// API Routes
app.use('/api/time-entries', timeEntriesRoutes);
app.use('/api/inboxes', inboxesRoutes);
app.use('/api/inboxes', ticketStagesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/members', profileRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/members', memberInboxesRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/software', inboxSoftwareRoutes);
app.use('/api/portal/software', portalSoftwareRoutes);
app.use('/api/import', importRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/email-rules', emailRulesRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/email-domains', emailDomainRoutes);
app.use('/api/client-signup', clientSignupRoutes);
app.use('/api/org-public-form', orgPublicFormAdminRoutes);

// Public tenant info (no auth — used by frontend to resolve subdomain → org)
app.use('/api/tenant', tenantRoutes);

// Public ticket submission (no auth, allow iframe embedding)
app.use('/api/public/submit', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
}, publicTicketRoutes);

// Public org-level ticket form (no auth, allow iframe embedding)
app.use('/api/public/org-form', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
}, orgPublicFormPublicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    console.error(`${err.name}: ${err.message}`);
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    console.error(`Prisma unique constraint violation on ${field}`);
    return res.status(400).json({ error: `A record with this ${field} already exists` });
  }

  if (err.code === 'P2025') {
    console.error('Prisma record not found:', err.message);
    return res.status(404).json({ error: 'Record not found' });
  }

  if (err.code === 'P2003') {
    console.error('Prisma foreign key constraint:', err.message);
    return res.status(400).json({ error: 'Invalid reference' });
  }

  if (err.name === 'MulterError') {
    console.error('Upload error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCronJobs();
});
