import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requireAuth, writeGuard } from './middleware/auth.js';

import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import carriersRouter from './routes/carriers.js';
import migrationsRouter from './routes/migrations.js';
import usersRouter from './routes/users.js';
import phoneNumbersRouter from './routes/phoneNumbers.js';
import autoAttendantsRouter from './routes/autoAttendants.js';
import callQueuesRouter from './routes/callQueues.js';
import resourceAccountsRouter from './routes/resourceAccounts.js';
import scriptsRouter from './routes/scripts.js';
import teamRouter from './routes/team.js';
import publicRouter from './routes/public.js';
import * as notificationsController from './controllers/notificationsController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no auth) - for magic link access
app.use('/api/public', publicRouter);

// Auth routes (login/setup are public, me/change-password are protected)
app.use('/api/auth', authRouter);

// All routes below require authentication
app.use('/api', requireAuth);

// Write guard: POST/PUT/PATCH/DELETE require non-viewer role
app.use('/api', writeGuard);

// Protected API Routes
app.use('/api/settings', settingsRouter);
app.use('/api/carriers', carriersRouter);
app.use('/api/migrations', migrationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/phone-numbers', phoneNumbersRouter);
app.use('/api/auto-attendants', autoAttendantsRouter);
app.use('/api/call-queues', callQueuesRouter);
app.use('/api/resource-accounts', resourceAccountsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/team', teamRouter);
app.get('/api/notifications/my-subscriptions', notificationsController.getMySubscriptions);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`PortFlow API running on port ${PORT}`);
});

export default app;
