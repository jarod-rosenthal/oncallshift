import { DataSource } from "typeorm";
import { logger } from "../../utils/logger.js";

/**
 * Well-known seed IDs for cross-reference in subsequent seed files.
 * These are deterministic UUIDs so seeds are idempotent and can reference each other.
 */
export const SEED_ORG_ID = "00000000-0000-4000-8000-000000000001";

interface SeedOrganization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  settings: object;
}

const ORGANIZATIONS: SeedOrganization[] = [
  {
    id: SEED_ORG_ID,
    name: "Contoso Engineering",
    slug: "contoso-engineering",
    plan: "professional",
    status: "active",
    timezone: "America/New_York",
    settings: {
      defaultUrgency: "high",
      autoResolveTimeout: 240,
      acknowledgementTimeout: 30,
    },
  },
];

/**
 * Seed organizations using raw SQL (check-before-insert pattern).
 * Works even before TypeORM entity models are created — uses raw queries
 * against the organizations table (which will be created by migration in Phase 1.1).
 *
 * This function is a no-op if the organizations table doesn't exist yet.
 */
export async function seedOrganizations(dataSource: DataSource): Promise<void> {
  // Check if the organizations table exists
  const tableExists = await dataSource.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'organizations'
    ) AS "exists"
  `);

  if (!tableExists[0]?.exists) {
    logger.info("Skipping organization seed: table does not exist yet");
    return;
  }

  for (const org of ORGANIZATIONS) {
    const existing = await dataSource.query(
      `SELECT id FROM organizations WHERE id = $1`,
      [org.id],
    );

    if (existing.length === 0) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, plan, status, timezone, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          org.id,
          org.name,
          org.slug,
          org.plan,
          org.status,
          org.timezone,
          JSON.stringify(org.settings),
        ],
      );
      logger.info(`Seeded organization: ${org.name}`);
    } else {
      logger.info(`Organization already exists: ${org.name}`);
    }
  }
}
