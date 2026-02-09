import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-ses", () => {
  const mockSend = vi.fn();
  return {
    SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    SendEmailCommand: vi.fn().mockImplementation((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    aws: {
      region: "us-east-2",
      ses: {
        fromEmail: "noreply@oncallshift.com",
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

describe("Email Service", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const sesModule = await import("@aws-sdk/client-ses");
    mockSend = (sesModule as any).__mockSend;
  });

  it("sendEmail sends an email with HTML body", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-123" });

    const { sendEmail } = await import("./email.js");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test Alert",
      html: "<h1>Alert!</h1>",
    });

    expect(result).toBe("ses-msg-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sendEmail handles multiple recipients", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-456" });

    const { sendEmail } = await import("./email.js");
    const result = await sendEmail({
      to: ["user1@example.com", "user2@example.com"],
      subject: "Team Alert",
      html: "<h1>Alert!</h1>",
    });

    expect(result).toBe("ses-msg-456");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sendEmail includes text body when provided", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-789" });

    const { sendEmail } = await import("./email.js");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>HTML</p>",
      text: "Plain text",
    });

    expect(result).toBe("ses-msg-789");
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
