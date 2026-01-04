#!/bin/bash
set -e

# AI Worker Entrypoint Script
# This script runs inside the Fargate container to execute a Jira task

echo "[AI Worker] Starting..."
echo "Task ID: ${TASK_ID}"
echo "Jira Issue: ${JIRA_ISSUE_KEY}"
echo "Persona: ${WORKER_PERSONA}"
echo "Repository: ${GITHUB_REPO}"
echo "Retry Number: ${RETRY_NUMBER:-0}"

# Heartbeat configuration
HEARTBEAT_INTERVAL=60
HEARTBEAT_PID=""

# Jira API helper function
add_jira_comment() {
    local comment="$1"
    if [ -z "${JIRA_BASE_URL}" ] || [ -z "${JIRA_EMAIL}" ] || [ -z "${JIRA_API_TOKEN}" ]; then
        echo "[Jira] Skipping comment - credentials not configured"
        return 0
    fi

    local auth=$(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)
    local body=$(cat <<EOF
{
  "body": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "${comment}"
          }
        ]
      }
    ]
  }
}
EOF
)

    curl -s -X POST "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/comment" \
        -H "Authorization: Basic ${auth}" \
        -H "Content-Type: application/json" \
        -d "${body}" > /dev/null 2>&1 && echo "[Jira] Comment added" || echo "[Jira] Failed to add comment"
}

# Transition Jira issue to "In Progress"
transition_jira_to_progress() {
    if [ -z "${JIRA_BASE_URL}" ] || [ -z "${JIRA_EMAIL}" ] || [ -z "${JIRA_API_TOKEN}" ]; then
        return 0
    fi

    local auth=$(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)

    # Get available transitions
    local transitions=$(curl -s "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/transitions" \
        -H "Authorization: Basic ${auth}" \
        -H "Accept: application/json")

    # Find "In Progress" transition
    local transition_id=$(echo "${transitions}" | jq -r '.transitions[] | select(.name | test("progress"; "i")) | .id' | head -1)

    if [ -n "${transition_id}" ] && [ "${transition_id}" != "null" ]; then
        curl -s -X POST "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/transitions" \
            -H "Authorization: Basic ${auth}" \
            -H "Content-Type: application/json" \
            -d "{\"transition\": {\"id\": \"${transition_id}\"}}" > /dev/null 2>&1 \
            && echo "[Jira] Transitioned to In Progress" || echo "[Jira] Failed to transition"
    fi
}

# Cleanup function to kill heartbeat on exit
cleanup() {
    if [ -n "${HEARTBEAT_PID}" ]; then
        echo "[Heartbeat] Stopping heartbeat process..."
        kill ${HEARTBEAT_PID} 2>/dev/null || true
    fi
    # Cleanup git credentials
    rm -f ~/.git-credentials
}
trap cleanup EXIT

# Start heartbeat background process
start_heartbeat() {
    if [ -n "${API_BASE_URL}" ] && [ -n "${ORG_API_KEY}" ]; then
        echo "[Heartbeat] Starting heartbeat process (every ${HEARTBEAT_INTERVAL}s)..."
        (
            while true; do
                curl -s -X POST "${API_BASE_URL}/api/v1/ai-worker-tasks/${TASK_ID}/heartbeat" \
                    -H "Authorization: Bearer ${ORG_API_KEY}" \
                    -H "Content-Type: application/json" \
                    > /dev/null 2>&1 || echo "[Heartbeat] Failed to send heartbeat (will retry)"
                sleep ${HEARTBEAT_INTERVAL}
            done
        ) &
        HEARTBEAT_PID=$!
        echo "[Heartbeat] Started with PID ${HEARTBEAT_PID}"
    else
        echo "[Heartbeat] Skipping - API_BASE_URL or ORG_API_KEY not set"
    fi
}

# Validate required environment variables
required_vars=("TASK_ID" "JIRA_ISSUE_KEY" "GITHUB_REPO" "WORKER_PERSONA" "ANTHROPIC_API_KEY" "GITHUB_TOKEN")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "[ERROR] Required environment variable $var is not set"
        exit 1
    fi
done

# Configure git with GitHub token
echo "[Setup] Configuring git..."
git config --global credential.helper store
echo "https://${GITHUB_TOKEN}@github.com" > ~/.git-credentials

# GitHub CLI uses GITHUB_TOKEN env var automatically, no need for gh auth login
echo "[Setup] GitHub CLI will use GITHUB_TOKEN from environment"

# Clone the repository
REPO_DIR="/home/aiworker/workspace"
echo "[Setup] Cloning ${GITHUB_REPO}..."
if ! git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "${REPO_DIR}" 2>&1; then
    echo "[ERROR] Failed to clone repository ${GITHUB_REPO}"
    echo "[DEBUG] Token length: ${#GITHUB_TOKEN}"
    exit 1
fi
cd "${REPO_DIR}"
echo "[Setup] Clone successful"

# Start heartbeat after setup is complete
start_heartbeat

# Create branch name from Jira issue key
BRANCH_NAME="ai/${JIRA_ISSUE_KEY,,}"
echo "[Setup] Creating branch: ${BRANCH_NAME}"
git checkout -b "${BRANCH_NAME}"

# Notify Jira that work is starting
transition_jira_to_progress
add_jira_comment "🤖 *AI Worker (${WORKER_PERSONA//_/ })* - Automated Update\n\n⚡ Starting work on this task.\n\nBranch: ${BRANCH_NAME}\nRepository: ${GITHUB_REPO}"

# Build the task instructions
INSTRUCTIONS_FILE="/tmp/task-instructions.md"
cat > "${INSTRUCTIONS_FILE}" << EOF
# Task: ${JIRA_ISSUE_KEY}

## Summary
${JIRA_SUMMARY}

## Description
${JIRA_DESCRIPTION:-No description provided}

## Instructions

You are an AI ${WORKER_PERSONA//_/ } working on this task. Complete the following:

1. Understand the requirements from the summary and description above
2. Explore the codebase to find relevant files
3. Implement the necessary changes
4. Write or update tests as needed
5. Ensure the code compiles/lints without errors
6. Commit your changes with clear commit messages
7. Push the branch and create a pull request

## Rules

- NEVER push to main/master directly
- NEVER commit secrets, credentials, or API keys
- ALWAYS run tests before creating PR
- Keep commits atomic and well-described
- Follow existing code patterns and conventions
- Add comments only where the logic isn't self-evident

## When Done

After completing the work:
1. Run \`git push -u origin ${BRANCH_NAME}\`
2. Create a PR with: \`gh pr create --title "${JIRA_ISSUE_KEY}: ${JIRA_SUMMARY}" --body "Fixes ${JIRA_ISSUE_KEY}"\`
EOF

# Add previous run context if this is a retry
if [ -n "${PREVIOUS_RUN_CONTEXT}" ] && [ "${RETRY_NUMBER:-0}" -gt 0 ]; then
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "---" >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "## Previous Run Context (Retry #${RETRY_NUMBER})" >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "IMPORTANT: This is retry attempt #${RETRY_NUMBER}. The previous attempt failed." >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "### What happened in the previous attempt:" >> "${INSTRUCTIONS_FILE}"
    echo "${PREVIOUS_RUN_CONTEXT}" >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "### Instructions for this retry:" >> "${INSTRUCTIONS_FILE}"
    echo "1. Avoid repeating the same mistakes from the previous attempt" >> "${INSTRUCTIONS_FILE}"
    echo "2. Try a different approach if the previous one failed" >> "${INSTRUCTIONS_FILE}"
    echo "3. Check if previous file changes caused issues" >> "${INSTRUCTIONS_FILE}"
    echo "4. If stuck in a loop, step back and reconsider the problem" >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "[AI Worker] This is retry #${RETRY_NUMBER} - previous context appended to instructions"
fi

echo "[Setup] Task instructions created"
cat "${INSTRUCTIONS_FILE}"

# Run Claude Code in agentic mode
echo ""
echo "[Claude] Starting Claude Agent..."
echo "================================"

# Set up Claude Code with appropriate permissions
export CLAUDE_CODE_ACCEPT_EDITS=true
export CLAUDE_CODE_MAX_TURNS="${MAX_TURNS:-50}"

# Use cheapest model for testing (haiku), can override with CLAUDE_MODEL env var
CLAUDE_MODEL="${CLAUDE_MODEL:-haiku}"
echo "[Claude] Using model: ${CLAUDE_MODEL}"

# Run Claude Code with stream-json output for accurate token tracking
CLAUDE_OUTPUT_FILE="/tmp/claude-output.json"
CLAUDE_TEXT_FILE="/tmp/claude-output.txt"

# Use stream-json to get structured output with token counts
claude \
    --print \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS:-50}" \
    --model "${CLAUDE_MODEL}" \
    --output-format stream-json \
    "$(cat ${INSTRUCTIONS_FILE})" 2>&1 | tee "${CLAUDE_OUTPUT_FILE}" | while IFS= read -r line; do
    # Extract and display text content for human-readable output
    if echo "$line" | jq -e '.type == "assistant" and .message.content' > /dev/null 2>&1; then
        echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null
    elif echo "$line" | jq -e '.type == "result"' > /dev/null 2>&1; then
        # Final result - save usage for later parsing
        echo "$line" > /tmp/claude-final-result.json
    fi
done

CLAUDE_EXIT_CODE=${PIPESTATUS[0]}

echo "================================"
echo "[Claude] Agent finished with exit code: ${CLAUDE_EXIT_CODE}"

# Parse token usage from the final result JSON
FINAL_RESULT="/tmp/claude-final-result.json"
if [ -f "${FINAL_RESULT}" ]; then
    INPUT_TOKENS=$(jq -r '.result.usage.input_tokens // 0' "${FINAL_RESULT}" 2>/dev/null || echo "0")
    OUTPUT_TOKENS=$(jq -r '.result.usage.output_tokens // 0' "${FINAL_RESULT}" 2>/dev/null || echo "0")
    CACHE_CREATION=$(jq -r '.result.usage.cache_creation_input_tokens // 0' "${FINAL_RESULT}" 2>/dev/null || echo "0")
    CACHE_READ=$(jq -r '.result.usage.cache_read_input_tokens // 0' "${FINAL_RESULT}" 2>/dev/null || echo "0")

    # Calculate cost based on model pricing
    # Haiku: $0.25/M input, $1.25/M output, $0.30/M cache write, $0.03/M cache read
    # Sonnet: $3/M input, $15/M output, $3.75/M cache write, $0.30/M cache read
    if [ "${CLAUDE_MODEL}" = "haiku" ]; then
        INPUT_RATE="0.00000025"
        OUTPUT_RATE="0.00000125"
        CACHE_WRITE_RATE="0.0000003"
        CACHE_READ_RATE="0.00000003"
    else
        # Default to Sonnet pricing
        INPUT_RATE="0.000003"
        OUTPUT_RATE="0.000015"
        CACHE_WRITE_RATE="0.00000375"
        CACHE_READ_RATE="0.0000003"
    fi

    CLAUDE_COST=$(echo "scale=4; ${INPUT_TOKENS} * ${INPUT_RATE} + ${OUTPUT_TOKENS} * ${OUTPUT_RATE} + ${CACHE_CREATION} * ${CACHE_WRITE_RATE} + ${CACHE_READ} * ${CACHE_READ_RATE}" | bc 2>/dev/null || echo "0")
else
    # Fallback: try parsing text format
    INPUT_TOKENS=$(grep -i "input_tokens" "${CLAUDE_OUTPUT_FILE}" | tail -1 | grep -oE '[0-9]+' | head -1 || echo "0")
    OUTPUT_TOKENS=$(grep -i "output_tokens" "${CLAUDE_OUTPUT_FILE}" | tail -1 | grep -oE '[0-9]+' | head -1 || echo "0")
    CLAUDE_COST="0"
fi

echo "[Tokens] Model: ${CLAUDE_MODEL}"
echo "[Tokens] Input: ${INPUT_TOKENS}, Output: ${OUTPUT_TOKENS}"
echo "[Tokens] Cache: created=${CACHE_CREATION:-0}, read=${CACHE_READ:-0}"
echo "[Tokens] Calculated cost: \$${CLAUDE_COST}"

# Output token markers for orchestrator to parse
echo "::input_tokens::${INPUT_TOKENS:-0}"
echo "::output_tokens::${OUTPUT_TOKENS:-0}"
echo "::cache_creation_tokens::${CACHE_CREATION:-0}"
echo "::cache_read_tokens::${CACHE_READ:-0}"
echo "::claude_cost::${CLAUDE_COST:-0}"
echo "::model::${CLAUDE_MODEL}"

# Report token usage to API
if [ -n "${API_BASE_URL}" ] && [ -n "${ORG_API_KEY}" ]; then
    echo "[API] Reporting token usage..."
    curl -s -X POST "${API_BASE_URL}/api/v1/ai-worker-tasks/${TASK_ID}/usage" \
        -H "Authorization: Bearer ${ORG_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"${CLAUDE_MODEL}\",
            \"inputTokens\": ${INPUT_TOKENS:-0},
            \"outputTokens\": ${OUTPUT_TOKENS:-0},
            \"reportedCost\": ${CLAUDE_COST:-0}
        }" > /dev/null 2>&1 && echo "[API] Token usage reported" || echo "[API] Failed to report token usage"
fi

# Check if PR was created
PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "")

if [ -n "${PR_URL}" ]; then
    echo "[SUCCESS] PR created: ${PR_URL}"

    # Update Jira with PR link
    add_jira_comment "🤖 *AI Worker (${WORKER_PERSONA//_/ })* - Automated Update\n\n✅ Implementation complete!\n\n🔀 Pull Request: ${PR_URL}\n🌿 Branch: ${BRANCH_NAME}\n\n⏳ Awaiting Virtual Manager review."

    # Output result for orchestrator to parse
    echo "::result::success"
    echo "::pr_url::${PR_URL}"
    echo "::pr_number::$(gh pr view --json number -q '.number')"
    echo "::branch::${BRANCH_NAME}"
else
    echo "[INFO] No PR was created"

    # Check if there are any commits
    COMMIT_COUNT=$(git rev-list --count HEAD ^origin/main 2>/dev/null || echo "0")

    if [ "${COMMIT_COUNT}" -gt 0 ]; then
        echo "[INFO] Pushing branch with ${COMMIT_COUNT} commits..."
        git push -u origin "${BRANCH_NAME}"

        echo "[INFO] Creating PR..."
        gh pr create \
            --title "${JIRA_ISSUE_KEY}: ${JIRA_SUMMARY}" \
            --body "## Summary

Automated implementation for [${JIRA_ISSUE_KEY}](https://oncallshift.atlassian.net/browse/${JIRA_ISSUE_KEY})

${JIRA_DESCRIPTION:-}

---
🤖 Generated by AI Worker (${WORKER_PERSONA//_/ })"

        PR_URL=$(gh pr view --json url -q '.url')
        echo "[SUCCESS] PR created: ${PR_URL}"

        # Update Jira with PR link
        add_jira_comment "🤖 *AI Worker (${WORKER_PERSONA//_/ })* - Automated Update\n\n✅ Implementation complete!\n\n🔀 Pull Request: ${PR_URL}\n🌿 Branch: ${BRANCH_NAME}\n\n⏳ Awaiting Virtual Manager review."

        echo "::result::success"
        echo "::pr_url::${PR_URL}"
        echo "::pr_number::$(gh pr view --json number -q '.number')"
        echo "::branch::${BRANCH_NAME}"
    else
        echo "[WARNING] No changes were made"
        add_jira_comment "🤖 *AI Worker (${WORKER_PERSONA//_/ })* - Automated Update\n\n⚠️ No changes needed.\n\nAnalyzed the task but determined no code changes were required. This may indicate the task is already complete or requires clarification."
        echo "::result::no_changes"
    fi
fi

# Exit with Claude's exit code (cleanup handled by trap)
exit ${CLAUDE_EXIT_CODE}
