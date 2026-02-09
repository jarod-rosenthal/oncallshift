import "reflect-metadata";
import { AppDataSource } from "./connection.js";
import { logger } from "../utils/logger.js";

async function runMigrations(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Running migrations...");
    const migrations = await AppDataSource.runMigrations();
    logger.info(`Executed ${migrations.length} migration(s)`);
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error("Migration failed", { error });
    process.exit(1);
  }
}

runMigrations();
