# AI Workers System

AI Workers are autonomous AI "employees" that pick up tasks from Jira and execute them using Claude Code CLI in ephemeral ECS Fargate containers. This enables a development team to have AI teammates that can handle coding tasks, create PRs, and update Jira - with humans reviewing the output.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Worker Personas](#worker-personas)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Jira Integration](#jira-integration)
- [GitHub Integration](#github-integration)
- [Safety Guardrails](#safety-guardrails)
- [API Reference](#api-reference)
- [Frontend Dashboard](#frontend-dashboard)
- [Infrastructure](#infrastructure)
- [Cost Management](#cost-management)

## Overview

The AI Workers system provides:

- **Autonomous Task Execution**: AI workers pick up Jira issues, implement changes, and create PRs
- **Multiple Personas**: Specialized workers for different roles (Developer, QA, DevOps, etc.)
- **Human-in-the-Loop**: All PRs require human review before merging
- **Cost Tracking**: Per-task cost estimation and budget controls
- **Safety Controls**: Dangerous command blocking, sensitive file protection, and approval workflows

## Architecture

```
┌─────────────────┐     Webhook      ┌──────────────────┐
│   Jira Cloud    │ ───────────────> │  OnCallShift API │
└─────────────────┘                  │  /ai-worker/jira │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │    SQS Queue     │
                                     │ ai-worker-tasks  │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │   Orchestrator   │
                                     │   (ECS Service)  │
                                     └────────┬─────────┘
                                              │
                                              │ Spawn Ephemeral Task
                                              ▼
                                     ┌──────────────────┐
                                     │  Executor Task   │
                                     │ (Fargate Spot)   │
                                     │                  │
                                     │ 1. git clone     │
                                     │ 2. Claude Code   │
                                     │ 3. git push      │
                                     │ 4. Create PR     │
                                     │ 5. Exit          │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │     GitHub       │
                                     │   Pull Request   │
                                     └──────────────────┘
```

## Worker Personas

Each worker persona has specialized knowledge and focus areas:

| Persona | Jira Issue Types | Responsibilities |
|---------|------------------|------------------|
| **Developer** | Story, Bug, Task, Sub-task | Code changes, features, bug fixes |
| **QA Engineer** | Test, Test Task | Test writing, test automation |
| **DevOps** | Infrastructure, CI/CD | Terraform, Docker, workflows |
| **Tech Writer** | Documentation, Docs | README, API docs, guides |
| **Support** | Service Request, Support | Customer issues, investigations |
| **PM** | Epic, Initiative | Planning, breakdown, coordination |

## How It Works

### 1. Task Creation (Jira Webhook)

When a Jira issue is created or updated with:
- The `ai-worker` or `ai-task` label, OR
- Assigned to a user with "ai" in their name/email

The webhook creates an `AIWorkerTask` in the database and queues it in SQS.

### 2. Task Orchestration

The orchestrator service:
1. Polls the SQS queue for new tasks
2. Finds an available worker instance for the task's persona
3. Spawns an ephemeral Fargate task with the executor image
4. Monitors execution progress
5. Updates task status and Jira

### 3. Task Execution

The executor container:
1. Clones the repository using GitHub PAT
2. Creates a feature branch (e.g., `feat/OCS-123-implement-feature`)
3. Runs Claude Code CLI with the task instructions and persona prompt
4. Commits changes and pushes the branch
5. Creates a pull request via GitHub API
6. Updates the Jira issue with PR link
7. Exits (container auto-terminates)

### 4. Human Review

- PR is created with detailed description
- Human reviews code changes
- Approves/requests changes via GitHub
- GitHub webhook updates task status
- On merge, task is marked completed

## Configuration

### Environment Variables

```bash
# Required for orchestrator
AI_WORKER_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/ai-worker-tasks
AWS_REGION=us-east-1

# Required for executor
GITHUB_TOKEN=ghp_xxx          # GitHub PAT with repo scope
ANTHROPIC_API_KEY=sk-ant-xxx  # Anthropic API key

# Optional
DEFAULT_GITHUB_REPO=org/repo  # Default repo for tasks
JIRA_WEBHOOK_SECRET=xxx       # Webhook auth secret
GITHUB_WEBHOOK_SECRET=xxx     # GitHub webhook HMAC secret
```

### Secrets Manager

Store sensitive values in AWS Secrets Manager:

- `pagerduty-lite/dev/github-token` - GitHub Personal Access Token
- `pagerduty-lite/dev/anthropic-api-key` - Anthropic API key
- `pagerduty-lite/dev/jira-webhook-secret` - Jira webhook secret

## Jira Integration

### Webhook Configuration

1. Go to Jira Settings > System > Webhooks
2. Create a new webhook:
   - **URL**: `https://oncallshift.com/api/v1/ai-worker/jira/webhook`
   - **Events**: Issue created, Issue updated
   - **JQL Filter** (optional): `labels = ai-worker`

3. Set the `Authorization` header:
   ```
   Bearer <JIRA_WEBHOOK_SECRET>
   ```

### Triggering AI Workers

Add the `ai-worker` label to any Jira issue to have it picked up by the AI worker system. The issue type determines which worker persona handles it.

### Jira Fields Used

| Field | Usage |
|-------|-------|
| `summary` | Task title and PR title |
| `description` | Detailed instructions for Claude |
| `issuetype` | Determines worker persona |
| `priority` | Task priority (P1-P5 mapping) |
| `labels` | Must include `ai-worker` or `ai-task` |
| `project.key` | Used for branch naming |

## GitHub Integration

### Webhook Configuration

1. Go to Repository Settings > Webhooks
2. Create a new webhook:
   - **URL**: `https://oncallshift.com/api/v1/ai-worker/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: Set to `GITHUB_WEBHOOK_SECRET`
   - **Events**: Pull requests, Pull request reviews, Check runs

### Personal Access Token

Create a GitHub PAT with:
- `repo` scope (full repository access)
- Access to the target repository

### Branch Naming Convention

AI workers create branches following the pattern:
```
feat/OCS-123-short-summary
fix/OCS-456-bug-description
```

## Safety Guardrails

### Blocked Commands

The following command patterns are blocked:

| Pattern | Reason |
|---------|--------|
| `rm -rf /`, `rm -rf ~` | Destructive file operations |
| `DROP DATABASE`, `DROP TABLE` | Database destruction |
| `git push --force main` | Force push to protected branches |
| `terraform destroy` | Infrastructure destruction |
| Credentials in commands | Credential exposure |

### Protected Files

These files cannot be modified by AI workers:

| Pattern | Risk Level |
|---------|------------|
| `.env*`, `credentials.*`, `secrets.*` | Critical |
| `*.pem`, `*.key`, `id_rsa*` | Critical |
| `.aws/credentials` | Critical |
| `terraform.tfstate` | Critical |
| `.github/workflows/*.yml` | High (requires approval) |
| `Dockerfile`, `docker-compose.yml` | Medium |

### Content Scanning

Files are scanned for sensitive content before commit:
- API keys (OpenAI, Anthropic, Stripe, AWS)
- Private keys (RSA, PGP, SSH)
- Database connection strings with credentials
- Hardcoded passwords and tokens

### Safety Limits

| Limit | Default | Description |
|-------|---------|-------------|
| Max conversation turns | 50 | Prevents runaway execution |
| Max execution time | 60 min | Task timeout |
| Max files modified | 30 | Per-task file change limit |
| Max lines changed | 2000 | Code change limit |
| Max cost per task | $5.00 | Budget per task |
| Max daily cost per worker | $50.00 | Daily budget |
| Max monthly cost per org | $500.00 | Monthly budget |

## API Reference

### AI Workers API

```
GET    /api/v1/ai-workers              # List workers
POST   /api/v1/ai-workers              # Create worker
GET    /api/v1/ai-workers/:id          # Get worker
PUT    /api/v1/ai-workers/:id          # Update worker
DELETE /api/v1/ai-workers/:id          # Delete worker
PUT    /api/v1/ai-workers/:id/pause    # Pause worker
PUT    /api/v1/ai-workers/:id/resume   # Resume worker
PUT    /api/v1/ai-workers/:id/disable  # Disable worker
PUT    /api/v1/ai-workers/:id/enable   # Enable worker
GET    /api/v1/ai-workers/:id/stats    # Get worker stats
```

### AI Worker Tasks API

```
GET    /api/v1/ai-worker-tasks              # List tasks
POST   /api/v1/ai-worker-tasks              # Create task
GET    /api/v1/ai-worker-tasks/summary      # Get summary stats
GET    /api/v1/ai-worker-tasks/:id          # Get task
GET    /api/v1/ai-worker-tasks/:id/logs     # Get task logs
GET    /api/v1/ai-worker-tasks/:id/conversation  # Get Claude conversation
POST   /api/v1/ai-worker-tasks/:id/cancel   # Cancel task
POST   /api/v1/ai-worker-tasks/:id/retry    # Retry failed task
```

### AI Worker Approvals API

```
GET    /api/v1/ai-worker-approvals          # List approvals
GET    /api/v1/ai-worker-approvals/pending  # Get pending approvals
GET    /api/v1/ai-worker-approvals/:id      # Get approval
POST   /api/v1/ai-worker-approvals/:id/approve  # Approve
POST   /api/v1/ai-worker-approvals/:id/reject   # Reject
POST   /api/v1/ai-worker-approvals/:id/expire   # Expire (admin)
```

### Webhook Endpoints

```
POST   /api/v1/ai-worker/jira/webhook    # Jira webhooks
POST   /api/v1/ai-worker/github/webhook  # GitHub webhooks
```

## Frontend Dashboard

Access the AI Workers dashboard at `/ai-workers` (admin only).

### Features

- **Summary Cards**: Active tasks, completed today, cost, pending approvals
- **Workers Tab**: View/manage worker instances, pause/resume/disable
- **Tasks Tab**: View recent tasks, status, PRs, costs
- **Approvals Tab**: Review and approve/reject pending approvals

### Worker Status

| Status | Description |
|--------|-------------|
| `idle` | Ready to accept tasks |
| `working` | Currently executing a task |
| `paused` | Won't pick up new tasks |
| `disabled` | Permanently disabled until re-enabled |

### Task Status

| Status | Description |
|--------|-------------|
| `queued` | Waiting in SQS queue |
| `assigned` | Assigned to a worker |
| `in_progress` | Claude is working on it |
| `pr_created` | PR has been created |
| `review_pending` | Waiting for human review |
| `review_approved` | PR approved |
| `review_rejected` | Changes requested |
| `completed` | PR merged, task done |
| `failed` | Task failed |
| `cancelled` | Manually cancelled |
| `blocked` | Blocked by safety check |

## Infrastructure

### Terraform Module

The `infrastructure/terraform/modules/ai-workers/` module creates:

- **SQS Queue**: Task queue with DLQ
- **ECR Repository**: AI worker Docker images
- **CloudWatch Log Groups**: Orchestrator and executor logs
- **IAM Roles**: Execution and task roles
- **ECS Task Definition**: Executor task (2 vCPU, 4GB RAM)

### Usage

```hcl
module "ai_workers" {
  source = "../../modules/ai-workers"

  project_name     = "pagerduty-lite"
  environment      = "dev"
  aws_region       = "us-east-1"
  ecs_cluster_arn  = module.ecs.cluster_arn
  ecs_cluster_name = module.ecs.cluster_name
  vpc_id           = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_ids = [module.networking.ecs_security_group_id]
  secrets_arns     = [aws_secretsmanager_secret.github_token.arn]

  github_token_secret_arn      = aws_secretsmanager_secret.github_token.arn
  anthropic_api_key_secret_arn = aws_secretsmanager_secret.anthropic_key.arn
}
```

### Docker Image

Build and push the AI worker image:

```bash
cd backend
docker build -f Dockerfile.ai-worker -t ai-worker .
docker tag ai-worker:latest <ECR_REPO_URL>:latest
docker push <ECR_REPO_URL>:latest
```

## Cost Management

### Pricing Estimates

| Resource | Cost |
|----------|------|
| Claude Sonnet (input) | $0.003/1K tokens |
| Claude Sonnet (output) | $0.015/1K tokens |
| Fargate Spot (2 vCPU, 4GB) | ~$0.04/hour |
| **Typical task** | **$0.20 - $2.00** |

### Cost Tracking

Each task tracks:
- `estimatedCostUsd`: Estimated cost before execution
- `actualCostUsd`: Actual cost after completion
- Token usage (input/output)
- Execution time

Workers track cumulative:
- `totalTokensUsed`
- `totalCostUsd`

### Budget Controls

Set limits in `ai-worker-safety.ts`:

```typescript
SAFETY_LIMITS = {
  maxCostPerTaskUsd: 5.0,
  maxDailyCostPerWorkerUsd: 50.0,
  maxMonthlyCostPerOrgUsd: 500.0,
}
```

## Troubleshooting

### Task Stuck in Queue

1. Check SQS queue for messages
2. Verify orchestrator service is running
3. Check orchestrator logs for errors

### Task Failed

1. View task logs via API or dashboard
2. Check Claude conversation for errors
3. Review safety validation results

### PR Not Created

1. Verify GitHub token is valid
2. Check executor logs in CloudWatch
3. Verify repository permissions

### Jira Not Updated

1. Check webhook secret configuration
2. Verify Jira API token is valid
3. Check API logs for Jira update errors
