#!/usr/bin/env node
/**
 * AI Worker Log Parser
 *
 * Reads Claude CLI's streaming JSON output and extracts tool events.
 * Sends structured events to the OnCallShift API for learning analysis.
 *
 * Usage:
 *   claude ... | tee output.log | node /app/scripts/log-parser.js
 *
 * Environment variables:
 *   - TASK_ID: Required. The AI worker task ID
 *   - ORG_ID: Required. The organization ID
 *   - API_BASE_URL: Required. OnCallShift API base URL
 *   - ORG_API_KEY: Required. Organization API key for authentication
 *   - BATCH_SIZE: Optional. Number of events to batch before sending (default: 10)
 *   - BATCH_TIMEOUT_MS: Optional. Max time to wait before flushing batch (default: 5000)
 */

const https = require("https");
const http = require("http");
const readline = require("readline");
const crypto = require("crypto");

// Configuration
const TASK_ID = process.env.TASK_ID;
const ORG_ID = process.env.ORG_ID;
const API_BASE_URL = process.env.API_BASE_URL || "https://oncallshift.com";
const ORG_API_KEY = process.env.ORG_API_KEY;
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
const BATCH_TIMEOUT_MS = parseInt(process.env.BATCH_TIMEOUT_MS || "5000", 10);

// Check if we have valid auth (either internal key or org API key)
const hasValidAuth = INTERNAL_SERVICE_KEY || ORG_API_KEY;

// Validate required env vars
if (!TASK_ID || !ORG_ID) {
  console.error(
    "[log-parser] Missing required env vars: TASK_ID, ORG_ID",
  );
  // Don't exit - just pass through stdin to stdout
}
if (!hasValidAuth) {
  console.error(
    "[log-parser] Missing auth: need INTERNAL_SERVICE_KEY or ORG_API_KEY",
  );
}

// State
let sequenceNumber = 0;
let eventBatch = [];
let batchTimeout = null;
let pendingToolUse = null; // Track current tool_use waiting for result
let errorCount = 0;
let retryCount = 0;

// Token usage tracking (accumulated across all messages)
const tokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};
let modelUsed = process.env.CLAUDE_MODEL || "sonnet";

/**
 * Classify error type from error message
 */
function classifyError(errorMessage) {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();

  if (
    lower.includes("permission denied") ||
    lower.includes("eacces") ||
    lower.includes("operation not permitted")
  ) {
    return "permission";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  if (
    lower.includes("not found") ||
    lower.includes("no such file") ||
    lower.includes("enoent") ||
    lower.includes("command not found")
  ) {
    return "not_found";
  }
  if (
    lower.includes("syntax error") ||
    lower.includes("unexpected token") ||
    lower.includes("parse error")
  ) {
    return "syntax";
  }
  if (
    lower.includes("git") ||
    lower.includes("fatal:") ||
    lower.includes("merge conflict")
  ) {
    return "git";
  }
  if (
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("connection refused")
  ) {
    return "network";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("403") ||
    lower.includes("401") ||
    lower.includes("authentication")
  ) {
    return "auth";
  }
  return null;
}

/**
 * Classify tool category
 */
function classifyToolCategory(toolName) {
  const fileTools = ["Read", "Write", "Edit", "NotebookEdit"];
  const shellTools = ["Bash", "KillShell"];
  const searchTools = ["Glob", "Grep", "WebSearch", "WebFetch"];

  if (fileTools.includes(toolName)) return "file";
  if (shellTools.includes(toolName)) return "shell";
  if (searchTools.includes(toolName)) return "search";
  return "other";
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLen = 2000) {
  if (!str) return null;
  const s = typeof str === "string" ? str : JSON.stringify(str);
  return s.length > maxLen ? s.substring(0, maxLen) + "...[truncated]" : s;
}

/**
 * Create SHA256 hash of input for deduplication
 */
function hashInput(input) {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Send events to API
 */
async function sendEvents(events) {
  if (!TASK_ID || !ORG_ID || !ORG_API_KEY || events.length === 0) {
    return;
  }

  const url = `${API_BASE_URL}/api/v1/super-admin/control-center/tool-events`;
  const body = JSON.stringify({ events });

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ORG_API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            console.error(
              `[log-parser] Failed to send events: ${res.statusCode} ${data}`,
            );
          }
          resolve();
        });
      },
    );

    req.on("error", (err) => {
      console.error(`[log-parser] Error sending events: ${err.message}`);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

/**
 * Flush event batch to API
 */
async function flushBatch() {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  if (eventBatch.length === 0) return;

  const events = [...eventBatch];
  eventBatch = [];

  await sendEvents(events);
}

/**
 * Add event to batch, flush if needed
 */
function addEvent(event) {
  eventBatch.push(event);

  if (eventBatch.length >= BATCH_SIZE) {
    flushBatch();
  } else if (!batchTimeout) {
    batchTimeout = setTimeout(flushBatch, BATCH_TIMEOUT_MS);
  }
}

/**
 * Process a tool_use event
 */
function processToolUse(data) {
  sequenceNumber++;

  pendingToolUse = {
    id: data.id,
    name: data.name,
    input: data.input,
    inputSummary: truncate(data.input),
    inputHash: hashInput(data.input),
    sequenceNumber,
    startedAt: new Date().toISOString(),
    attemptNumber: 1, // Will be updated if we detect retries
  };

  // Check for retry pattern (same tool with similar input recently)
  // This is a simple heuristic - could be improved
}

/**
 * Process a tool_result event
 */
function processToolResult(data) {
  if (!pendingToolUse) {
    // Result without matching use - skip
    return;
  }

  const completedAt = new Date().toISOString();
  const startedAt = new Date(pendingToolUse.startedAt);
  const durationMs = Date.now() - startedAt.getTime();

  const isError = data.is_error === true;
  let errorMessage = null;
  let errorType = null;

  if (isError) {
    errorMessage = truncate(data.content || data.error);
    errorType = classifyError(errorMessage);
    errorCount++;
  }

  // Detect if this looks like a retry (same tool, failed before)
  // Simple heuristic: if we've seen errors, subsequent attempts are retries
  let attemptNumber = 1;
  if (errorCount > 0 && !isError) {
    // This succeeded after previous errors - likely a retry that worked
    retryCount++;
    attemptNumber = errorCount + 1;
  }

  const event = {
    taskId: TASK_ID,
    orgId: ORG_ID,
    toolName: pendingToolUse.name,
    toolCategory: classifyToolCategory(pendingToolUse.name),
    inputSummary: pendingToolUse.inputSummary,
    inputHash: pendingToolUse.inputHash,
    outputSummary: truncate(data.content),
    success: !isError,
    errorType,
    errorMessage,
    sequenceNumber: pendingToolUse.sequenceNumber,
    attemptNumber,
    startedAt: pendingToolUse.startedAt,
    completedAt,
    durationMs,
  };

  addEvent(event);
  pendingToolUse = null;
}

/**
 * Extract and accumulate token usage from a JSON object
 * Handles various formats that Claude CLI might output
 */
function extractUsage(data) {
  // Try various paths where usage might be located
  const usagePaths = [
    data.usage,
    data.message?.usage,
    data.result?.usage,
    data.delta?.usage,
    data.content_block?.usage,
  ];

  for (const usage of usagePaths) {
    if (usage && typeof usage === "object") {
      // Accumulate tokens (Claude reports cumulative, so take max)
      if (typeof usage.input_tokens === "number") {
        tokenUsage.inputTokens = Math.max(tokenUsage.inputTokens, usage.input_tokens);
      }
      if (typeof usage.output_tokens === "number") {
        tokenUsage.outputTokens = Math.max(tokenUsage.outputTokens, usage.output_tokens);
      }
      if (typeof usage.cache_creation_input_tokens === "number") {
        tokenUsage.cacheCreationInputTokens = Math.max(
          tokenUsage.cacheCreationInputTokens,
          usage.cache_creation_input_tokens
        );
      }
      if (typeof usage.cache_read_input_tokens === "number") {
        tokenUsage.cacheReadInputTokens = Math.max(
          tokenUsage.cacheReadInputTokens,
          usage.cache_read_input_tokens
        );
      }
      return true; // Found usage
    }
  }
  return false;
}

/**
 * Process a line of output from Claude CLI
 */
function processLine(line) {
  // Pass through to stdout (for tee to capture full output)
  console.log(line);

  // Try to parse as JSON
  try {
    const data = JSON.parse(line);

    // Extract token usage from any event that has it
    extractUsage(data);

    // Track model if specified
    if (data.model) {
      modelUsed = data.model;
    }

    // Check for tool_use content block
    if (data.type === "content_block_start" && data.content_block?.type === "tool_use") {
      processToolUse(data.content_block);
    }

    // Check for tool_result
    if (data.type === "tool_result") {
      processToolResult(data);
    }

    // Also check for message content with tool_use
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "tool_use") {
          processToolUse(block);
        }
        if (block.type === "tool_result") {
          processToolResult(block);
        }
      }
    }

    // Check message-level content
    if (data.message?.content && Array.isArray(data.message.content)) {
      for (const block of data.message.content) {
        if (block.type === "tool_use") {
          processToolUse(block);
        }
      }
    }
  } catch {
    // Not JSON - that's fine, just pass through
  }
}

/**
 * Send token usage to the API
 *
 * Note: Cost calculation is done server-side using the shared pricing config.
 * This function only reports raw token counts.
 */
async function sendTokenUsage() {
  // Always output structured markers for orchestrator backup parsing
  // These go to stdout which ends up in CloudWatch logs
  console.log(`::input_tokens::${tokenUsage.inputTokens}`);
  console.log(`::output_tokens::${tokenUsage.outputTokens}`);
  console.log(`::cache_creation_tokens::${tokenUsage.cacheCreationInputTokens}`);
  console.log(`::cache_read_tokens::${tokenUsage.cacheReadInputTokens}`);
  console.log(`::model::${modelUsed}`);

  // Log to stderr for visibility
  console.error(`[log-parser] Token usage: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}, cache_create=${tokenUsage.cacheCreationInputTokens}, cache_read=${tokenUsage.cacheReadInputTokens}`);
  console.error(`[log-parser] Model: ${modelUsed}`);

  // Skip API call if no auth available
  if (!TASK_ID || !hasValidAuth) {
    console.error(`[log-parser] Skipping API call - no valid auth`);
    return;
  }

  const url = `${API_BASE_URL}/api/v1/ai-worker-tasks/${TASK_ID}/usage`;
  const body = JSON.stringify({
    model: modelUsed,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    cacheCreationTokens: tokenUsage.cacheCreationInputTokens,
    cacheReadTokens: tokenUsage.cacheReadInputTokens,
  });

  // Build headers - prefer internal key, fallback to org API key
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };
  if (INTERNAL_SERVICE_KEY) {
    headers["X-Internal-Key"] = INTERNAL_SERVICE_KEY;
  } else if (ORG_API_KEY) {
    headers["Authorization"] = `Bearer ${ORG_API_KEY}`;
  }

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.request(
      url,
      {
        method: "POST",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.error(`[log-parser] Token usage reported successfully`);
          } else {
            console.error(`[log-parser] Failed to report token usage: ${res.statusCode} ${data}`);
          }
          resolve();
        });
      },
    );

    req.on("error", (err) => {
      console.error(`[log-parser] Error reporting token usage: ${err.message}`);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send final summary when done
 */
async function sendSummary() {
  // Flush any remaining events
  await flushBatch();

  // Send token usage first (most important for cost tracking)
  await sendTokenUsage();

  // Send task summary update
  if (!TASK_ID || !ORG_ID || !ORG_API_KEY) return;

  const url = `${API_BASE_URL}/api/v1/super-admin/control-center/tasks/${TASK_ID}/tool-summary`;
  const body = JSON.stringify({
    toolErrorCount: errorCount,
    toolRetryCount: retryCount,
    totalToolCalls: sequenceNumber,
  });

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.request(
      url,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ORG_API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", resolve);
      },
    );

    req.on("error", () => resolve());
    req.write(body);
    req.end();
  });
}

// Main: read stdin line by line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", processLine);

rl.on("close", async () => {
  await sendSummary();
  process.exit(0);
});

// Handle SIGTERM/SIGINT gracefully
process.on("SIGTERM", async () => {
  await sendSummary();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await sendSummary();
  process.exit(0);
});
