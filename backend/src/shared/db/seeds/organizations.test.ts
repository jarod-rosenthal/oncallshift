import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindOneBy = vi.fn();
const mockCreate = vi.fn();
const mockSave = vi.fn();

vi.mock("../connection.js", () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      findOneBy: mockFindOneBy,
      create: mockCreate,
      save: mockSave,
    })),
  },
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { seedOrganizations } from "./organizations.js";

describe("seedOrganizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates organization when it does not exist", async () => {
    mockFindOneBy.mockResolvedValue(null);
    mockCreate.mockImplementation((data: unknown) => data);
    mockSave.mockResolvedValue(undefined);

    await seedOrganizations();

    expect(mockFindOneBy).toHaveBeenCalledWith({ name: "Contoso Engineering" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Contoso Engineering" }),
    );
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("skips organization when it already exists (idempotent)", async () => {
    mockFindOneBy.mockResolvedValue({ id: "existing-id", name: "Contoso Engineering" });

    await seedOrganizations();

    expect(mockFindOneBy).toHaveBeenCalledWith({ name: "Contoso Engineering" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
