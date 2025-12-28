import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../shared/utils/logger';

// Import routes
import alertRoutes from './routes/alerts';
import incidentRoutes from './routes/incidents';
import scheduleRoutes from './routes/schedules';
import deviceRoutes from './routes/devices';
import userRoutes from './routes/users';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'pagerduty-lite-api',
    });
  });

  // API routes
  app.use('/api/v1/alerts', alertRoutes);
  app.use('/api/v1/incidents', incidentRoutes);
  app.use('/api/v1/schedules', scheduleRoutes);
  app.use('/api/v1/devices', deviceRoutes);
  app.use('/api/v1/users', userRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
