import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import timeEntriesRoutes from './routes/timeEntries.js';
import projectsRoutes from './routes/projects.js';
import reportsRoutes from './routes/reports.js';
import ticketsRoutes from './routes/tickets.js';
import portalRoutes from './routes/portal.js';
import membersRoutes from './routes/members.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

// Allow Chrome extension origins (matches any extension ID for development)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow listed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Better Auth handler - must be before express.json() for auth routes
app.all('/api/auth/*', toNodeHandler(auth));

// JSON parsing for other routes
app.use(express.json());

// API Routes
app.use('/api/time-entries', timeEntriesRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/members', membersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
