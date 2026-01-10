# Gartner Best Practices Implementation Plan for AI Worker Directives

## Executive Summary

This document analyzes how OnCallShift's AI Worker agent directives align with Gartner's best practices for incident management and automation, identifies gaps, and provides an actionable implementation plan.

---

## Part 1: Current Alignment with Gartner Best Practices

### What We're Doing Well

| Gartner Best Practice | Current Implementation | Status |
|----------------------|------------------------|--------|
| **Algorithmic Service Operations** | 3-layer architecture (Directive → Orchestration → Execution) separates concerns and pushes complexity into deterministic scripts | ✅ Strong |
| **Test-First Approach** | `fix_bug.md` mandates writing failing test before fixing code | ✅ Strong |
| **Documentation as Code** | Self-annealing notes in directives, Jira comments mandatory | ✅ Strong |
| **Risk Assessment** | Explicit risk criteria for deployment decisions (HIGH RISK vs SAFE) | ✅ Strong |
| **Human-in-the-Loop** | Risky changes require human review, manager approval workflow | ✅ Strong |
| **Automated Runbooks** | Execution scripts in `/app/execution-compiled/` follow runbook patterns | ✅ Strong |
| **Multi-Tenancy Security** | All queries scoped by `orgId`, OWASP Top 10 compliance required | ✅ Strong |
| **Continuous Improvement** | Self-annealing protocol for learning from failures | ✅ Strong |
| **Clear Success Criteria** | Definition of Done checklist in AGENTS.md | ✅ Strong |
| **Version Control** | Git workflow with branch naming conventions, PR requirements | ✅ Strong |

### Partial Alignment

| Gartner Best Practice | Current State | Gap |
|----------------------|---------------|-----|
| **Severity Classification** | Risk assessment exists but no formal severity tiers (P1-P5) | Needs standardization |
| **Metrics Tracking** | No MTTR/MTTA tracking for AI worker tasks | Needs implementation |
| **Stakeholder Communication** | Jira comments only, no multi-channel notification | Limited |
| **Escalation Paths** | Manager review exists but no tiered escalation | Needs expansion |
| **Tabletop Exercises** | No formal testing of AI worker response procedures | Missing |
| **Post-Incident Review** | Self-annealing exists but not formalized for task failures | Needs enhancement |

---

## Part 2: Identified Gaps

### Gap 1: No Formal Severity Classification System

**Gartner Recommendation:** "Define what constitutes an incident, and categorize it based on severity, urgency, and potential consequences using a scale (e.g., 1-5)."

**Current State:** Risk assessment is binary (HIGH RISK vs SAFE). No P1-P5 classification.

**Impact:** Workers cannot prioritize tasks appropriately. Critical bugs treated same as minor improvements.

### Gap 2: No Incident Metrics (MTTR, MTTA, MTTD)

**Gartner Recommendation:** "Mature I&O organizations have a clear focus on key metrics: MTTD, MTTR, and number of P1 vs P2 incidents. Define year-over-year reduction targets."

**Current State:** No tracking of:
- Mean Time to Acknowledge (MTTA) - when worker claims task
- Mean Time to Resolve (MTTR) - task completion time
- Mean Time to Deploy (MTTD) - deployment success rate
- Task failure rates by type

**Impact:** Cannot measure improvement or identify systemic issues.

### Gap 3: Limited Stakeholder Communication

**Gartner Recommendation:** "Multiple channels and methods of communication (email, phone, text, chat, alert systems). Clear, concise information about incident type, severity, impact, scope, root cause, actions taken, expected resolution time."

**Current State:** Only Jira comments. No real-time notifications for critical failures.

**Impact:** Team unaware of AI worker struggles until checking Jira manually.

### Gap 4: No Tiered Escalation Policy

**Gartner Recommendation:** "Organizations with well-defined escalation policies resolve incidents 40% faster. Three core components: severity-based triggers, tiered support structure, automated notification routing."

**Current State:** Single-tier: worker fails → blocked. No automatic escalation.

**Impact:** Blocked tasks sit idle instead of being routed to appropriate help.

### Gap 5: No Post-Task Review Process

**Gartner Recommendation:** "Post-incident reviews analyze what happened, why, and how the response unfolded. Focus on actionable lessons. Feed findings back into process adjustments and training."

**Current State:** Self-annealing exists for script failures, but no systematic post-task review for:
- Tasks that took too long
- Tasks that required multiple attempts
- Tasks with unexpected blockers

**Impact:** Learning happens ad-hoc, patterns not identified.

### Gap 6: No Blameless Postmortem Culture

**Gartner Recommendation:** "A truly effective post-mortem focuses on what went wrong, not who went wrong. Ask 'why' five times to reach systemic causes."

**Current State:** Completion comments focus on what was done, not lessons learned.

**Impact:** Same issues recur because root causes aren't addressed.

### Gap 7: Runbook Maturity Not Measured

**Gartner Recommendation:** "Automated runbooks should be treated like production code: tested, versioned, reviewed, rolled out gradually. Define clear success criteria."

**Current State:** Execution scripts exist but no:
- Coverage metrics (what % of common tasks are automated)
- Success rate tracking per script
- Version history with improvement notes

**Impact:** Cannot identify which runbooks need improvement.

### Gap 8: No Quarterly Policy Review

**Gartner Recommendation:** "Escalation policies should undergo quarterly reviews at minimum, with additional reviews after major incidents or system changes."

**Current State:** No formal review cadence for directives.

**Impact:** Directives may become stale or miss evolving best practices.

---

## Part 3: Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### Deployment Note

**The AI Worker Orchestrator has a dedicated deployment script:** `./deploy-orchestrator.sh`

This script:
- Rebuilds backend TypeScript
- Builds Docker image with version tag
- Pushes to ECR
- Force redeploys the `pagerduty-lite-dev-aiw-orch` ECS service
- Waits for new task to start and verifies logs

**Deployment order for Phase 1:**
1. Run database migration first (via `./deploy.sh` or direct psql)
2. Deploy orchestrator changes (via `./deploy-orchestrator.sh`)
3. Update directive files (no deployment needed - they're read at runtime)

#### 1.1 Add Severity Classification to AGENTS.md

Add to `backend/ai-worker/AGENTS.md`:

```markdown
## Task Severity Classification

Classify every task based on business impact:

| Severity | Description | SLA | Examples |
|----------|-------------|-----|----------|
| **P1 - Critical** | Production down, data loss risk | 1 hour | Security vulnerability, API outage |
| **P2 - High** | Major feature broken | 4 hours | Auth failing, payments broken |
| **P3 - Medium** | Feature degraded | 24 hours | Performance issue, minor bug |
| **P4 - Low** | Improvement/enhancement | 72 hours | UI polish, documentation |
| **P5 - Planned** | Scheduled work | Sprint | New features, refactoring |

### Determining Severity

1. Check Jira priority field
2. Look for keywords: "urgent", "critical", "blocker", "production"
3. When uncertain, ask via Jira comment before starting
```

#### 1.2 Integration Points (Push-Based Architecture)

**Architecture Note:** The orchestrator is now push-based:
- Tasks are triggered immediately via `POST /api/v1/ai-worker-tasks/:id/trigger`
- Orchestrator runs but doesn't poll - just keeps alive for task monitoring
- The idle loop (sleeps 60s) can be used for periodic escalation checks

**In API route `ai-worker-tasks.ts` - `/trigger` endpoint (~line 326):**
```typescript
// After task status is set to 'executing', add:
task.acknowledgedAt = new Date();
task.severity = AIWorkerTask.mapPriorityToSeverity(task.priority);
task.startedAt = new Date();
task.status = "executing";
await taskRepo.save(task);
```

**In orchestrator `monitorTaskCompletion()` method (~line 373):**
```typescript
// After successful completion (before marking complete), add:
task.requiresPostReview = task.determinePostReviewRequired();
```

**New method in orchestrator for escalation checking:**
```typescript
private async checkForStuckTasks(): Promise<void> {
  const taskRepo = this.dataSource.getRepository(AIWorkerTask);

  // Find tasks in active states without recent heartbeat
  const stuckTasks = await taskRepo
    .createQueryBuilder('task')
    .where('task.status IN (:...activeStatuses)', {
      activeStatuses: ['claimed', 'environment_setup', 'executing']
    })
    .andWhere('task.lastHeartbeatAt < :threshold', {
      threshold: new Date(Date.now() - 15 * 60 * 1000) // 15 min
    })
    .andWhere('task.escalationCount = 0')
    .getMany();

  for (const task of stuckTasks) {
    const blockedMinutes = task.lastHeartbeatAt
      ? (Date.now() - task.lastHeartbeatAt.getTime()) / 60000
      : 999;

    if (task.shouldEscalate(blockedMinutes)) {
      task.escalate(`Blocked for ${Math.floor(blockedMinutes)} minutes`);
      await taskRepo.save(task);
      await this.logTaskEvent(task, 'escalation',
        `Task escalated: blocked for ${Math.floor(blockedMinutes)} minutes`);
      // TODO: Send Slack notification
    }
  }
}
```

**Modify orchestrator `start()` idle loop (~line 129):**
```typescript
async start(): Promise<void> {
  this.running = true;
  logger.info('AI Worker Orchestrator starting (push-based mode)...');
  await this.initialize();

  // Periodic escalation check counter
  let checkCounter = 0;

  while (this.running) {
    await this.sleep(60000); // Sleep 1 minute

    // Check for stuck tasks every 5 minutes
    checkCounter++;
    if (checkCounter >= 5) {
      checkCounter = 0;
      await this.checkForStuckTasks();
    }
  }
}
```

#### 1.3 Add Metrics Tracking Schema

Create migration `backend/src/shared/db/migrations/069_ai_worker_metrics.sql`:

```sql
-- Track AI worker task metrics for MTTR/MTTA analysis
ALTER TABLE ai_worker_tasks ADD COLUMN IF NOT EXISTS
  severity VARCHAR(10) DEFAULT 'P4';

ALTER TABLE ai_worker_tasks ADD COLUMN IF NOT EXISTS
  acknowledged_at TIMESTAMPTZ;

ALTER TABLE ai_worker_tasks ADD COLUMN IF NOT EXISTS
  first_commit_at TIMESTAMPTZ;

-- Create metrics aggregation view
CREATE OR REPLACE VIEW ai_worker_metrics_daily AS
SELECT
  DATE(created_at) as date,
  severity,
  persona,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))/60) as avg_mtta_minutes,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_mttr_minutes
FROM ai_worker_tasks
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), severity, persona;
```

#### 1.3 Update Task Lifecycle Tracking

Update AI worker orchestrator to track:
- `acknowledged_at` when task is claimed
- `first_commit_at` when first commit is pushed
- `severity` from Jira priority mapping

### Phase 2: Communication & Escalation (Week 3-4)

#### 2.1 Create Escalation Policy Directive

Create `backend/ai-worker/directives/common/escalation_policy.md`:

```markdown
# Escalation Policy

## Automatic Escalation Triggers

### Tier 1 → Tier 2 (AI Worker → Human Developer)
Escalate when:
- Task blocked for > 30 minutes with no progress
- 3+ failed attempts at same operation
- Security-sensitive code changes detected
- P1/P2 tasks not progressing

### Tier 2 → Tier 3 (Human Developer → Team Lead)
Escalate when:
- P1 task not resolved within 1 hour
- Multiple related failures detected
- Architectural decisions required

## Escalation Actions

1. **Add Jira comment** with escalation reason
2. **Change Jira assignee** to escalation target
3. **Add label** `needs-human-intervention`
4. **Send Slack notification** (if configured)
5. **Update task status** to `escalated`

## De-escalation

When escalation target provides guidance:
1. AI Worker can resume work
2. Update task status to `in_progress`
3. Apply guidance and continue
```

#### 2.2 Add Slack Integration for Critical Alerts

Add to orchestrator: send Slack notification for:
- P1/P2 task failures
- Tasks blocked > 1 hour
- Security issues detected

### Phase 3: Post-Task Review (Week 5-6)

#### 3.1 Create Post-Task Review Directive

Create `backend/ai-worker/directives/common/post_task_review.md`:

```markdown
# Post-Task Review

## When to Perform Review

Perform a blameless review when:
- Task took 2x longer than estimated
- Task required 3+ attempts
- Unexpected blockers encountered
- Novel solution discovered

## Review Template

Add this to your completion comment for significant learnings:

### Post-Task Review (OCS-XXX)

**What happened:**
[Brief description of the task and outcome]

**What went well:**
- [Positive outcome 1]
- [Positive outcome 2]

**What was challenging:**
- [Challenge 1]
- [Challenge 2]

**Root cause analysis (5 Whys):**
1. Why did [problem] occur? → [Answer]
2. Why? → [Deeper answer]
3. Why? → [Even deeper]
4. Why? → [Systemic cause]
5. Why? → [Root cause]

**Action items:**
- [ ] [Improvement 1] - Add to directive
- [ ] [Improvement 2] - Create execution script
- [ ] [Improvement 3] - File follow-up Jira ticket

**Lessons for future AI workers:**
[What should other AI workers know about this type of task?]
```

#### 3.2 Add Automatic Review Triggers

Update orchestrator to flag tasks for review based on:
- Duration exceeding severity SLA
- Multiple status transitions
- Error count threshold

### Phase 4: Runbook Maturity (Week 7-8)

#### 4.1 Create Runbook Coverage Tracking

Add to AGENTS.md:

```markdown
## Runbook Maturity Levels

| Level | Criteria | Target |
|-------|----------|--------|
| **L0 - Manual** | No automation, follow written steps | < 10% |
| **L1 - Scripted** | Execution script exists | 40% |
| **L2 - Tested** | Script has automated tests | 30% |
| **L3 - Monitored** | Success rate tracked, alerts on failures | 15% |
| **L4 - Self-Healing** | Auto-recovery on common failures | 5% |

## Current Coverage

| Category | L0 | L1 | L2 | L3 | L4 |
|----------|----|----|----|----|-----|
| Git operations | 0% | 80% | 60% | 20% | 0% |
| Jira integration | 0% | 90% | 50% | 30% | 0% |
| Testing | 20% | 60% | 40% | 10% | 0% |
| Deployment | 10% | 70% | 30% | 20% | 0% |

*Update this table quarterly*
```

#### 4.2 Add Success Rate Tracking per Script

Create execution script wrapper that tracks:
- Invocation count
- Success/failure count
- Average execution time
- Common error types

### Phase 5: Quarterly Review Process (Ongoing)

#### 5.1 Create Review Checklist

Create `backend/ai-worker/directives/common/quarterly_review.md`:

```markdown
# Quarterly Directive Review

## Review Checklist

### Metrics Review
- [ ] MTTR trending down?
- [ ] MTTA within SLA?
- [ ] Task failure rate < 10%?
- [ ] Runbook coverage improving?

### Directive Updates
- [ ] All self-annealing notes reviewed and incorporated
- [ ] Outdated patterns removed
- [ ] New patterns from successful tasks added
- [ ] Edge cases documented

### Escalation Policy
- [ ] Escalation triggers still appropriate?
- [ ] Response times meeting SLA?
- [ ] Any new escalation scenarios to add?

### Security Review
- [ ] Security best practices current?
- [ ] Any new OWASP considerations?
- [ ] Credential handling still secure?

### Tool Updates
- [ ] Execution scripts still working?
- [ ] Any deprecated APIs to update?
- [ ] New tools to integrate?

## Review Schedule

| Quarter | Focus Area | Owner |
|---------|------------|-------|
| Q1 | Metrics & SLAs | Platform Team |
| Q2 | Security & Compliance | Security Team |
| Q3 | Runbook Maturity | DevOps Team |
| Q4 | Full Audit | All Teams |
```

---

## Part 4: Priority Matrix

| Initiative | Impact | Effort | Priority |
|-----------|--------|--------|----------|
| Severity Classification | High | Low | **1** |
| Metrics Tracking | High | Medium | **2** |
| Escalation Policy | High | Medium | **3** |
| Post-Task Review | Medium | Low | **4** |
| Slack Notifications | Medium | Medium | **5** |
| Runbook Maturity Tracking | Medium | Medium | **6** |
| Quarterly Review Process | Low | Low | **7** |

---

## Part 5: Success Metrics

### 6-Month Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| MTTR (P1 tasks) | Unknown | < 2 hours | ai_worker_metrics_daily view |
| MTTA (all tasks) | Unknown | < 15 min | ai_worker_metrics_daily view |
| Task Success Rate | ~70% est | > 90% | completed/(completed+failed) |
| Runbook Coverage (L1+) | ~60% est | > 85% | Manual audit |
| Escalation Response | N/A | < 30 min | New tracking |
| Post-Task Reviews | 0% | > 50% for P1-P3 | Jira comment audit |

---

## References

- [Gartner: ITSM Best Practices for Major Incident Management](https://www.gartner.com/en/documents/6397475)
- [Gartner: How to Get Started with AIOps](https://www.gartner.com/smarterwithgartner/how-to-get-started-with-aiops)
- [Gartner: ITSM Best Practices for Automating Incident Management](https://www.gartner.com/en/documents/6883766)
- [BigPanda: Gartner's 4 Steps to Turbocharge Major Incident Handling](https://www.bigpanda.io/blog/bigpanda-perspective-gartner-4-steps-turbocharge-major-incident-handling/)
- [Gartner Peer Community: Best Practices for Outage Notifications](https://www.gartner.com/peer-community/post/best-practices-outage-notifications-how-keep-it-leadership-team-aware-real-time-how-support-desk-organization-get-involved)
- [Gartner Peer Community: Incident Response Communications](https://www.gartner.com/peer-community/post/how-structure-incident-response-communications-coordination-stakeholders-informed-make-decisions-quickly-have-found-effective)
- [Aisera: Complete Guide to Gartner on AIOps](https://aisera.com/blog/gartner-on-aiops-the-complete-guide/)
- [ITIL Best Practices Guide 2026](https://itsm.tools/itil-best-practices/)
- [Atlassian: Incident Management Metrics](https://www.atlassian.com/incident-management/kpis/common-metrics)
