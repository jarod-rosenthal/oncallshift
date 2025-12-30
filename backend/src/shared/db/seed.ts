import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDataSource } from './data-source';
import { logger } from '../utils/logger';

async function runSeeds() {
  try {
    logger.info('Starting database seeding...');

    const dataSource = await createDataSource();
    await dataSource.initialize();

    logger.info('Database connected successfully');

    // Read and run seed files in order
    const seedFiles = [
      '001_test_data.sql',
      '002_add_jarod.sql',
    ];

    for (const seedFile of seedFiles) {
      const seedPath = join(__dirname, 'seeds', seedFile);
      const seedSql = readFileSync(seedPath, 'utf8');

      logger.info(`Running seed: ${seedFile}`);
      await dataSource.query(seedSql);
      logger.info(`✅ Seed ${seedFile} completed`);
    }

    logger.info('✅ All seeds completed successfully!');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

runSeeds();
