import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-sns", () => {
  const mockSend = vi.fn();
  return {
    SNSClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    PublishCommand: vi.fn().mockImplementation((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    aws: {
      region: "us-east-2",
      sns: {
        pushTopicArn: "arn:aws:sns:us-east-2:123456789:oncallshift-prod-push-events",
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

describe("Push Notification Service", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const snsModule = await import("@aws-sdk/client-sns");
    mockSend = (snsModule as any).__mockSend;
  });

  it("publishToPushTopic publishes a notification to the SNS topic", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "sns-msg-123" });

    const { publishToPushTopic } = await import("./push.js");
    const result = await publishToPushTopic({
      title: "New Incident",
      body: "Critical alert on API Gateway",
    });

    expect(result).toBe("sns-msg-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("publishToPushTopic includes data payload", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "sns-msg-456" });

    const { publishToPushTopic } = await import("./push.js");
    const result = await publishToPushTopic({
      title: "Incident Update",
      body: "Incident #42 acknowledged",
      data: { incidentId: "inc-42", action: "acknowledged" },
    });

    expect(result).toBe("sns-msg-456");
  });

  it("sendToEndpoint sends a push notification to a specific device", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "sns-endpoint-123" });

    const { sendToEndpoint } = await import("./push.js");
    const result = await sendToEndpoint(
      "arn:aws:sns:us-east-2:123456789:endpoint/GCM/oncallshift/abc123",
      {
        title: "You've been paged",
        body: "Critical incident on Auth Service",
        data: { incidentId: "inc-99" },
      },
    );

    expect(result).toBe("sns-endpoint-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
