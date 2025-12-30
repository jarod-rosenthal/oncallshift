import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createDataSource } from './data-source';
import { logger } from '../utils/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migration...');

    const dataSource = await createDataSource();
    await dataSource.initialize();

    logger.info('Database connected successfully');

    // Get all migration files sorted by name
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration files`);

    // Run each migration in order
    for (const migrationFile of migrationFiles) {
      const migrationPath = join(migrationsDir, migrationFile);
      const migrationSql = readFileSync(migrationPath, 'utf8');

      logger.info(`Running migration: ${migrationFile}`);
      await dataSource.query(migrationSql);
      logger.info(`✅ Completed: ${migrationFile}`);
    }

    logger.info('✅ All migrations completed successfully!');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
