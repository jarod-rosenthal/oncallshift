import 'dotenv/config';
import { createApp } from './app';
import { getDataSource } from '../shared/db/data-source';
import { logger } from '../shared/utils/logger';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection (optional for local dev)
    if (process.env.DATABASE_URL || process.env.DB_HOST) {
      logger.info('Connecting to database...');
      await getDataSource();
      logger.info('Database connected successfully');
    } else {
      logger.warn('No database configured - running without database connection');
      logger.warn('API endpoints that require database will fail');
      logger.warn('To enable database: set DATABASE_URL or DB_HOST environment variable');
    }

    // Create Express app
    const app = createApp();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 API server started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Frontend: http://localhost:${PORT}/`);
      logger.info(`Demo: http://localhost:${PORT}/demo`);
      logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
