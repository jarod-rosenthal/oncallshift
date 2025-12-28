import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pagerduty-lite' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// If we're in production, don't log to console with colors
if (process.env.NODE_ENV === 'production') {
  logger.transports = [
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  ];
}
