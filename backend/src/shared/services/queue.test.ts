import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-sqs", () => {
  const mockSend = vi.fn();
  return {
    SQSClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    SendMessageCommand: vi.fn().mockImplementation((input) => ({ input })),
    ReceiveMessageCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteMessageCommand: vi.fn().mockImplementation((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    aws: {
      region: "us-east-2",
      sqs: {
        alertsQueueUrl: "https://sqs.us-east-2.amazonaws.com/123456789/oncallshift-prod-alerts",
        notificationsQueueUrl: "https://sqs.us-east-2.amazonaws.com/123456789/oncallshift-prod-notifications",
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

describe("Queue Service", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const sqsModule = await import("@aws-sdk/client-sqs");
    mockSend = (sqsModule as any).__mockSend;
  });

  it("sendMessage sends a message to the specified queue", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "msg-123" });

    const { sendMessage } = await import("./queue.js");
    const result = await sendMessage(
      "https://sqs.us-east-2.amazonaws.com/123456789/test-queue",
      { type: "test", data: "hello" },
    );

    expect(result).toBe("msg-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sendAlert sends to the alerts queue URL", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "alert-123" });

    const { sendAlert } = await import("./queue.js");
    const result = await sendAlert({ alertType: "critical", serviceId: "svc-1" });

    expect(result).toBe("alert-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sendNotification sends to the notifications queue URL", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "notif-123" });

    const { sendNotification } = await import("./queue.js");
    const result = await sendNotification({ userId: "user-1", message: "test" });

    expect(result).toBe("notif-123");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("receiveMessages receives messages from a queue", async () => {
    const mockMessages = [
      { MessageId: "msg-1", Body: '{"type":"test"}' },
      { MessageId: "msg-2", Body: '{"type":"test2"}' },
    ];
    mockSend.mockResolvedValueOnce({ Messages: mockMessages });

    const { receiveMessages } = await import("./queue.js");
    const messages = await receiveMessages(
      "https://sqs.us-east-2.amazonaws.com/123456789/test-queue",
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].MessageId).toBe("msg-1");
  });

  it("receiveMessages returns empty array when no messages", async () => {
    mockSend.mockResolvedValueOnce({ Messages: undefined });

    const { receiveMessages } = await import("./queue.js");
    const messages = await receiveMessages(
      "https://sqs.us-east-2.amazonaws.com/123456789/test-queue",
    );

    expect(messages).toHaveLength(0);
  });

  it("deleteMessage deletes a message from the queue", async () => {
    mockSend.mockResolvedValueOnce({});

    const { deleteMessage } = await import("./queue.js");
    await deleteMessage(
      "https://sqs.us-east-2.amazonaws.com/123456789/test-queue",
      "receipt-handle-123",
    );

    expect(mockSend).toHaveBeenCalledOnce();
  });
});
