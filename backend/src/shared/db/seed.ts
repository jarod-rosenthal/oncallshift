import { AppDataSource } from "./connection.js";
import { logger } from "../utils/logger.js";

/**
 * Idempotent seed framework.
 * Uses check-before-insert pattern: SELECT existence → INSERT only if missing.
 * Safe to run multiple times without duplicates or errors.
 * Ordered by dependency: organizations → users → teams → services → etc.
 *
 * Each phase extends this file with new seed data as models are created.
 */
async function seed(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Starting seed...");

    // Phase 0.2: Organization seed will be added in Story 6
    // Phase 1.1: Users and teams
    // Phase 2.1: Services
    // Phase 2.2: Schedules
    // Phase 2.3: Escalation policies
    // Phase 3.2: Incidents
    // Phase 3.3: Notifications

    logger.info("Seed completed successfully.");
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error("Seed failed:", { error });
    process.exit(1);
  }
}

seed();
