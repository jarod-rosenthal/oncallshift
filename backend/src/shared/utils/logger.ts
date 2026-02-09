import winston from "winston";

const { combine, timestamp, json, printf, colorize } = winston.format;

const isDevelopment = process.env.NODE_ENV !== "production";

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  format: isDevelopment ? devFormat : prodFormat,
  defaultMeta: { service: "oncallshift-api" },
  transports: [new winston.transports.Console()],
});
