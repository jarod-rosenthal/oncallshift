# Integrations Overview

OnCallShift integrates with your existing monitoring, communication, and infrastructure tools. This guide explains integration types and how to set them up.

## Table of Contents

- [Integration Types](#integration-types)
- [Quick Setup](#quick-setup)
- [Available Integrations](#available-integrations)
- [Integration Management](#integration-management)
- [Custom Integrations](#custom-integrations)

---

## Integration Types

OnCallShift supports three categories of integrations:

### Inbound Integrations (Alerting)

Receive alerts from monitoring and observability tools:

- **Webhooks** - Universal webhook endpoints (PagerDuty/Opsgenie compatible)
- **Email** - Alert ingestion via email
- **Native integrations** - Direct connections to popular tools

[Diagram: Monitoring Tool -> Webhook -> OnCallShift -> Notifications]

### Outbound Integrations (Notifications)

Send notifications and updates to communication tools:

- **Slack** - Alert channels, interactive responses
- **Microsoft Teams** - Channel notifications
- **Email** - User notifications
- **SMS** - Critical alert delivery
- **Push notifications** - Mobile app alerts

### Bidirectional Integrations

Two-way communication with platforms:

- **Jira** - Create tickets from incidents, sync status
- **GitHub** - Link incidents to issues/PRs
- **ServiceNow** - ITSM integration

---

## Quick Setup

### Step 1: Create a Service

If you haven't already, create a service for your integration:

1. Go to **Services** > **Create Service**
2. Name it (e.g., "Production API Monitoring")
3. Assign to a team and escalation policy

### Step 2: Add an Integration

1. Open your service
2. Navigate to **Integrations** tab
3. Click **Add Integration**
4. Choose your integration type
5. Copy the generated webhook URL or API key

### Step 3: Configure Your Monitoring Tool

Use the webhook URL in your monitoring tool. See specific guides:

- [Webhooks (Generic)](./webhooks.md)
- [Slack](./slack.md)
- [Email](./email.md)
- [Terraform](./terraform.md)

### Step 4: Test the Integration

1. Trigger a test alert from your monitoring tool
2. Verify it appears in OnCallShift
3. Check notification delivery

---

## Available Integrations

### Monitoring & Observability

| Integration | Type | Setup Guide |
|-------------|------|-------------|
| **Datadog** | Webhook | Use webhook URL with Datadog notification |
| **Prometheus/Alertmanager** | Webhook | Configure webhook receiver |
| **Grafana** | Webhook | Add notification channel |
| **New Relic** | Webhook | Create webhook destination |
| **AWS CloudWatch** | Webhook/SNS | SNS subscription to webhook |
| **Pingdom** | Webhook | Add webhook integration |
| **Uptime Robot** | Webhook | Configure alert contact |

### APM & Error Tracking

| Integration | Type | Setup Guide |
|-------------|------|-------------|
| **Sentry** | Webhook | Add webhook integration |
| **Bugsnag** | Webhook | Configure webhook notification |
| **Rollbar** | Webhook | Set up webhook notification |

### Infrastructure & Cloud

| Integration | Type | Setup Guide |
|-------------|------|-------------|
| **AWS** | Native | See [Cloud Credentials](#cloud-credentials) |
| **Google Cloud** | Native | See [Cloud Credentials](#cloud-credentials) |
| **Azure** | Native | See [Cloud Credentials](#cloud-credentials) |
| **Kubernetes** | Webhook | Via Alertmanager |
| **Terraform** | Provider | See [Terraform Guide](./terraform.md) |

### Communication

| Integration | Type | Setup Guide |
|-------------|------|-------------|
| **Slack** | Native | [Slack Guide](./slack.md) |
| **Microsoft Teams** | Webhook | Incoming webhook |
| **Email** | Native | [Email Guide](./email.md) |
| **SMS** | Native | Configured per-user |

### Ticketing & Project Management

| Integration | Type | Setup Guide |
|-------------|------|-------------|
| **Jira** | Native | OAuth connection |
| **GitHub Issues** | Native | GitHub App |
| **Linear** | Webhook | API integration |
| **ServiceNow** | Native | ITSM module |

---

## Integration Management

### Viewing Integration Status

1. Go to **Settings** > **Integrations**
2. See all configured integrations
3. Check:
   - **Last received**: When data was last received
   - **Status**: Active, inactive, or error
   - **Event count**: Messages processed

### Troubleshooting Integrations

If alerts aren't coming through:

1. **Check webhook URL** - Ensure it's correctly configured
2. **Verify authentication** - API keys or tokens are correct
3. **Test connectivity** - Can your monitoring tool reach OnCallShift?
4. **Check event format** - Review the expected payload format
5. **View integration logs** - See raw events received

### Integration Events

View raw events from an integration:

1. Open the service
2. Go to **Integrations** > Select integration
3. Click **View Events**
4. See recent payloads and processing status

---

## Custom Integrations

### Generic Webhook

For any tool that can send HTTP requests:

**Endpoint**: `POST https://oncallshift.com/api/v1/alerts/webhook`

**Headers**:
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Minimal payload**:
```json
{
  "summary": "Alert title",
  "source": "your-tool",
  "severity": "critical"
}
```

See [Webhooks Guide](./webhooks.md) for full documentation.

### Event API

For programmatic integration:

```bash
curl -X POST https://oncallshift.com/api/v1/events \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "service_key_here",
    "event_action": "trigger",
    "payload": {
      "summary": "Server disk space low",
      "severity": "warning",
      "source": "disk-monitor",
      "custom_details": {
        "disk_usage": "92%",
        "server": "web-01"
      }
    }
  }'
```

### Cloud Credentials

For AI-powered cloud investigation, configure cloud provider credentials:

1. Navigate to **Settings** > **Cloud Credentials**
2. Add credentials for:
   - **AWS**: IAM access key or assume role
   - **GCP**: Service account JSON
   - **Azure**: Service principal
3. Credentials are encrypted at rest
4. AI Assistant uses these for investigation

**Required permissions** (read-only recommended):
- View CloudWatch/Cloud Monitoring metrics
- List resources and configurations
- Read logs
- Describe deployments

---

## Integration Security

### API Key Best Practices

- Generate unique keys per integration
- Use read-only keys where possible
- Rotate keys regularly
- Never commit keys to source control

### Network Security

OnCallShift webhook endpoints:
- Accept traffic from any source
- Validate payloads where possible
- Rate limit requests
- Log all incoming events

For enhanced security:
- Use IP allowlisting for outbound notifications
- Verify webhook signatures when available
- Use HTTPS exclusively

### Data Handling

- Alert payloads are stored for debugging
- Sensitive fields can be masked
- Data retention follows your plan settings

---

## Need Help?

- Browse integration-specific guides in this section
- Check [Troubleshooting](../troubleshooting.md) for common issues
- [Contact support](../contact.md) for integration assistance

---

*Next: [Webhooks](./webhooks.md) | [Slack](./slack.md) | [Email](./email.md) | [Terraform](./terraform.md)*
