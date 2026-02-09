import { describe, it, expect, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    databaseUrl: "postgresql://test:test@localhost:5433/test",
    nodeEnv: "test",
  },
}));

describe("AppDataSource", () => {
  it("exports a DataSource configured with postgres", async () => {
    const { AppDataSource } = await import("./connection.js");

    expect(AppDataSource).toBeDefined();
    expect(AppDataSource.options.type).toBe("postgres");
    expect((AppDataSource.options as { url: string }).url).toBe(
      "postgresql://test:test@localhost:5433/test",
    );
  });

  it("has Organization entity registered", async () => {
    const { AppDataSource } = await import("./connection.js");
    const entities = AppDataSource.options.entities as Function[];

    expect(entities).toBeDefined();
    expect(entities.length).toBeGreaterThanOrEqual(1);

    const entityNames = entities.map((e) => (e as Function).name);
    expect(entityNames).toContain("Organization");
  });

  it("has synchronize disabled", async () => {
    const { AppDataSource } = await import("./connection.js");
    expect(AppDataSource.options.synchronize).toBe(false);
  });
});
