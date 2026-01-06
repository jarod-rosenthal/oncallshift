import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
}

let cachedConfig: DbConfig | null = null;

export async function getDbConfig(): Promise<DbConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check if DATABASE_URL is provided (can be URL string or JSON object from Secrets Manager)
  const directUrl = process.env.DATABASE_URL;
  if (directUrl) {
    // Try to parse as JSON first (for ECS with Secrets Manager)
    try {
      const secret = JSON.parse(directUrl);
      if (secret.host && secret.username && secret.password) {
        cachedConfig = {
          host: secret.host,
          port: secret.port || 5432,
          username: secret.username,
          password: secret.password,
          database: secret.dbname || secret.database,
          ssl: true, // Always use SSL for RDS connections
        };
        return cachedConfig;
      }
    } catch {
      // Not JSON, try parsing as URL
    }

    // Parse as postgres:// URL (for local development)
    cachedConfig = parseDatabaseUrl(directUrl);
    return cachedConfig;
  }

  // Fetch from AWS Secrets Manager using DATABASE_SECRET_ARN
  const secretArn = process.env.DATABASE_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DATABASE_URL or DATABASE_SECRET_ARN must be set');
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const command = new GetSecretValueCommand({ SecretId: secretArn });

  try {
    const response = await client.send(command);
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    cachedConfig = {
      host: secret.host,
      port: secret.port || 5432,
      username: secret.username,
      password: secret.password,
      database: secret.dbname || secret.database,
    };

    return cachedConfig;
  } catch (error) {
    console.error('Error fetching database config:', error);
    throw error;
  }
}

function parseDatabaseUrl(url: string): DbConfig {
  // Parse postgres://username:password@host:port/database?sslmode=require
  const match = url.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(?:\?(.+))?/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  // Parse query parameters
  const queryString = match[6];
  let ssl = false;

  if (queryString) {
    const params = new URLSearchParams(queryString);
    const sslMode = params.get('sslmode');
    // Enable SSL if sslmode is set to anything other than 'disable'
    ssl = sslMode !== null && sslMode !== 'disable';
  }

  return {
    username: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
    ssl,
  };
}
