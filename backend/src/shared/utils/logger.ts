import { createLogger, format, transports } from "winston";

const isTest = process.env.NODE_ENV === "test";

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  silent: isTest,
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    format.errors({ stack: true }),
    process.env.NODE_ENV === "production"
      ? format.json()
      : format.combine(format.colorize(), format.simple()),
  ),
  defaultMeta: { service: "oncallshift-api" },
  transports: [new transports.Console()],
});
