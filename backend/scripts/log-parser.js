#!/usr/bin/env node
/**
 * Claude stream-json log parser
 *
 * Responsibilities:
 * - Pass through Claude stream-json lines to stdout (for display/logging)
 * - Capture token usage from the final message (input/output/cache tokens)
 * - Report usage to the Control Center API for accurate per-model billing
 *
 * Environment:
 *   TASK_ID        - AI worker task id
 *   API_BASE_URL   - e.g. https://api.oncallshift.com
 *   ORG_API_KEY    - org API key (Bearer)
 *   CLAUDE_MODEL   - model name (sonnet/opus/haiku)
 */

const readline = require('readline');

const taskId = process.env.TASK_ID;
const apiBaseUrl = process.env.API_BASE_URL;
const apiKey = process.env.ORG_API_KEY;
const model = process.env.CLAUDE_MODEL || 'sonnet';

const usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
};

function updateUsage(candidate) {
  if (!candidate || typeof candidate !== 'object') return;
  const usageNode =
    candidate.usage ||
    (candidate.message && candidate.message.usage) ||
    null;

  if (!usageNode) return;

  usage.inputTokens = Number(usageNode.input_tokens ?? usageNode.inputTokens ?? usage.inputTokens);
  usage.outputTokens = Number(usageNode.output_tokens ?? usageNode.outputTokens ?? usage.outputTokens);
  usage.cacheCreationTokens = Number(
    usageNode.cache_creation_input_tokens ??
      usageNode.cacheCreationTokens ??
      usage.cacheCreationTokens
  );
  usage.cacheReadTokens = Number(
    usageNode.cache_read_input_tokens ?? usageNode.cacheReadTokens ?? usage.cacheReadTokens
  );
}

async function reportUsage() {
  if (!taskId || !apiBaseUrl || !apiKey) {
    console.error('[log-parser] Missing env (TASK_ID, API_BASE_URL, ORG_API_KEY); skipping usage report');
    return;
  }

  const payload = {
    model,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    cacheCreationTokens: usage.cacheCreationTokens || 0,
    cacheReadTokens: usage.cacheReadTokens || 0,
  };

  const url = `${apiBaseUrl}/api/v1/ai-worker-tasks/${taskId}/usage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    console.error(`[log-parser] Reported usage for task ${taskId}:`, JSON.stringify(payload));
  } catch (err) {
    console.error('[log-parser] Failed to report usage:', err?.message || err);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    // Pass-through for downstream processing
    console.log(line);
    try {
      const parsed = JSON.parse(line);
      updateUsage(parsed);
    } catch {
      // ignore non-JSON lines
    }
  });

  rl.on('close', () => {
    reportUsage().finally(() => {
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('[log-parser] Fatal error:', err?.message || err);
  process.exit(1);
});
