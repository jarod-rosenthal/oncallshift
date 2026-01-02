# Frequently Asked Questions

Quick answers to common questions about OnCallShift.

## Table of Contents

- [General](#general)
- [Getting Started](#getting-started)
- [Incidents](#incidents)
- [Schedules](#schedules)
- [Notifications](#notifications)
- [Integrations](#integrations)
- [Mobile App](#mobile-app)
- [Billing](#billing)
- [Security](#security)

---

## General

### What is OnCallShift?

OnCallShift is a production incident management platform that helps engineering teams respond to and resolve incidents faster. It provides:

- Alert management and routing
- On-call scheduling
- Escalation policies
- Multi-channel notifications (push, SMS, email, Slack)
- AI-powered incident diagnosis
- Runbook automation

### How is OnCallShift different from PagerDuty?

OnCallShift is designed for modern engineering teams with:

- **AI-first approach** - Built-in AI diagnosis and cloud investigation
- **Simpler pricing** - Transparent, predictable costs
- **Modern UX** - Clean, fast interface for web and mobile
- **Open integrations** - PagerDuty/Opsgenie-compatible webhooks for easy migration

### Can I migrate from PagerDuty or Opsgenie?

Yes. OnCallShift provides:

- **Import tools** for users, services, schedules, and policies
- **Compatible webhook formats** - Point your monitoring tools to OnCallShift without reconfiguring
- **Migration guides** with step-by-step instructions

Go to **Settings** > **Import** to start your migration.

### Is there a free trial?

Yes. All new organizations get a 14-day free trial of Professional features. No credit card required to start.

---

## Getting Started

### How do I invite team members?

1. Go to **Settings** > **Users**
2. Click **Invite User**
3. Enter their email address
4. Select their role (Admin, Manager, or Responder)
5. Click **Send Invite**

### What roles are available?

| Role | Description |
|------|-------------|
| **Admin** | Full access including billing and organization settings |
| **Manager** | Can manage teams, services, schedules, and policies |
| **Responder** | Can respond to incidents and view dashboards |

### How do I connect my monitoring tools?

1. Create a service for the system you want to monitor
2. Go to **Service** > **Integrations** > **Add Integration**
3. Copy the webhook URL
4. Configure your monitoring tool to send alerts to that URL

See our [Integration Guides](./integrations/overview.md) for specific tools.

### Do I need to install anything?

**Web**: No installation needed. Visit [oncallshift.com](https://oncallshift.com) and log in.

**Mobile**: Download from [App Store (iOS)](https://apps.apple.com/app/oncallshift) or [Google Play (Android)](https://play.google.com/store/apps/details?id=com.oncallshift).

---

## Incidents

### What's the difference between an alert and an incident?

- **Alert**: A single notification from a monitoring system (e.g., "CPU high")
- **Incident**: A tracked issue that may contain multiple related alerts

Multiple alerts can be grouped into a single incident using deduplication keys.

### How does alert deduplication work?

Alerts with the same `dedup_key` within 24 hours are grouped into a single incident. Without a `dedup_key`, each alert creates a new incident.

Example:
```json
{
  "summary": "High CPU on web-01",
  "dedup_key": "cpu-high-web-01"
}
```

### What incident states exist?

| State | Description |
|-------|-------------|
| **Triggered** | New, needs attention |
| **Acknowledged** | Someone is working on it |
| **Resolved** | Issue is fixed |
| **Snoozed** | Temporarily paused |

### How do I prevent duplicate incidents?

1. Use consistent `dedup_key` values in your alerts
2. Configure alert grouping on your service
3. Set an appropriate grouping window (e.g., 5 minutes)

### Can I merge incidents?

Yes. Open an incident and click **Merge** to combine it with another incident. The merged incident inherits all timeline events.

---

## Schedules

### How do on-call schedules work?

Schedules define who is on-call at any given time. They support:

- **Rotations**: Daily, weekly, or custom patterns
- **Layers**: Primary, secondary, and override coverage
- **Handoffs**: When shifts change (e.g., 9 AM Monday)

### Can I have multiple people on-call at once?

Yes. You can:

- Add multiple schedules to an escalation policy step
- Create a schedule with multiple participants per shift
- Use schedule layers for primary and backup coverage

### How do I handle vacations?

Create a **schedule override**:

1. Go to the schedule
2. Click **Create Override**
3. Select who will cover
4. Set the date range
5. Save

### What happens if no one is on-call?

If the schedule has gaps, alerts will either:

- Skip to the next escalation step
- Notify a fallback contact (if configured)
- Remain unacknowledged until someone takes action

### Can I swap shifts with a teammate?

Yes. The person originally on-call can:

1. Create an override giving coverage to someone else
2. The other person creates an override for the return shift

Or contact a manager to adjust the schedule.

---

## Notifications

### What notification channels are available?

- **Push notifications** - Mobile app (iOS, Android)
- **Email** - Any email address
- **SMS** - Text messages (plan-dependent)
- **Slack** - Channel and direct messages
- **Phone call** - Voice alerts (Enterprise)

### How do I configure my notification preferences?

1. Go to **Settings** > **Notifications**
2. Enable/disable channels
3. Set preferences by severity
4. Configure quiet hours if desired

### Why didn't I receive a notification?

Common reasons:

1. You're not on-call for that service
2. Someone acknowledged before escalation reached you
3. Notification channel is disabled in preferences
4. Device-level settings block notifications
5. Email went to spam

See [Troubleshooting](./troubleshooting.md#notification-issues) for detailed solutions.

### Can I get notified differently for critical vs. low-priority alerts?

Yes. Configure notification rules:

1. **Settings** > **Notifications** > **Rules**
2. Create rules based on severity
3. Example: Critical = Push + SMS, Low = Email only

### What are quiet hours?

Quiet hours suppress non-critical notifications during specified times (e.g., 10 PM - 7 AM). Critical alerts still come through.

---

## Integrations

### What monitoring tools work with OnCallShift?

Any tool that can send HTTP webhooks, including:

- Datadog
- Prometheus/Alertmanager
- Grafana
- New Relic
- AWS CloudWatch
- PagerDuty (we accept their webhook format)
- Opsgenie (we accept their webhook format)

See [Integrations Overview](./integrations/overview.md) for the full list.

### Is there a Terraform provider?

Yes. The OnCallShift Terraform provider lets you manage:

- Teams and users
- Services and escalation policies
- Schedules and overrides
- Integrations

See [Terraform Guide](./integrations/terraform.md).

### Can I use the API to create custom integrations?

Yes. Our REST API supports all platform functionality:

- **Docs**: [oncallshift.com/api-docs](https://oncallshift.com/api-docs)
- **See**: [API Reference](./api-reference.md)

### How do I set up Slack?

1. Go to **Settings** > **Integrations** > **Slack**
2. Click **Add to Slack**
3. Authorize OnCallShift
4. Configure channel mappings

See [Slack Guide](./integrations/slack.md) for details.

---

## Mobile App

### Is there a mobile app?

Yes. OnCallShift has native apps for:

- **iOS**: [App Store](https://apps.apple.com/app/oncallshift)
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=com.oncallshift)

### What can I do from the mobile app?

Everything needed for incident response:

- View and manage incidents
- Acknowledge, resolve, escalate, snooze
- Access runbooks
- Use AI assistant
- View schedules
- Manage notification preferences

### Do push notifications work when the app is closed?

Yes. Push notifications are delivered by Apple/Google even when the app isn't running. Ensure notifications are enabled in device settings.

### Can I acknowledge from the notification?

Yes. On both iOS and Android:

- **iOS**: Long-press notification, tap **Acknowledge**
- **Android**: Tap notification actions

---

## Billing

### What plans are available?

| Plan | Best For | Key Features |
|------|----------|--------------|
| **Starter** | Small teams | Up to 5 users, 100 incidents/month |
| **Professional** | Growing teams | Unlimited users and incidents |
| **Enterprise** | Large organizations | SSO, custom contracts, dedicated support |

### How does billing work?

- Billed monthly or annually (annual saves 20%)
- Per-user pricing for Professional plan
- Custom pricing for Enterprise
- SMS usage may have additional costs

### Can I change plans?

Yes. Go to **Settings** > **Billing** > **Change Plan**. Upgrades take effect immediately; downgrades at next billing cycle.

### Is there an annual discount?

Yes. Annual billing saves 20% compared to monthly.

### What payment methods do you accept?

- Credit/debit cards (Visa, Mastercard, Amex)
- ACH bank transfer (annual plans)
- Wire transfer (Enterprise)
- Invoicing (Enterprise)

---

## Security

### Is my data secure?

Yes. OnCallShift implements:

- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **SOC 2 Type II**: Annual compliance audits
- **Access controls**: Role-based permissions
- **Audit logs**: All actions logged
- **Data residency**: US-based infrastructure

### Do you support SSO?

Yes. Enterprise plans support:

- SAML 2.0
- OAuth 2.0 / OIDC
- Integration with Okta, Azure AD, Google Workspace, etc.

### Where is my data stored?

Data is stored in AWS US East (N. Virginia) region. Enterprise customers can discuss data residency requirements.

### Can I enable two-factor authentication?

Yes. Each user can enable 2FA in their profile settings:

1. Go to **Settings** > **Security**
2. Click **Enable 2FA**
3. Scan QR code with authenticator app
4. Save backup codes

Admins can require 2FA for all organization members.

### How long do you retain data?

Default retention:

- **Incidents**: 2 years
- **Audit logs**: 90 days (Professional), 1 year (Enterprise)
- **Notifications**: 90 days

Enterprise customers can customize retention periods.

### Can I export my data?

Yes. Go to **Settings** > **Data Management** > **Export**. You can export:

- Users and teams
- Services and policies
- Incidents (including resolved)
- Schedules

---

## Still Have Questions?

- **Search documentation**: Use the search feature
- **Troubleshooting**: See [Troubleshooting Guide](./troubleshooting.md)
- **Contact us**: [support@oncallshift.com](mailto:support@oncallshift.com)

---

*Last updated: January 2026*
