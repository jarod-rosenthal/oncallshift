# Post-Task Review

> Gartner: "Post-incident reviews analyze what happened, why, and how the response unfolded, focusing on actionable lessons rather than individual blame."

## Goal

Conduct blameless post-task reviews when tasks encounter significant challenges, ensuring learnings are captured and fed back into directive improvements.

## When to Perform a Review

Perform a post-task review when ANY of these conditions are met:

| Trigger | Threshold | Why |
|---------|-----------|-----|
| **Duration exceeded** | 2x the severity SLA | Task took much longer than expected |
| **Multiple attempts** | 3+ retries on same operation | Indicates systemic issue |
| **Escalation required** | Any escalation | Something wasn't clear or automated |
| **Novel solution** | First time using an approach | Others can learn from this |
| **Near miss** | Almost deployed broken code | Prevented a problem, should document |

## Blameless Review Principles

### The Core Rule

> **Focus on WHAT went wrong, not WHO went wrong.**

Every AI worker (and human) did their best with the information available at the time. The goal is systemic improvement, not blame.

### Key Principles

1. **Assume good intent** - Decisions made sense with available context
2. **Seek systemic causes** - Individual errors usually have systemic roots
3. **Focus on learning** - Every challenge is an opportunity to improve
4. **Document for others** - Your learning helps future workers
5. **Suggest concrete changes** - Vague lessons don't help

## Review Template

Add this section to your completion comment for qualifying tasks:

```markdown
---

## Post-Task Review

### Summary
[1-2 sentence overview of what made this task notable]

### Timeline
- **Started:** [timestamp]
- **First blocker:** [timestamp] - [brief description]
- **Escalated:** [timestamp] (if applicable)
- **Resolved:** [timestamp]
- **Total duration:** [X hours] (SLA was [Y hours])

### What Went Well
- [Positive outcome 1]
- [Positive outcome 2]

### What Was Challenging
- [Challenge 1 - be specific]
- [Challenge 2 - be specific]

### Root Cause Analysis (5 Whys)

**Problem:** [The main challenge or delay]

1. **Why** did this happen?
   → [First-level cause]

2. **Why** was that the case?
   → [Deeper cause]

3. **Why** did that occur?
   → [Even deeper]

4. **Why** wasn't that prevented?
   → [Systemic cause]

5. **Why** does that systemic issue exist?
   → [Root cause - usually process, tooling, or documentation gap]

### Action Items

- [ ] **Directive update:** [Specific change to make to which directive]
- [ ] **Execution script:** [New script to create or existing one to improve]
- [ ] **Follow-up ticket:** [Jira ticket to create for larger improvements]

### Lessons for Future AI Workers

> [Clear, actionable advice for the next worker who encounters a similar task]

---
```

## 5 Whys Examples

### Example 1: Deployment Failed

**Problem:** Deployment failed after code changes were made

1. **Why?** → The Docker build failed with a TypeScript error
2. **Why?** → A type was imported from a file that doesn't exist in the container
3. **Why?** → The import path used a local alias that isn't configured in Docker
4. **Why?** → The tsconfig.json paths aren't copied to the Docker build context
5. **Why?** → The directive doesn't mention checking import paths before committing

**Action:** Update `test_before_commit.md` to include import path verification step.

### Example 2: Task Took 3x Longer Than Expected

**Problem:** P3 task took 72 hours instead of 24 hours

1. **Why?** → Spent 40 hours trying different approaches to the database query
2. **Why?** → The existing query patterns didn't apply to this use case
3. **Why?** → This was a complex aggregation that needed a different approach
4. **Why?** → The directive doesn't distinguish simple queries from complex ones
5. **Why?** → No complexity assessment step exists in the directive

**Action:** Add "complexity assessment" pre-flight check to `backend_developer/README.md`.

## Feeding Back Improvements

### Update Directives

After completing the review, update the relevant directive:

1. Find the directive file in `directives/`
2. Add your learning to the "Self-Annealing Notes" section
3. If a new step is needed, add it to the main procedure
4. Commit with message: `docs(ai-worker): add learning from OCS-XXX`

### Create Execution Scripts

If you found yourself doing something manually that should be automated:

1. Create a new script in `execution/`
2. Test it works
3. Reference it in the directive
4. Commit on a `self-anneal/*` branch for review

### File Follow-Up Tickets

For improvements too large to do immediately:

1. Create a Jira ticket with:
   - Clear description of the improvement needed
   - Reference to the original task that surfaced this
   - Suggested approach
2. Link it to the original task
3. Add to your completion comment

## Review Metrics

Track these to measure review effectiveness:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Reviews performed | 100% of qualifying tasks | Count reviews / qualifying tasks |
| Action items completed | > 80% within 2 weeks | Track action item completion |
| Recurring issues | < 10% | Same root cause appearing twice |
| Directive updates | 2+ per week | Count commits to directives/ |

## Self-Annealing Notes

*Updated by AI Workers when they learn something about the review process*

