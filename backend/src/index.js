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
import clientSignupRoutes from './routes/clientSignup.js';
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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
]
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOriginSet = new Set(allowedOrigins);

// Allow Chrome extension origins (matches any extension ID for development)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow listed origins
    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin && allowedOriginSet.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    console.error('CORS blocked origin:', origin, 'Allowed origins:', Array.from(allowedOriginSet));
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

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
app.use('/api/client-signup', clientSignupRoutes);

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
