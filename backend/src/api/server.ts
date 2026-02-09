import { config } from "../shared/config/index.js";
import { app } from "./app.js";
import { logger } from "../shared/utils/logger.js";

const server = app.listen(config.port, () => {
  logger.info(`OnCallShift API server started`, {
    port: config.port,
    environment: config.nodeEnv,
  });
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
