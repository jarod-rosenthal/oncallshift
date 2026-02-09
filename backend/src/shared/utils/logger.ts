import winston from "winston";

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === "production";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "ISO" }),
    json(),
  ),
  defaultMeta: { service: "oncallshift-api" },
  transports: [
    new winston.transports.Console({
      format: isProduction ? combine(timestamp(), json()) : combine(colorize(), simple()),
    }),
  ],
});
