import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  port: parseInt(optional("PORT", "3000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),

  database: {
    url: required("DATABASE_URL"),
  },

  cognito: {
    userPoolId: required("COGNITO_USER_POOL_ID"),
    clientId: required("COGNITO_CLIENT_ID"),
    region: optional("AWS_REGION", "us-east-2"),
  },

  sqs: {
    alertsQueueUrl: required("ALERTS_QUEUE_URL"),
    notificationsQueueUrl: required("NOTIFICATIONS_QUEUE_URL"),
    region: optional("AWS_REGION", "us-east-2"),
  },

  ses: {
    fromEmail: required("SES_FROM_EMAIL"),
    region: optional("AWS_REGION", "us-east-2"),
  },

  sns: {
    pushTopicArn: required("SNS_PUSH_TOPIC_ARN"),
    region: optional("AWS_REGION", "us-east-2"),
  },

  s3: {
    uploadsBucket: required("S3_UPLOADS_BUCKET"),
    region: optional("AWS_REGION", "us-east-2"),
  },

  cors: {
    origins: optional("CORS_ORIGINS", "http://localhost:5173").split(","),
  },

  aws: {
    region: optional("AWS_REGION", "us-east-2"),
  },
} as const;
