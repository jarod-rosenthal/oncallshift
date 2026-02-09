import "reflect-metadata";
import { DataSource } from "typeorm";

const databaseUrl = process.env.DATABASE_URL || "postgresql://oncallshift:localdev@localhost:5433/oncallshift";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: databaseUrl,
  synchronize: false,
  logging: process.env.NODE_ENV !== "production",
  entities: [],
  migrations: [],
  subscribers: [],
});
