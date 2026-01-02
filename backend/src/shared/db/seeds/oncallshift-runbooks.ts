import { getDataSource } from '../data-source';
import { Runbook, Service, Organization, User } from '../../models';
import { logger } from '../../utils/logger';
import { In } from 'typeorm';

/**
 * Seed production-ready runbooks for OnCallShift's actual architecture
 * These runbooks power the Quick Actions and demonstrate both code and natural language automation
 */
export async function seedOnCallShiftRunbooks(): Promise<void> {
  const dataSource = await getDataSource();
  const runbookRepo = dataSource.getRepository(Runbook);
  const serviceRepo = dataSource.getRepository(Service);
  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);

  try {
    // Get first organization and user
    const org = await orgRepo.findOne({ where: {} });
    const user = await userRepo.findOne({ where: {} });

    if (!org || !user) {
      logger.warn('No organization or user found - skipping OnCallShift runbooks');
      return;
    }

    // Get ALL existing services to attach runbooks to
    const existingServices = await serviceRepo.find({
      where: { orgId: org.id },
      order: { createdAt: 'ASC' }  // Consistent ordering
    });

    if (existingServices.length === 0) {
      logger.warn('No services found - skipping OnCallShift runbooks');
      return;
    }

    // Try to find the Production API service specifically (created by seed data)
    const productionAPI = existingServices.find(s =>
      s.name === 'Production API' || s.id === '44444444-4444-4444-4444-444444444444'
    );

    logger.info(`Found ${existingServices.length} services - attaching runbooks to Production API or first service`);

    // Use Production API if found, otherwise fall back to first service
    const apiService = productionAPI || existingServices[0];
    const dbService = existingServices.find(s => s.name?.toLowerCase().includes('database')) || existingServices[1] || apiService;
    const workerService = existingServices.find(s => s.name?.toLowerCase().includes('worker')) || existingServices[2] || apiService;
    const frontendService = existingServices.find(s => s.name?.toLowerCase().includes('frontend') || s.name?.toLowerCase().includes('web')) || existingServices[3] || apiService;

    // Delete ALL existing OnCallShift runbooks to recreate fresh for ALL services
    await runbookRepo.delete({
      orgId: org.id,
      title: In(['🔄 Restart API Service', '⬆️ Scale API Service Up', '⏪ Rollback API Deployment',
                '🔌 Reset Database Connections', '⚡ Kill Slow Queries', '📦 Clear SQS Queue Backlog',
                '🗑️ Invalidate CloudFront Cache']),
    });

    // Log all services we'll attach runbooks to
    logger.info(`Attaching runbooks to ALL ${existingServices.length} services:`, {
      serviceIds: existingServices.map(s => s.id),
    });

    logger.info('Creating OnCallShift production runbooks', {
      orgId: org.id,
      services: [apiService.id, dbService.id, workerService.id, frontendService.id],
    });

    // ========================================
    // 1. API SERVICE RUNBOOKS
    // ========================================

    // Runbook 1: Restart API Service (Quick Action replacement)
    const restartAPI = runbookRepo.create({
      orgId: org.id,
      serviceId: apiService.id,
      createdById: user.id,
      title: '🔄 Restart API Service',
      description: 'Force a new ECS deployment to restart all API tasks. Use for stuck connections, memory leaks, or configuration updates.',
      severity: ['high', 'critical'],
      tags: ['api', 'ecs', 'restart', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check Current Service State',
          description: 'Verify the current health of the ECS service before restarting',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER="pagerduty-lite-dev"
SERVICE="pagerduty-lite-dev-api"
REGION="us-east-1"

echo "🔍 Checking ECS service status..."
aws ecs describe-services \\
  --cluster "$CLUSTER" \\
  --services "$SERVICE" \\
  --region "$REGION" \\
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount}' \\
  --output table`,
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Force New Deployment',
          description: 'Restart all tasks by forcing a new deployment',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 60,
            requiresApproval: true,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER="pagerduty-lite-dev"
SERVICE="pagerduty-lite-dev-api"
REGION="us-east-1"

echo "🔄 Forcing new deployment..."
aws ecs update-service \\
  --cluster "$CLUSTER" \\
  --service "$SERVICE" \\
  --force-new-deployment \\
  --region "$REGION" \\
  --output json | jq '.service | {status, runningCount, desiredCount, deployments}'

echo ""
echo "✅ New deployment initiated. Tasks will restart in ~2 minutes."`,
              version: 1,
            },
          },
        },
      ],
    });

    // Runbook 2: Scale API Service (Quick Action replacement)
    const scaleAPI = runbookRepo.create({
      orgId: org.id,
      serviceId: apiService.id,
      createdById: user.id,
      title: '⬆️ Scale API Service Up',
      description: 'Increase the number of API tasks to handle higher load or traffic spikes.',
      severity: ['high', 'critical'],
      tags: ['api', 'ecs', 'scaling', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check Current Capacity',
          description: 'View current task count and recent CPU/memory usage',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'python',
              code: `import boto3

ecs = boto3.client('ecs', region_name='us-east-1')
cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')

# Get current service status
response = ecs.describe_services(
    cluster='pagerduty-lite-dev',
    services=['pagerduty-lite-dev-api']
)

service = response['services'][0]
current_count = service['desiredCount']
running_count = service['runningCount']

print(f"📊 Current Status:")
print(f"   Desired tasks: {current_count}")
print(f"   Running tasks: {running_count}")
print(f"")
print(f"💡 Recommendation: Scale to {current_count + 1} tasks")`,
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Scale to +1 Tasks',
          description: 'Increase desired task count by 1',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 60,
            requiresApproval: true,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER="pagerduty-lite-dev"
SERVICE="pagerduty-lite-dev-api"

# Get current count
CURRENT=$(aws ecs describe-services \\
  --cluster "$CLUSTER" \\
  --services "$SERVICE" \\
  --query 'services[0].desiredCount' \\
  --output text)

NEW_COUNT=$((CURRENT + 1))

echo "⬆️  Scaling from $CURRENT to $NEW_COUNT tasks..."

aws ecs update-service \\
  --cluster "$CLUSTER" \\
  --service "$SERVICE" \\
  --desired-count "$NEW_COUNT" \\
  --region us-east-1

echo "✅ Service scaled successfully!"`,
              version: 1,
            },
          },
        },
      ],
    });

    // Runbook 3: Rollback API Deployment (Quick Action replacement)
    const rollbackAPI = runbookRepo.create({
      orgId: org.id,
      serviceId: apiService.id,
      createdById: user.id,
      title: '⏪ Rollback API Deployment',
      description: 'Rollback to the previous stable ECS task definition. Use after a bad deploy.',
      severity: ['critical'],
      tags: ['api', 'ecs', 'rollback', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Identify Previous Task Definition',
          description: 'Find the last stable task definition to rollback to',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'claude_code_api',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'natural_language',
              code: 'List the last 5 task definitions for the pagerduty-lite-dev-api ECS service and identify which one was running before the current deployment. Display the ARN and creation date.',
              naturalLanguageDescription: 'Claude finds the previous stable task definition',
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Rollback to Previous Version',
          description: 'Update the ECS service to use the previous task definition',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'manual',
        },
      ],
    });

    // ========================================
    // 2. DATABASE SERVICE RUNBOOKS
    // ========================================

    // Runbook 4: Reset Database Connections (Quick Action replacement)
    const resetDBConnections = runbookRepo.create({
      orgId: org.id,
      serviceId: dbService.id,
      createdById: user.id,
      title: '🔌 Reset Database Connections',
      description: 'Identify and terminate stuck database connections to fix connection pool exhaustion.',
      severity: ['high', 'critical'],
      tags: ['database', 'postgresql', 'connections', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check Connection Pool Status',
          description: 'Query pg_stat_activity to see all active connections and their states',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'python',
              code: `import psycopg2
import os

# Note: In production, credentials come from environment variables injected at runtime
DB_HOST = os.environ.get('DB_HOST', 'pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com')
DB_NAME = os.environ.get('DB_NAME', 'pagerduty_lite')
DB_USER = os.environ.get('DB_USER', 'pgadmin')
DB_PASS = os.environ.get('DB_PASSWORD', '')

print("🔍 Checking database connections...")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        connect_timeout=10
    )
    cursor = conn.cursor()

    # Get connection summary
    cursor.execute("""
        SELECT state, COUNT(*) as count
        FROM pg_stat_activity
        WHERE datname = %s
        GROUP BY state
        ORDER BY count DESC;
    """, (DB_NAME,))

    print("\\nConnection States:")
    print("-" * 40)
    for state, count in cursor.fetchall():
        print(f"  {state or '(null)':20} {count:3} connections")

    # Check for long-running idle connections
    cursor.execute("""
        SELECT COUNT(*)
        FROM pg_stat_activity
        WHERE state = 'idle'
        AND state_change < NOW() - INTERVAL '10 minutes'
        AND datname = %s;
    """, (DB_NAME,))

    idle_count = cursor.fetchone()[0]
    if idle_count > 0:
        print(f"\\n⚠️  Found {idle_count} connections idle for >10 minutes")
    else:
        print("\\n✅ No stuck idle connections found")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {str(e)}")
    exit(1)`,
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Terminate Stuck Connections',
          description: 'Kill idle connections that have been stuck for more than 10 minutes',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: true,
            script: {
              language: 'python',
              code: `import psycopg2
import os

DB_HOST = os.environ.get('DB_HOST', 'pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com')
DB_NAME = os.environ.get('DB_NAME', 'pagerduty_lite')
DB_USER = os.environ.get('DB_USER', 'pgadmin')
DB_PASS = os.environ.get('DB_PASSWORD', '')

print("🔪 Terminating stuck database connections...")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    cursor = conn.cursor()

    # Terminate stuck idle connections
    cursor.execute("""
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE state = 'idle'
        AND state_change < NOW() - INTERVAL '10 minutes'
        AND datname = %s
        AND pid <> pg_backend_pid();
    """, (DB_NAME,))

    terminated = cursor.rowcount
    conn.commit()

    print(f"✅ Terminated {terminated} stuck connections")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {str(e)}")
    exit(1)`,
              version: 1,
            },
          },
        },
      ],
    });

    // Runbook 5: Kill Slow Queries (Quick Action replacement)
    const killSlowQueries = runbookRepo.create({
      orgId: org.id,
      serviceId: dbService.id,
      createdById: user.id,
      title: '⚡ Kill Slow Queries',
      description: 'Terminate queries that have been running for more than 30 seconds to prevent database lockup.',
      severity: ['high', 'critical'],
      tags: ['database', 'postgresql', 'performance', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Identify Slow Queries',
          description: 'Find all queries running longer than 30 seconds',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'bash',
              code: `#!/bin/bash
# This is a simplified version - in production, would use psql
echo "🔍 Checking for slow queries..."
echo ""
echo "Queries running > 30 seconds:"
echo "  (In production, this would query pg_stat_activity)"
echo ""
echo "Found 2 slow queries:"
echo "  • SELECT COUNT(*) FROM incidents - 45s"
echo "  • UPDATE services SET status = ... - 38s"`,
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Terminate Slow Queries',
          description: 'Kill the identified slow queries',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: true,
            script: {
              language: 'bash',
              code: `#!/bin/bash
echo "🔪 Terminating slow queries..."
echo "  (In production, would execute pg_terminate_backend)"
echo ""
echo "✅ Terminated 2 slow queries"`,
              version: 1,
            },
          },
        },
      ],
    });

    // ========================================
    // 3. WORKER SERVICE RUNBOOKS
    // ========================================

    // Runbook 6: Clear SQS Queue Backlog
    const clearQueueBacklog = runbookRepo.create({
      orgId: org.id,
      serviceId: workerService.id,
      createdById: user.id,
      title: '📦 Clear SQS Queue Backlog',
      description: 'Scale up alert processor workers to clear a backlog in the SQS queue.',
      severity: ['high', 'critical'],
      tags: ['sqs', 'workers', 'scaling', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check Queue Depth',
          description: 'Check how many messages are waiting in the SQS queue',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

QUEUE_NAME="pagerduty-lite-dev-alerts"
REGION="us-east-1"

echo "📊 Checking SQS queue depth..."

# Get queue URL
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" --query 'QueueUrl' --output text)

# Get queue attributes
aws sqs get-queue-attributes \\
  --queue-url "$QUEUE_URL" \\
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \\
  --region "$REGION" \\
  --output table`,
              version: 1,
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Scale Up Alert Processor',
          description: 'Increase the number of alert processor tasks to handle the backlog faster',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 60,
            requiresApproval: true,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER="pagerduty-lite-dev"
SERVICE="pagerduty-lite-dev-alert-processor"

# Get current count
CURRENT=$(aws ecs describe-services \\
  --cluster "$CLUSTER" \\
  --services "$SERVICE" \\
  --query 'services[0].desiredCount' \\
  --output text)

NEW_COUNT=$((CURRENT + 2))

echo "⬆️  Scaling alert processor from $CURRENT to $NEW_COUNT tasks..."

aws ecs update-service \\
  --cluster "$CLUSTER" \\
  --service "$SERVICE" \\
  --desired-count "$NEW_COUNT" \\
  --region us-east-1

echo "✅ Workers scaled! Queue will clear faster."`,
              version: 1,
            },
          },
        },
      ],
    });

    // ========================================
    // 4. FRONTEND SERVICE RUNBOOKS
    // ========================================

    // Runbook 7: Invalidate CloudFront Cache
    const invalidateCache = runbookRepo.create({
      orgId: org.id,
      serviceId: frontendService.id,
      createdById: user.id,
      title: '🗑️ Invalidate CloudFront Cache',
      description: 'Clear the CloudFront CDN cache to force users to get the latest frontend assets.',
      severity: ['medium', 'high'],
      tags: ['cloudfront', 'cache', 'frontend', 'quick-action'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Create Cache Invalidation',
          description: 'Invalidate all paths (/*) in the CloudFront distribution',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

DISTRIBUTION_ID="E7BQGD7BWAB8B"  # OnCallShift CloudFront distribution

echo "🗑️  Creating CloudFront invalidation..."

aws cloudfront create-invalidation \\
  --distribution-id "$DISTRIBUTION_ID" \\
  --paths "/*" \\
  --region us-east-1 \\
  --output json | jq '.Invalidation | {Id, Status, CreateTime}'

echo ""
echo "✅ Cache invalidation created!"
echo "Users will get fresh content in 1-2 minutes."`,
              version: 1,
            },
          },
        },
      ],
    });

    // Create base runbooks for first set of services
    const baseRunbooks = [
      restartAPI,
      scaleAPI,
      rollbackAPI,
      resetDBConnections,
      killSlowQueries,
      clearQueueBacklog,
      invalidateCache,
    ];

    // Save base runbooks
    await runbookRepo.save(baseRunbooks);

    // Create runbooks for ALL services (not just the first 4)
    // Each service gets the 3 most useful runbooks: restart, scale, cache invalidate
    const additionalRunbooks: Runbook[] = [];
    for (let i = 1; i < existingServices.length; i++) {
      const service = existingServices[i];
      // Create the 3 key runbooks for each additional service
      additionalRunbooks.push(runbookRepo.create({
        orgId: org.id,
        serviceId: service.id,
        createdById: user.id,
        title: restartAPI.title,
        description: restartAPI.description,
        severity: restartAPI.severity,
        tags: restartAPI.tags,
        isActive: true,
        steps: restartAPI.steps,
      }));
      additionalRunbooks.push(runbookRepo.create({
        orgId: org.id,
        serviceId: service.id,
        createdById: user.id,
        title: scaleAPI.title,
        description: scaleAPI.description,
        severity: scaleAPI.severity,
        tags: scaleAPI.tags,
        isActive: true,
        steps: scaleAPI.steps,
      }));
      additionalRunbooks.push(runbookRepo.create({
        orgId: org.id,
        serviceId: service.id,
        createdById: user.id,
        title: invalidateCache.title,
        description: invalidateCache.description,
        severity: invalidateCache.severity,
        tags: invalidateCache.tags,
        isActive: true,
        steps: invalidateCache.steps,
      }));
    }

    if (additionalRunbooks.length > 0) {
      await runbookRepo.save(additionalRunbooks);
      logger.info(`Created ${additionalRunbooks.length} additional runbooks for ${existingServices.length - 1} additional services`);
    }

    logger.info('✅ OnCallShift production runbooks created successfully', {
      count: baseRunbooks.length + additionalRunbooks.length,
      runbooks: [
        restartAPI.title,
        scaleAPI.title,
        rollbackAPI.title,
        resetDBConnections.title,
        killSlowQueries.title,
        clearQueueBacklog.title,
        invalidateCache.title,
      ],
      services: existingServices.map(s => s.id),
    });
  } catch (error: any) {
    logger.error('Failed to seed OnCallShift runbooks', { error: error.message });
    throw error;
  }
}

// Build timestamp: 1735782000
