import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import maintenanceTypesRoutes from './routes/maintenance-types';
import motorcycleRoutes from './routes/motorcycles';
import kilometerRoutes from './routes/kilometers';
import maintenanceRoutes from './routes/maintenance';
import documentRoutes from './routes/documents';
import notificationRoutes from './routes/notifications';
import { ReminderEngine } from './services/reminder';
import { db } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/maintenance-types', maintenanceTypesRoutes);
app.use('/api/motorcycles', motorcycleRoutes);
app.use('/api/motorcycles', kilometerRoutes);
app.use('/api/motorcycles', maintenanceRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/motorcycles', documentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);

// Start reminder engine
const reminderCheckInterval = parseInt(process.env.REMINDER_CHECK_INTERVAL_MS || '3600000', 10);
const reminderEngine = new ReminderEngine(db, { checkIntervalMs: reminderCheckInterval });
reminderEngine.start();

app.listen(PORT, () => {
  console.log(`🏍️  Moto Tracker API running on port ${PORT}`);
  console.log(`⏰ Reminder engine started (interval: ${reminderCheckInterval}ms)`);
});

export default app;
