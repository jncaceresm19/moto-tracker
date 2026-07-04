import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import motorcycleRoutes from './routes/motorcycles';
import maintenanceRoutes from './routes/maintenance';

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
app.use('/api/motorcycles', motorcycleRoutes);
app.use('/api/motorcycles/:id/maintenance', maintenanceRoutes);

app.listen(PORT, () => {
  console.log(`🏍️  Moto Tracker API running on port ${PORT}`);
});

export default app;
