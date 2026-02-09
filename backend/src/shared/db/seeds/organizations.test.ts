import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedOrganizations, SEED_ORG_ID } from "./organizations.js";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockDataSource() {
  return {
    query: vi.fn(),
  } as any;
}

describe("seedOrganizations", () => {
  let mockDataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  it("skips seeding when organizations table does not exist", async () => {
    mockDataSource.query.mockResolvedValueOnce([{ exists: false }]);

    await seedOrganizations(mockDataSource);

    // Only the table existence check should have been called
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.tables"),
    );
  });

  it("inserts organization when it does not exist", async () => {
    // Table exists
    mockDataSource.query.mockResolvedValueOnce([{ exists: true }]);
    // Organization does not exist
    mockDataSource.query.mockResolvedValueOnce([]);
    // Insert succeeds
    mockDataSource.query.mockResolvedValueOnce(undefined);

    await seedOrganizations(mockDataSource);

    expect(mockDataSource.query).toHaveBeenCalledTimes(3);
    // Verify SELECT check
    expect(mockDataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT id FROM organizations"),
      [SEED_ORG_ID],
    );
    // Verify INSERT
    expect(mockDataSource.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO organizations"),
      expect.arrayContaining([SEED_ORG_ID, "Contoso Engineering"]),
    );
  });

  it("skips insert when organization already exists (idempotent)", async () => {
    // Table exists
    mockDataSource.query.mockResolvedValueOnce([{ exists: true }]);
    // Organization already exists
    mockDataSource.query.mockResolvedValueOnce([{ id: SEED_ORG_ID }]);

    await seedOrganizations(mockDataSource);

    // Should only have table check + existence check, no insert
    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
  });

  it("exports a deterministic SEED_ORG_ID", () => {
    expect(SEED_ORG_ID).toBe("00000000-0000-4000-8000-000000000001");
  });
});
