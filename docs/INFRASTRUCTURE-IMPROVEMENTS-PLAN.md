# OnCallShift Infrastructure Improvements Plan

**Version**: 1.0
**Created**: January 2025
**Status**: Pre-Load-Test Planning

---

## Executive Summary

This document provides a comprehensive analysis of OnCallShift's AWS infrastructure, identifying bottlenecks, single points of failure, and multi-tenant risks. It includes a prioritized hardening checklist and load-testing strategy to prepare for production scale.

### Current Architecture Understanding

Based on infrastructure analysis:

1. **Frontend**: React SPA on S3 + CloudFront (well-architected, globally distributed)
2. **Backend**: Node.js/Express on ECS Fargate (512 CPU / 1024MB), auto-scaling 1-4 tasks
3. **Database**: RDS PostgreSQL 15.15 on `db.t4g.micro`, single-AZ, gp3 storage, no read replicas
4. **Workers**: 4 ECS Fargate services (alert-processor, notification-worker, escalation-timer, snooze-expiry)
5. **Queues**: SQS with DLQs for alerts and notifications (well-configured with long polling)
6. **Multi-tenant Model**: Shared database with `org_id` column across 37+ entity tables
7. **Caching**: None (no ElastiCache Redis)
8. **Region**: us-east-1, 2 AZs, single NAT gateway

### Key Gaps Identified

| Category | Gap | Risk Level |
|----------|-----|------------|
| Database | Single db.t4g.micro, no Multi-AZ | **CRITICAL** |
| Database | No connection pooling (RDS Proxy) | HIGH |
| Database | No read replicas | HIGH |
| Caching | No Redis for hot data | HIGH |
| Observability | Container Insights disabled | MEDIUM |
| Observability | Performance Insights disabled | MEDIUM |
| Workers | No auto-scaling on workers | MEDIUM |
| Security | Single NAT gateway | LOW |

---

## Section A: Current Architecture Assessment

### Request Path Analysis

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│ CloudFront  │───>│     ALB      │───>│ ECS Fargate │───>│    RDS      │
│  (Frontend) │    │ (us-east-1)  │    │  API Tasks  │    │  Postgres   │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │    SQS      │
                                       │   Queues    │
                                       └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │ ECS Workers │
                                       │ (4 services)│
                                       └─────────────┘
```

**Typical API Call Flow (Create Incident):**
1. Client → CloudFront → ALB (HTTPS termination)
2. ALB → ECS API task (private subnet via target group)
3. API authenticates JWT via Cognito token validation
4. API queries RDS for org context, service, escalation policy
5. API writes incident to RDS
6. API publishes to SQS alerts queue
7. Alert-processor worker consumes from SQS
8. Worker writes notifications to SQS notifications queue
9. Notification-worker delivers via SES/SNS/Expo

### Top 10 Likely Bottlenecks

| # | Bottleneck | Current State | Why It's a Problem | Load Scenario |
|---|------------|---------------|-------------------|---------------|
| 1 | **RDS Instance Size** | db.t4g.micro (2 vCPU burst, 1GB RAM) | ~50 max connections, bursts limited to 10% baseline | 50+ concurrent users |
| 2 | **No Connection Pooling** | Direct connections from ECS | Each task opens N connections; workers compete | 4+ API tasks + 4 workers |
| 3 | **Missing Indexes** | Unknown tenant query patterns | Full table scans on tenant-filtered queries | Large tenants with 10k+ incidents |
| 4 | **No Redis Cache** | Every read hits RDS | Repeated queries for same schedules, policies | High read frequency endpoints |
| 5 | **ECS Task CPU Limit** | 512 CPU units (0.5 vCPU) | Node.js event loop saturation under load | CPU-bound AI diagnosis calls |
| 6 | **Worker Scaling** | Fixed at 1 task each | Notification backlog during incident storms | Mass notification events |
| 7 | **Single NAT Gateway** | Cost optimization | All private subnet traffic through one NAT | Outbound API calls bottleneck |
| 8 | **ALB Connection Limits** | Default idle timeout (60s) | Long-running requests hold connections | WebSocket/SSE connections |
| 9 | **SQS Visibility Timeout** | 30-60 seconds | Retries during slow processing cause duplicates | Slow notification delivery |
| 10 | **No Request Rate Limiting** | ALB passes all traffic | One tenant can saturate API | Noisy neighbor attack |

### Top 5 Single Points of Failure

| # | SPOF | Current State | Failure Scenario | Impact |
|---|------|---------------|------------------|--------|
| 1 | **RDS Single-AZ** | No Multi-AZ standby | AZ failure or RDS maintenance | **Complete outage** (30+ min recovery) |
| 2 | **Single NAT Gateway** | One NAT in one AZ | NAT failure or AZ issue | Workers can't reach SQS/SES/Cognito |
| 3 | **Escalation Timer** | Single instance only | Container crash | Missed escalations until restart |
| 4 | **No Circuit Breakers** | Direct RDS calls | RDS overload cascades | API timeouts, snowball effect |
| 5 | **Cognito Dependency** | Every request validates JWT | Cognito outage | All authenticated requests fail |

---

## Section B: Multi-Tenant Architecture Review

### Current Model: Shared Database with `org_id`

All 37+ entity tables include an `org_id` foreign key. This is the most common and cost-effective multi-tenant pattern, but requires careful design.

```sql
-- Example: Incidents table
CREATE TABLE incidents (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  incident_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  ...
  UNIQUE(org_id, incident_number)
);
```

### Multi-Tenant Implications on RDS

| Aspect | Current State | Risk | Recommendation |
|--------|---------------|------|----------------|
| **Indexing** | Unknown index coverage | Slow tenant-scoped queries | Add composite indexes with `org_id` first |
| **Query Scoping** | Manual `WHERE org_id = ?` | Cross-tenant data leaks if forgotten | Use TypeORM scopes or row-level security |
| **Connection Limits** | ~50 max on t4g.micro | All tenants share pool | RDS Proxy + larger instance |
| **CPU/IOPS** | Shared across all tenants | One heavy tenant impacts all | Per-tenant rate limits |
| **Backup/Restore** | Whole-database only | Can't restore single tenant | Consider logical backups per org |

### Data Isolation Risks

1. **Missing org_id WHERE clauses**: If any query forgets tenant filter, data leaks
2. **N+1 Query Patterns**: Loading incidents → then each owner → amplified by tenant count
3. **Large Tenant Domination**: One org with 100k incidents slows queries for everyone
4. **Index Bloat**: Without tenant-first indexes, scans grow with total data

### Recommended Indexes for Multi-Tenant Performance

```sql
-- Priority 1: Most queried tables
CREATE INDEX idx_incidents_org_status ON incidents(org_id, status, created_at DESC);
CREATE INDEX idx_incidents_org_service ON incidents(org_id, service_id, created_at DESC);
CREATE INDEX idx_alerts_org_incident ON alerts(org_id, incident_id);
CREATE INDEX idx_notifications_org_user ON notifications(org_id, user_id, created_at DESC);

-- Priority 2: Schedules and on-call
CREATE INDEX idx_schedules_org ON schedules(org_id);
CREATE INDEX idx_schedule_layers_schedule ON schedule_layers(schedule_id);
CREATE INDEX idx_overrides_schedule_time ON schedule_overrides(schedule_id, start_time, end_time);

-- Priority 3: Services and policies
CREATE INDEX idx_services_org_status ON services(org_id, status);
CREATE INDEX idx_escalation_policies_org ON escalation_policies(org_id);
```

### Noisy Neighbor Mitigation

| Strategy | Implementation | Effort |
|----------|---------------|--------|
| **Per-tenant API rate limits** | ALB WAF rules or app middleware | Medium |
| **Query complexity limits** | Limit `OFFSET`/`LIMIT` values | Low |
| **Read replica routing** | Heavy reports → read replica | Medium |
| **Tenant-aware connection pools** | PgBouncer with tenant tagging | High |
| **Large tenant isolation** | Dedicated RDS for enterprise tier | High |

---

## Section C: Pre-Load-Test Hardening Checklist

### ECS & Application Layer

| Item | Current | Target | Effort | Impact | Priority |
|------|---------|--------|--------|--------|----------|
| API task CPU | 512 units | 1024 units | Low | High | P0 |
| API task memory | 1024 MB | 2048 MB | Low | High | P0 |
| API desired count | 1 | 2 (min) | Low | High | P0 |
| Auto-scaling max | 4 | 10 | Low | Medium | P1 |
| Worker auto-scaling | None | SQS-based | Medium | High | P1 |
| Health check path | `/health` | Add DB check | Low | Medium | P1 |
| Graceful shutdown | Unknown | 30s drain | Low | Medium | P2 |
| Container Insights | Disabled | Enabled | Low | Medium | P1 |

**Terraform Changes for ECS:**

```hcl
# main.tf - Update API service
module "api_service" {
  # ...
  task_cpu    = "1024"   # Was 512
  task_memory = "2048"   # Was 1024

  desired_count = 2       # Was 1

  autoscaling_min_capacity  = 2   # Was 1
  autoscaling_max_capacity  = 10  # Was 4
}

# Enable Container Insights
resource "aws_ecs_cluster" "main" {
  setting {
    name  = "containerInsights"
    value = "enabled"  # Was "disabled"
  }
}
```

### RDS (PostgreSQL)

| Item | Current | Target | Effort | Impact | Priority |
|------|---------|--------|--------|--------|----------|
| Instance class | db.t4g.micro | db.t4g.medium | Low | **Critical** | P0 |
| Multi-AZ | No | Yes | Low | **Critical** | P0 |
| Max connections | ~50 | ~200 | Low | High | P0 |
| Performance Insights | Disabled | Enabled | Low | High | P1 |
| Enhanced Monitoring | Disabled | Enabled (60s) | Low | Medium | P1 |
| Read replica | None | 1 replica | Medium | High | P1 |
| RDS Proxy | None | Enable | Medium | High | P1 |
| Connection timeout | Default | 30s | Low | Medium | P2 |
| Statement timeout | None | 30s | Low | Medium | P2 |

**Terraform Changes for RDS:**

```hcl
# variables.tf
variable "db_instance_class" {
  default = "db.t4g.medium"  # Was db.t4g.micro
}

variable "db_multi_az" {
  default = true  # New variable
}

# modules/database/main.tf
resource "aws_db_instance" "main" {
  instance_class = var.instance_class
  multi_az       = var.multi_az  # Add this

  performance_insights_enabled = true  # Was false
  monitoring_interval          = 60    # Was 0
}

# Custom parameter group
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.project_name}-${var.environment}-pg15"

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "statement_timeout"
    value = "30000"  # 30 seconds
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries > 1 second
  }
}
```

### Caching & Async (New Components)

| Item | Current | Target | Effort | Impact | Priority |
|------|---------|--------|--------|--------|----------|
| ElastiCache Redis | None | cache.t4g.micro cluster | Medium | High | P1 |
| Cache schedules | N/A | 5 min TTL | Medium | High | P1 |
| Cache escalation policies | N/A | 5 min TTL | Medium | High | P1 |
| Cache on-call calculations | N/A | 1 min TTL | Medium | High | P1 |
| SQS batch processing | Single message | Batch of 10 | Low | Medium | P2 |

**Terraform for ElastiCache:**

```hcl
# New: ElastiCache Redis cluster
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-redis"
  subnet_ids = module.networking.private_subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.project_name}-${var.environment}"
  description                = "Redis cluster for OnCallShift"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 2
  port                       = 6379
  engine_version             = "7.0"
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = true
  multi_az_enabled           = true
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [module.networking.redis_security_group_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}
```

### Networking & Reliability

| Item | Current | Target | Effort | Impact | Priority |
|------|---------|--------|--------|--------|----------|
| NAT Gateways | 1 (single AZ) | 2 (multi-AZ) | Low | Medium | P2 |
| ALB idle timeout | 60s | 120s | Low | Low | P3 |
| ALB health check interval | 30s | 10s | Low | Medium | P1 |
| VPC Flow Logs | Unknown | Enable | Low | Medium | P2 |
| WAF rate limiting | None | Enable | Medium | High | P1 |

---

## Section D: Observability Plan

### Metrics to Instrument

#### ALB Metrics (CloudWatch built-in)
- `RequestCount` - Total requests
- `HTTPCode_Target_4XX_Count` - Client errors
- `HTTPCode_Target_5XX_Count` - Server errors
- `TargetResponseTime` - p50, p95, p99 latency
- `ActiveConnectionCount` - Concurrent connections
- `HealthyHostCount` - Available ECS tasks

#### ECS Metrics (Container Insights)
- `CpuUtilized` / `CpuReserved` - Per service
- `MemoryUtilized` / `MemoryReserved` - Per service
- `RunningTaskCount` - Scaling effectiveness
- `ServiceCount` - Service health

#### Application Metrics (Custom CloudWatch)
```typescript
// backend/src/shared/middleware/metrics.ts
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: process.env.AWS_REGION });

export async function recordLatency(
  endpoint: string,
  latencyMs: number,
  orgId: string,
  statusCode: number
) {
  await cloudwatch.putMetricData({
    Namespace: 'OnCallShift/API',
    MetricData: [
      {
        MetricName: 'RequestLatency',
        Value: latencyMs,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Endpoint', Value: endpoint },
          { Name: 'OrgId', Value: orgId },
          { Name: 'StatusCode', Value: String(statusCode) },
        ],
      },
    ],
  });
}
```

#### RDS Metrics (Enhanced Monitoring)
- `CPUUtilization` - Database load
- `DatabaseConnections` - Connection pool exhaustion
- `ReadIOPS` / `WriteIOPS` - Storage throughput
- `ReadLatency` / `WriteLatency` - Query performance
- `FreeableMemory` - Buffer cache pressure
- `BufferCacheHitRatio` - Cache effectiveness

#### SQS Metrics
- `ApproximateNumberOfMessagesVisible` - Queue depth
- `ApproximateAgeOfOldestMessage` - Processing lag
- `NumberOfMessagesReceived` - Throughput
- `NumberOfMessagesSent` - Ingestion rate

### CloudWatch Dashboard

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "API Health",
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "app/..."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."],
          [".", "TargetResponseTime", ".", ".", { "stat": "p99" }]
        ]
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Database Health",
        "metrics": [
          ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "pagerduty-lite-dev"],
          [".", "DatabaseConnections", ".", "."],
          [".", "ReadLatency", ".", "."]
        ]
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Queue Depth",
        "metrics": [
          ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "pagerduty-lite-dev-alerts"],
          [".", ".", ".", "pagerduty-lite-dev-notifications"]
        ]
      }
    }
  ]
}
```

### Logging Strategy

```hcl
# Structured logging with request correlation
# backend/src/shared/middleware/logging.ts

interface LogContext {
  requestId: string;
  orgId: string;
  userId: string;
  endpoint: string;
  method: string;
  latencyMs: number;
  statusCode: number;
}

// CloudWatch Logs Insights query for slow requests
// fields @timestamp, @message
// | filter latencyMs > 1000
// | stats count() by endpoint, orgId
// | sort count desc
// | limit 20
```

### Alerting Rules

| Metric | Threshold | Action |
|--------|-----------|--------|
| API 5xx rate | > 1% for 5 min | Page on-call |
| RDS CPU | > 80% for 10 min | Page on-call |
| RDS Connections | > 80% max | Page on-call |
| SQS oldest message | > 5 min | Warn |
| ECS task restarts | > 3 in 10 min | Page on-call |
| ALB unhealthy hosts | Any | Page on-call |

---

## Section E: Load Testing Strategy

### Recommended Tool: k6

k6 is ideal for this stack because:
- JavaScript-based (matches Node.js backend knowledge)
- Native CloudWatch integration
- Excellent for API load testing
- Supports complex scenarios with VU-based concurrency

### Phase 1: Smoke Tests (Day 1)

**Goal**: Validate basic functionality under minimal load

```javascript
// k6/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '2m',
};

const BASE_URL = 'https://oncallshift.com/api/v1';

export default function () {
  // Health check
  let res = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
  check(res, { 'health OK': (r) => r.status === 200 });

  // List incidents (authenticated)
  res = http.get(`${BASE_URL}/incidents`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
  check(res, { 'incidents OK': (r) => r.status === 200 });

  sleep(1);
}
```

**Watch**:
- All responses 2xx
- Latency < 500ms
- No errors in CloudWatch Logs

### Phase 2: Endpoint Stress Tests (Days 2-3)

**Goal**: Find per-endpoint limits

| Endpoint | Target RPS | Duration | Ramp |
|----------|------------|----------|------|
| GET /incidents | 100 | 5 min | 2 min |
| POST /incidents | 50 | 5 min | 2 min |
| GET /schedules/:id/oncall | 200 | 5 min | 2 min |
| POST /alerts/webhook | 100 | 5 min | 2 min |

```javascript
// k6/stress-incidents.js
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 100 },  // Hold
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**Watch**:
- RDS CPU and connections
- ECS auto-scaling triggers
- SQS queue depth growth
- p95 latency trends

### Phase 3: Realistic Usage Simulation (Days 4-5)

**Goal**: Simulate actual usage patterns

```javascript
// k6/realistic.js
export const options = {
  scenarios: {
    incident_creators: {
      executor: 'constant-arrival-rate',
      rate: 10,              // 10 incidents/second
      duration: '10m',
      preAllocatedVUs: 20,
    },
    incident_viewers: {
      executor: 'constant-vus',
      vus: 50,               // 50 users browsing
      duration: '10m',
    },
    oncall_checkers: {
      executor: 'constant-arrival-rate',
      rate: 5,               // 5 on-call checks/second
      duration: '10m',
      preAllocatedVUs: 10,
    },
  },
};

export default function () {
  const scenario = __ENV.SCENARIO;

  if (scenario === 'incident_creators') {
    createIncident();
  } else if (scenario === 'incident_viewers') {
    listAndViewIncidents();
  } else {
    checkOnCall();
  }
}
```

**Watch**:
- End-to-end latency distribution
- Worker throughput vs queue growth
- Database query patterns (slow query log)

### Phase 4: Noisy Neighbor Test (Day 6)

**Goal**: Validate tenant isolation

```javascript
// k6/noisy-neighbor.js
export const options = {
  scenarios: {
    heavy_tenant: {
      executor: 'constant-arrival-rate',
      rate: 100,             // Heavy tenant: 100 req/s
      duration: '10m',
      env: { ORG_TOKEN: __ENV.HEAVY_TENANT_TOKEN },
    },
    light_tenants: {
      executor: 'constant-arrival-rate',
      rate: 10,              // Each light tenant: 10 req/s
      duration: '10m',
      env: { ORG_TOKEN: __ENV.LIGHT_TENANT_TOKEN },
    },
  },
};
```

**Watch**:
- Light tenant latency doesn't degrade
- Heavy tenant gets rate limited (if implemented)
- Database doesn't become CPU-bound

---

## Section F: Recommendations & 4-Week Plan

### Top 10 Changes Before Load Testing

| # | Change | Effort | Impact | Week |
|---|--------|--------|--------|------|
| 1 | Upgrade RDS to db.t4g.medium | 30 min | Critical | 1 |
| 2 | Enable RDS Multi-AZ | 30 min | Critical | 1 |
| 3 | Enable Container Insights | 10 min | High | 1 |
| 4 | Enable RDS Performance Insights | 10 min | High | 1 |
| 5 | Increase API task size (1024 CPU / 2048 MB) | 15 min | High | 1 |
| 6 | Add org_id composite indexes | 2 hours | High | 2 |
| 7 | Set up RDS Proxy | 2 hours | High | 2 |
| 8 | Add ElastiCache Redis | 4 hours | High | 3 |
| 9 | Implement API rate limiting | 4 hours | High | 3 |
| 10 | Add worker auto-scaling | 2 hours | Medium | 3 |

### Hard-to-Change-Later Decisions

Lock in these decisions now:

1. **RDS Proxy**: Retrofitting connection pooling is painful; enable now
2. **Multi-tenant indexing strategy**: Adding indexes to large tables is slow
3. **Cache invalidation patterns**: Design cache keys for tenant isolation
4. **Rate limiting architecture**: ALB WAF vs application-level vs API Gateway

### 4-Week Hardening Plan

#### Week 1: Observability & Basic Safeguards

| Day | Task | Owner |
|-----|------|-------|
| 1 | Enable Container Insights | DevOps |
| 1 | Enable RDS Performance Insights + Enhanced Monitoring | DevOps |
| 2 | Create CloudWatch dashboard | DevOps |
| 2 | Set up alerting rules | DevOps |
| 3 | Upgrade RDS to db.t4g.medium + Multi-AZ | DevOps |
| 4 | Increase API task size (1024/2048) | DevOps |
| 5 | Run Phase 1 smoke tests | QA |

**Deliverable**: Visibility into system behavior, basic resilience

#### Week 2: Database Optimization

| Day | Task | Owner |
|-----|------|-------|
| 1 | Analyze slow query logs from Week 1 | Backend |
| 2 | Add composite indexes for top queries | Backend |
| 3 | Set up RDS Proxy | DevOps |
| 4 | Configure connection pool limits | Backend |
| 5 | Run Phase 2 stress tests | QA |

**Deliverable**: Database handles 5x current load

#### Week 3: Caching & Scaling

| Day | Task | Owner |
|-----|------|-------|
| 1 | Deploy ElastiCache Redis | DevOps |
| 2 | Implement caching for schedules/policies | Backend |
| 3 | Add cache for on-call calculations | Backend |
| 4 | Implement API rate limiting (per-tenant) | Backend |
| 5 | Add SQS-based worker auto-scaling | DevOps |

**Deliverable**: Hot reads cached, workers scale with load

#### Week 4: Load Testing & Refinement

| Day | Task | Owner |
|-----|------|-------|
| 1-2 | Run Phase 3 realistic usage tests | QA |
| 3 | Run Phase 4 noisy neighbor tests | QA |
| 4 | Analyze results, identify remaining bottlenecks | All |
| 5 | Document findings, plan next iteration | All |

**Deliverable**: Confidence in production readiness, documented limits

---

## Appendix A: Cost Implications

| Change | Monthly Cost Delta | Notes |
|--------|-------------------|-------|
| RDS db.t4g.micro → medium | +$25 | Essential for production |
| RDS Multi-AZ | +$25 | Essential for reliability |
| ElastiCache t4g.micro x2 | +$25 | High ROI for caching |
| 2nd NAT Gateway | +$32 | Optional, improves availability |
| Container Insights | +$5-10 | Based on log volume |
| RDS Proxy | +$0 | Included with RDS |

**Total estimated increase**: ~$80-120/month for production-ready infrastructure

---

## Appendix B: Monitoring Queries

### CloudWatch Logs Insights - Slow API Requests
```
fields @timestamp, @message
| parse @message '"latencyMs":*,' as latency
| filter latency > 1000
| stats count() by bin(5m)
| sort @timestamp desc
```

### CloudWatch Logs Insights - Errors by Tenant
```
fields @timestamp, @message
| parse @message '"orgId":"*"' as orgId
| parse @message '"statusCode":*,' as status
| filter status >= 500
| stats count() by orgId
| sort count desc
| limit 10
```

### RDS Performance Insights - Top Queries
```sql
-- Via Performance Insights console or pg_stat_statements
SELECT
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE query LIKE '%incidents%'
ORDER BY total_time DESC
LIMIT 10;
```

---

## Appendix C: Reference Architecture (Target State)

```
                                    ┌─────────────────┐
                                    │   CloudFront    │
                                    │   (Frontend)    │
                                    └────────┬────────┘
                                             │
┌────────────────────────────────────────────┼────────────────────────────────────────────┐
│                                            ▼                              VPC           │
│                                    ┌───────────────┐                                    │
│                                    │  WAF + ALB    │                                    │
│                                    │ (rate limits) │                                    │
│                                    └───────┬───────┘                                    │
│                                            │                                            │
│            ┌───────────────────────────────┼───────────────────────────────┐            │
│            │                               ▼                               │            │
│            │    ┌─────────────────────────────────────────────────┐       │            │
│            │    │              ECS Cluster (Fargate)               │       │            │
│            │    │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │       │            │
│            │    │  │  API    │  │  API    │  │  Workers (4)    │  │       │            │
│            │    │  │ Task 1  │  │ Task 2  │  │  Auto-scaled    │  │       │            │
│            │    │  └────┬────┘  └────┬────┘  └────────┬────────┘  │       │            │
│            │    └───────┼───────────┼─────────────────┼───────────┘       │            │
│            │            │           │                 │                    │            │
│  Private   │            └─────┬─────┘                 │                    │  Private   │
│  Subnet    │                  │                       │                    │  Subnet    │
│  (AZ-a)    │                  ▼                       ▼                    │  (AZ-b)    │
│            │          ┌───────────────┐       ┌───────────────┐            │            │
│            │          │   RDS Proxy   │       │     SQS       │            │            │
│            │          │ (conn pool)   │       │   Queues      │            │            │
│            │          └───────┬───────┘       └───────────────┘            │            │
│            │                  │                                            │            │
│            │                  ▼                                            │            │
│            │          ┌───────────────┐                                    │            │
│            │          │  RDS Postgres │◄────── Multi-AZ Standby            │            │
│            │          │   (Primary)   │           (AZ-b)                   │            │
│            │          └───────────────┘                                    │            │
│            │                                                               │            │
│            │          ┌───────────────┐                                    │            │
│            │          │  ElastiCache  │◄────── Replica                     │            │
│            │          │    Redis      │          (AZ-b)                    │            │
│            │          └───────────────┘                                    │            │
│            │                                                               │            │
│            └───────────────────────────────────────────────────────────────┘            │
│                                                                                          │
│            ┌────────────┐                                    ┌────────────┐              │
│            │ NAT GW     │                                    │ NAT GW     │              │
│            │ (AZ-a)     │                                    │ (AZ-b)     │              │
│            └────────────┘                                    └────────────┘              │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Document maintained by: Platform Engineering*
*Last review: January 2025*
*Next review: After load testing completion*
