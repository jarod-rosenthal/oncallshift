# Manager Guide

This guide covers team management tasks in OnCallShift. As a manager, you configure schedules, create escalation policies, monitor team performance, and generate reports.

## Table of Contents

- [Schedule Management](#schedule-management)
- [Escalation Policies](#escalation-policies)
- [Service Configuration](#service-configuration)
- [Team Performance](#team-performance)
- [Reports and Analytics](#reports-and-analytics)
- [Runbook Management](#runbook-management)
- [Stakeholder Communication](#stakeholder-communication)
- [Best Practices](#best-practices)

---

## Schedule Management

On-call schedules determine who receives alerts at any given time.

### Creating a Schedule

1. Navigate to **Schedules** > **Create Schedule**
2. Configure basic settings:
   - **Name**: e.g., "Backend Primary On-Call"
   - **Description**: Coverage and responsibilities
   - **Timezone**: Team's primary timezone
   - **Team**: Associated team

[Screenshot: Schedule creation form]

### Rotation Types

Choose the rotation that fits your team:

#### Weekly Rotation
- One person on-call for a full week
- Good for: Small teams, predictable workloads
- Handoff: Same day/time each week

#### Daily Rotation
- Rotates each day
- Good for: Spreading load evenly
- Handoff: Same time each day

#### Custom Rotation
- Define specific patterns
- Good for: Follow-the-sun, split shifts
- Example: 12-hour shifts, weekday/weekend split

### Adding Participants

1. Open the schedule
2. Click **Add Participants**
3. Select team members
4. Arrange order (drag to reorder)
5. Optionally set participation percentage

[Screenshot: Participant list with drag handles]

### Setting Handoff Time

Configure when shifts change:

1. Edit the schedule
2. Set **Handoff Time** (e.g., 9:00 AM)
3. Set **Handoff Day** (for weekly rotations)
4. Consider:
   - Business hours start
   - Overlap with previous shift
   - Team preferences

### Schedule Layers

Create complex schedules with layers:

**Primary Layer**: Main on-call rotation
**Secondary Layer**: Backup coverage
**Override Layer**: Temporary changes

Layers stack - lower layers fill gaps in higher layers.

Example:
```
Override Layer:  | Alice (vacation cover) |                      |
Primary Layer:   | Bob        | Carol       | David              |
```

### Schedule Overrides

Handle vacations, sick days, and special coverage:

1. Open the schedule
2. Click **Create Override**
3. Select:
   - **Who**: The replacement person
   - **Start**: When override begins
   - **End**: When override ends
   - **Reason**: Vacation, sick, swap, etc.

[Screenshot: Override creation modal]

### Viewing Current On-Call

See who's on-call right now:

1. Go to **Schedules**
2. View the **Currently On-Call** section
3. Or use the calendar view for future coverage

API endpoint: `GET /api/v1/schedules/:id/oncall`

---

## Escalation Policies

Escalation policies define who gets notified and when.

### Creating an Escalation Policy

1. Navigate to **Escalation Policies** > **Create**
2. Enter:
   - **Name**: e.g., "Payment Service Critical"
   - **Description**: When to use this policy
   - **Team**: Associated team

### Adding Escalation Steps

Build your escalation chain:

**Step 1 - Immediate** (0 minutes)
- Target: Primary on-call schedule
- Notification: Push + SMS

**Step 2 - First Escalation** (5 minutes)
- Target: Secondary on-call schedule
- Notification: Push + SMS + Phone

**Step 3 - Manager Escalation** (15 minutes)
- Target: Engineering Manager
- Notification: All channels

**Step 4 - Executive Escalation** (30 minutes)
- Target: VP Engineering
- Notification: All channels

[Screenshot: Escalation policy with multiple steps]

### Step Configuration

For each step, configure:

| Setting | Description |
|---------|-------------|
| **Targets** | Who to notify (schedules, users, or groups) |
| **Timeout** | Minutes before escalating to next step |
| **Notification Channels** | How to notify (push, email, SMS, phone) |
| **Repeat** | Re-notify if unacknowledged (optional) |

### Multiple Targets per Step

Notify multiple people simultaneously:

1. Add step
2. Click **Add Target**
3. Add additional schedules or users
4. All targets receive notification at once

### Escalation Policy Best Practices

- **Always have multiple steps** - Single-person policies create single points of failure
- **Include managers early** - They need visibility into ongoing incidents
- **Set appropriate timeouts** - Too short causes notification fatigue
- **Test your policies** - Trigger test incidents to verify flow
- **Review regularly** - Update as team structure changes

---

## Service Configuration

Services represent systems that generate alerts.

### Creating Services

1. Navigate to **Services** > **Create Service**
2. Configure:
   - **Name**: "Payment API", "User Database"
   - **Description**: What this service does
   - **Team**: Owning team
   - **Escalation Policy**: Who handles alerts

### Service Settings

For each service, configure:

**Alert Settings**:
- **Auto-resolve timeout**: Auto-resolve if no updates (optional)
- **Alert grouping**: Combine related alerts
- **Suppression rules**: Filter out noisy alerts

**Integration Settings**:
- Webhook endpoints
- Authentication keys
- Event routing rules

### Service Dependencies

Map your service architecture:

1. Open service settings
2. Navigate to **Dependencies**
3. Add services this one depends on
4. Add services that depend on this one

Benefits:
- See impact of incidents
- Understand failure cascades
- Better AI analysis

### Service Maintenance Windows

Schedule maintenance to suppress alerts:

1. Open service
2. Click **Schedule Maintenance**
3. Set:
   - Start time
   - Duration
   - Notification behavior (suppress or reduce)
   - Description

---

## Team Performance

Monitor how your team handles incidents.

### Team Dashboard

Access team metrics:

1. Go to **Analytics** > **Team Performance**
2. Select your team
3. View:
   - Active incidents
   - MTTA (Mean Time to Acknowledge)
   - MTTR (Mean Time to Resolve)
   - Incident volume trends
   - Top triggered services

[Screenshot: Team performance dashboard]

### Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **MTTA** | Time from trigger to acknowledgment | < 5 minutes |
| **MTTR** | Time from trigger to resolution | Varies by severity |
| **Acknowledgment Rate** | % incidents acknowledged | > 95% |
| **Escalation Rate** | % incidents that escalate | < 20% |
| **Off-Hours %** | Incidents outside business hours | Track for burnout |

### Responder Analytics

View individual performance:

1. Navigate to **Analytics** > **Responders**
2. Filter by team and date range
3. See per-person:
   - Incidents handled
   - Average response time
   - On-call hours
   - Interruption count

### Identifying Issues

Red flags to watch:

- **High MTTA**: Notification issues or responder availability
- **High MTTR**: Complex issues or knowledge gaps
- **High escalation rate**: Primary responders need support
- **Uneven distribution**: Some team members overloaded
- **After-hours spikes**: System reliability issues

---

## Reports and Analytics

Generate reports for stakeholders and planning.

### Standard Reports

**Incident Summary Report**
- Total incidents by severity
- Trends over time
- Top services affected
- Resolution statistics

**On-Call Report**
- Hours worked by each responder
- Incidents per shift
- Off-hours interruptions
- Schedule coverage gaps

**Service Health Report**
- Incident frequency per service
- MTTR by service
- Most common alert types
- Improvement trends

### Generating Reports

1. Navigate to **Reports**
2. Select report type
3. Configure:
   - Date range
   - Teams or services to include
   - Grouping (daily, weekly, monthly)
4. Click **Generate**
5. Download as PDF, CSV, or view online

### Scheduled Reports

Automate regular reporting:

1. Go to **Reports** > **Scheduled**
2. Click **Create Schedule**
3. Configure:
   - Report type
   - Frequency (daily, weekly, monthly)
   - Recipients (email addresses)
   - Delivery time
4. Reports are emailed automatically

### Custom Analytics

For advanced analysis:

1. Use **Reports** > **Custom**
2. Select metrics and dimensions
3. Apply filters
4. Export data for external analysis

Or use the API:
```bash
GET /api/v1/analytics/incidents?team=backend&start=2026-01-01
```

---

## Runbook Management

Maintain runbooks for your team's services.

### Creating Runbooks

1. Navigate to **Runbooks** > **Create**
2. Structure your runbook:

```markdown
# High CPU on Payment Service

## Symptoms
- Alert: "CPU utilization > 90%"
- Slow API responses
- Timeout errors in logs

## Quick Diagnosis
1. Check current CPU: `top` or CloudWatch metrics
2. Identify high-CPU process: `ps aux --sort=-%cpu`
3. Check recent deployments: git log --oneline -10

## Resolution Steps
1. [ ] Scale up if legitimate traffic
2. [ ] Restart service if memory leak suspected
3. [ ] Roll back if recent deployment caused issue

## Escalation
If unresolved after 15 minutes, escalate to backend lead.
```

### Linking Runbooks to Services

1. Open the runbook
2. Click **Link to Services**
3. Select relevant services
4. Runbook appears in incident suggestions

### Runbook Automation

Enable automated execution:

1. Edit the runbook
2. Mark steps as "Automated"
3. Add the command or script
4. Set approval requirements:
   - **Auto-approve**: Runs without confirmation
   - **Require approval**: Needs responder confirmation
   - **Manager approval**: Needs manager sign-off

### Runbook Reviews

Keep runbooks current:

1. Schedule quarterly reviews
2. Check each runbook:
   - Are steps still accurate?
   - Are links working?
   - Are commands current?
3. Update based on recent incidents
4. Archive obsolete runbooks

---

## Stakeholder Communication

Keep stakeholders informed during incidents.

### Status Pages

Create public or private status pages:

1. Navigate to **Status Pages** > **Create**
2. Configure:
   - **Name**: "ACME Corp System Status"
   - **URL**: status.acme.com (custom domain)
   - **Visibility**: Public or authenticated
   - **Services**: Which services to show

### Posting Updates

During incidents:

1. Open the incident
2. Click **Post Status Update**
3. Write customer-friendly message
4. Select affected services
5. Set impact level
6. Publish

Updates appear on the status page immediately.

### Incident Communication Templates

Create templates for common scenarios:

**Service Degradation**:
> We are currently experiencing degraded performance with [Service]. Our team is investigating. We will provide updates every 30 minutes.

**Service Outage**:
> [Service] is currently unavailable. We have identified the issue and are working on a fix. Estimated resolution: [Time].

**Resolved**:
> The issue with [Service] has been resolved. All systems are operating normally. We apologize for any inconvenience.

---

## Best Practices

### Building a Healthy On-Call Culture

1. **Fair rotation** - Distribute on-call evenly
2. **Compensate appropriately** - Time off or additional pay
3. **Limit interruptions** - Fix noisy alerts
4. **Support responders** - Clear escalation paths
5. **Celebrate wins** - Recognize good incident handling

### Schedule Optimization

- **Avoid single points of failure** - Always have backup coverage
- **Respect time zones** - Follow-the-sun when possible
- **Plan for holidays** - Override coverage in advance
- **Review quarterly** - Adjust for team changes

### Reducing Incident Volume

1. **Track incident sources** - Identify noisy services
2. **Improve alerting** - Better thresholds, smarter alerts
3. **Fix root causes** - Postmortems lead to fixes
4. **Automate responses** - Runbook automation
5. **Invest in reliability** - Engineering time for stability

### Effective Postmortems

After major incidents:

1. **Schedule promptly** - Within 48 hours
2. **Blameless culture** - Focus on systems, not people
3. **Document timeline** - What happened when
4. **Identify causes** - Root cause and contributing factors
5. **Create action items** - Specific, assigned, deadlined
6. **Share learnings** - Cross-team visibility

### Manager Responsibilities

Daily:
- Review active incidents
- Check team capacity

Weekly:
- Review incident trends
- 1:1s about on-call experience
- Schedule updates for holidays/PTO

Monthly:
- Performance reports
- Runbook reviews
- Process improvements

Quarterly:
- On-call retrospective
- Schedule optimization
- Escalation policy review

---

*Questions about team management? Contact support@oncallshift.com*
