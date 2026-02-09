import { DataSource } from "typeorm";
import { env } from "../config/env.js";
import { Organization } from "../models/organization.js";

/**
 * TypeORM DataSource — single connection shared across the app.
 * Entities must be registered here (import the class, add to the array).
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.databaseUrl,
  entities: [Organization],
  synchronize: false,
  logging: env.nodeEnv === "development" ? ["error", "warn"] : ["error"],
  migrations: ["src/shared/db/migrations/*.ts"],
  migrationsTableName: "typeorm_migrations",
});
