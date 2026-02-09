import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "../config/index.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.database.url,
  entities: [
    // Entities will be registered here as they are created in subsequent phases
  ],
  migrations: ["src/shared/db/migrations/*.js"],
  synchronize: false,
  logging: config.isProduction ? ["error"] : ["error", "warn"],
  ssl: config.isProduction ? { rejectUnauthorized: false } : false,
});
