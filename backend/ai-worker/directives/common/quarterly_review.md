# Quarterly Directive Review

> Gartner: "Escalation policies should undergo quarterly reviews at minimum, with additional reviews after major incidents or system changes."

## Goal

Ensure AI Worker directives remain current, effective, and aligned with best practices through regular review cycles.

## Review Schedule

| Quarter | Focus Area | Primary Reviewer |
|---------|------------|------------------|
| Q1 (Jan-Mar) | Metrics & SLAs | Platform Team |
| Q2 (Apr-Jun) | Security & Compliance | Security Team |
| Q3 (Jul-Sep) | Runbook Maturity | DevOps Team |
| Q4 (Oct-Dec) | Full Audit | All Teams |

### Additional Reviews

Trigger an out-of-cycle review when:
- Major incident caused by AI Worker action
- New persona or task type added
- Significant platform changes (new tools, APIs, infrastructure)
- 3+ similar escalations in one week

## Review Checklist

### 1. Metrics Review

```markdown
## Metrics Assessment

**Period:** [Quarter] [Year]

### Key Performance Indicators

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| MTTA (P1-P2) | < 15 min | [X] min | [Pass/Fail] |
| MTTR (P1) | < 1 hour | [X] hours | [Pass/Fail] |
| MTTR (P2) | < 4 hours | [X] hours | [Pass/Fail] |
| Task Success Rate | > 90% | [X]% | [Pass/Fail] |
| Escalation Rate | < 20% | [X]% | [Pass/Fail] |
| False Escalations | < 10% | [X]% | [Pass/Fail] |

### Trends

- [ ] MTTR trending down quarter-over-quarter?
- [ ] Escalation rate stable or improving?
- [ ] Any severity level with notably worse metrics?

### Action Items

- [ ] [Action based on metrics]
```

### 2. Directive Content Review

For each directive file, verify:

```markdown
## Directive Review: [filename]

### Accuracy
- [ ] All file paths still valid?
- [ ] All execution scripts still exist and work?
- [ ] Code examples compile and follow current patterns?
- [ ] No references to deprecated tools or APIs?

### Completeness
- [ ] All common scenarios covered?
- [ ] Edge cases documented?
- [ ] Error handling guidance included?
- [ ] Self-annealing notes incorporated into main content?

### Clarity
- [ ] Steps are in logical order?
- [ ] No ambiguous instructions?
- [ ] Examples are helpful and realistic?
- [ ] New AI worker could follow this without confusion?

### Improvements Needed
- [ ] [Specific improvement 1]
- [ ] [Specific improvement 2]
```

### 3. Escalation Policy Review

```markdown
## Escalation Policy Assessment

### Effectiveness
- [ ] Escalation thresholds still appropriate?
- [ ] Response times meeting SLA?
- [ ] Escalation paths reaching the right people?

### Coverage
- [ ] Any new escalation scenarios to add?
- [ ] Any scenarios that no longer apply?
- [ ] Any severity levels needing threshold adjustment?

### Process
- [ ] Escalation documentation clear?
- [ ] De-escalation process working?
- [ ] Feedback loop to AI workers effective?
```

### 4. Security Review

```markdown
## Security Assessment

### Current Controls
- [ ] OWASP Top 10 compliance still valid?
- [ ] Forbidden actions list current?
- [ ] Credential handling secure?
- [ ] Input validation requirements clear?

### New Threats
- [ ] Any new vulnerability patterns to add?
- [ ] Any new attack vectors to document?
- [ ] Any dependencies with security issues?

### Compliance
- [ ] SOC2 requirements met?
- [ ] Data handling guidelines current?
- [ ] Audit trail sufficient?
```

### 5. Runbook Maturity Assessment

```markdown
## Runbook Maturity

### Coverage by Level

| Level | Description | Target | Current |
|-------|-------------|--------|---------|
| L0 | Manual (no automation) | < 10% | [X]% |
| L1 | Scripted (execution script exists) | 40% | [X]% |
| L2 | Tested (script has tests) | 30% | [X]% |
| L3 | Monitored (success rate tracked) | 15% | [X]% |
| L4 | Self-healing (auto-recovery) | 5% | [X]% |

### Scripts Needing Improvement

| Script | Current Level | Issue | Target Level |
|--------|---------------|-------|--------------|
| [script1] | L1 | No tests | L2 |
| [script2] | L2 | No monitoring | L3 |

### New Scripts Needed

- [ ] [Scenario that should be automated]
- [ ] [Another scenario]
```

### 6. Self-Annealing Notes Audit

```markdown
## Self-Annealing Notes Review

### Notes to Incorporate

Review all self-annealing notes and determine:

| Directive | Note Date | Summary | Action |
|-----------|-----------|---------|--------|
| [file] | [date] | [summary] | Incorporate / Discard / Follow-up |

### Incorporation Actions

- [ ] Update [directive] with [learning]
- [ ] Create execution script for [pattern]
- [ ] File ticket for [larger improvement]
```

## Review Output

After completing the quarterly review, produce:

### 1. Summary Report

Create a summary document:

```markdown
# Q[X] AI Worker Directive Review Summary

**Review Date:** [Date]
**Reviewers:** [Names]

## Key Findings

### What's Working Well
- [Finding 1]
- [Finding 2]

### Areas for Improvement
- [Area 1]: [Specific issue and proposed fix]
- [Area 2]: [Specific issue and proposed fix]

## Metrics Summary

| Metric | Q[X-1] | Q[X] | Trend |
|--------|--------|------|-------|
| MTTR (P1) | X hr | Y hr | [Up/Down] |
| Success Rate | X% | Y% | [Up/Down] |
| Escalation Rate | X% | Y% | [Up/Down] |

## Action Items

| Item | Owner | Due Date | Priority |
|------|-------|----------|----------|
| [Action] | [Owner] | [Date] | [P1-P4] |

## Next Review

**Date:** [Next quarter start + 2 weeks]
**Focus:** [Next quarter's focus area]
```

### 2. Updated Directives

Commit all directive updates with:
```
docs(ai-worker): Q[X] quarterly review updates

- Updated [directive1] with [change]
- Added [new directive]
- Removed [deprecated content]

Reviewed by: [Names]
```

### 3. Improvement Tickets

Create Jira tickets for:
- Large improvements that can't be done during review
- New execution scripts needed
- Process changes requiring broader discussion

## Self-Annealing Notes

*Updated by reviewers when they learn something about the review process*

