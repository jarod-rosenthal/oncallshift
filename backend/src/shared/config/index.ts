import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  database: {
    url: process.env.DATABASE_URL || "postgresql://oncallshift:localdev@localhost:5433/oncallshift",
  },

  aws: {
    region: process.env.AWS_REGION || "us-east-2",
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || "",
      clientId: process.env.COGNITO_CLIENT_ID || "",
    },
    sqs: {
      alertsQueueUrl: process.env.ALERTS_QUEUE_URL || "",
      notificationsQueueUrl: process.env.NOTIFICATIONS_QUEUE_URL || "",
    },
    ses: {
      fromEmail: process.env.SES_FROM_EMAIL || "noreply@oncallshift.com",
    },
    sns: {
      pushTopicArn: process.env.SNS_PUSH_TOPIC_ARN || "",
    },
    s3: {
      uploadsBucket: process.env.S3_UPLOADS_BUCKET || "",
    },
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || "http://localhost:5173").split(","),
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || "",
  },
} as const;
