import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDataSource } from './data-source';
import { logger } from '../utils/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migration...');

    const dataSource = await createDataSource();
    await dataSource.initialize();

    logger.info('Database connected successfully');

    // Read migration SQL file
    const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
    const migrationSql = readFileSync(migrationPath, 'utf8');

    // Run migration
    logger.info('Running migration: 001_initial_schema.sql');
    await dataSource.query(migrationSql);

    logger.info('✅ Migration completed successfully!');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
