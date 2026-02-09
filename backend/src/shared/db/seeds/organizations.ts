import { AppDataSource } from "../connection.js";
import { Organization } from "../../models/organization.js";
import { logger } from "../../utils/logger.js";

/**
 * Seed organizations using check-before-insert pattern.
 * Safe to run multiple times — skips existing records.
 */
export async function seedOrganizations(): Promise<void> {
  const repo = AppDataSource.getRepository(Organization);

  const organizations = [
    {
      name: "Contoso Engineering",
      status: "active",
      plan: "enterprise",
      timezone: "America/New_York",
      settings: {
        features: {
          incidents: true,
          schedules: true,
          escalationPolicies: true,
          statusPages: true,
          analytics: true,
        },
      },
    },
  ];

  for (const orgData of organizations) {
    const existing = await repo.findOneBy({ name: orgData.name });
    if (existing) {
      logger.info(`Organization "${orgData.name}" already exists, skipping.`);
      continue;
    }

    const org = repo.create(orgData);
    await repo.save(org);
    logger.info(`Created organization "${orgData.name}".`);
  }
}
