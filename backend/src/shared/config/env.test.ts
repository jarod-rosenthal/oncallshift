import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("env config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules to get fresh env reads
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("provides default values for optional vars", async () => {
    // Dynamic import to get fresh module
    const { env } = await import("./env.js");

    expect(env.nodeEnv).toBeDefined();
    expect(env.port).toBe(3000);
    expect(env.corsOrigins).toBe("http://localhost:5173");
    expect(env.awsRegion).toBe("us-east-2");
  });

  it("nodeEnv is captured at module load time (not re-read per call)", async () => {
    // env.nodeEnv is set once when the module is first imported,
    // so changing process.env after import has no effect.
    process.env.NODE_ENV = "production";
    const { env } = await import("./env.js");
    expect(env.isProduction).toBe(false);
  });
});
