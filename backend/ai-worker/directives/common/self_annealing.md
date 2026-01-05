# Self-Annealing Protocol

> When execution scripts fail, diagnose and fix them rather than working around the problem.

## Goal

Improve the AI Worker system by fixing execution scripts when they fail, creating a positive feedback loop where the system becomes more reliable over time.

## Inputs

- **Failed script path**: e.g., `execution/git/create_branch.ts`
- **Error output**: The JSON error returned by the script
- **Original inputs**: The arguments you passed to the script

## Pre-flight Checks

1. Confirm the failure is in the execution script, not your inputs:
   - Re-read the script's expected input format
   - Verify you passed valid arguments

2. Check if this is a known issue:
   - Search the directive's Self-Annealing Notes section
   - Check if there's a workaround documented

## Steps

### Step 1: Diagnose the Failure

Analyze the error output:

```
execution/diagnostics/analyze_error.ts
  --script <failed-script-path>
  --error "<error-message>"
  --inputs "<original-inputs>"
```

Common failure patterns:
- **Command not found**: Missing dependency or PATH issue
- **Permission denied**: File permissions or auth issue
- **Timeout**: Network issue or resource exhaustion
- **Parse error**: Unexpected output format from command

### Step 2: Fix the Script

Read the failing script and understand the bug:

1. Open `execution/<category>/<script>.ts`
2. Identify the failing code section
3. Determine the fix:
   - Better error handling
   - Different command approach
   - Added retry logic
   - Fixed output parsing

4. Make the fix using the Edit tool

### Step 3: Test the Fix

Run the fixed script with the same inputs that caused the failure:

```
execution/test/run_script.ts
  --script <fixed-script-path>
  --inputs "<original-inputs>"
```

Verify:
- [ ] Script completes without error
- [ ] Output is valid JSON
- [ ] Output contains expected data

### Step 4: Update the Directive

Add what you learned to the relevant directive's Self-Annealing Notes:

```markdown
## Self-Annealing Notes

### [Date] - [Brief description]
**Problem:** [What failed]
**Cause:** [Root cause]
**Fix:** [What was changed]
**Lesson:** [How to avoid in future]
```

### Step 5: Commit the Improvement

Create a self-anneal branch and PR:

```
execution/git/create_branch.ts
  --type fix
  --issue self-anneal
  --description "fix-<script-name>-<brief-issue>"
```

Commit message format:
```
fix(ai-worker): improve <script> to handle <edge-case>

Problem: <what was failing>
Solution: <what was fixed>
```

Create PR for human review - self-annealing changes should be reviewed before merging.

### Step 6: Continue Original Task

After the fix is committed (not necessarily merged):
1. Return to your original task
2. Re-run the now-fixed script
3. Continue with the original directive

## Outputs

- [ ] Fixed execution script in `execution/`
- [ ] Updated Self-Annealing Notes in relevant directive
- [ ] PR created on `self-anneal/*` branch
- [ ] Original task can proceed

## Edge Cases

### Fix is Complex

If the fix requires significant refactoring:
1. Create a minimal fix to unblock current work
2. Document the full fix needed in a Jira ticket
3. Continue with workaround for now

### Multiple Scripts Affected

If the root cause affects multiple scripts:
1. Fix the common issue in a shared utility
2. Update all affected scripts
3. Test each one individually

### Cannot Determine Fix

If you truly cannot fix the script:
1. Document the failure in detail
2. Add a Jira comment explaining what happened
3. Mark the task as blocked
4. Do NOT work around the issue by running commands manually

## Self-Annealing Notes

<!-- Updated by AI workers when they learn something -->

### 2026-01-04 - Initial directive created
**Problem:** No formal process for script improvements
**Cause:** Ad-hoc fixes were getting lost
**Fix:** Created this directive to formalize the process
**Lesson:** Document everything, even the process of documenting
