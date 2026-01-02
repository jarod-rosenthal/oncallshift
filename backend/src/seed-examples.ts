#!/usr/bin/env ts-node
import 'dotenv/config';
import { seedOnCallShiftRunbooks } from './shared/db/seeds/oncallshift-runbooks';
import { getDataSource, closeDataSource } from './shared/db/data-source';
import { logger } from './shared/utils/logger';

async function main() {
  try {
    logger.info('Starting OnCallShift production runbooks seed...');

    // Initialize database connection
    await getDataSource();

    // Seed OnCallShift-specific runbooks
    await seedOnCallShiftRunbooks();

    logger.info('✅ OnCallShift runbooks seeded successfully!');

    // Close connection
    await closeDataSource();

    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Failed to seed OnCallShift runbooks', { error: error.message });
    process.exit(1);
  }
}

main();
