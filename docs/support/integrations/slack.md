# Slack Integration

Connect OnCallShift with Slack to receive alerts in channels, acknowledge incidents from Slack, and keep your team informed.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Channel Configuration](#channel-configuration)
- [Interactive Actions](#interactive-actions)
- [Notification Settings](#notification-settings)
- [Slash Commands](#slash-commands)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The OnCallShift Slack integration enables:

- **Alert notifications** in channels when incidents are triggered
- **Interactive buttons** to acknowledge, resolve, and escalate from Slack
- **Status updates** as incidents progress
- **Slash commands** to check on-call status and manage incidents
- **Thread updates** keeping incident discussion organized

[Screenshot: Slack notification with action buttons]

---

## Installation

### Step 1: Connect Slack Workspace

1. Navigate to **Settings** > **Integrations** > **Slack**
2. Click **Add to Slack**
3. Review permissions OnCallShift requests:
   - Post messages to channels
   - Add interactive buttons
   - Access basic workspace info
4. Click **Allow**

[Screenshot: Slack OAuth permission screen]

### Step 2: Authorize OnCallShift Bot

After approval, you'll be redirected back to OnCallShift with confirmation.

The OnCallShift bot (`@OnCallShift`) is now added to your workspace.

### Step 3: Invite Bot to Channels

The bot must be invited to channels where you want alerts:

1. Go to the Slack channel
2. Type `/invite @OnCallShift`
3. Or mention `@OnCallShift` and click **Invite to Channel**

---

## Channel Configuration

### Setting Up Alert Channels

Configure which channels receive alerts:

1. Go to **Settings** > **Integrations** > **Slack**
2. Click **Add Channel Mapping**
3. Configure:
   - **Service**: Which service's alerts to send
   - **Channel**: Destination Slack channel
   - **Severity filter**: Minimum severity to notify

[Screenshot: Channel mapping configuration]

### Channel Mapping Examples

| Service | Channel | Severity | Use Case |
|---------|---------|----------|----------|
| All services | #incidents | Critical | Major alerts only |
| Payment API | #payments-team | All | Team-specific alerts |
| Infrastructure | #sre-alerts | High+ | SRE visibility |
| All services | #incidents-low | Low, Info | Non-urgent tracking |

### Multiple Channel Notifications

You can send the same incident to multiple channels:

- Primary team channel for responders
- Central #incidents for visibility
- Management channel for critical alerts

---

## Interactive Actions

### Responding to Alerts

When an alert posts to Slack, you'll see action buttons:

[Screenshot: Alert message with Acknowledge, Resolve, Escalate buttons]

**Available actions**:

| Button | Action | Effect |
|--------|--------|--------|
| **Acknowledge** | Take ownership | Stops escalation timer |
| **Resolve** | Mark as fixed | Closes the incident |
| **Escalate** | Pass to next level | Triggers next policy step |
| **Snooze** | Temporarily pause | Options: 30m, 1h, 2h |
| **View** | Open in OnCallShift | Full incident details |

### Action Confirmation

When you click an action:
1. Slack shows a brief processing message
2. The incident message updates with your action
3. Thread shows who took what action and when

[Screenshot: Updated alert showing "Acknowledged by @alice 2m ago"]

### Thread Updates

Incident updates post as thread replies:
- State changes
- Notes added
- Responder changes
- Resolution details

This keeps the main channel clean while preserving history.

---

## Notification Settings

### Configuring Alert Format

Customize how alerts appear:

1. Go to **Settings** > **Integrations** > **Slack** > **Notification Settings**
2. Options:
   - **Include custom details**: Show alert payload data
   - **Include links**: Show related URLs
   - **Include runbooks**: Link to relevant runbooks
   - **Mention on-call**: @ mention the on-call person

### Alert Message Content

Standard alert includes:
- Severity indicator (emoji)
- Incident title
- Service name
- Trigger time
- Current status
- Action buttons

With custom details enabled:
```
:red_circle: CRITICAL: Database connection pool exhausted

*Service*: Payment API
*Component*: postgres-primary
*Triggered*: 2 minutes ago

*Details*:
- Pool size: 100
- Active connections: 100
- Waiting queries: 47

[Acknowledge] [Resolve] [Escalate] [Snooze] [View]
```

### Severity Emoji Mapping

| Severity | Emoji | Meaning |
|----------|-------|---------|
| Critical | :red_circle: | Immediate attention |
| High | :large_orange_circle: | Urgent |
| Medium | :large_yellow_circle: | Important |
| Low | :large_blue_circle: | Non-urgent |
| Info | :white_circle: | Informational |

---

## Slash Commands

Use slash commands from any channel where the bot is present.

### /oncall

Check who's currently on-call:

```
/oncall
```

Response:
```
Currently on-call:
- Backend: @alice (until 9am tomorrow)
- Frontend: @bob (until 9am tomorrow)
- SRE: @carol (until 9am tomorrow)
```

Check specific schedule:
```
/oncall backend
```

### /incident

View or manage incidents:

**List active incidents**:
```
/incident list
```

**View specific incident**:
```
/incident INC-123
```

**Create incident manually**:
```
/incident create "Database slow" --service="postgres" --severity="high"
```

### /oncallshift

General commands:

```
/oncallshift help        # Show available commands
/oncallshift status      # Integration status
/oncallshift schedules   # View all schedules
```

---

## Best Practices

### Channel Organization

**Recommended structure**:

```
#incidents              - All critical/high alerts (visibility)
#incidents-low          - Low severity tracking
#team-backend           - Backend team alerts
#team-frontend          - Frontend team alerts
#oncall-handoff         - Shift change discussions
```

### Notification Routing

| Alert Type | Routing |
|------------|---------|
| Critical | Team channel + #incidents + SMS |
| High | Team channel + #incidents |
| Medium | Team channel only |
| Low | #incidents-low or email only |
| Info | Logged, no Slack |

### Mention Strategy

When to @ mention on-call:
- Critical alerts: Always
- High alerts: During business hours
- Medium/Low: Never (channel is sufficient)

Configure in **Settings** > **Integrations** > **Slack** > **Mention Settings**

### Thread Etiquette

- Keep incident discussion in threads
- Main channel stays clean
- Thread history is preserved
- Easy to review what happened

---

## Advanced Configuration

### Private Channels

To use private channels:

1. Invite `@OnCallShift` to the private channel
2. Configure channel mapping as normal
3. Bot only sees channels it's invited to

### Multiple Workspaces (Enterprise)

Connect multiple Slack workspaces:

1. Complete installation for first workspace
2. Click **Add Another Workspace**
3. Repeat authorization
4. Configure channel mappings per workspace

### Custom Bot Name

Enterprise plans can customize the bot:

1. Go to **Settings** > **Integrations** > **Slack** > **Advanced**
2. Set custom bot name
3. Upload custom bot icon

---

## Troubleshooting

### Bot Not Posting to Channel

**Check bot membership**:
1. Go to channel settings
2. View members
3. Ensure OnCallShift bot is listed

**Verify channel mapping**:
1. Go to **Settings** > **Integrations** > **Slack**
2. Check channel mapping exists
3. Verify severity filter allows the alert

### Buttons Not Working

**Re-authorize the app**:
1. Go to **Settings** > **Integrations** > **Slack**
2. Click **Reconnect**
3. Re-authorize in Slack

**Check permissions**:
- Bot needs `chat:write` and `chat:write.public`
- Interactive Components must be enabled

### Messages Not Updating

If thread updates aren't appearing:
1. Check bot has access to the thread
2. Verify channel mapping is still active
3. Check for Slack API errors in integration logs

### Duplicate Notifications

If getting duplicate alerts:
1. Review all channel mappings
2. Check for overlapping service configurations
3. Ensure only one mapping per service/channel combination

### Test the Integration

Send a test notification:

1. Go to **Settings** > **Integrations** > **Slack**
2. Click **Send Test Message**
3. Select a channel
4. Verify message appears with working buttons

---

## Security Considerations

### Permissions Requested

OnCallShift requests minimal Slack permissions:

| Permission | Purpose |
|------------|---------|
| `chat:write` | Post alerts to channels |
| `chat:write.public` | Post to channels without invite |
| `users:read` | Map Slack users to OnCallShift |
| `commands` | Enable slash commands |

### Data Handling

- Incident data is sent to Slack for display
- OnCallShift does not store Slack messages
- User mapping is stored for notifications
- All communication uses HTTPS

### Revoking Access

To disconnect Slack:

1. In OnCallShift: **Settings** > **Integrations** > **Slack** > **Disconnect**
2. In Slack: **Settings** > **Manage Apps** > **OnCallShift** > **Remove**

---

*Need help? See [Troubleshooting](../troubleshooting.md) or [contact support](../contact.md).*
