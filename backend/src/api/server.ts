import "reflect-metadata";
import { config } from "../shared/config/index.js";
import { createApp } from "./app.js";
import { AppDataSource } from "../shared/db/connection.js";
import { logger } from "../shared/utils/logger.js";

async function start(): Promise<void> {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info("Database connection established");

    // Run pending migrations
    const pendingMigrations = await AppDataSource.runMigrations();
    if (pendingMigrations.length > 0) {
      logger.info(`Ran ${pendingMigrations.length} migration(s)`);
    }

    // Create and start Express app
    const app = createApp();

    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        env: config.nodeEnv,
        port: config.port,
      });
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down...");
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

start();
