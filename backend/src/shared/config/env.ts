/**
 * Centralized environment configuration.
 * All env vars are read once at startup and validated.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? parseInt(value, 10) : fallback;
}

export const env = {
  /** Node environment */
  nodeEnv: optional("NODE_ENV", "development"),
  /** Is production */
  get isProduction() {
    return this.nodeEnv === "production";
  },
  /** Is test */
  get isTest() {
    return this.nodeEnv === "test";
  },

  /** Server port */
  port: optionalInt("PORT", 3000),

  /** CORS origins (comma-separated) */
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173"),

  /** Database URL */
  get databaseUrl() {
    return optional(
      "DATABASE_URL",
      "postgresql://oncallshift:localdev@localhost:5433/oncallshift",
    );
  },

  /** AWS region */
  awsRegion: optional("AWS_REGION", "us-east-2"),

  /** Cognito */
  cognitoUserPoolId: optional("COGNITO_USER_POOL_ID", ""),
  cognitoClientId: optional("COGNITO_CLIENT_ID", ""),

  /** SQS queue URLs */
  alertsQueueUrl: optional("ALERTS_QUEUE_URL", ""),
  notificationsQueueUrl: optional("NOTIFICATIONS_QUEUE_URL", ""),

  /** SES */
  sesFromEmail: optional("SES_FROM_EMAIL", "noreply@oncallshift.com"),

  /** SNS */
  snsPushTopicArn: optional("SNS_PUSH_TOPIC_ARN", ""),

  /** S3 */
  s3UploadsBucket: optional("S3_UPLOADS_BUCKET", ""),

  /** Encryption key */
  encryptionKey: optional("ENCRYPTION_KEY", ""),

  /** Log level */
  logLevel: optional("LOG_LEVEL", "info"),
} as const;

/**
 * Validate that critical env vars are set.
 * Call at startup in production; skip in dev/test for flexibility.
 */
export function validateEnv(): void {
  if (!env.isProduction) return;

  required("DATABASE_URL");
  required("COGNITO_USER_POOL_ID");
  required("COGNITO_CLIENT_ID");
  required("ALERTS_QUEUE_URL");
  required("NOTIFICATIONS_QUEUE_URL");
  required("ENCRYPTION_KEY");
}
