# Email Integration

OnCallShift supports bidirectional email integration: receive alerts via email and send notifications to team members.

## Table of Contents

- [Overview](#overview)
- [Inbound Email (Alert Ingestion)](#inbound-email-alert-ingestion)
- [Outbound Email (Notifications)](#outbound-email-notifications)
- [Email Parsing Rules](#email-parsing-rules)
- [Notification Preferences](#notification-preferences)
- [Email Templates](#email-templates)
- [Troubleshooting](#troubleshooting)

---

## Overview

Email integration enables:

**Inbound**:
- Create incidents from monitoring system emails
- Parse alert details from email content
- Route alerts to appropriate services

**Outbound**:
- Notify responders of incidents
- Send acknowledgment confirmations
- Deliver resolution summaries
- Share scheduled reports

---

## Inbound Email (Alert Ingestion)

### Getting Your Integration Email

Each service has a unique email address for alert ingestion:

1. Navigate to **Services** > Select your service
2. Go to **Integrations** tab
3. Click **Add Integration** > **Email**
4. Copy your integration email address

Your email looks like:
```
alerts+sk_abc123xyz@ingest.oncallshift.com
```

[Screenshot: Integration email address with copy button]

### Configuring Monitoring Tools

Forward alerts from your monitoring system to the integration email.

**Examples**:

| Tool | Configuration |
|------|---------------|
| Datadog | Add email as notification channel |
| Nagios | Configure email alerts |
| Zabbix | Add email as action recipient |
| AWS CloudWatch | SNS email subscription |
| Prometheus | Alertmanager email receiver |

### Email Format

OnCallShift extracts alert information from emails:

**Subject line**: Becomes the incident summary
**Body**: Stored as incident details
**Attachments**: Stored and linked

**Best practices for source systems**:
- Include severity in subject: `[CRITICAL] Service down`
- Use consistent formatting
- Include key metrics in body

---

## Email Parsing Rules

### Default Parsing

By default, OnCallShift parses:

| Email Part | Incident Field |
|------------|----------------|
| Subject | Summary |
| Body | Description + Custom Details |
| Sender | Source |
| Date | Trigger Time |

### Custom Parsing Rules

Create rules to extract specific data:

1. Go to **Services** > Service > **Integrations** > Email
2. Click **Parsing Rules**
3. Add rules:

**Example: Extract severity from subject**
```
Pattern: \[(CRITICAL|HIGH|MEDIUM|LOW)\]
Field: severity
```

**Example: Extract host from body**
```
Pattern: Host: (\S+)
Field: custom_details.host
```

### Severity Detection

Configure automatic severity detection:

| Subject Contains | Severity |
|------------------|----------|
| `CRITICAL`, `P1`, `EMERGENCY` | Critical |
| `HIGH`, `P2`, `ERROR` | High |
| `WARNING`, `P3`, `MEDIUM` | Medium |
| `LOW`, `P4`, `INFO` | Low |

### Email Threading

Emails in the same thread update the same incident:

- Reply to incident email = Add note
- Same subject line within 24h = Merge alerts
- "RE:" prefix is stripped for matching

---

## Outbound Email (Notifications)

### Notification Types

OnCallShift sends these email types:

| Email Type | When Sent |
|------------|-----------|
| **Incident Triggered** | New incident created |
| **Incident Acknowledged** | Someone acknowledged |
| **Incident Resolved** | Incident resolved |
| **Incident Assigned** | Assigned to you |
| **Escalation Notice** | Incident escalated to you |
| **Shift Starting** | On-call shift beginning |
| **Shift Reminder** | Upcoming shift (configurable) |
| **Weekly Report** | Scheduled summary |

### Email Actions

Incident emails include action links:

[Screenshot: Incident email with action buttons]

**Actions via email**:
- Click **Acknowledge** to acknowledge
- Click **Resolve** to resolve
- Click **View** to open in web

**Reply actions**:
- Reply with "ACK" to acknowledge
- Reply with "RESOLVE" to resolve
- Any other reply adds a note

---

## Notification Preferences

### User Email Settings

Each user configures their preferences:

1. Go to **Settings** > **Notifications**
2. Under **Email**:
   - Enable/disable email notifications
   - Set email address (if different from login)
   - Configure notification types

[Screenshot: Email notification preferences]

### Notification Rules

Configure when to receive emails:

| Setting | Options |
|---------|---------|
| **Incident triggers** | All, High+, Critical only, None |
| **Status updates** | All, Own incidents, None |
| **Schedule notifications** | On, Off |
| **Reports** | Daily, Weekly, Monthly, None |

### Quiet Hours

Suppress non-critical emails during off-hours:

1. Go to **Settings** > **Notifications** > **Quiet Hours**
2. Set start and end times
3. Select days
4. Critical emails still delivered

---

## Email Templates

### Default Templates

OnCallShift uses clean, mobile-friendly templates:

**Incident Triggered**:
```
Subject: [CRITICAL] Payment service error rate > 5%

Service: Payment API
Severity: Critical
Triggered: 2 minutes ago

Details:
- Error rate: 7.3%
- Threshold: 5%
- Affected endpoints: /charge, /refund

[Acknowledge] [View Incident]

You're receiving this because you're on-call for Backend Primary.
Manage preferences: https://oncallshift.com/settings/notifications
```

### Custom Templates (Enterprise)

Enterprise plans can customize templates:

1. Go to **Settings** > **Email Templates**
2. Edit templates using variables:
   - `{{incident.summary}}`
   - `{{incident.severity}}`
   - `{{incident.service.name}}`
   - `{{responder.name}}`
   - `{{links.acknowledge}}`

### Email Branding

Customize email appearance:

1. **Settings** > **Organization** > **Branding**
2. Upload logo
3. Set primary color
4. Preview and save

---

## Email Security

### SPF/DKIM/DMARC

OnCallShift emails are authenticated:

- **SPF**: `include:_spf.oncallshift.com`
- **DKIM**: Signed with oncallshift.com key
- **DMARC**: Policy published

### Whitelist Our Senders

If emails go to spam, whitelist:

- `noreply@oncallshift.com`
- `alerts@oncallshift.com`
- `reports@oncallshift.com`

### Inbound Email Security

For inbound integration emails:

- Unique per-service addresses prevent guessing
- Rate limiting prevents abuse
- Malicious attachments are scanned
- Large attachments are rejected (>25MB)

---

## Troubleshooting

### Not Receiving Notification Emails

**Check email settings**:
1. Verify email address in profile
2. Check notification preferences
3. Ensure email channel is enabled

**Check spam folder**:
- Look for emails from `@oncallshift.com`
- Mark as "Not Spam" if found
- Add to contacts

**Verify on-call status**:
- Check you're on the schedule
- Verify escalation policy includes you

### Inbound Emails Not Creating Incidents

**Verify email address**:
- Check exact integration email address
- Ensure no typos or extra characters

**Check email format**:
- Subject line shouldn't be empty
- Email size under 25MB
- Valid sender address

**View integration logs**:
1. Go to **Services** > Service > **Integrations**
2. Select email integration
3. Click **View Events**
4. Check for parsing errors

### Emails Delayed

**Check email provider**:
- Some providers delay external emails
- Verify with other email sources

**Check OnCallShift status**:
- Visit status.oncallshift.com
- Check for delivery issues

**Consider SMS/Push**:
- For time-critical alerts
- Add SMS as backup channel

### Action Links Not Working

**Link expiration**:
- Action links expire after 24 hours
- Use the web interface for older incidents

**Authentication required**:
- You must be logged into OnCallShift
- Links won't work if logged out

### Duplicate Emails

**Check notification rules**:
- Multiple rules may match
- Review all active rules

**Check escalation policy**:
- Multiple steps may notify same person
- Review policy configuration

---

## Best Practices

### For Alert Ingestion

1. **Consistent formatting** - Use templates in monitoring tools
2. **Include severity** - Add `[CRITICAL]` etc. to subject
3. **Meaningful subjects** - Make them searchable
4. **Relevant details** - Include metrics, hosts, links

### For Notifications

1. **Configure preferences** - Don't leave defaults
2. **Add backup channels** - SMS for critical, push for mobile
3. **Use filters** - Don't get email for every severity
4. **Check spam regularly** - Until you've whitelisted

### Email vs Other Channels

| Use Case | Recommended Channel |
|----------|---------------------|
| Critical alerts | Push + SMS (immediate) |
| All incidents | Push (fast, non-intrusive) |
| Audit trail | Email (searchable) |
| Reports | Email (detailed) |
| Shift reminders | Email (non-urgent) |

---

*Need help? See [Troubleshooting](../troubleshooting.md) or [contact support](../contact.md).*
