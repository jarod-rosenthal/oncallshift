import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    aws: {
      region: "us-east-2",
      s3: {
        uploadsBucket: "oncallshift-prod-uploads",
      },
    },
  },
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Storage Service", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const s3Module = await import("@aws-sdk/client-s3");
    mockSend = (s3Module as any).__mockSend;
  });

  it("uploadFile uploads a file to S3", async () => {
    mockSend.mockResolvedValueOnce({});

    const { uploadFile } = await import("./storage.js");
    await uploadFile("uploads/test.png", Buffer.from("test"), "image/png");

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("getFile retrieves a file from S3", async () => {
    const mockBody = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("file-content");
      },
    };
    mockSend.mockResolvedValueOnce({ Body: mockBody });

    const { getFile } = await import("./storage.js");
    const result = await getFile("uploads/test.png");

    expect(result).toBeDefined();
    expect(result!.toString()).toBe("file-content");
  });

  it("getFile returns undefined when body is empty", async () => {
    mockSend.mockResolvedValueOnce({ Body: undefined });

    const { getFile } = await import("./storage.js");
    const result = await getFile("uploads/missing.png");

    expect(result).toBeUndefined();
  });

  it("deleteFile deletes a file from S3", async () => {
    mockSend.mockResolvedValueOnce({});

    const { deleteFile } = await import("./storage.js");
    await deleteFile("uploads/test.png");

    expect(mockSend).toHaveBeenCalledOnce();
  });
});
