import { DataSource } from 'typeorm';
import { getDbConfig } from './config';

// Import entities
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { Schedule } from '../models/Schedule';
import { ScheduleMember } from '../models/ScheduleMember';
import { EscalationPolicy } from '../models/EscalationPolicy';
import { EscalationStep } from '../models/EscalationStep';
import { Incident } from '../models/Incident';
import { IncidentEvent } from '../models/IncidentEvent';
import { Notification } from '../models/Notification';
import { DeviceToken } from '../models/DeviceToken';

export async function createDataSource(): Promise<DataSource> {
  const dbConfig = await getDbConfig();

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    synchronize: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev', // Auto-create tables in dev, use migrations in production
    logging: process.env.NODE_ENV === 'development',
    entities: [
      Organization,
      User,
      Service,
      Schedule,
      ScheduleMember,
      EscalationPolicy,
      EscalationStep,
      Incident,
      IncidentEvent,
      Notification,
      DeviceToken,
    ],
    migrations: ['src/shared/db/migrations/*.ts'],
    subscribers: [],
  });

  return dataSource;
}

// Global data source instance
let appDataSource: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (!appDataSource) {
    appDataSource = await createDataSource();
    await appDataSource.initialize();
  }
  return appDataSource;
}

export async function closeDataSource(): Promise<void> {
  if (appDataSource?.isInitialized) {
    await appDataSource.destroy();
    appDataSource = null;
  }
}
