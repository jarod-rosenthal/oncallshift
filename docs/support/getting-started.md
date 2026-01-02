# Getting Started with OnCallShift

Get up and running with OnCallShift in under 15 minutes. This guide walks you through account setup, configuration, and handling your first incident.

## Table of Contents

- [Create Your Account](#create-your-account)
- [Initial Setup Checklist](#initial-setup-checklist)
- [Your First Incident](#your-first-incident)
- [Mobile App Setup](#mobile-app-setup)
- [Configure Notifications](#configure-notifications)
- [Next Steps](#next-steps)

---

## Create Your Account

### Sign Up

1. Visit [oncallshift.com](https://oncallshift.com)
2. Click **Get Started** or **Sign Up**
3. Enter your email address and create a password
4. Verify your email address via the confirmation link

[Screenshot: Sign up page with email and password fields]

### Create or Join an Organization

After signing up, you'll either:

- **Create a new organization** - If you're the first person from your company
- **Join an existing organization** - If a teammate has already set up OnCallShift

To join an existing organization, ask your admin to invite you via email.

[Screenshot: Organization creation screen]

---

## Initial Setup Checklist

Complete these steps to configure OnCallShift for your team:

### 1. Create Your First Team

Teams group related services and responders together.

1. Navigate to **Settings** > **Teams**
2. Click **Create Team**
3. Enter a team name (e.g., "Platform", "Backend", "SRE")
4. Add team members by email

[Screenshot: Team creation form]

### 2. Add a Service

Services represent applications, microservices, or infrastructure components that can generate alerts.

1. Go to **Services** in the main navigation
2. Click **Create Service**
3. Configure:
   - **Name**: A descriptive name (e.g., "Payment API", "User Database")
   - **Team**: Assign to the responsible team
   - **Escalation Policy**: Select who gets notified (create one if needed)

[Screenshot: Service creation with escalation policy selection]

### 3. Set Up an Escalation Policy

Escalation policies define who gets notified and when alerts go unacknowledged.

1. Navigate to **Escalation Policies**
2. Click **Create Policy**
3. Add escalation steps:
   - **Step 1**: Primary on-call (immediate)
   - **Step 2**: Secondary on-call (after 5 minutes)
   - **Step 3**: Team lead (after 10 minutes)
4. Set escalation timeout between steps

[Screenshot: Escalation policy with multiple steps]

### 4. Create an On-Call Schedule

Schedules determine who is on-call at any given time.

1. Go to **Schedules** > **Create Schedule**
2. Configure:
   - **Name**: e.g., "Backend Primary"
   - **Timezone**: Your team's timezone
   - **Rotation type**: Daily, weekly, or custom
   - **Participants**: Add team members to the rotation
3. Set handoff time (when shifts change)

[Screenshot: Schedule calendar view with rotation]

### 5. Configure Integrations

Connect your monitoring tools to send alerts to OnCallShift.

1. Navigate to **Settings** > **Integrations**
2. Copy your webhook URL for the service
3. Configure your monitoring tool to send alerts to this URL

See our [Integration Guides](./integrations/overview.md) for specific setup instructions.

---

## Your First Incident

Let's walk through the incident lifecycle:

### Triggering a Test Alert

Send a test alert using curl:

```bash
curl -X POST https://oncallshift.com/api/v1/alerts/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "summary": "Test Alert - High CPU Usage",
    "severity": "warning",
    "source": "monitoring",
    "service_key": "YOUR_SERVICE_KEY"
  }'
```

### Receiving Notifications

When an incident is triggered:

1. **Push notification** appears on your mobile device
2. **Email** arrives in your inbox
3. **Slack message** (if configured)
4. **SMS** for critical alerts (if enabled)

[Screenshot: Push notification on mobile device]

### Acknowledging an Incident

Acknowledging tells your team you're working on the issue:

**From Web:**
1. Click the incident in your dashboard
2. Click **Acknowledge**

**From Mobile:**
1. Tap the push notification
2. Tap **Acknowledge**

**From Slack:**
1. Click **Acknowledge** button in the alert message

### Resolving an Incident

Once the issue is fixed:

1. Open the incident
2. Add resolution notes (optional but recommended)
3. Click **Resolve**

[Screenshot: Incident detail page with acknowledge and resolve buttons]

### Viewing Incident Timeline

Every incident maintains a timeline showing:
- When it was triggered
- Who acknowledged and when
- All actions taken
- Notes added
- Resolution details

---

## Mobile App Setup

The OnCallShift mobile app keeps you connected when you're away from your desk.

### Download the App

- **iOS**: [App Store](https://apps.apple.com/app/oncallshift)
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=com.oncallshift)

### Sign In

1. Open the app
2. Enter your email and password
3. If your organization uses SSO, tap **Sign in with SSO**

### Enable Push Notifications

Push notifications are critical for on-call alerting:

1. When prompted, tap **Allow** for notifications
2. Verify in your device settings that OnCallShift has notification permissions
3. Test by triggering a test incident

[Screenshot: iOS notification permission prompt]

### Mobile Features

The mobile app supports:
- **Incident management** - Acknowledge, escalate, resolve, snooze
- **On-call schedules** - View current and upcoming shifts
- **Runbooks** - Access and execute runbooks
- **Team chat** - Coordinate with responders
- **AI Assistant** - Get help diagnosing issues

---

## Configure Notifications

Customize how and when you receive alerts.

### Notification Channels

Configure your preferred notification methods:

1. Go to **Settings** > **Notifications**
2. Enable/disable channels:
   - **Push notifications** (recommended for all alerts)
   - **Email** (good for non-urgent updates)
   - **SMS** (use for critical alerts)
   - **Slack** (team visibility)

### Notification Rules

Create rules to customize notifications by:
- **Severity**: Critical alerts via SMS, warnings via push
- **Time of day**: Different preferences for business hours vs. nights
- **Service**: High-priority services get more aggressive notifications

[Screenshot: Notification preferences page]

### Do Not Disturb

Set quiet hours when you're off-call:

1. Go to **Settings** > **Do Not Disturb**
2. Configure your schedule
3. Notes:
   - DND only applies when you're not on-call
   - Critical alerts may override DND (configurable)

---

## Next Steps

You're all set up! Here's what to explore next:

### Deepen Your Knowledge

- **[Responder Guide](./guides/responder-guide.md)** - Master incident response
- **[Admin Guide](./guides/admin-guide.md)** - Configure your organization
- **[Manager Guide](./guides/manager-guide.md)** - Set up schedules and reports

### Connect Your Tools

- **[Webhooks](./integrations/webhooks.md)** - Connect monitoring tools
- **[Slack](./integrations/slack.md)** - Team collaboration
- **[Terraform](./integrations/terraform.md)** - Infrastructure as code

### Advanced Features

- **AI Diagnosis** - Let AI analyze incidents and suggest causes
- **Runbook Automation** - Automate incident response steps
- **Cloud Investigation** - Connect AWS/GCP/Azure for deep analysis
- **Status Pages** - Communicate with stakeholders

### Get Help

- Browse the **[FAQ](./faq.md)**
- Check **[Troubleshooting](./troubleshooting.md)**
- **[Contact Support](./contact.md)**

---

*Need help? Reach out at support@oncallshift.com*
