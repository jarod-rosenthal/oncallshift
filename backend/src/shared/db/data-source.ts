import { DataSource } from 'typeorm';
import { getDbConfig } from './config';

// Import entities
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { Schedule } from '../models/Schedule';
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
    synchronize: false, // Use migrations in production
    logging: process.env.NODE_ENV === 'development',
    entities: [
      Organization,
      User,
      Service,
      Schedule,
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
