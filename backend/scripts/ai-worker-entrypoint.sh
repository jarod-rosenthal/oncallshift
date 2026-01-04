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

# Run Claude Code (binary is named 'claude' not 'claude-code')
claude \
    --print \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS:-50}" \
    --model "${CLAUDE_MODEL}" \
    "$(cat ${INSTRUCTIONS_FILE})"

CLAUDE_EXIT_CODE=$?

echo "================================"
echo "[Claude] Agent finished with exit code: ${CLAUDE_EXIT_CODE}"

# Check if PR was created
PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "")

if [ -n "${PR_URL}" ]; then
    echo "[SUCCESS] PR created: ${PR_URL}"

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
Generated by AI Worker (${WORKER_PERSONA//_/ })"

        PR_URL=$(gh pr view --json url -q '.url')
        echo "[SUCCESS] PR created: ${PR_URL}"
        echo "::result::success"
        echo "::pr_url::${PR_URL}"
        echo "::pr_number::$(gh pr view --json number -q '.number')"
        echo "::branch::${BRANCH_NAME}"
    else
        echo "[WARNING] No changes were made"
        echo "::result::no_changes"
    fi
fi

# Exit with Claude's exit code (cleanup handled by trap)
exit ${CLAUDE_EXIT_CODE}
