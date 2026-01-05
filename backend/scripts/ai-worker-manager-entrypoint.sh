#!/bin/bash
set -e

# AI Worker Manager Entrypoint Script
# This script runs inside the Fargate container for Manager tasks
# Handles: PR review, learning analysis, environment updates

echo "[Manager] Starting Virtual Manager..."
echo "Task ID: ${TASK_ID}"
echo "Action: ${MANAGER_ACTION}"
echo "Repository: ${GITHUB_REPO:-jarod-rosenthal/pagerduty-lite}"

# Configuration
GITHUB_REPO="${GITHUB_REPO:-jarod-rosenthal/pagerduty-lite}"
HEARTBEAT_INTERVAL=60
HEARTBEAT_PID=""

# Send log to Control Center API
send_log() {
    local log_type="$1"
    local message="$2"
    local severity="${3:-info}"

    if [ -z "${API_BASE_URL}" ] || [ -z "${ORG_API_KEY}" ]; then
        return 0
    fi

    local body="{\"taskId\": \"${TASK_ID}\", \"type\": \"${log_type}\", \"message\": \"${message}\", \"severity\": \"${severity}\"}"

    curl -s -X POST "${API_BASE_URL}/api/v1/super-admin/control-center/logs" \
        -H "Authorization: Bearer ${ORG_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "${body}" > /dev/null 2>&1 &
}

# Cleanup function
cleanup() {
    if [ -n "${HEARTBEAT_PID}" ]; then
        echo "[Heartbeat] Stopping heartbeat process..."
        kill ${HEARTBEAT_PID} 2>/dev/null || true
    fi
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
                    > /dev/null 2>&1 || true
                sleep ${HEARTBEAT_INTERVAL}
            done
        ) &
        HEARTBEAT_PID=$!
        echo "[Heartbeat] Started with PID ${HEARTBEAT_PID}"
    fi
}

# Validate required environment variables
required_vars=("TASK_ID" "MANAGER_ACTION" "ANTHROPIC_API_KEY" "GITHUB_TOKEN")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "[ERROR] Required environment variable $var is not set"
        exit 1
    fi
done

# Configure git
echo "[Setup] Configuring git..."
git config --global credential.helper store
echo "https://${GITHUB_TOKEN}@github.com" > ~/.git-credentials
git config --global user.name "Virtual Manager"
git config --global user.email "ai-manager@oncallshift.com"

# Clone the repository
REPO_DIR="/home/aiworker/workspace"
echo "[Setup] Cloning ${GITHUB_REPO}..."
send_log "system" "Cloning repository ${GITHUB_REPO}..." "info"
if ! git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "${REPO_DIR}" 2>&1; then
    echo "[ERROR] Failed to clone repository ${GITHUB_REPO}"
    send_log "error" "Failed to clone repository" "error"
    exit 1
fi
cd "${REPO_DIR}"
echo "[Setup] Clone successful"

# Start heartbeat
start_heartbeat

# Build instructions based on action
INSTRUCTIONS_FILE="/tmp/manager-instructions.md"
DOE_BASE_DIR="/app"
MANAGER_DIRECTIVE="${DOE_BASE_DIR}/directives/manager/README.md"

# Copy base Manager directive
if [ -f "${MANAGER_DIRECTIVE}" ]; then
    cp "${MANAGER_DIRECTIVE}" "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
    echo "---" >> "${INSTRUCTIONS_FILE}"
    echo "" >> "${INSTRUCTIONS_FILE}"
else
    echo "[WARN] Manager directive not found at ${MANAGER_DIRECTIVE}"
    touch "${INSTRUCTIONS_FILE}"
fi

# Add action-specific context
case "${MANAGER_ACTION}" in
    "review_pr")
        echo "[Manager] Action: PR Code Review"
        send_log "manager" "Starting PR code review" "info"

        cat >> "${INSTRUCTIONS_FILE}" << EOF
# Current Task: PR Code Review

## Task Details
- **Task ID**: ${TASK_ID}
- **Jira Issue**: ${JIRA_ISSUE_KEY}
- **PR URL**: ${PR_URL}
- **PR Number**: ${PR_NUMBER}

## Your Job

1. Fetch the PR diff using:
   \`\`\`bash
   gh pr diff ${PR_NUMBER}
   \`\`\`

2. Review the code against these criteria:
   - Does it correctly implement the Jira requirements?
   - Is the code quality acceptable?
   - Are there security vulnerabilities?
   - Are there test coverage gaps?
   - Does it follow project coding standards?

3. Make a decision:
   - **APPROVE**: Code is ready to merge
   - **REVISION_NEEDED**: Has fixable issues, provide specific feedback
   - **REJECT**: Fundamental problems, cannot be fixed with revisions

4. Post your feedback to both Jira and GitHub PR

5. Output your decision:
   \`\`\`
   ::review_decision::approved|revision_needed|rejected
   ::code_quality_score::1-10
   ::feedback::Your detailed feedback
   \`\`\`

## Jira Task Summary
${JIRA_SUMMARY:-No summary provided}

## Jira Task Description
${JIRA_DESCRIPTION:-No description provided}

## Previous Review Feedback (if any)
${REVIEW_FEEDBACK:-None - this is the first review}

EOF
        ;;

    "analyze_learnings")
        echo "[Manager] Action: Learning Analysis"
        send_log "manager" "Starting learning analysis" "info"

        cat >> "${INSTRUCTIONS_FILE}" << EOF
# Current Task: Learning Analysis

## Task Details
- **Task ID**: ${TASK_ID}
- **Jira Issue**: ${JIRA_ISSUE_KEY}

## Your Job

1. Fetch tool events for this task:
   \`\`\`bash
   curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/tool-events?taskId=${SOURCE_TASK_ID}"
   \`\`\`

2. Analyze the execution:
   - Identify retry sequences (same tool, multiple attempts)
   - Find what went wrong and how it was recovered
   - Extract patterns: error_recovery, best_practice, anti_pattern

3. Store useful patterns via API:
   \`\`\`bash
   curl -X POST -H "Authorization: Bearer \${ORG_API_KEY}" \\
     -H "Content-Type: application/json" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/patterns" \\
     -d '{"toolName": "...", "patternType": "error_recovery", "title": "...", "recommendedApproach": "..."}'
   \`\`\`

4. If you identify environment issues (missing tools, permissions), suggest them:
   - Create a file /tmp/environment-suggestions.json with suggested changes

5. Output summary:
   \`\`\`
   ::patterns_extracted::N
   ::directive_suggestions::N
   ::environment_suggestions::N
   \`\`\`

## Source Task ID to Analyze
${SOURCE_TASK_ID}

EOF
        ;;

    "update_environment")
        echo "[Manager] Action: Environment Update"
        send_log "manager" "Starting environment update" "info"

        cat >> "${INSTRUCTIONS_FILE}" << EOF
# Current Task: Environment Update

## Task Details
- **Task ID**: ${TASK_ID}

## Your Job

You need to update the AI Worker environment based on learned issues.

## Changes to Make
${ENVIRONMENT_CHANGES:-No specific changes provided - analyze recent failures}

## Safety Rules

1. **ONLY modify these files:**
   - \`backend/Dockerfile.ai-worker\`
   - \`backend/ai-worker/directives/**\`
   - \`backend/ai-worker/execution/**\`
   - \`infrastructure/terraform/modules/ai-workers/\` (IAM policies only)

2. **NEVER modify:**
   - Core application code (\`backend/src/\` except workers)
   - Frontend code
   - Database migrations
   - Production configuration

3. **Create a PR on \`self-anneal/*\` branch:**
   \`\`\`bash
   git checkout -b self-anneal/${TASK_ID}
   # Make changes
   git add -A
   git commit -m "chore: Self-annealing environment update"
   git push -u origin HEAD
   gh pr create --title "Self-Annealing: Environment Update" --body "..."
   \`\`\`

4. Output the PR URL:
   \`\`\`
   ::result::success
   ::pr_url::https://github.com/${GITHUB_REPO}/pull/XXX
   \`\`\`

EOF
        ;;

    *)
        echo "[ERROR] Unknown MANAGER_ACTION: ${MANAGER_ACTION}"
        send_log "error" "Unknown action: ${MANAGER_ACTION}" "error"
        exit 1
        ;;
esac

# Add common environment info
cat >> "${INSTRUCTIONS_FILE}" << EOF

## Environment
- API_BASE_URL: ${API_BASE_URL}
- Repository: ${GITHUB_REPO}
- Working directory: $(pwd)

## API Authentication
Use the ORG_API_KEY environment variable:
\`\`\`bash
curl -H "Authorization: Bearer \${ORG_API_KEY}" ...
\`\`\`

EOF

echo "[Setup] Manager instructions created"
cat "${INSTRUCTIONS_FILE}"

# Select Claude model based on action
case "${MANAGER_ACTION}" in
    "review_pr")
        CLAUDE_MODEL="opus"  # Best reasoning for code review
        MAX_TURNS=30
        ;;
    "analyze_learnings")
        CLAUDE_MODEL="haiku"  # Fast and cheap for pattern extraction
        MAX_TURNS=20
        ;;
    "update_environment")
        CLAUDE_MODEL="sonnet"  # Balanced for infrastructure changes
        MAX_TURNS=40
        ;;
esac

echo ""
echo "[Claude] Starting Claude Agent..."
echo "================================"
echo "[Claude] Model: ${CLAUDE_MODEL}, Max turns: ${MAX_TURNS}"
send_log "system" "Starting Claude Agent (model: ${CLAUDE_MODEL})" "info"

# Set up Claude Code
export CLAUDE_CODE_ACCEPT_EDITS=true
export CLAUDE_CODE_MAX_TURNS="${MAX_TURNS}"

# Run Claude
CLAUDE_OUTPUT_FILE="/tmp/claude-output.jsonl"
PROMPT="Read the file ${INSTRUCTIONS_FILE} and follow the instructions exactly. Start by reading the file now."

claude \
    --print \
    --verbose \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS}" \
    --model "${CLAUDE_MODEL}" \
    --output-format stream-json \
    "${PROMPT}" \
    2>/tmp/claude-stderr.log | tee "${CLAUDE_OUTPUT_FILE}" | while IFS= read -r line; do
    if echo "$line" | jq -e '.type == "assistant" and .message.content' > /dev/null 2>&1; then
        text_content=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
        if [ -n "$text_content" ]; then
            echo "$text_content"
            truncated=$(echo "$text_content" | head -c 500 | tr '\n' ' ' | sed 's/"/\\"/g')
            send_log "manager_output" "$truncated" "info"
        fi
    fi
done

CLAUDE_EXIT_CODE=${PIPESTATUS[0]}

# Show stderr
if [ -s "/tmp/claude-stderr.log" ]; then
    echo "[Claude STDERR]:"
    cat /tmp/claude-stderr.log
fi

echo "================================"
echo "[Claude] Agent finished with exit code: ${CLAUDE_EXIT_CODE}"

# Parse token usage
INPUT_TOKENS="0"
OUTPUT_TOKENS="0"

if [ -f "${CLAUDE_OUTPUT_FILE}" ] && [ -s "${CLAUDE_OUTPUT_FILE}" ]; then
    INPUT_TOKENS=$(cat "${CLAUDE_OUTPUT_FILE}" | jq -r 'select(.message.usage.input_tokens != null) | .message.usage.input_tokens' 2>/dev/null | awk '{sum += $1} END {print sum+0}')
    OUTPUT_TOKENS=$(cat "${CLAUDE_OUTPUT_FILE}" | jq -r 'select(.message.usage.output_tokens != null) | .message.usage.output_tokens' 2>/dev/null | awk '{sum += $1} END {print sum+0}')
fi

echo "[Tokens] Model: ${CLAUDE_MODEL}"
echo "[Tokens] Input: ${INPUT_TOKENS}, Output: ${OUTPUT_TOKENS}"
echo "::input_tokens::${INPUT_TOKENS:-0}"
echo "::output_tokens::${OUTPUT_TOKENS:-0}"
echo "::model::${CLAUDE_MODEL}"

# Report usage
if [ -n "${API_BASE_URL}" ] && [ -n "${ORG_API_KEY}" ]; then
    curl -s -X POST "${API_BASE_URL}/api/v1/ai-worker-tasks/${TASK_ID}/usage" \
        -H "Authorization: Bearer ${ORG_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${CLAUDE_MODEL}\", \"inputTokens\": ${INPUT_TOKENS:-0}, \"outputTokens\": ${OUTPUT_TOKENS:-0}}" \
        > /dev/null 2>&1 || true
fi

if [ "${CLAUDE_EXIT_CODE}" -eq 0 ]; then
    send_log "system" "Manager completed successfully" "info"
else
    send_log "error" "Manager exited with code ${CLAUDE_EXIT_CODE}" "error"
fi

exit ${CLAUDE_EXIT_CODE}
