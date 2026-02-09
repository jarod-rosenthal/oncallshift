import "reflect-metadata";
import { config } from "dotenv";
config();

import app from "./app.js";
import { env, validateEnv } from "../shared/config/env.js";
import { logger } from "../shared/utils/logger.js";
import { AppDataSource } from "../shared/db/connection.js";

validateEnv();

async function start(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Database connected.");
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`OnCallShift API listening on :${env.port}`, {
      port: env.port,
      nodeEnv: env.nodeEnv,
    });
  });
}

start();
