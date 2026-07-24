import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import motorcycleRoutes from './routes/motorcycles';
import maintenanceRoutes from './routes/maintenance';
import documentRoutes from './routes/documents';
import kilometerRoutes from './routes/kilometers';
import fuelRoutes from './routes/fuel';
import profileRoutes from './routes/profile';
import theftAlertRoutes from './routes/theft-alerts';
import activeMotoRoutes from './routes/activeMotos';
import notificationRoutes from './routes/notifications';
import googleRoutes from './routes/google';
import weatherRoutes from './routes/weather';
import otpRoutes from './routes/otp';
import gpsTrackerRoutes from './routes/gpsTrackers';
import ocrRoutes from './routes/ocr';
import municipalitiesRoutes from './routes/municipalities';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  exposedHeaders: ['Authorization'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/motorcycles', motorcycleRoutes);
app.use('/api/motorcycles/:id/maintenance', maintenanceRoutes);
app.use('/api/motorcycles/:id/documents', documentRoutes);
app.use('/api/motorcycles/:id/kilometers', kilometerRoutes);
app.use('/api/motorcycles/:id/fuel', fuelRoutes);
app.use('/api/theft-alerts', theftAlertRoutes);
app.use('/api/active-motos', activeMotoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/gps-trackers', gpsTrackerRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/municipalities', municipalitiesRoutes);

// Only listen when not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Moto Tracker API running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
