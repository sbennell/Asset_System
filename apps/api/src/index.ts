import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import softwareRoutes from './routes/software.js';
import lookupRoutes from './routes/lookups.js';
import stocktakeRoutes from './routes/stocktake.js';
import importRoutes from './routes/import.js';
import labelRoutes from './routes/labels.js';
import systemRoutes from './routes/system.js';
import networkRoutes from './routes/network.js';
import reportRoutes from './routes/reports.js';
import studentRoutes from './routes/students.js';
import publicRoutes from './routes/public.js';
import { startStudentImportWatcher, closeStudentImportWatcher } from './services/studentImportWatcher.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  // install.ps1 always generates and writes a random SESSION_SECRET for production
  // deployments; a missing value here means the environment is misconfigured, and
  // falling back to a shared default would let sessions be forged. Fail loudly instead.
  throw new Error('SESSION_SECRET environment variable is required in production');
}

// Content-Security-Policy is left to a follow-up pass (needs verification against every
// page/asset the SPA loads); the rest of helmet's defaults (X-Content-Type-Options,
// X-Frame-Options, etc.) are safe to enable as-is.
app.use(helmet({ contentSecurityPolicy: false }));

// The SPA is served from this same Express app in production (see below), so the API
// never needs to accept cross-origin requests there - only same-origin requests from the
// browser matter, and those don't require CORS headers at all. Only the Vite dev server
// (a different origin/port) needs the dev-only localhost allowance.
app.use(cors({
  origin: isProduction ? false : /^http:\/\/localhost:\d+$/,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'itms-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Most installs of this internal LAN tool run over plain HTTP (see install.ps1),
    // so cookies can't be marked Secure by default without breaking login for them.
    // Deployments that do terminate HTTPS in front of the app can opt in.
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Make prisma available to routes
app.locals.prisma = prisma;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/software', softwareRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/stocktakes', stocktakeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files in production
if (isProduction) {
  const frontendPath = path.join(__dirname, '../../web/dist');
  app.use(express.static(frontendPath));

  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeStudentImportWatcher();
  await prisma.$disconnect();
  process.exit(0);
});

let studentImportWatcher: any = null;

app.listen(PORT, async () => {
  console.log(`IT Management System (ITMS) API running on http://localhost:${PORT}`);

  // Initialize student import watcher
  studentImportWatcher = await startStudentImportWatcher(prisma);
});

export { prisma };
