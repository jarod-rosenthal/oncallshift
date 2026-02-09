import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizations1700000001 implements MigrationInterface {
  name = "CreateOrganizations1700000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        plan VARCHAR(50) NOT NULL DEFAULT 'free',
        settings JSONB NOT NULL DEFAULT '{}',
        timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS organizations;`);
  }
}
