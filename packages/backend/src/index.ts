import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import motorcycleRoutes from './routes/motorcycles';
import maintenanceRoutes from './routes/maintenance';
import documentRoutes from './routes/documents';
import kilometerRoutes from './routes/kilometers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  exposedHeaders: ['Authorization'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/motorcycles', motorcycleRoutes);
app.use('/api/motorcycles/:id/maintenance', maintenanceRoutes);
app.use('/api/motorcycles/:id/documents', documentRoutes);
app.use('/api/motorcycles/:id/kilometers', kilometerRoutes);

// Only listen when not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Moto Tracker API running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
