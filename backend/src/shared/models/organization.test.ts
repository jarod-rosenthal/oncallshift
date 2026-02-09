import { describe, it, expect } from "vitest";
import { getMetadataArgsStorage } from "typeorm";
import { Organization } from "./organization.js";

describe("Organization entity", () => {
  it("is decorated as an entity targeting 'organizations' table", () => {
    const tables = getMetadataArgsStorage().tables;
    const orgTable = tables.find((t) => t.target === Organization);

    expect(orgTable).toBeDefined();
    expect(orgTable!.name).toBe("organizations");
  });

  it("has expected columns", () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Organization,
    );
    const columnNames = columns.map((c) => c.propertyName);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("plan");
    expect(columnNames).toContain("settings");
    expect(columnNames).toContain("timezone");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");
  });

  it("can be instantiated", () => {
    const org = new Organization();
    expect(org).toBeInstanceOf(Organization);
  });
});
