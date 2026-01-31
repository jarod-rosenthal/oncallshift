# Responder Guide

This guide helps on-call responders effectively handle incidents in OnCallShift. Learn to acknowledge, investigate, escalate, and resolve incidents efficiently.

## Table of Contents

- [Understanding Incidents](#understanding-incidents)
- [Acknowledging Incidents](#acknowledging-incidents)
- [Investigating Issues](#investigating-issues)
- [Using AI Diagnosis](#using-ai-diagnosis)
- [Executing Runbooks](#executing-runbooks)
- [Escalating and Reassigning](#escalating-and-reassigning)
- [Resolving Incidents](#resolving-incidents)
- [Snoozing Incidents](#snoozing-incidents)
- [Adding Responders](#adding-responders)
- [Mobile Response](#mobile-response)
- [Best Practices](#best-practices)

---

## Understanding Incidents

### Incident States

Every incident moves through these states:

| State | Meaning | Actions Available |
|-------|---------|-------------------|
| **Triggered** | New, unacknowledged alert | Acknowledge, Escalate, Resolve |
| **Acknowledged** | Someone is working on it | Resolve, Escalate, Snooze, Reassign |
| **Resolved** | Issue is fixed | Reopen |
| **Snoozed** | Temporarily paused | Wakes automatically |

### Severity Levels

Incidents have severity levels that affect notification urgency:

- **Critical** - System down, customer impact (all channels, immediate)
- **High** - Significant degradation (push + SMS)
- **Medium** - Performance issues (push + email)
- **Low** - Minor issues (email only)
- **Info** - Informational alerts (logged, no notification)

### Incident Timeline

Every incident maintains a timeline showing:
- Trigger time and source
- All state changes
- Who took each action
- Notes and updates
- Related incidents

[Screenshot: Incident timeline showing state changes and actions]

---

## Acknowledging Incidents

Acknowledging tells your team you're investigating the issue.

### From the Web Dashboard

1. View the incident in your dashboard
2. Click the **Acknowledge** button
3. Optionally add a note about your initial assessment

[Screenshot: Acknowledge button on incident card]

### From Email

1. Open the incident notification email
2. Click **Acknowledge** in the email
3. You'll be redirected to the incident page

### From Mobile App

1. Tap the push notification
2. Tap **Acknowledge** on the incident screen
3. Or acknowledge directly from the notification (iOS)

### From Slack

1. When an alert posts to Slack, click **Acknowledge**
2. Your response is recorded in OnCallShift

### What Happens When You Acknowledge

- Escalation timer pauses
- Your team sees you're handling it
- You become the assigned responder
- Other responders are notified you've taken ownership

---

## Investigating Issues

### Incident Details Page

The incident detail page shows:

- **Summary**: Alert title and description
- **Service**: Which service triggered the alert
- **Timeline**: Complete history of actions
- **Related Incidents**: Similar or linked incidents
- **Alert Data**: Full payload from monitoring system

### Viewing Alert Payload

Access the raw alert data:

1. Open the incident
2. Scroll to **Alert Details**
3. View the full JSON payload
4. Look for:
   - Error messages
   - Affected resources
   - Metric values
   - Timestamps

### Related Incidents

OnCallShift automatically identifies related incidents:

- Same service within 24 hours
- Similar alert messages
- Same root cause (AI-detected)

Review related incidents to:
- See if this is a recurring issue
- Find previous solutions
- Identify patterns

---

## Using AI Diagnosis

OnCallShift's AI can analyze incidents and suggest causes.

### Running AI Diagnosis

1. Open the incident
2. Click **AI Diagnosis** or find it in the sidebar
3. Wait for analysis (usually 10-30 seconds)

The AI examines:
- Alert payload and metadata
- Related incidents
- Service configuration
- Runbook content

### AI Capabilities

**Incident Analysis**:
- Identifies likely root causes
- Suggests investigation steps
- Highlights relevant runbooks

**Cloud Investigation** (if configured):
- Queries AWS/GCP/Azure resources
- Checks CloudWatch/Cloud Monitoring metrics
- Reviews recent deployments
- Examines log patterns

**AI Assistant Chat**:
1. Open the **AI Assistant** panel
2. Ask questions like:
   - "What changed in the last hour?"
   - "Show me error rates for this service"
   - "What does this error mean?"
   - "How do I fix this?"

[Screenshot: AI diagnosis panel with root cause suggestions]

---

## Executing Runbooks

Runbooks are step-by-step guides for handling specific incidents.

### Finding Relevant Runbooks

1. Open the incident
2. Check **Suggested Runbooks** in the sidebar
3. Or navigate to **Runbooks** and search

Runbooks may be:
- Auto-linked to services
- Suggested by AI based on the incident
- Manually associated

### Following a Runbook

1. Open the runbook
2. Follow each step sequentially
3. Mark steps as complete
4. Add notes about what you did

[Screenshot: Runbook execution view with step checklist]

### Automated Runbook Execution

Some runbooks support automated execution:

1. Review the automated steps
2. Click **Execute** to start
3. Approve each step (if required)
4. Monitor execution progress
5. View command output

**Safety**: Automated steps run in sandboxed environments. Sensitive operations require manual approval.

### Creating Quick Runbooks

After resolving an incident, capture your steps:

1. Go to **Runbooks** > **Create**
2. Title it clearly: "High CPU on Payment Service"
3. Add steps you took to resolve
4. Link to the service
5. Future incidents will suggest this runbook

---

## Escalating and Reassigning

### When to Escalate

Escalate when:
- You need additional expertise
- The issue is outside your domain
- You're blocked and need help
- Severity is higher than expected
- You're going off-shift

### Manual Escalation

1. Open the incident
2. Click **Escalate**
3. Optionally add a reason
4. The next escalation policy step is triggered

[Screenshot: Escalation button and confirmation dialog]

### Reassigning to Specific Person

Transfer ownership to a specific responder:

1. Open the incident
2. Click **Reassign**
3. Search for and select the person
4. Add a handoff note
5. Confirm reassignment

The new responder receives immediate notification.

### Adding Notes for Handoff

When escalating or reassigning, always add context:

- What you've tried
- What you've ruled out
- Current hypothesis
- Relevant logs or metrics

---

## Resolving Incidents

### When to Resolve

Resolve when:
- The root cause is fixed
- Services are restored
- Monitoring shows normal metrics
- No further action needed

### Resolving an Incident

1. Open the incident
2. Click **Resolve**
3. Add resolution notes:
   - What was the root cause?
   - How was it fixed?
   - Any follow-up needed?
4. Confirm resolution

[Screenshot: Resolution dialog with notes field]

### Resolution Best Practices

Write resolution notes that help future responders:

**Good**:
> "Root cause: Memory leak in payment service v2.3.4 caused OOM kills. Fix: Rolled back to v2.3.3. Follow-up: Memory profiling ticket created (JIRA-1234)."

**Bad**:
> "Fixed"

### Post-Incident Actions

After resolving:
1. Update or create runbooks with learnings
2. Create follow-up tickets for permanent fixes
3. Schedule postmortem for major incidents
4. Review and improve alerting if needed

---

## Snoozing Incidents

Snooze temporarily pauses an incident when you need to delay response.

### When to Snooze

- Waiting for a deployment to complete
- Issue will auto-resolve (e.g., scheduled maintenance ending)
- Need to coordinate with another team
- Low priority during business hours

### Snoozing an Incident

1. Open the incident
2. Click **Snooze**
3. Select duration:
   - 30 minutes
   - 1 hour
   - 2 hours
   - 4 hours
   - Until specific time
4. Add a reason
5. Confirm

[Screenshot: Snooze duration selection]

### What Happens When Snoozed

- Notifications pause
- Incident shows "Snoozed" status
- Timer shows when it will wake
- Escalation resumes when snooze ends

### Waking a Snoozed Incident

To end snooze early:
1. Open the incident
2. Click **Wake** or **End Snooze**
3. Normal incident handling resumes

---

## Adding Responders

For complex incidents, add additional responders.

### Adding Responders

1. Open the incident
2. Click **Add Responders**
3. Search and select team members
4. They receive immediate notification

### Conference Bridge

For voice coordination:
1. Click **Start Conference** on the incident
2. Share the dial-in link
3. All responders join the same call

### Collaboration Features

- **Live timeline**: See what others are doing
- **Notes**: Share findings and updates
- **@mentions**: Notify specific responders
- **Status updates**: Post progress to stakeholders

---

## Mobile Response

### Responding from Push Notification

iOS and Android support quick actions:

1. Long-press the notification (or swipe)
2. Choose:
   - **Acknowledge**
   - **View Details**
   - **Snooze**

### Mobile App Features

Full incident management on mobile:
- View all active incidents
- Acknowledge, resolve, escalate
- Access runbooks
- Use AI assistant
- View on-call schedules
- Check who's available

[Screenshot: Mobile incident list and detail views]

### Offline Handling

If you're offline when paged:
- SMS notification is sent as backup
- Phone call escalation (if configured)
- Incident escalates after timeout

---

## Best Practices

### During On-Call

1. **Keep phone charged and nearby**
2. **Test notifications** at shift start
3. **Know your escalation path**
4. **Have runbooks bookmarked**
5. **Know how to reach teammates**

### When Paged

1. **Acknowledge quickly** - even if investigating
2. **Check the runbook first** - don't reinvent the wheel
3. **Use AI diagnosis** - get a quick analysis
4. **Communicate progress** - add timeline notes
5. **Escalate when stuck** - don't be a hero

### Investigation Tips

1. **Check recent changes** - deployments, configs
2. **Look at related incidents** - patterns help
3. **Review metrics** - before and after trigger
4. **Check dependencies** - upstream/downstream
5. **Read the full alert** - details matter

### Handoff Best Practices

When your shift ends:
1. Document current status of active incidents
2. Note what you've tried
3. Share any hypotheses
4. Introduce incoming responder via notes
5. Be available briefly for questions

### Reducing Alert Fatigue

If you're getting too many alerts:
1. Track which alerts lead to action vs noise
2. Report noisy alerts to service owners
3. Suggest threshold adjustments
4. Help improve alert quality

---

## Keyboard Shortcuts

Speed up your response with shortcuts:

| Shortcut | Action |
|----------|--------|
| `A` | Acknowledge incident |
| `R` | Resolve incident |
| `E` | Escalate incident |
| `S` | Snooze incident |
| `N` | Add note |
| `K` | Previous incident |
| `J` | Next incident |
| `/` | Search |
| `?` | Show all shortcuts |

---

*Questions about incident response? See our [FAQ](../faq.md) or [contact support](../contact.md).*
