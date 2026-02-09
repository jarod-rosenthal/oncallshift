import "reflect-metadata";
import { config } from "dotenv";
config();

import { AppDataSource } from "./connection.js";
import { logger } from "../utils/logger.js";
import { seedOrganizations } from "./seeds/organizations.js";

/**
 * Seed runner — executes all seed functions in dependency order.
 *
 * Each seed function is idempotent: it checks for existing records
 * before inserting, so `npm run seed` is safe to run multiple times.
 *
 * Dependency order:
 *   1. Organizations
 *   2. Users (Phase 1.1)
 *   3. Teams + memberships (Phase 1.1)
 *   4. Services + dependencies (Phase 2.1)
 *   5. Schedules + layers + overrides (Phase 2.2)
 *   6. Escalation policies (Phase 2.3)
 *   7. Incidents + events + responders (Phase 3.2)
 *   8. Notifications + contact methods (Phase 3.3)
 */
async function seed(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Starting seed...");

    // Phase 0.2
    await seedOrganizations();

    // Future phases add seed calls here in dependency order:
    // Phase 1.1: await seedUsers();
    // Phase 1.1: await seedTeams();
    // Phase 2.1: await seedServices();
    // Phase 2.2: await seedSchedules();
    // Phase 2.3: await seedEscalationPolicies();
    // Phase 3.2: await seedIncidents();
    // Phase 3.3: await seedNotifications();

    logger.info("Seed completed successfully.");
  } catch (error) {
    logger.error("Seed failed", { error });
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

seed();
