# AI Worker Directives Audit

> Analysis of gaps, issues, and missing items in the AI worker directive system.
> Generated: 2026-01-09

## Summary

After examining `AGENTS.md` and all persona directives, I've identified significant gaps that could cause worker failures, confusion, or incomplete work.

---

## Critical Gaps

### 1. Missing Persona Directives

Two personas are defined in the type system but have **NO directives**:

| Persona | Status |
|---------|--------|
| `tech_writer` | **No directive exists** |
| `project_manager` | **No directive exists** |

These personas will have no guidance when assigned tasks.

### 2. Missing Task-Type Directives

Only `backend_developer` has task-specific directives. Other personas lack equivalent guides:

| Persona | Has README | Task Directives |
|---------|------------|-----------------|
| backend_developer | Yes | `add_api_endpoint.md`, `fix_bug.md` |
| frontend_developer | Yes | **None** (needs: add_component.md, fix_ui_bug.md, add_mobile_screen.md) |
| devops_engineer | Yes | **None** (needs: add_terraform_module.md, update_cicd.md) |
| qa_engineer | Yes | **None** (needs: write_unit_test.md, write_e2e_test.md) |
| security_engineer | Yes | **None** (needs: security_audit.md, fix_vulnerability.md) |
| manager | Yes | N/A (actions defined differently) |

### 3. Referenced but Non-Existent Execution Scripts

**VERIFIED:** Directives reference scripts that DON'T exist:

| Script | Referenced In | Exists? |
|--------|--------------|---------|
| `codebase/search_patterns.ts` | add_api_endpoint.md, fix_bug.md | ❌ NO |
| `codebase/find_model.ts` | add_api_endpoint.md | ❌ NO |
| `git/recent_commits.ts` | fix_bug.md | ❌ NO |
| `logs/search_logs.ts` | fix_bug.md | ❌ NO |
| `diagnostics/analyze_error.ts` | self_annealing.md | ❌ NO |
| `test/run_lint.ts` | test_before_commit.md | ❌ NO |
| `test/verify_all.ts` | test_before_commit.md | ❌ NO |
| `test/run_script.ts` | self_annealing.md | ❌ NO |

**Scripts that DO exist:**
- `git/create_branch.ts`, `commit_changes.ts`, `create_pr.ts`, `rebase_on_main.ts`
- `jira/add_comment.ts`, `transition_issue.ts`
- `test/run_tests.ts`, `run_typecheck.ts`
- `deploy/run_deploy.ts`, `check_deployment_safety.ts`
- `validation/validate_deployment.ts`

Workers WILL fail when directives tell them to call non-existent scripts.

---

## Contradictions & Inconsistencies

### 4. TypeScript Availability Contradiction

**AGENTS.md (line 222-235)** says:
> "This container does NOT have project dev dependencies installed. Do NOT attempt to run `npx tsc --noEmit`"

**But** `test_before_commit.md` says:
> "Run execution/test/run_typecheck.ts --project backend"

This is confusing - which is correct? Workers need clear guidance.

### 5. "See Separate Directive" - But They Don't Exist

`add_api_endpoint.md` says:
> "If model doesn't exist, create it first (see separate directive)"

**No `create_typeorm_model.md` exists.** Same for database migrations.

---

## Missing Critical Guidance

### 6. No Concurrent Work Handling

With per-persona concurrency limiting, different personas CAN work simultaneously. But:
- What if frontend and backend workers both touch `package.json`?
- What if both touch shared types?
- No merge conflict prevention guidance beyond the rebase mechanism

### 7. No Escalation Paths

When should a worker give up? Current directives say:
- Self-annealing: "If you cannot determine fix, mark task as blocked"

But there's no:
- Escalation to human reviewers
- Criteria for when to ask for help
- Process for "I'm stuck" scenarios

### 8. No Resource Limit Guidance

Workers don't know:
- ECS task timeout limits
- Memory/CPU constraints
- Maximum file sizes they can handle
- Maximum PR diff sizes

### 9. No Rate Limiting Guidance

No mention of:
- Jira API rate limits
- GitHub API rate limits
- How to handle 429 responses
- Backoff strategies

---

## Security Gaps

### 10. Incomplete Security Guidance

Security engineer directive missing:
- CORS configuration best practices
- CSP header guidance
- Dependency scanning (`npm audit`)
- Supply chain security
- Code signing

### 11. API Key Documentation

AGENTS.md doesn't specify:
- Which environment variables are available
- Which are required vs optional
- How to handle missing credentials gracefully

---

## Process Gaps

### 12. Empty Self-Annealing Notes

Every single directive has empty "Self-Annealing Notes" sections:
```markdown
## Self-Annealing Notes
*This section is updated by AI Workers with learned improvements*
```

This suggests the feedback loop isn't working - lessons aren't being captured.

### 13. No Test Data/Fixture Guidance

QA directive mentions mocking but:
- No guidance on setting up test fixtures
- No guidance on test data management
- No examples of proper mock setup

### 14. Missing Mobile-Specific Directives

Frontend directive briefly mentions mobile but lacks:
- React Native specific patterns
- Platform difference handling (iOS/Android)
- OTA update procedures
- Mobile testing guidance

---

## Recommendations

### Priority 1: Fix Critical Gaps
1. Create `tech_writer/README.md` and `project_manager/README.md`
2. Create or remove references to non-existent execution scripts
3. Resolve TypeScript availability contradiction

### Priority 2: Add Task Directives
1. `frontend_developer/add_component.md`
2. `devops_engineer/add_terraform_module.md`
3. `qa_engineer/write_test.md`
4. `common/create_database_migration.md`
5. `common/create_typeorm_model.md`

### Priority 3: Add Missing Guidance
1. Concurrent work / merge conflict handling
2. Escalation procedures
3. Resource limits documentation
4. Rate limiting handling
5. API key documentation

### Priority 4: Process Improvements
1. Seed self-annealing notes with known patterns
2. Add test fixture examples
3. Add mobile-specific guidance

---

## Files to Review/Create

| Action | File |
|--------|------|
| CREATE | `directives/tech_writer/README.md` |
| CREATE | `directives/project_manager/README.md` |
| CREATE | `directives/frontend_developer/add_component.md` |
| CREATE | `directives/common/create_migration.md` |
| CREATE | `directives/common/escalation.md` |
| UPDATE | `AGENTS.md` - clarify TypeScript availability |
| UPDATE | All READMEs - add real self-annealing notes |
| AUDIT | `execution/` - verify which scripts exist |

---

## Verification

To validate these findings:
1. Run `ls -la backend/ai-worker/execution/` to check which scripts exist ✅ Done
2. Check if any workers have successfully used self-annealing
3. Review recent worker failures to identify patterns
