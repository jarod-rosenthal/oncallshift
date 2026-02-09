import "reflect-metadata";
import { config } from "dotenv";
config();

import { AppDataSource } from "./connection.js";
import { logger } from "../utils/logger.js";

async function migrate(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Running migrations...");

    const migrations = await AppDataSource.runMigrations();
    if (migrations.length === 0) {
      logger.info("No pending migrations.");
    } else {
      logger.info(`Applied ${migrations.length} migration(s):`, {
        migrations: migrations.map((m) => m.name),
      });
    }
  } catch (error) {
    logger.error("Migration failed", { error });
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

migrate();
