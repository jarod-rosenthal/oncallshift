import 'dotenv/config';
import { createApp } from './app';
import { getDataSource } from '../shared/db/data-source';
import { logger } from '../shared/utils/logger';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    // Create Express app
    const app = createApp();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 API server started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
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
