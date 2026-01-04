# Jira Integration Guide

This document contains configuration needed to manage the OnCallShift Jira project programmatically.

---

## Credentials

Credentials are stored in AWS Secrets Manager:

```
Secret Name: oncallshift/jira-integration
Region:      us-east-1
ARN:         arn:aws:secretsmanager:us-east-1:593971626975:secret:oncallshift/jira-integration-9tPncw
```

### Retrieve Credentials

```bash
aws secretsmanager get-secret-value \
  --secret-id oncallshift/jira-integration \
  --region us-east-1 \
  --query SecretString \
  --output text | jq .
```

### Secret Structure

```json
{
  "base_url": "https://oncallshift.atlassian.net",
  "email": "<jira-email>",
  "api_token": "<jira-api-token>",
  "project_key": "OCS",
  "project_id": "10034",
  "board_id": "35"
}
```

### Load as Environment Variables

```bash
eval $(aws secretsmanager get-secret-value \
  --secret-id oncallshift/jira-integration \
  --region us-east-1 \
  --query SecretString \
  --output text | jq -r 'to_entries | .[] | "export JIRA_\(.key | ascii_upcase)=\(.value)"')
```

---

## Project Configuration

| Field | Value |
|-------|-------|
| **Base URL** | `https://oncallshift.atlassian.net` |
| **Project Key** | `OCS` |
| **Project ID** | `10034` |
| **Project Name** | `oncallshift` |
| **Board ID** | `35` |
| **Active Sprint ID** | `1` |
| **Sprint Name** | `OCS Sprint 1` |

---

## Issue Types

| Type | ID | Use Case |
|------|----|----------|
| Epic | `10000` | Large initiatives (e.g., "Security Hardening") |
| Story | `10008` | User-facing features |
| Task | `10041` | Individual work items |
| Sub-task | `10042` | Breakdown of tasks |
| Bug | `10043` | Defects |

---

## Workflow Statuses

| Status | ID |
|--------|-----|
| To Do | `10039` |
| In Progress | `3` |
| Done | `10040` |

---

## Custom Fields

| Field | ID |
|-------|-----|
| Sprint | `customfield_10020` |
| Story Points | `customfield_10033` |

---

## API Endpoints

### Core Issue Operations

| Action | Method | Endpoint |
|--------|--------|----------|
| Create issue | `POST` | `/rest/api/3/issue` |
| Get issue | `GET` | `/rest/api/3/issue/{key}` |
| Update issue | `PUT` | `/rest/api/3/issue/{key}` |
| Delete issue | `DELETE` | `/rest/api/3/issue/{key}` |
| Search issues (JQL) | `POST` | `/rest/api/3/search/jql` |
| Transition issue | `POST` | `/rest/api/3/issue/{key}/transitions` |
| Add comment | `POST` | `/rest/api/3/issue/{key}/comment` |

### Project & Board Operations

| Action | Method | Endpoint |
|--------|--------|----------|
| List projects | `GET` | `/rest/api/3/project/search` |
| Get project | `GET` | `/rest/api/3/project/{key}` |
| Get board | `GET` | `/rest/agile/1.0/board/{boardId}` |
| Get board config | `GET` | `/rest/agile/1.0/board/{boardId}/configuration` |

### Sprint Operations

| Action | Method | Endpoint |
|--------|--------|----------|
| List sprints | `GET` | `/rest/agile/1.0/board/35/sprint` |
| Get sprint issues | `GET` | `/rest/agile/1.0/sprint/{sprintId}/issue` |
| Move to sprint | `POST` | `/rest/agile/1.0/sprint/{sprintId}/issue` |
| Move to backlog | `POST` | `/rest/agile/1.0/backlog/issue` |
| Start sprint | `POST` | `/rest/agile/1.0/sprint/{sprintId}` |
| Complete sprint | `POST` | `/rest/agile/1.0/sprint/{sprintId}` |

---

## Example API Calls

### Setup (Load Credentials)

```bash
# Load credentials from Secrets Manager
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id oncallshift/jira-integration \
  --region us-east-1 \
  --query SecretString \
  --output text)

JIRA_BASE_URL=$(echo $SECRET | jq -r .base_url)
JIRA_EMAIL=$(echo $SECRET | jq -r .email)
JIRA_API_TOKEN=$(echo $SECRET | jq -r .api_token)
JIRA_AUTH="$JIRA_EMAIL:$JIRA_API_TOKEN"
```

### Create a Task

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue" \
  -d '{
    "fields": {
      "project": {"key": "OCS"},
      "summary": "Task title here",
      "description": {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Description here"}]}]
      },
      "issuetype": {"name": "Task"},
      "labels": ["backend", "p1"],
      "parent": {"key": "OCS-1"}
    }
  }'
```

### Create an Epic

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue" \
  -d '{
    "fields": {
      "project": {"key": "OCS"},
      "summary": "[P0] Epic Title Here",
      "description": {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Epic description"}]}]
      },
      "issuetype": {"name": "Epic"},
      "labels": ["p0", "security"]
    }
  }'
```

### Search Issues with JQL

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/search/jql" \
  -d '{
    "jql": "project = OCS AND status = \"To Do\" ORDER BY created DESC",
    "fields": ["key", "summary", "status", "assignee"],
    "maxResults": 50
  }'
```

### Move Issues to Sprint

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/agile/1.0/sprint/1/issue" \
  -d '{
    "issues": ["OCS-7", "OCS-8", "OCS-9"]
  }'
```

### Move Issues to Backlog

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/agile/1.0/backlog/issue" \
  -d '{
    "issues": ["OCS-31", "OCS-32"]
  }'
```

### Transition Issue (Change Status)

```bash
# First, get available transitions
curl -u "$JIRA_AUTH" \
  "$JIRA_BASE_URL/rest/api/3/issue/OCS-7/transitions"

# Then transition (example: move to "In Progress")
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue/OCS-7/transitions" \
  -d '{
    "transition": {"id": "21"}
  }'
```

### Add Comment to Issue

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X POST \
  "$JIRA_BASE_URL/rest/api/3/issue/OCS-7/comment" \
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Comment text here"}]}]
    }
  }'
```

### Update Issue

```bash
curl -u "$JIRA_AUTH" \
  -H "Content-Type: application/json" \
  -X PUT \
  "$JIRA_BASE_URL/rest/api/3/issue/OCS-7" \
  -d '{
    "fields": {
      "summary": "Updated title",
      "labels": ["backend", "p0", "urgent"]
    }
  }'
```

---

## Current Board Structure

### Epics in Sprint (P0-P1)

| Key | Title | Priority |
|-----|-------|----------|
| OCS-1 | Security Hardening - Enterprise Adoption Blocker | P0 |
| OCS-2 | SSO/SAML - Enterprise Gate | P0 |
| OCS-3 | Mobile Notification Reliability - Core Value Proposition | P0 |
| OCS-4 | Mobile AI Features - Key Differentiator | P1 |
| OCS-5 | Bidirectional Slack Integration | P1 |
| OCS-6 | HIPAA/BAA Compliance - Healthcare Vertical | P1 |

### Epics in Backlog (P2)

| Key | Title | Priority |
|-----|-------|----------|
| OCS-31 | Testing Coverage - Target 80% on Critical Paths | P2 |
| OCS-32 | Migration Import Gaps - PagerDuty/Opsgenie Parity | P2 |

---

## Useful Links

| Resource | URL |
|----------|-----|
| Board | https://oncallshift.atlassian.net/jira/software/c/projects/OCS/boards/35 |
| Backlog | https://oncallshift.atlassian.net/jira/software/c/projects/OCS/boards/35/backlog |
| API Token Management | https://id.atlassian.com/manage-profile/security/api-tokens |
| Jira REST API v3 Docs | https://developer.atlassian.com/cloud/jira/platform/rest/v3/ |
| Jira Agile API Docs | https://developer.atlassian.com/cloud/jira/software/rest/ |

---

## MCP Server Options

For AI agent integration, consider these MCP servers:

| Option | Description | Link |
|--------|-------------|------|
| Atlassian Remote MCP | Official, hosted on Cloudflare | [Blog Post](https://www.atlassian.com/blog/announcements/remote-mcp-server) |
| sooperset/mcp-atlassian | Open source, Cloud + Server | [GitHub](https://github.com/sooperset/mcp-atlassian) |
| cosmix/jira-mcp | Open source, AI-optimized | [GitHub](https://github.com/cosmix/jira-mcp) |

---

*Last Updated: January 3, 2026*
