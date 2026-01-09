# AI Worker Execution Environment Issues

**Analysis Date:** 2026-01-09
**PR Reference:** #98
**Analyzed Log Streams:** 5 recent ECS executor task runs

## Executive Summary

After analyzing recent AI worker task executions in CloudWatch logs, I've identified **1 critical issue** and **several areas for improvement** in the execution environment. While tasks are generally completing successfully (PRs are being created), there are failures in post-execution reporting that reduce visibility and learning capabilities.

## Critical Issues

### 1. Jira Comment Integration Failure ❌ CRITICAL

**Issue:** All analyzed task runs show consistent failures when attempting to add completion comments to Jira tickets.

**Evidence from logs:**
```
[Jira] Failed to add comment (HTTP 000)
```

**Occurrence:** 100% of analyzed runs (5/5 log streams)

**Impact:**
- **HIGH**: Workers cannot document their work in Jira as required by the DoD
- Completion comments are MANDATORY according to CLAUDE.md instructions
- Team loses visibility into what was done, blockers encountered, and follow-up needed
- Violates the documented workflow requirement to add completion comment before transitioning to Done

**Affected Task IDs:**
- `11e60cc6-2e4e-4c1c-b8d8-ef78e750c51f` (OCS-144)
- Task for OCS-141 (PR #96)
- Multiple others

**Root Cause Hypothesis:**
1. **HTTP 000 error** suggests network/DNS failure or authentication issue, not an HTTP error response
2. Likely causes:
   - Missing or invalid Jira credentials in execution environment
   - Network connectivity issue from ECS container to Jira API
   - Execution script (`/app/execution-compiled/jira/add_comment.js`) not handling auth correctly
   - Missing environment variables (JIRA_API_TOKEN, JIRA_EMAIL, JIRA_DOMAIN)

**Verification Needed:**
```bash
# Check if Jira credentials are being passed to the container
aws ecs describe-task-definition \
  --task-definition pagerduty-lite-dev-ai-worker-executor \
  --query 'taskDefinition.containerDefinitions[0].environment' \
  | grep -i jira
```

**Recommended Fix:**
1. Verify Jira credentials are available in Secrets Manager
2. Ensure ECS task definition includes Jira environment variables:
   - `JIRA_API_TOKEN`
   - `JIRA_EMAIL`
   - `JIRA_DOMAIN` (oncallshift.atlassian.net)
3. Update execution script to log more detailed error information
4. Test Jira API connectivity from within the ECS container

## Medium Priority Issues

### 2. Inconsistent Error Detail Reporting ⚠️ MEDIUM

**Issue:** When the Jira comment fails, the error message provides minimal debugging information (HTTP 000 with no additional context).

**Impact:**
- Difficult to diagnose the root cause without accessing the execution script source
- Slows down debugging and remediation

**Recommendation:**
- Update Jira execution scripts to log:
  - Full error stack trace
  - HTTP request details (URL, headers - minus sensitive data)
  - Response body if available
  - Environment variable presence check

### 3. Missing TypeScript Validation in CI ⚠️ MEDIUM

**Issue:** The execution environment explicitly disables TypeScript checking and tells workers to "rely on CI to catch type errors."

**From logs:**
```
**Important:** This container does NOT have project dev dependencies installed. Do NOT attempt to run:
- `npx tsc --noEmit` - Will fail (no TypeScript in project)
```

**Impact:**
- Workers cannot validate their code changes before committing
- Increases risk of pushing broken code
- Forces reliance on CI to catch basic syntax errors

**Why this exists:**
The container doesn't have `node_modules` installed to reduce image size, but this creates a gap in the quality gates.

**Recommendation:**
- Install minimal TypeScript dev dependencies in the worker image:
  - `typescript`
  - `@types/node`
  - Project-specific `@types/*` packages
- Adds ~50MB to image but enables local type checking
- Workers can run `npx tsc --noEmit` before committing

### 4. Repetitive Pattern Learning Instructions ℹ️ LOW

**Issue:** The same Git Bash shell parsing warnings appear 3x in the instructions provided to workers.

**From logs:**
```
When commands fail with syntax errors involving $() or ${}, delegate to a Task agent which runs in WSL where these issues dont exist.
When commands fail with syntax errors involving $() or ${}, delegate to a Task agent which runs in WSL where these issues dont exist.
When commands fail with syntax errors involving $() or ${}, delegate to a Task agent which runs in WSL where these issues dont exist.
```

**Impact:**
- Token waste (minor)
- Visual clutter in instructions
- Suggests a deduplication issue in the pattern-fetching system

**Recommendation:**
- Deduplicate patterns when assembling instructions
- Implement pattern uniqueness check by content hash

## Positive Observations ✅

Despite the issues above, the execution environment shows several strengths:

1. **Task Completion Success:** Workers are successfully:
   - Cloning repositories
   - Making code changes
   - Creating commits
   - Pushing to remote
   - Creating PRs

2. **Token Tracking Works:** The log-parser successfully captures and reports token usage:
   ```
   [log-parser] Token usage: input=101, output=3251, cache_create=54008, cache_read=970744
   [log-parser] Model: claude-haiku-4-5-20251001
   [log-parser] Token usage reported successfully
   ```

3. **Heartbeat System Functional:** Worker heartbeats are running correctly to prevent premature timeout detection

4. **Pattern System Working:** Workers receive relevant persona patterns (9 patterns for backend_developer)

5. **GitHub Integration Solid:** No failures in git operations or GitHub CLI usage

6. **Model Selection Working:** Workers correctly use the assigned model (haiku/sonnet/opus)

## Environment Configuration Review

Based on `backend/src/shared/services/ecs-task-runner.ts:81-100`, the following environment variables are passed to workers:

**Required (Present):**
- ✅ TASK_ID
- ✅ ORG_ID
- ✅ JIRA_ISSUE_KEY
- ✅ JIRA_SUMMARY
- ✅ JIRA_DESCRIPTION
- ✅ GITHUB_REPO
- ✅ WORKER_PERSONA
- ✅ ANTHROPIC_API_KEY
- ✅ GITHUB_TOKEN
- ✅ API_BASE_URL
- ✅ ORG_API_KEY (for log-parser API calls)

**Missing (Suspected):**
- ❌ JIRA_API_TOKEN (needed for execution scripts to call Jira API)
- ❌ JIRA_EMAIL (needed for Jira authentication)
- ❌ JIRA_DOMAIN (needed for Jira API base URL)

## Recommendations Summary

### Immediate (Critical)

1. **Fix Jira Integration**
   - Add missing Jira credentials to ECS task environment
   - Test Jira API connectivity from container
   - Update execution scripts with better error logging

### Short Term (High Priority)

2. **Add TypeScript to Worker Image**
   - Install minimal TS dev dependencies
   - Enable `npx tsc --noEmit` validation before commits

3. **Improve Error Logging**
   - Enhance execution scripts to log full error details
   - Add environment variable presence checks at container startup

### Medium Term (Quality Improvements)

4. **Deduplicate Patterns**
   - Add uniqueness check when fetching persona patterns
   - Reduce token waste in instructions

5. **Add Execution Script Tests**
   - Create integration tests for Jira/GitHub execution scripts
   - Mock external APIs to test error handling paths
   - Run tests in CI to catch regressions

## Testing Recommendations

Before deploying fixes:

1. **Manual Jira API Test from Container:**
   ```bash
   # Exec into a running worker container
   aws ecs execute-command --cluster pagerduty-lite-dev \
     --task <TASK_ID> --container ai-worker-executor --interactive \
     --command "/bin/bash"

   # Test Jira API connectivity
   curl -v -H "Authorization: Bearer $JIRA_API_TOKEN" \
     "https://oncallshift.atlassian.net/rest/api/3/myself"
   ```

2. **Verify Environment Variables:**
   ```bash
   # Inside container
   env | grep -E "(JIRA|GITHUB|ANTHROPIC)" | sort
   ```

3. **Test Execution Script Directly:**
   ```bash
   # Inside container
   JIRA_KEY=OCS-999 COMMENT="Test comment" \
     node /app/execution-compiled/jira/add_comment.js
   ```

## Success Metrics

After implementing fixes, monitor these metrics:

- **Jira comment success rate:** Should increase from 0% to >95%
- **Tasks with completion comments:** Should match total completed tasks
- **Type error rate in CI:** Should decrease with local TS validation
- **Worker retry rate:** May decrease with better error prevention

## Related Files to Review

- `backend/src/shared/services/ecs-task-runner.ts` - Task environment setup
- `backend/src/lambdas/ai-worker-manager.ts` - Worker orchestration
- `infrastructure/terraform/environments/dev/ecs.tf` - ECS task definition
- Execution scripts (need to locate source, not in repo):
  - `/app/execution-compiled/jira/add_comment.js`
  - `/app/execution-compiled/jira/transition_issue.js`

## Conclusion

The AI worker execution environment is **functionally sound** for core tasks (code changes, commits, PRs) but has a **critical gap in Jira integration** that prevents workers from fulfilling their documentation requirements. The fix is straightforward: add missing Jira credentials to the container environment.

The secondary issues (TypeScript validation, error logging) are quality-of-life improvements that will make the environment more robust and easier to debug.

**No code changes needed yet** - focus on infrastructure/environment configuration first.
