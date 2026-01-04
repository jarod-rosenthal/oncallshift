---
allowed-tools: Bash(aws logs:*)
description: View ECS service logs
---

# View ECS Logs

Service to view: $ARGUMENTS (default: api)

## Available services:
- `api` - Main API server
- `alert-processor` - Processes incoming alerts from SQS
- `notification-worker` - Sends notifications (email/push/SMS)
- `escalation-timer` - Auto-advances escalation steps
- `snooze-expiry` - Handles expired snoozes
- `report-scheduler` - Generates scheduled reports

## Instructions

Run:
```bash
aws logs tail /ecs/pagerduty-lite-dev/$ARGUMENTS --follow --since 5m --region us-east-1
```

If no service specified, use `api`. Show the last 5 minutes of logs.
