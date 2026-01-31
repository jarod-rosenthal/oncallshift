# Webhooks Integration

OnCallShift accepts alerts via webhooks from any monitoring tool. Our webhook endpoints are compatible with PagerDuty and Opsgenie formats, making migration seamless.

## Table of Contents

- [Quick Start](#quick-start)
- [Endpoint Reference](#endpoint-reference)
- [Payload Formats](#payload-formats)
- [Authentication](#authentication)
- [Event Types](#event-types)
- [Custom Fields](#custom-fields)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Get Your Webhook URL

1. Navigate to **Services** > Select your service
2. Go to **Integrations** tab
3. Click **Add Integration** > **Generic Webhook**
4. Copy the webhook URL

Your webhook URL looks like:
```
https://oncallshift.com/api/v1/alerts/webhook?service_key=sk_abc123...
```

### 2. Send a Test Alert

```bash
curl -X POST "https://oncallshift.com/api/v1/alerts/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "summary": "Test Alert - CPU Usage High",
    "severity": "warning",
    "source": "monitoring"
  }'
```

### 3. Verify in OnCallShift

Check your **Incidents** dashboard to see the new incident.

---

## Endpoint Reference

### Primary Endpoint

```
POST https://oncallshift.com/api/v1/alerts/webhook
```

### Authentication Options

**Option 1: API Key Header** (Recommended)
```
Authorization: Bearer YOUR_API_KEY
```

**Option 2: Service Key in URL**
```
https://oncallshift.com/api/v1/alerts/webhook?service_key=sk_abc123
```

**Option 3: Service Key in Body**
```json
{
  "service_key": "sk_abc123",
  "summary": "Alert message"
}
```

### Response Codes

| Code | Meaning |
|------|---------|
| `202` | Alert accepted for processing |
| `400` | Invalid payload |
| `401` | Authentication failed |
| `404` | Service not found |
| `429` | Rate limit exceeded |
| `500` | Server error |

### Success Response

```json
{
  "status": "success",
  "message": "Alert accepted",
  "dedup_key": "abc123xyz",
  "incident_id": "inc_789"
}
```

---

## Payload Formats

OnCallShift supports multiple payload formats for compatibility.

### OnCallShift Native Format

```json
{
  "summary": "Database connection pool exhausted",
  "severity": "critical",
  "source": "db-monitor",
  "component": "postgres-primary",
  "group": "database",
  "class": "connection_pool",
  "custom_details": {
    "pool_size": 100,
    "active_connections": 100,
    "waiting_queries": 47,
    "database": "production"
  },
  "links": [
    {
      "href": "https://grafana.example.com/d/db-metrics",
      "text": "Database Dashboard"
    }
  ],
  "images": [
    {
      "src": "https://grafana.example.com/render/d/cpu-graph.png",
      "alt": "CPU Graph"
    }
  ],
  "dedup_key": "db-pool-exhausted-prod"
}
```

### PagerDuty v2 Compatible Format

```json
{
  "routing_key": "YOUR_SERVICE_KEY",
  "event_action": "trigger",
  "dedup_key": "unique-alert-id",
  "payload": {
    "summary": "Server disk space critical",
    "severity": "critical",
    "source": "disk-monitor",
    "component": "web-server-01",
    "group": "infrastructure",
    "class": "disk",
    "custom_details": {
      "disk_usage": "95%",
      "mount_point": "/var/log"
    }
  },
  "links": [
    {
      "href": "https://example.com/dashboard",
      "text": "Monitoring Dashboard"
    }
  ]
}
```

### Opsgenie Compatible Format

```json
{
  "message": "CPU usage exceeded threshold",
  "alias": "cpu-alert-server01",
  "priority": "P1",
  "source": "monitoring",
  "tags": ["production", "critical", "server01"],
  "details": {
    "cpu_usage": "98%",
    "threshold": "90%",
    "duration": "5 minutes"
  }
}
```

---

## Authentication

### API Keys

Generate API keys in **Settings** > **API Keys**.

**Header Authentication** (Recommended):
```bash
curl -X POST https://oncallshift.com/api/v1/alerts/webhook \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Alert"}'
```

### Service Keys

Each service has a unique key for alert routing:

**URL Parameter**:
```
POST https://oncallshift.com/api/v1/alerts/webhook?service_key=sk_abc123
```

**Body Parameter**:
```json
{
  "service_key": "sk_abc123",
  "summary": "Alert message"
}
```

### IP Allowlisting (Enterprise)

Restrict webhook sources to specific IPs:

1. Go to **Settings** > **Security**
2. Enable **IP Allowlist**
3. Add your monitoring tool IP addresses

---

## Event Types

### Trigger (Create Incident)

```json
{
  "event_action": "trigger",
  "dedup_key": "unique-id",
  "payload": {
    "summary": "New alert",
    "severity": "critical"
  }
}
```

### Acknowledge

```json
{
  "event_action": "acknowledge",
  "dedup_key": "unique-id"
}
```

### Resolve

```json
{
  "event_action": "resolve",
  "dedup_key": "unique-id"
}
```

### Default Behavior

- If `event_action` is omitted, defaults to `trigger`
- If `dedup_key` is omitted, a unique key is generated
- Duplicate `trigger` events with same `dedup_key` are deduplicated

---

## Custom Fields

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | Yes | Alert title (max 1024 chars) |
| `severity` | string | No | `critical`, `high`, `medium`, `low`, `info` |
| `source` | string | No | Alert source (e.g., tool name) |
| `component` | string | No | Affected component |
| `group` | string | No | Logical grouping |
| `class` | string | No | Alert category |
| `custom_details` | object | No | Additional key-value data |
| `dedup_key` | string | No | Unique ID for deduplication |
| `links` | array | No | Related URLs |
| `images` | array | No | Related images/graphs |

### Severity Mapping

OnCallShift maps incoming severities:

| Input | OnCallShift Severity |
|-------|---------------------|
| `critical`, `P1`, `emergency`, `sev1` | Critical |
| `high`, `P2`, `error`, `sev2` | High |
| `medium`, `P3`, `warning`, `sev3` | Medium |
| `low`, `P4`, `info`, `sev4` | Low |
| `info`, `P5`, `debug` | Info |

---

## Examples

### Datadog Webhook

Configure Datadog to send to OnCallShift:

1. In Datadog, go to **Integrations** > **Webhooks**
2. Add a new webhook:
   - **Name**: OnCallShift
   - **URL**: `https://oncallshift.com/api/v1/alerts/webhook`
   - **Headers**: `Authorization: Bearer YOUR_API_KEY`
   - **Payload**:
   ```json
   {
     "summary": "$EVENT_TITLE",
     "severity": "$ALERT_PRIORITY",
     "source": "datadog",
     "custom_details": {
       "event_type": "$EVENT_TYPE",
       "tags": "$TAGS",
       "link": "$LINK"
     },
     "dedup_key": "$ALERT_ID"
   }
   ```

### Prometheus Alertmanager

Add to your `alertmanager.yml`:

```yaml
receivers:
  - name: oncallshift
    webhook_configs:
      - url: https://oncallshift.com/api/v1/alerts/webhook
        http_config:
          authorization:
            type: Bearer
            credentials: YOUR_API_KEY
        send_resolved: true
```

### Grafana

1. Go to **Alerting** > **Contact points**
2. Add contact point:
   - **Type**: Webhook
   - **URL**: `https://oncallshift.com/api/v1/alerts/webhook`
   - **HTTP Method**: POST
   - **Authorization Header**: `Bearer YOUR_API_KEY`

### AWS CloudWatch via SNS

1. Create SNS topic subscribed to CloudWatch alarm
2. Add HTTPS subscription:
   - **Endpoint**: `https://oncallshift.com/api/v1/alerts/webhook?service_key=sk_abc123`
   - **Protocol**: HTTPS

CloudWatch alarm format is automatically parsed.

### cURL Example

Full example with all fields:

```bash
curl -X POST "https://oncallshift.com/api/v1/alerts/webhook" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Payment service error rate > 5%",
    "severity": "critical",
    "source": "prometheus",
    "component": "payment-api",
    "group": "backend",
    "class": "error_rate",
    "custom_details": {
      "error_rate": "7.3%",
      "threshold": "5%",
      "duration": "5m",
      "affected_endpoints": ["/charge", "/refund"],
      "environment": "production"
    },
    "links": [
      {
        "href": "https://grafana.example.com/d/payments",
        "text": "Payment Dashboard"
      },
      {
        "href": "https://logs.example.com/search?service=payment",
        "text": "Payment Logs"
      }
    ],
    "dedup_key": "payment-error-rate-prod"
  }'
```

---

## Troubleshooting

### Alert Not Creating Incident

**Check authentication**:
```bash
curl -v https://oncallshift.com/api/v1/alerts/webhook \
  -H "Authorization: Bearer YOUR_API_KEY"
```
Look for `401 Unauthorized` errors.

**Verify service key**:
- Ensure service exists and is active
- Check service key matches

**Check payload format**:
- `summary` field is required
- Payload must be valid JSON

### Duplicate Alerts Not Merging

Alerts merge when they have the same `dedup_key`:

```json
{
  "dedup_key": "unique-consistent-id",
  "summary": "Alert message"
}
```

Without `dedup_key`, each alert creates a new incident.

### Resolve Not Working

Ensure the `dedup_key` matches the original trigger:

```json
{
  "event_action": "resolve",
  "dedup_key": "same-key-as-trigger"
}
```

### Rate Limiting

If receiving `429` errors:
- Default limit: 120 requests/minute per service
- Contact support for higher limits
- Implement backoff in your integration

### View Raw Events

Debug by viewing received events:

1. Go to **Services** > Your service > **Integrations**
2. Select the integration
3. Click **View Events**
4. See raw payloads and processing status

---

## Best Practices

### Deduplication Keys

Use consistent, meaningful dedup keys:

**Good**: `db-connection-pool-production-postgres01`
**Bad**: `alert-12345` (not descriptive)
**Bad**: Random UUID per alert (no deduplication)

### Payload Content

Include useful information in `custom_details`:
- Current metric values
- Thresholds that were breached
- Affected resources
- Duration of the condition
- Links to dashboards

### Severity Accuracy

Match severity to business impact:
- **Critical**: Customer-facing outage
- **High**: Significant degradation
- **Medium**: Performance issues
- **Low**: Anomalies to investigate
- **Info**: Informational only

---

*Need help? See [Troubleshooting](../troubleshooting.md) or [contact support](../contact.md).*
