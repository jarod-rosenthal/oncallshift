#!/bin/bash
set -e

# AI Worker Entrypoint Script
# This script runs inside the Fargate container to execute a Jira task
# Uses the DOE (Directive-Orchestration-Execution) framework

echo "[AI Worker] Starting with DOE framework..."
echo "Task ID: ${TASK_ID}"
echo "Jira Issue: ${JIRA_ISSUE_KEY}"
echo "Persona: ${WORKER_PERSONA}"
echo "Repository: ${GITHUB_REPO}"
echo "Retry Number: ${RETRY_NUMBER:-0}"

# DOE Framework paths (inside Docker container)
DOE_BASE_DIR="/app"
AGENTS_MD="${DOE_BASE_DIR}/AGENTS.md"
DIRECTIVES_DIR="${DOE_BASE_DIR}/directives"
EXECUTION_DIR="${DOE_BASE_DIR}/execution"
EXECUTION_COMPILED_DIR="${DOE_BASE_DIR}/execution-compiled"

# Export for Claude to use
export DOE_BASE_DIR AGENTS_MD DIRECTIVES_DIR EXECUTION_DIR EXECUTION_COMPILED_DIR

# Heartbeat configuration
HEARTBEAT_INTERVAL=60
HEARTBEAT_PID=""

# Send log to Control Center API
send_log() {
    local log_type="$1"
    local message="$2"
    local severity="${3:-info}"
    local extra_json="${4:-}"

    if [ -z "${API_BASE_URL}" ] || [ -z "${ORG_API_KEY}" ]; then
        return 0
    fi

    # Build JSON body
    local body="{\"taskId\": \"${TASK_ID}\", \"type\": \"${log_type}\", \"message\": \"${message}\", \"severity\": \"${severity}\""
    if [ -n "${extra_json}" ]; then
        body="${body}, ${extra_json}"
    fi
    body="${body}}"

    # POST to logs endpoint (async, don't block on failure)
    curl -s -X POST "${API_BASE_URL}/api/v1/super-admin/control-center/logs" \
        -H "Authorization: Bearer ${ORG_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "${body}" > /dev/null 2>&1 &
}

# Jira API helper function
add_jira_comment() {
    local comment="$1"
    if [ -z "${JIRA_BASE_URL}" ] || [ -z "${JIRA_EMAIL}" ] || [ -z "${JIRA_API_TOKEN}" ]; then
        echo "[Jira] Skipping comment - credentials not configured"
        return 0
    fi

    local auth=$(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)

    # Escape the comment for JSON (handle newlines, quotes, backslashes)
    local escaped_comment=$(echo "$comment" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

    local body="{\"body\":{\"type\":\"doc\",\"version\":1,\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"${escaped_comment}\"}]}]}}"

    local response=$(curl -s -w "\n%{http_code}" -X POST "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/comment" \
        -H "Authorization: Basic ${auth}" \
        -H "Content-Type: application/json" \
        -d "${body}" 2>&1)

    local http_code=$(echo "$response" | tail -1)
    local body_response=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo "[Jira] Comment added"
    else
        echo "[Jira] Failed to add comment (HTTP ${http_code})"
    fi
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
send_log "system" "Cloning repository ${GITHUB_REPO}..." "info"
if ! git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "${REPO_DIR}" 2>&1; then
    echo "[ERROR] Failed to clone repository ${GITHUB_REPO}"
    echo "[DEBUG] Token length: ${#GITHUB_TOKEN}"
    send_log "error" "Failed to clone repository ${GITHUB_REPO}" "error"
    exit 1
fi
cd "${REPO_DIR}"
echo "[Setup] Clone successful"
send_log "git_operation" "Repository cloned successfully" "info"

# Start heartbeat after setup is complete
start_heartbeat

# Create branch name from Jira issue key
BRANCH_NAME="ai/${JIRA_ISSUE_KEY,,}"
echo "[Setup] Creating branch: ${BRANCH_NAME}"
git checkout -b "${BRANCH_NAME}"
send_log "git_operation" "Created branch: ${BRANCH_NAME}" "info"

# Notify Jira that work is starting
transition_jira_to_progress
add_jira_comment "[AI Worker] ${WORKER_PERSONA//_/ } - Starting work on this task. Branch: ${BRANCH_NAME}, Repository: ${GITHUB_REPO}"

# =============================================================================
# Task Complexity Detection
# =============================================================================
# Simple tasks don't need the full directive framework - they can just be done.
# This saves turns and improves efficiency for straightforward changes.

detect_task_complexity() {
    local summary_lower=$(echo "${JIRA_SUMMARY:-}" | tr '[:upper:]' '[:lower:]')
    local desc_lower=$(echo "${JIRA_DESCRIPTION:-}" | tr '[:upper:]' '[:lower:]')
    local combined="${summary_lower} ${desc_lower}"

    # Simple task indicators (can be done in <5 turns)
    local simple_patterns=(
        "fix typo"
        "update comment"
        "rename.*to"
        "change.*from.*to"
        "add.*import"
        "remove.*import"
        "update.*version"
        "bump.*version"
        "fix.*spacing"
        "fix.*indentation"
        "add.*type"
        "fix.*type error"
        "one.*line"
        "single.*line"
        "simple.*fix"
        "quick.*fix"
        "trivial"
    )

    for pattern in "${simple_patterns[@]}"; do
        if echo "$combined" | grep -qiE "$pattern"; then
            echo "simple"
            return
        fi
    done

    # Complex task indicators (need full directive framework)
    local complex_patterns=(
        "implement"
        "create.*new"
        "add.*feature"
        "refactor"
        "migrate"
        "integration"
        "multi.*file"
        "across.*files"
        "architecture"
        "design"
        "security"
        "authentication"
        "database"
        "api.*endpoint"
        "new.*route"
        "test.*coverage"
    )

    for pattern in "${complex_patterns[@]}"; do
        if echo "$combined" | grep -qiE "$pattern"; then
            echo "complex"
            return
        fi
    done

    # Default to standard (use some directives but not all)
    echo "standard"
}

TASK_COMPLEXITY=$(detect_task_complexity)
echo "[Complexity] Detected task complexity: ${TASK_COMPLEXITY}"
send_log "system" "Task complexity: ${TASK_COMPLEXITY}" "info"

# Set max turns based on complexity
case "${TASK_COMPLEXITY}" in
    "simple")
        EFFECTIVE_MAX_TURNS="${MAX_TURNS:-20}"
        ;;
    "standard")
        EFFECTIVE_MAX_TURNS="${MAX_TURNS:-50}"
        ;;
    "complex")
        EFFECTIVE_MAX_TURNS="${MAX_TURNS:-100}"
        ;;
    *)
        EFFECTIVE_MAX_TURNS="${MAX_TURNS:-50}"
        ;;
esac
echo "[Complexity] Max turns set to: ${EFFECTIVE_MAX_TURNS}"

# Build task instructions using DOE framework
INSTRUCTIONS_FILE="/tmp/task-instructions.md"

# Build instructions based on complexity
if [ "${TASK_COMPLEXITY}" = "simple" ]; then
    # Simple tasks: Minimal instructions, just do the work
    echo "[Instructions] Using simplified instructions for simple task"
    cat > "${INSTRUCTIONS_FILE}" << 'SIMPLE_EOF'
# Simple Task - Direct Execution Mode

This is a straightforward task that should be completed quickly.

## Instructions

1. **Read the task** below
2. **Make the change** directly - no need for extensive planning
3. **Test** by running deploy.sh if needed
4. **Commit and push** your changes
5. **Create a PR** with a brief description

## Git Workflow (Quick Version)

```bash
# After making changes:
git add -A
git commit -m "OCS-XXX: Brief description"
git push -u origin HEAD
gh pr create --title "OCS-XXX: Brief description" --body "Quick fix for..."
```

## Skip These for Simple Tasks

- You don't need to read all directives
- You don't need extensive error handling
- You don't need to update multiple test files (unless tests are failing)

Just make the change, verify it works, and ship it.

---

SIMPLE_EOF
else
    # Standard/Complex tasks: Use full AGENTS.md
    if [ -f "${AGENTS_MD}" ]; then
        cp "${AGENTS_MD}" "${INSTRUCTIONS_FILE}"
        echo "" >> "${INSTRUCTIONS_FILE}"
        echo "---" >> "${INSTRUCTIONS_FILE}"
        echo "" >> "${INSTRUCTIONS_FILE}"
    else
        echo "[WARN] AGENTS.md not found at ${AGENTS_MD}, using fallback instructions"
        touch "${INSTRUCTIONS_FILE}"
    fi
fi

# Add task-specific context
cat >> "${INSTRUCTIONS_FILE}" << EOF
# Current Task: ${JIRA_ISSUE_KEY}

## Summary
${JIRA_SUMMARY}

## Description
${JIRA_DESCRIPTION:-No description provided}

## Environment
- **Branch**: ${BRANCH_NAME}
- **Repository**: ${GITHUB_REPO}
- **Persona**: ${WORKER_PERSONA//_/ }
- **Directives Directory**: ${DIRECTIVES_DIR}
- **Execution Scripts Directory**: ${EXECUTION_DIR}

EOF

# List available directives dynamically (skip for simple tasks)
if [ "${TASK_COMPLEXITY}" != "simple" ] && [ -d "${DIRECTIVES_DIR}" ]; then
    cat >> "${INSTRUCTIONS_FILE}" << 'DIREOF'
## Available Directives

Read the relevant directive for your task type:

DIREOF
    echo "### Common Directives" >> "${INSTRUCTIONS_FILE}"
    for f in "${DIRECTIVES_DIR}/common"/*.md; do
        [ -f "$f" ] && echo "- \`directives/common/$(basename $f)\`" >> "${INSTRUCTIONS_FILE}"
    done
    echo "" >> "${INSTRUCTIONS_FILE}"

    # List persona-specific directives
    PERSONA_DIR="${DIRECTIVES_DIR}/${WORKER_PERSONA}"
    if [ -d "${PERSONA_DIR}" ]; then
        echo "### ${WORKER_PERSONA//_/ } Directives" >> "${INSTRUCTIONS_FILE}"
        for f in "${PERSONA_DIR}"/*.md; do
            [ -f "$f" ] && echo "- \`directives/${WORKER_PERSONA}/$(basename $f)\`" >> "${INSTRUCTIONS_FILE}"
        done
        echo "" >> "${INSTRUCTIONS_FILE}"

        # Inline the persona's README.md for immediate context
        PERSONA_README="${PERSONA_DIR}/README.md"
        if [ -f "${PERSONA_README}" ]; then
            echo "---" >> "${INSTRUCTIONS_FILE}"
            echo "" >> "${INSTRUCTIONS_FILE}"
            echo "## Your Persona Guidelines" >> "${INSTRUCTIONS_FILE}"
            echo "" >> "${INSTRUCTIONS_FILE}"
            cat "${PERSONA_README}" >> "${INSTRUCTIONS_FILE}"
            echo "" >> "${INSTRUCTIONS_FILE}"
        fi
    fi
fi

# List available execution scripts
cat >> "${INSTRUCTIONS_FILE}" << EOF

## Available Execution Scripts

Use these scripts instead of running commands directly:

EOF

if [ -d "${EXECUTION_COMPILED_DIR}" ]; then
    for dir in "${EXECUTION_COMPILED_DIR}"/*/; do
        [ -d "$dir" ] || continue
        dirname=$(basename "$dir")
        echo "### ${dirname}/" >> "${INSTRUCTIONS_FILE}"
        for f in "$dir"*.js; do
            [ -f "$f" ] && echo "- \`execution-compiled/${dirname}/$(basename $f)\` - Run with: \`node ${f}\`" >> "${INSTRUCTIONS_FILE}"
        done
        echo "" >> "${INSTRUCTIONS_FILE}"
    done
elif [ -d "${EXECUTION_DIR}" ]; then
    # Fallback to TypeScript if compiled not available
    for dir in "${EXECUTION_DIR}"/*/; do
        [ -d "$dir" ] || continue
        dirname=$(basename "$dir")
        echo "### ${dirname}/" >> "${INSTRUCTIONS_FILE}"
        for f in "$dir"*.ts; do
            [ -f "$f" ] && echo "- \`execution/${dirname}/$(basename $f)\` - Run with: \`npx ts-node ${f}\`" >> "${INSTRUCTIONS_FILE}"
        done
        echo "" >> "${INSTRUCTIONS_FILE}"
    done
fi

# Add workflow guidance
cat >> "${INSTRUCTIONS_FILE}" << EOF

## Workflow

1. **Read** the appropriate directive for your task type
2. **Follow** the directive's steps in order
3. **Use** execution scripts instead of raw commands
4. **If a script fails**, follow the self-annealing protocol in \`directives/common/self_annealing.md\`

## Critical Rules

- NEVER push to main/master directly
- NEVER commit secrets, credentials, or API keys
- ALWAYS run tests before creating PR (use \`node /app/execution-compiled/test/run_tests.js\`)
- Keep commits atomic and well-described
- Follow existing code patterns and conventions
EOF

# =============================================================================
# Fetch Learned Patterns from API
# =============================================================================
# Inject high-effectiveness patterns from previous task executions

fetch_learned_patterns() {
    if [ -z "${API_BASE_URL}" ] || [ -z "${ORG_API_KEY}" ]; then
        echo "[Patterns] Skipping - API_BASE_URL or ORG_API_KEY not set"
        return 0
    fi

    echo "[Patterns] Fetching relevant patterns for persona: ${WORKER_PERSONA}"

    # Fetch patterns relevant to this task type
    local patterns_response
    patterns_response=$(curl -s -X GET \
        "${API_BASE_URL}/api/v1/super-admin/control-center/patterns/relevant?limit=10" \
        -H "Authorization: Bearer ${ORG_API_KEY}" \
        -H "Accept: application/json" 2>/dev/null)

    if [ -z "${patterns_response}" ] || [ "${patterns_response}" = "null" ]; then
        echo "[Patterns] No patterns returned from API"
        return 0
    fi

    # Check if we got any patterns
    local pattern_count
    pattern_count=$(echo "${patterns_response}" | jq -r '.patterns | length' 2>/dev/null || echo "0")

    if [ "${pattern_count}" = "0" ] || [ "${pattern_count}" = "null" ]; then
        echo "[Patterns] No relevant patterns found"
        return 0
    fi

    echo "[Patterns] Found ${pattern_count} relevant patterns"

    # Append patterns to instructions file
    cat >> "${INSTRUCTIONS_FILE}" << 'PATTERNS_HEADER'

---

## Learnings from Previous Tasks

Previous AI workers discovered these helpful patterns. Apply them when relevant:

PATTERNS_HEADER

    # Parse each pattern and add to instructions
    echo "${patterns_response}" | jq -r '.patterns[] | "### \(.title)\n\n\(.recommendedApproach)\n\n*Effectiveness: \(.effectivenessScore | . * 100 | floor)%*\n"' >> "${INSTRUCTIONS_FILE}" 2>/dev/null

    echo "[Patterns] Appended patterns to instructions"

    # Record which patterns were applied (for effectiveness tracking)
    local pattern_ids
    pattern_ids=$(echo "${patterns_response}" | jq -r '.patterns[].id' 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    if [ -n "${pattern_ids}" ]; then
        echo "[Patterns] Applied pattern IDs: ${pattern_ids}"
        # Report applied patterns to API
        curl -s -X POST "${API_BASE_URL}/api/v1/super-admin/control-center/tasks/${TASK_ID}/patterns-applied" \
            -H "Authorization: Bearer ${ORG_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "{\"patternIds\": [$(echo "${pattern_ids}" | sed 's/,$//' | sed 's/\([^,]*\)/"\1"/g')]}" \
            > /dev/null 2>&1 || true
    fi
}

# Fetch and inject learned patterns
fetch_learned_patterns

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
send_log "system" "Starting Claude Agent (model: ${CLAUDE_MODEL:-sonnet}, max turns: ${EFFECTIVE_MAX_TURNS}, complexity: ${TASK_COMPLEXITY})" "info"

# Set up Claude Code with appropriate permissions
export CLAUDE_CODE_ACCEPT_EDITS=true
export CLAUDE_CODE_MAX_TURNS="${EFFECTIVE_MAX_TURNS}"

# Use sonnet (reliable model) until system is stable, can override with CLAUDE_MODEL env var
# Note: Claude Code CLI accepts short names: haiku, sonnet, opus
CLAUDE_MODEL="${CLAUDE_MODEL:-sonnet}"
echo "[Claude] Using model: ${CLAUDE_MODEL}"

# Test Claude CLI is working before running the full task
echo "[Claude] Testing CLI connectivity..."
if ! claude --version > /dev/null 2>&1; then
    echo "[ERROR] Claude CLI not working"
    exit 1
fi

# Run Claude Code with stream-json output for accurate token tracking
CLAUDE_OUTPUT_FILE="/tmp/claude-output.jsonl"
CLAUDE_TEXT_FILE="/tmp/claude-output.txt"

# Use stream-json to get structured output with token counts
# Claude CLI doesn't read from stdin - prompt must be passed as argument
# Tell Claude to read the instructions file itself (uses Read tool internally)
PROMPT="Read the file ${INSTRUCTIONS_FILE} and follow the instructions exactly. Start by reading the file now."

echo "[DEBUG] Prompt: ${PROMPT}"
echo "[DEBUG] Instructions file exists: $(test -f "${INSTRUCTIONS_FILE}" && echo "yes" || echo "no")"
echo "[DEBUG] ANTHROPIC_API_KEY set: $(test -n "${ANTHROPIC_API_KEY}" && echo "yes (${#ANTHROPIC_API_KEY} chars)" || echo "no")"
echo "[DEBUG] Working directory: $(pwd)"

# Run Claude and capture stderr separately to see errors
CLAUDE_STDERR_FILE="/tmp/claude-stderr.log"

# Log parser script path (inside Docker container)
LOG_PARSER_SCRIPT="/app/scripts/log-parser.js"

# Export env vars for log-parser.js (including CLAUDE_MODEL for cost calculation)
export TASK_ID ORG_ID API_BASE_URL ORG_API_KEY CLAUDE_MODEL

# Check if log-parser exists
if [ -f "${LOG_PARSER_SCRIPT}" ]; then
    echo "[Learning] Tool event capture enabled via log-parser.js"
    LOG_PARSER_CMD="node ${LOG_PARSER_SCRIPT}"
else
    echo "[Learning] log-parser.js not found, skipping tool event capture"
    LOG_PARSER_CMD="cat"  # Passthrough if parser not available
fi

# Run Claude with stream-json and pipe through log-parser for tool event capture
# Pipeline: claude -> tee (save raw output) -> log-parser (extract events) -> display
claude \
    --print \
    --verbose \
    --dangerously-skip-permissions \
    --max-turns "${EFFECTIVE_MAX_TURNS}" \
    --model "${CLAUDE_MODEL}" \
    --output-format stream-json \
    "${PROMPT}" \
    2>"${CLAUDE_STDERR_FILE}" | tee "${CLAUDE_OUTPUT_FILE}" | ${LOG_PARSER_CMD} | while IFS= read -r line; do
    # Extract and display text content for human-readable output
    if echo "$line" | jq -e '.type == "assistant" and .message.content' > /dev/null 2>&1; then
        text_content=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
        if [ -n "$text_content" ]; then
            echo "$text_content"
            # Send truncated log to API (escape for JSON)
            truncated=$(echo "$text_content" | head -c 500 | tr '\n' ' ' | sed 's/"/\\"/g')
            send_log "claude_output" "$truncated" "info"
        fi
        # Check for tool use
        tool_use=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .name // empty' 2>/dev/null)
        if [ -n "$tool_use" ]; then
            send_log "tool_use" "Using tool: $tool_use" "info"
        fi
    fi
done

CLAUDE_EXIT_CODE=${PIPESTATUS[0]}

# Show any stderr output
if [ -s "${CLAUDE_STDERR_FILE}" ]; then
    echo "[Claude STDERR]:"
    cat "${CLAUDE_STDERR_FILE}"
fi

echo "================================"
echo "[Claude] Agent finished with exit code: ${CLAUDE_EXIT_CODE}"
if [ "${CLAUDE_EXIT_CODE}" -eq 0 ]; then
    send_log "system" "Claude Agent completed successfully" "info"
else
    send_log "error" "Claude Agent exited with code ${CLAUDE_EXIT_CODE}" "error"
fi

# =============================================================================
# Token Usage Tracking
# =============================================================================
# Token usage is tracked by log-parser.js which:
# 1. Parses usage from the final result event (guaranteed accurate)
# 2. Reports all 4 token types (input, output, cache_creation, cache_read)
# 3. Posts to /api/v1/ai-worker-tasks/:id/usage on completion
# 4. Server calculates cost using shared pricing config
#
# We extract basic token counts here only for Jira comment display.
# Authoritative cost is in the Control Center (calculated server-side).

echo "[Tokens] Token usage tracked by log-parser.js (reports to API on completion)"
echo "[Tokens] Cost calculated server-side using shared pricing config"
echo "[Tokens] Model: ${CLAUDE_MODEL}"

# Extract token counts from last line for Jira comment display only
INPUT_TOKENS="0"
OUTPUT_TOKENS="0"
if [ -f "${CLAUDE_OUTPUT_FILE}" ] && [ -s "${CLAUDE_OUTPUT_FILE}" ]; then
    LAST_LINE=$(tail -1 "${CLAUDE_OUTPUT_FILE}" 2>/dev/null)
    INPUT_TOKENS=$(echo "${LAST_LINE}" | jq -r '.usage.input_tokens // .message.usage.input_tokens // 0' 2>/dev/null || echo "0")
    OUTPUT_TOKENS=$(echo "${LAST_LINE}" | jq -r '.usage.output_tokens // .message.usage.output_tokens // 0' 2>/dev/null || echo "0")
    if [ "${INPUT_TOKENS}" != "0" ] && [ "${INPUT_TOKENS}" != "null" ]; then
        echo "[Tokens] Display estimate: ${INPUT_TOKENS} input / ${OUTPUT_TOKENS} output"
    fi
fi

# Gather detailed info about changes for Jira
FILES_CHANGED=$(git diff --name-only origin/main 2>/dev/null | wc -l | tr -d ' ')
FILES_LIST=$(git diff --name-only origin/main 2>/dev/null | head -10 | tr '\n' ', ' | sed 's/,$//')
COMMIT_MESSAGES=$(git log --oneline origin/main..HEAD 2>/dev/null | head -5 | tr '\n' '; ' | sed 's/;$//')
LINES_ADDED=$(git diff --stat origin/main 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
LINES_REMOVED=$(git diff --stat origin/main 2>/dev/null | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")

# Build detailed Jira comment function
build_detailed_comment() {
    local status="$1"
    local pr_url="$2"

    local comment="🤖 *AI Worker (${WORKER_PERSONA//_/ })* - Automated Update\n\n"

    if [ "$status" = "success" ]; then
        comment="${comment}✅ *Implementation Complete*\n\n"
        comment="${comment}📊 *Changes Summary:*\n"
        comment="${comment}• Files modified: ${FILES_CHANGED}\n"
        comment="${comment}• Lines: +${LINES_ADDED} / -${LINES_REMOVED}\n"
        if [ -n "${FILES_LIST}" ]; then
            comment="${comment}• Key files: ${FILES_LIST}\n"
        fi
        comment="${comment}\n"
        if [ -n "${COMMIT_MESSAGES}" ]; then
            comment="${comment}📝 *Commits:* ${COMMIT_MESSAGES}\n\n"
        fi
        comment="${comment}🔀 *Pull Request:* ${pr_url}\n"
        comment="${comment}🌿 *Branch:* ${BRANCH_NAME}\n\n"
        comment="${comment}📈 *Tokens:* ${INPUT_TOKENS:-0} input / ${OUTPUT_TOKENS:-0} output\n\n"
        comment="${comment}⏳ Awaiting Virtual Manager review."
    elif [ "$status" = "success_no_pr" ]; then
        comment="${comment}✅ *Implementation Complete (No PR)*\n\n"
        comment="${comment}📊 *Changes Summary:*\n"
        comment="${comment}• Files modified: ${FILES_CHANGED}\n"
        comment="${comment}• Lines: +${LINES_ADDED} / -${LINES_REMOVED}\n"
        if [ -n "${FILES_LIST}" ]; then
            comment="${comment}• Key files: ${FILES_LIST}\n"
        fi
        comment="${comment}\n"
        if [ -n "${COMMIT_MESSAGES}" ]; then
            comment="${comment}📝 *Commits:* ${COMMIT_MESSAGES}\n\n"
        fi
        comment="${comment}🌿 *Branch:* ${BRANCH_NAME}\n"
        comment="${comment}📝 *Note:* Changes pushed to branch without creating PR (as requested)\n\n"
        comment="${comment}📈 *Tokens:* ${INPUT_TOKENS:-0} input / ${OUTPUT_TOKENS:-0} output"
    elif [ "$status" = "no_changes" ]; then
        comment="${comment}⚠️ *No Changes Made*\n\n"
        comment="${comment}The AI worker analyzed this task but determined no code changes were required.\n\n"
        comment="${comment}This may indicate:\n"
        comment="${comment}• The task is already complete\n"
        comment="${comment}• Requirements need clarification\n"
        comment="${comment}• The requested change conflicts with existing code\n\n"
        comment="${comment}📈 *Tokens:* ${INPUT_TOKENS:-0} input / ${OUTPUT_TOKENS:-0} output"
    fi

    echo "$comment"
}

# Check if PR was created
PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "")

if [ -n "${PR_URL}" ]; then
    echo "[SUCCESS] PR created: ${PR_URL}"
    send_log "git_operation" "PR created: ${PR_URL}" "info"

    # Update Jira with detailed comment
    DETAILED_COMMENT=$(build_detailed_comment "success" "${PR_URL}")
    add_jira_comment "${DETAILED_COMMENT}"

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
        send_log "git_operation" "Pushing branch with ${COMMIT_COUNT} commits" "info"
        git push -u origin "${BRANCH_NAME}"

        # Check if worker explicitly requested no PR
        if grep -q "::no_pr::true" "${OUTPUT_FILE}"; then
            echo "[INFO] Worker requested no PR - skipping PR creation"
            send_log "git_operation" "Branch pushed without PR (worker request)" "info"

            # Update Jira with detailed comment
            DETAILED_COMMENT=$(build_detailed_comment "success_no_pr" "")
            add_jira_comment "${DETAILED_COMMENT}"

            echo "::result::success_no_pr"
            echo "::branch::${BRANCH_NAME}"
            echo "::commits::${COMMIT_COUNT}"
        else
            echo "[INFO] Creating PR..."
            send_log "git_operation" "Creating pull request" "info"
            gh pr create \
                --title "${JIRA_ISSUE_KEY}: ${JIRA_SUMMARY}" \
                --body "## Summary

Automated implementation for [${JIRA_ISSUE_KEY}](https://oncallshift.atlassian.net/browse/${JIRA_ISSUE_KEY})

${JIRA_DESCRIPTION:-}

---
🤖 Generated by AI Worker (${WORKER_PERSONA//_/ })"

            PR_URL=$(gh pr view --json url -q '.url')
            echo "[SUCCESS] PR created: ${PR_URL}"
            send_log "git_operation" "PR created: ${PR_URL}" "info"

            # Update Jira with detailed comment
            DETAILED_COMMENT=$(build_detailed_comment "success" "${PR_URL}")
            add_jira_comment "${DETAILED_COMMENT}"

            echo "::result::success"
            echo "::pr_url::${PR_URL}"
            echo "::pr_number::$(gh pr view --json number -q '.number')"
            echo "::branch::${BRANCH_NAME}"
        fi
    else
        echo "[WARNING] No changes were made"
        send_log "warning" "No code changes were made" "warning"
        DETAILED_COMMENT=$(build_detailed_comment "no_changes" "")
        add_jira_comment "${DETAILED_COMMENT}"
        echo "::result::no_changes"
    fi
fi

# Exit with Claude's exit code (cleanup handled by trap)
exit ${CLAUDE_EXIT_CODE}
