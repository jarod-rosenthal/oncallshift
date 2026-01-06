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

        # Clone repository (needed for PR review)
        REPO_DIR="/home/aiworker/workspace"
        echo "[Setup] Cloning ${GITHUB_REPO} for PR review..."
        send_log "system" "Cloning repository ${GITHUB_REPO}..." "info"
        if ! git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "${REPO_DIR}" 2>&1; then
            echo "[ERROR] Failed to clone repository ${GITHUB_REPO}"
            send_log "error" "Failed to clone repository" "error"
            exit 1
        fi
        cd "${REPO_DIR}"
        echo "[Setup] Clone successful"

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

4. Post your feedback to both Jira and GitHub PR (REQUIRED)

5. Create new Jira tickets for significant issues found (if any):

   **When to create new tickets:**
   - Security vulnerabilities discovered
   - Missing test coverage for critical paths
   - Technical debt that should be addressed separately
   - Follow-up improvements suggested during review

   **How to create tickets:**
   \`\`\`bash
   # Get JIRA credentials
   JIRA_URL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.url')
   JIRA_EMAIL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.email')
   JIRA_API_TOKEN=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.apiToken')

   # Create new ticket
   curl -X POST \\
     -H "Content-Type: application/json" \\
     -u "\${JIRA_EMAIL}:\${JIRA_API_TOKEN}" \\
     "\${JIRA_URL}/rest/api/3/issue" \\
     -d '{
       "fields": {
         "project": {"key": "OCS"},
         "summary": "[FIX] <brief issue description>",
         "issuetype": {"name": "Story"},
         "description": {
           "type": "doc",
           "version": 1,
           "content": [
             {
               "type": "paragraph",
               "content": [
                 {"type": "text", "text": "Issue found during review of ${JIRA_ISSUE_KEY}\\n\\n"}
               ]
             },
             {
               "type": "paragraph",
               "content": [
                 {"type": "text", "text": "[Detailed description of the issue]"}
               ]
             }
           ]
         },
         "priority": {"name": "Medium"},
         "labels": ["manager", "code-review-finding"]
       }
     }'
   \`\`\`

   **Note:** Only create tickets for issues that should be tracked separately.
   Simple fixes should just be noted in the PR review feedback.

6. Output your decision:
   \`\`\`
   ::review_decision::approved|revision_needed|rejected
   ::code_quality_score::1-10
   ::jira_updated::true
   ::new_tickets_created::N (where N is the number of new tickets, or 0)
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

        # No repository clone needed - only analyzes logs via API
        cd /tmp

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

5. Update Jira with findings:
   \`\`\`bash
   # Post learning analysis results to Jira
   curl -X POST -H "Authorization: Bearer \${ORG_API_KEY}" \\
     -H "Content-Type: application/json" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-comment" \\
     -d '{"issueKey": "${JIRA_ISSUE_KEY}", "comment": "Learning Analysis: [summary]"}'
   \`\`\`

6. Create new Jira tickets for critical findings (if any):

   **When to create new tickets:**
   - Systematic environment issues that need fixing
   - Missing tools or permissions affecting multiple workers
   - Best practices that should be formalized into directives
   - Anti-patterns that keep recurring

   **How to create tickets:**
   \`\`\`bash
   # Get JIRA credentials
   JIRA_URL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.url')
   JIRA_EMAIL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.email')
   JIRA_API_TOKEN=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
     "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.apiToken')

   # Create ticket
   curl -X POST \\
     -H "Content-Type: application/json" \\
     -u "\${JIRA_EMAIL}:\${JIRA_API_TOKEN}" \\
     "\${JIRA_URL}/rest/api/3/issue" \\
     -d '{
       "fields": {
         "project": {"key": "OCS"},
         "summary": "[GAP] <brief issue description>",
         "issuetype": {"name": "Story"},
         "description": {
           "type": "doc",
           "version": 1,
           "content": [
             {
               "type": "paragraph",
               "content": [
                 {"type": "text", "text": "Found during learning analysis of ${JIRA_ISSUE_KEY}\\n\\n"}
               ]
             },
             {
               "type": "paragraph",
               "content": [
                 {"type": "text", "text": "[Description of the systemic issue]"}
               ]
             }
           ]
         },
         "priority": {"name": "Medium"},
         "labels": ["manager", "learning-finding"]
       }
     }'
   \`\`\`

7. Output summary:
   \`\`\`
   ::patterns_extracted::N
   ::directive_suggestions::N
   ::environment_suggestions::N
   ::jira_updated::true
   ::new_tickets_created::N (where N is the number of new tickets, or 0)
   \`\`\`

## Source Task ID to Analyze
${SOURCE_TASK_ID}

EOF
        ;;

    "update_environment")
        echo "[Manager] Action: Autonomous Environment Update"
        send_log "manager" "Starting autonomous environment analysis and fixes" "info"

        # Start in /tmp - repository will only be cloned if issues are found
        cd /tmp

        cat >> "${INSTRUCTIONS_FILE}" << EOF
# Manager: Environment Update

**CRITICAL: You have 80 turns. Use them wisely.**

## Task
Analyze worker task ${TASK_ID} (${JIRA_ISSUE_KEY}) for environment issues and fix them.

## Workflow

### 1. Fetch Worker Logs (2 turns)
\`\`\`bash
curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/logs/${TASK_ID}?limit=500" > /tmp/worker-logs.json
\`\`\`

Output: \`::progress::logs_fetched\`

### 2. Identify Environment Issues (5 turns)
Scan logs for:
- \`command not found\` - Missing tools
- \`permission denied\` - IAM/file permissions
- \`No such file\` - Missing scripts
- Container build failures
- AWS permission errors

Output: \`::progress::issues_identified\` or \`::result::no_issues\`

**If NO issues found:**
- Skip to step 6 (Update Jira)
- Output: \`::result::no_issues\`

### 3. Clone Repository (ONLY if issues found) (3 turns)

**IMPORTANT: Only execute this step if you found issues in step 2.**

\`\`\`bash
REPO_DIR="/home/aiworker/workspace"
echo "Cloning repository for environment fixes..."
git clone "https://\${GITHUB_TOKEN}@github.com/jarod-rosenthal/pagerduty-lite.git" "\${REPO_DIR}"
cd "\${REPO_DIR}"
\`\`\`

### 4. Implement Fixes (40-60 turns)

**Allowed modifications:**
- \`backend/Dockerfile.ai-worker\`
- \`backend/ai-worker/directives/**\`
- \`backend/ai-worker/execution/**\`
- \`backend/scripts/ai-worker-entrypoint.sh\`
- \`infrastructure/terraform/modules/ai-workers/main.tf\`

**FORBIDDEN:**
- \`backend/src/\` (except workers)
- \`frontend/\`, \`mobile/\`
- \`backend/src/shared/db/migrations/\`

Output: \`::progress::fixes_implemented\`

### 5. Commit and Create PR (10 turns)
\`\`\`bash
git checkout -b self-anneal/\${TASK_ID}
git add -A
git commit -m "chore: Fix environment issues from ${JIRA_ISSUE_KEY}

Environment fixes:
- [List issues fixed]

Source: ${JIRA_ISSUE_KEY}
\ud83e\udd16 Generated with [Claude Code](https://claude.com/claude-code)"

git push -u origin HEAD

gh pr create \\
  --title "[Self-Anneal] Environment fixes from ${JIRA_ISSUE_KEY}" \\
  --body "## Summary

Automated environment fixes from ${JIRA_ISSUE_KEY}.

## Issues Fixed
[List what you fixed]

## Changes
[Describe changes]

---
Source: ${JIRA_ISSUE_KEY}
\ud83e\udd16 Generated with [Claude Code](https://claude.com/claude-code)"
\`\`\`

Output: \`::progress::pr_created\`

### 6. Update Jira Ticket (REQUIRED - All Cases) (3 turns)

**CRITICAL: Always update Jira with your findings, even if no issues were found.**

\`\`\`bash
# Get JIRA credentials
JIRA_URL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.url')
JIRA_EMAIL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.email')
JIRA_API_TOKEN=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.apiToken')

# Post comment to Jira
curl -X POST \\
  -H "Content-Type: application/json" \\
  -u "\${JIRA_EMAIL}:\${JIRA_API_TOKEN}" \\
  "\${JIRA_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/comment" \\
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Virtual Manager Analysis Results",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "[Your analysis summary here - issues found or no issues found]"
            }
          ]
        }
      ]
    }
  }'
\`\`\`

### 7. Create New Jira Tickets for Complex Issues (Optional) (5 turns)

**When to create new tickets:**
- Infrastructure changes too complex for a single PR
- Multiple related but separable environment issues
- Issues that require coordination with other systems
- Follow-up improvements discovered during fixes

**How to create tickets:**
\`\`\`bash
# Get JIRA credentials (if not already fetched)
JIRA_URL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.url')
JIRA_EMAIL=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.email')
JIRA_API_TOKEN=\$(curl -s -H "Authorization: Bearer \${ORG_API_KEY}" \\
  "\${API_BASE_URL}/api/v1/super-admin/control-center/jira-config" | jq -r '.apiToken')

# Create ticket
curl -X POST \\
  -H "Content-Type: application/json" \\
  -u "\${JIRA_EMAIL}:\${JIRA_API_TOKEN}" \\
  "\${JIRA_URL}/rest/api/3/issue" \\
  -d '{
    "fields": {
      "project": {"key": "OCS"},
      "summary": "[INFRA] <brief issue description>",
      "issuetype": {"name": "Story"},
      "description": {
        "type": "doc",
        "version": 1,
        "content": [
          {
            "type": "paragraph",
            "content": [
              {"type": "text", "text": "Found during environment update for ${JIRA_ISSUE_KEY}\\n\\n"}
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {"type": "text", "text": "[Description of the infrastructure issue]"}
            ]
          }
        ]
      },
      "priority": {"name": "Medium"},
      "labels": ["manager", "environment-finding"]
    }
  }'
\`\`\`

**Note:** Only create tickets for issues beyond the scope of the current fix.

### 8. Output Results (1 turn)

**If issues were found and fixed:**
\`\`\`
::result::success
::pr_url::[URL]
::pr_number::[number]
::issues_fixed::[count]
::jira_updated::true
::new_tickets_created::N (where N is the number of new tickets, or 0)
::description::[Brief summary]
\`\`\`

**If NO issues found:**
\`\`\`
::result::no_issues
::jira_updated::true
::new_tickets_created::0
::analysis::Worker succeeded with no environment gaps. All required tools present, permissions correct, execution scripts working.
\`\`\`

## Bailout Logic
If turn count > 70 and not done:
\`\`\`
::result::partial
::progress::[what you completed]
::remaining::[what's left]
\`\`\`

## Rules
- Be concise - no verbose explanations
- Focus on environment issues only
- Create Jira tickets for complex issues beyond scope of current PR
- If unsure about a fix, skip it and document in PR

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
        MAX_TURNS=80  # Increased from 40 - needs time for file edits, commits, PR creation
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

    # Parse output markers from Claude's response
    DECISION=$(cat "${CLAUDE_OUTPUT_FILE}" 2>/dev/null | grep -oP '::review_decision::\K[^:]+' | head -1 || echo "")
    CODE_QUALITY=$(cat "${CLAUDE_OUTPUT_FILE}" 2>/dev/null | grep -oP '::code_quality_score::\K[0-9]+' | head -1 || echo "")
    NEW_TICKETS=$(cat "${CLAUDE_OUTPUT_FILE}" 2>/dev/null | grep -oP '::new_tickets_created::\K[0-9]+' | head -1 || echo "0")
    FEEDBACK=$(cat "${CLAUDE_OUTPUT_FILE}" 2>/dev/null | grep -oP '::feedback::\K.+' | head -1 || echo "")

    # Mark task as completed via API
    if [ -n "${API_BASE_URL}" ] && [ -n "${ORG_API_KEY}" ]; then
        echo "[Manager] Marking task as completed..."

        # Build JSON payload with available fields
        PAYLOAD=$(jq -n \
            --arg decision "$DECISION" \
            --arg feedback "$FEEDBACK" \
            --argjson codeQuality "${CODE_QUALITY:-null}" \
            --argjson newTickets "${NEW_TICKETS:-0}" \
            '{
                decision: (if $decision != "" then $decision else null end),
                feedback: (if $feedback != "" then $feedback else null end),
                codeQualityScore: $codeQuality,
                newTicketsCreated: $newTickets
            }')

        COMPLETE_RESPONSE=$(curl -s -X POST \
            "${API_BASE_URL}/api/v1/super-admin/control-center/tasks/${TASK_ID}/mark-manager-complete" \
            -H "Authorization: Bearer ${ORG_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD")

        if echo "$COMPLETE_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
            echo "[Manager] Failed to mark as completed: $(echo "$COMPLETE_RESPONSE" | jq -r '.error')"
            send_log "error" "Failed to mark task as completed" "error"
        else
            echo "[Manager] Task marked as completed successfully"
            send_log "system" "Task marked as completed" "info"
        fi
    fi
else
    send_log "error" "Manager exited with code ${CLAUDE_EXIT_CODE}" "error"
fi

exit ${CLAUDE_EXIT_CODE}
