import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/migrations';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import materialRoutes from './routes/materials';
import testRoutes from './routes/tests';
import adminRoutes from './routes/admin';
import notificationsRoutes from './routes/notifications';
import cron from 'node-cron';
import { processDocumentationReminders } from './services/notificationService';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Initialize database
initDatabase()
  .then(() => {
    console.log('Database initialized');
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server + ежедневные напоминания по документации
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const schedule = process.env.NOTIFICATION_CRON || '0 8 * * *';
  cron.schedule(schedule, () => {
    processDocumentationReminders()
      .then((r) => console.log('[cron] documentation reminders:', r))
      .catch((err) => console.error('[cron] documentation reminders failed:', err));
  });
});

export default app;
