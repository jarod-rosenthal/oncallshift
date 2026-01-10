# Escalation Policy

> Gartner: "Organizations with well-defined escalation policies resolve incidents 40% faster."

## Goal

Ensure blocked tasks are routed to appropriate help quickly, minimizing time-to-resolution and preventing silent failures.

## Escalation Tiers

### Tier 1: AI Worker (You)
- **Role**: First responder, autonomous problem solver
- **Authority**: Make code changes, deploy safe changes, create PRs
- **Escalate when**: Blocked beyond threshold, uncertain about approach, security concerns

### Tier 2: Human Developer
- **Role**: Technical guidance, unblock AI workers
- **Authority**: Approve risky changes, provide architectural direction
- **Escalate when**: Cross-team coordination needed, business decisions required

### Tier 3: Team Lead / Manager
- **Role**: Priority decisions, resource allocation
- **Authority**: Reprioritize work, involve stakeholders
- **Escalate when**: P1 not progressing, multiple related failures

## Automatic Escalation Triggers

### Time-Based Triggers

| Severity | Block Threshold | Action |
|----------|-----------------|--------|
| P1 | 15 minutes | Jira comment + `needs-human-intervention` label |
| P2 | 30 minutes | Jira comment + `needs-human-intervention` label |
| P3 | 2 hours | Jira comment only |
| P4-P5 | 24 hours | Jira comment only |

### Condition-Based Triggers

Escalate immediately (regardless of severity) when:

1. **Security vulnerability discovered** during investigation
2. **Data integrity issue** detected
3. **3+ failed attempts** at the same operation
4. **Architectural decision required** that affects other services
5. **Unclear requirements** that cannot be resolved from ticket/codebase

## Escalation Procedure

### Step 1: Document the Blocker

Add a Jira comment with this format:

```
[ESCALATION REQUEST]

**Severity:** P2
**Blocked Duration:** 35 minutes
**Task:** Implement user authentication endpoint

**Blocker:**
Unable to determine the correct OAuth flow. The existing code uses JWT but
the ticket mentions OAuth2. Need clarification on:
1. Should this use the existing JWT middleware?
2. Or implement new OAuth2 flow?

**What I've Tried:**
1. Searched codebase for OAuth patterns - found none
2. Checked related tickets - no clarification
3. Reviewed auth middleware - uses JWT only

**Help Needed:**
Guidance on authentication approach before I proceed.

**Impact if Delayed:**
This blocks OCS-124 and OCS-125 which depend on this endpoint.
```

### Step 2: Add Escalation Label

```bash
# Add the escalation label to the Jira ticket
JIRA_KEY=$JIRA_ISSUE_KEY LABEL="needs-human-intervention" node /app/execution-compiled/jira/add_label.js
```

### Step 3: Continue Working (If Possible)

While waiting for help:
- Work on other aspects of the task that aren't blocked
- Document findings that might help the human reviewer
- Prepare alternative approaches to discuss
- Do NOT context-switch to a different task unless explicitly told to

### Step 4: De-escalation

When help arrives:
1. Acknowledge the guidance in Jira
2. Remove the `needs-human-intervention` label
3. Continue with the task
4. Document what you learned in your completion comment

## Escalation Anti-Patterns

### DO NOT:

1. **Escalate too early** - Try for at least the threshold duration first
2. **Escalate without details** - "I'm stuck" is not helpful
3. **Abandon the task** - Keep working on what you can
4. **Escalate the same issue repeatedly** - If no response, wait or try alternatives
5. **Work around security issues** - Always escalate security concerns immediately

### DO:

1. **Provide context** - What you tried, what failed, what you need
2. **Suggest alternatives** - "I could do A or B, which is preferred?"
3. **Quantify impact** - What's blocked by this, what's the urgency
4. **Stay engaged** - Monitor for responses, be ready to continue

## Escalation Metrics

Track these to improve the process:

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Escalation Response Time | < 30 min for P1-P2 | Measures team responsiveness |
| Escalations per Task | < 1 average | High rate indicates unclear requirements |
| False Escalations | < 10% | Escalations that weren't needed |
| Resolution After Escalation | < 2 hours | Measures guidance effectiveness |

## Self-Annealing Notes

*Updated by AI Workers when they learn something about escalation*

