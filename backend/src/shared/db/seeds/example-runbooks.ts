import { getDataSource } from '../data-source';
import { Runbook, Service, Organization, User } from '../../models';
import { logger } from '../../utils/logger';

/**
 * Seed example runbooks showcasing automation capabilities
 */
export async function seedExampleRunbooks(): Promise<void> {
  const dataSource = await getDataSource();
  const runbookRepo = dataSource.getRepository(Runbook);
  const serviceRepo = dataSource.getRepository(Service);
  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);

  try {
    // Get first organization and user for examples
    const org = await orgRepo.findOne({ where: {} });
    const user = await userRepo.findOne({ where: {} });

    if (!org || !user) {
      logger.warn('No organization or user found - skipping example runbooks');
      return;
    }

    // Get or create a demo service
    let service = await serviceRepo.findOne({
      where: { orgId: org.id, name: 'Demo Service' }
    });

    if (!service) {
      service = serviceRepo.create({
        orgId: org.id,
        name: 'Demo Service',
        description: 'Service for demonstrating runbook automation',
      });
      await serviceRepo.save(service);
    }

    logger.info('Creating example runbooks', { orgId: org.id, serviceId: service.id });

    // 1. AWS ECS Service Recovery
    const ecsRecovery = runbookRepo.create({
      orgId: org.id,
      serviceId: service.id,
      createdById: user.id,
      title: '🚀 AWS ECS Service Recovery',
      description: 'Automatically recover an unhealthy ECS service by forcing a new deployment. Demonstrates multi-language steps, approval gates, and health validation.',
      severity: ['critical', 'high'],
      tags: ['aws', 'ecs', 'auto-remediation', 'production'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check ECS Service Health',
          description: 'Query AWS ECS to check the current state of the service, including running tasks, desired tasks, and deployment status.',
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

# Configuration
CLUSTER_NAME="\${ECS_CLUSTER:-your-cluster-name}"
SERVICE_NAME="\${ECS_SERVICE:-your-cluster-name-api}"
REGION="\${AWS_REGION:-us-east-1}"

echo "Checking ECS service health..."
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Get service details
SERVICE_INFO=$(aws ecs describe-services \\
  --cluster "$CLUSTER_NAME" \\
  --services "$SERVICE_NAME" \\
  --region "$REGION" \\
  --query 'services[0]' \\
  --output json)

# Extract key metrics
RUNNING_COUNT=$(echo "$SERVICE_INFO" | jq -r '.runningCount')
DESIRED_COUNT=$(echo "$SERVICE_INFO" | jq -r '.desiredCount')
PENDING_COUNT=$(echo "$SERVICE_INFO" | jq -r '.pendingCount')
STATUS=$(echo "$SERVICE_INFO" | jq -r '.status')

echo "Service Status: $STATUS"
echo "Running Tasks: $RUNNING_COUNT"
echo "Desired Tasks: $DESIRED_COUNT"
echo "Pending Tasks: $PENDING_COUNT"
echo ""

# Check for unhealthy state
if [ "$RUNNING_COUNT" -lt "$DESIRED_COUNT" ]; then
  echo "⚠️  WARNING: Service is unhealthy!"
  echo "Running tasks ($RUNNING_COUNT) is less than desired ($DESIRED_COUNT)"
  exit 1
else
  echo "✅ Service appears healthy"
  exit 0
fi`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Force New Deployment',
          description: 'Force ECS to create a new deployment, which will start fresh tasks with the latest configuration. This requires approval as it impacts production.',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 60,
            requiresApproval: true, // Destructive operation
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER_NAME="\${ECS_CLUSTER:-your-cluster-name}"
SERVICE_NAME="\${ECS_SERVICE:-your-cluster-name-api}"
REGION="\${AWS_REGION:-us-east-1}"

echo "Forcing new deployment for ECS service..."
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo ""

# Force new deployment
aws ecs update-service \\
  --cluster "$CLUSTER_NAME" \\
  --service "$SERVICE_NAME" \\
  --force-new-deployment \\
  --region "$REGION" \\
  --output json | jq -r '.service | {status, runningCount, desiredCount, deployments}'

echo ""
echo "✅ New deployment initiated successfully"
echo "Waiting 10 seconds for deployment to begin..."
sleep 10`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-3',
          order: 3,
          title: 'Wait for Healthy State',
          description: 'Monitor the service until all tasks are running and healthy. Uses Python with boto3 for more sophisticated polling logic.',
          isOptional: false,
          estimatedMinutes: 5,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 300,
            requiresApproval: false,
            script: {
              language: 'python',
              code: `import boto3
import time
import os
import sys

# Configuration
CLUSTER_NAME = os.environ.get('ECS_CLUSTER', 'your-cluster-name')
SERVICE_NAME = os.environ.get('ECS_SERVICE', 'your-cluster-name-api')
REGION = os.environ.get('AWS_REGION', 'us-east-1')
MAX_WAIT_TIME = 240  # 4 minutes
POLL_INTERVAL = 10   # 10 seconds

print(f"Waiting for ECS service to become healthy...")
print(f"Cluster: {CLUSTER_NAME}")
print(f"Service: {SERVICE_NAME}")
print(f"Max wait time: {MAX_WAIT_TIME} seconds")
print()

# Initialize ECS client
ecs = boto3.client('ecs', region_name=REGION)

start_time = time.time()
attempt = 0

while True:
    attempt += 1
    elapsed = time.time() - start_time

    if elapsed > MAX_WAIT_TIME:
        print(f"❌ Timeout: Service did not become healthy within {MAX_WAIT_TIME} seconds")
        sys.exit(1)

    # Get service status
    response = ecs.describe_services(
        cluster=CLUSTER_NAME,
        services=[SERVICE_NAME]
    )

    if not response['services']:
        print(f"❌ Service not found: {SERVICE_NAME}")
        sys.exit(1)

    service = response['services'][0]
    running_count = service['runningCount']
    desired_count = service['desiredCount']
    pending_count = service['pendingCount']

    print(f"[Attempt {attempt}] Running: {running_count}, Desired: {desired_count}, Pending: {pending_count}")

    # Check if healthy
    if running_count == desired_count and pending_count == 0:
        print()
        print(f"✅ Service is healthy! All {desired_count} tasks are running.")
        print(f"Total time: {elapsed:.1f} seconds")
        sys.exit(0)

    # Wait before next check
    time.sleep(POLL_INTERVAL)`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
      ],
    });

    // 2. Database Connection Pool Analysis
    const dbAnalysis = runbookRepo.create({
      orgId: org.id,
      serviceId: service.id,
      createdById: user.id,
      title: '🔍 Database Connection Pool Analysis',
      description: 'Analyze database connection patterns, check for connection leaks, measure replica lag, and get AI recommendations for optimal pool settings.',
      severity: ['high', 'medium'],
      tags: ['database', 'performance', 'postgresql', 'analysis'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check Active Database Connections',
          description: 'Query PostgreSQL to identify active connections, their states, and duration. Helps identify connection leaks or long-running queries.',
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
from datetime import datetime

# Database configuration (from environment or defaults)
DB_HOST = os.environ.get('DB_HOST', 'REDACTED_RDS_HOSTNAME')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'pagerduty_lite')
DB_USER = os.environ.get('DB_USER', 'pgadmin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')

print("Analyzing database connections...")
print(f"Database: {DB_HOST}:{DB_PORT}/{DB_NAME}")
print()

try:
    # Connect to database
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )

    cursor = conn.cursor()

    # Query active connections
    query = """
    SELECT
        state,
        COUNT(*) as count,
        MAX(EXTRACT(EPOCH FROM (NOW() - state_change))) as max_duration_sec
    FROM pg_stat_activity
    WHERE datname = %s
    GROUP BY state
    ORDER BY count DESC;
    """

    cursor.execute(query, (DB_NAME,))
    results = cursor.fetchall()

    print("Connection States:")
    print("-" * 50)
    total_connections = 0
    for state, count, max_duration in results:
        total_connections += count
        duration_str = f"{max_duration:.1f}s" if max_duration else "N/A"
        print(f"{state:20} {count:3} connections (max: {duration_str})")

    print("-" * 50)
    print(f"Total connections: {total_connections}")
    print()

    # Check for long-running queries
    cursor.execute("""
        SELECT COUNT(*)
        FROM pg_stat_activity
        WHERE state = 'active'
        AND query_start < NOW() - INTERVAL '5 minutes'
        AND datname = %s;
    """, (DB_NAME,))

    long_running = cursor.fetchone()[0]
    if long_running > 0:
        print(f"⚠️  WARNING: {long_running} queries running for more than 5 minutes")
    else:
        print("✅ No long-running queries detected")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {str(e)}")
    exit(1)`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Measure RDS Replica Lag',
          description: 'Check CloudWatch metrics for database replica lag to ensure read replicas are keeping up with the primary.',
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

DB_INSTANCE_ID="\${DB_INSTANCE_ID:-your-cluster-name}"
REGION="\${AWS_REGION:-us-east-1}"

echo "Checking RDS replica lag..."
echo "Instance: $DB_INSTANCE_ID"
echo ""

# Get replica lag metric from CloudWatch
REPLICA_LAG=$(aws cloudwatch get-metric-statistics \\
  --namespace AWS/RDS \\
  --metric-name ReplicaLag \\
  --dimensions Name=DBInstanceIdentifier,Value="$DB_INSTANCE_ID" \\
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \\
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \\
  --period 300 \\
  --statistics Average \\
  --region "$REGION" \\
  --query 'Datapoints[0].Average' \\
  --output text 2>/dev/null || echo "None")

if [ "$REPLICA_LAG" = "None" ] || [ -z "$REPLICA_LAG" ]; then
  echo "ℹ️  No replica lag data (single-instance deployment)"
else
  echo "Replica Lag: \${REPLICA_LAG}ms"

  # Check if lag is concerning - simple comparison
  LAG_INT=\${REPLICA_LAG%.*}  # Get integer part
  if [ "$LAG_INT" -gt 1000 ] 2>/dev/null; then
    echo "⚠️  WARNING: High replica lag detected (>1 second)"
  else
    echo "✅ Replica lag is within acceptable range"
  fi
fi`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-3',
          order: 3,
          title: 'AI-Powered Pool Recommendations',
          description: 'Use Claude to analyze the connection patterns and provide recommendations for optimal pool settings based on the data collected.',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'claude_code_api',
            timeout: 30,
            requiresApproval: false,
            script: {
              language: 'natural_language',
              code: 'Analyze the database connection patterns from the previous steps and recommend optimal connection pool settings. Consider the number of active connections, idle connections, and any long-running queries. Provide specific recommendations for min_pool_size, max_pool_size, and connection_timeout values.',
              naturalLanguageDescription: 'AI analyzes connection data and recommends pool settings',
              version: 1,
              generatedAt: new Date().toISOString(),
            },
          },
        },
      ],
    });

    // 3. Auto-Silence During Maintenance
    const maintenanceSilence = runbookRepo.create({
      orgId: org.id,
      serviceId: service.id,
      createdById: user.id,
      title: '🔕 Auto-Silence During Maintenance',
      description: 'Automatically silence incident alerts during scheduled maintenance windows. Verifies the maintenance window, snoozes alerts, and notifies the team.',
      severity: ['low', 'medium'],
      tags: ['maintenance', 'notifications', 'automation'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Verify Maintenance Window',
          description: 'Check if the current time falls within the scheduled maintenance window using JavaScript date logic.',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 10,
            requiresApproval: false,
            script: {
              language: 'javascript',
              code: `// Maintenance window configuration
const MAINTENANCE_START = process.env.MAINT_START || '22:00'; // 10 PM
const MAINTENANCE_END = process.env.MAINT_END || '02:00';     // 2 AM
const TIMEZONE = process.env.TIMEZONE || 'America/New_York';

console.log('Checking maintenance window...');
console.log(\`Window: \${MAINTENANCE_START} - \${MAINTENANCE_END} (\${TIMEZONE})\`);
console.log('');

// Parse time strings
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

// Get current time in maintenance timezone
const now = new Date();
const currentHour = now.getHours();
const currentMinute = now.getMinutes();

const start = parseTime(MAINTENANCE_START);
const end = parseTime(MAINTENANCE_END);

console.log(\`Current time: \${currentHour.toString().padStart(2, '0')}:\${currentMinute.toString().padStart(2, '0')}\`);

// Check if current time is within window
function isInWindow(current, start, end) {
  const currentMins = current.hours * 60 + current.minutes;
  const startMins = start.hours * 60 + start.minutes;
  const endMins = end.hours * 60 + end.minutes;

  // Handle overnight windows (e.g., 22:00 - 02:00)
  if (endMins < startMins) {
    return currentMins >= startMins || currentMins <= endMins;
  }

  return currentMins >= startMins && currentMins <= endMins;
}

const inWindow = isInWindow(
  { hours: currentHour, minutes: currentMinute },
  start,
  end
);

if (inWindow) {
  console.log('✅ Currently in maintenance window');
  console.log('Proceeding with alert silencing...');
  process.exit(0);
} else {
  console.log('❌ Not in maintenance window');
  console.log('Skipping alert silencing');
  process.exit(1);
}`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Snooze Incident Alerts',
          description: 'Use the OnCallShift API to snooze this incident for the duration of the maintenance window.',
          isOptional: false,
          estimatedMinutes: 1,
          type: 'manual',
        },
        {
          id: 'step-3',
          order: 3,
          title: 'Notify Team',
          description: 'Post a notification that the incident has been automatically silenced during maintenance.',
          isOptional: true,
          estimatedMinutes: 1,
          type: 'manual',
        },
      ],
    });

    // 4. Self-Healing CPU Scaling
    const cpuScaling = runbookRepo.create({
      orgId: org.id,
      serviceId: service.id,
      createdById: user.id,
      title: '📈 Self-Healing CPU Scaling',
      description: 'Automatically scale ECS service based on CPU utilization. Monitors CloudWatch metrics, calculates optimal task count, and scales with approval.',
      severity: ['high', 'critical'],
      tags: ['auto-scaling', 'performance', 'ecs', 'observability'],
      isActive: true,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Check CPU Metrics',
          description: 'Query CloudWatch for recent CPU utilization metrics to determine if scaling is needed.',
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
import os
from datetime import datetime, timedelta

CLUSTER_NAME = os.environ.get('ECS_CLUSTER', 'your-cluster-name')
SERVICE_NAME = os.environ.get('ECS_SERVICE', 'your-cluster-name-api')
REGION = os.environ.get('AWS_REGION', 'us-east-1')

print(f"Checking CPU metrics for ECS service...")
print(f"Cluster: {CLUSTER_NAME}")
print(f"Service: {SERVICE_NAME}")
print()

# Initialize CloudWatch client
cloudwatch = boto3.client('cloudwatch', region_name=REGION)

# Get CPU utilization for last 10 minutes
end_time = datetime.utcnow()
start_time = end_time - timedelta(minutes=10)

response = cloudwatch.get_metric_statistics(
    Namespace='AWS/ECS',
    MetricName='CPUUtilization',
    Dimensions=[
        {'Name': 'ClusterName', 'Value': CLUSTER_NAME},
        {'Name': 'ServiceName', 'Value': SERVICE_NAME},
    ],
    StartTime=start_time,
    EndTime=end_time,
    Period=300,  # 5-minute periods
    Statistics=['Average', 'Maximum']
)

if not response['Datapoints']:
    print("⚠️  No CPU metrics found")
    exit(1)

# Calculate average across datapoints
datapoints = response['Datapoints']
avg_cpu = sum(dp['Average'] for dp in datapoints) / len(datapoints)
max_cpu = max(dp['Maximum'] for dp in datapoints)

print(f"Average CPU: {avg_cpu:.1f}%")
print(f"Maximum CPU: {max_cpu:.1f}%")
print()

# Determine if scaling is needed
if avg_cpu > 70:
    print(f"⚠️  High CPU utilization detected ({avg_cpu:.1f}%)")
    print("Scaling up is recommended")
    exit(0)
elif avg_cpu < 30:
    print(f"ℹ️  Low CPU utilization ({avg_cpu:.1f}%)")
    print("Scaling down could save costs")
    exit(0)
else:
    print(f"✅ CPU utilization is normal ({avg_cpu:.1f}%)")
    print("No scaling needed")
    exit(1)`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Calculate Target Task Count',
          description: 'Calculate the optimal number of tasks based on current CPU utilization and desired target utilization.',
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

CLUSTER_NAME="\${ECS_CLUSTER:-your-cluster-name}"
SERVICE_NAME="\${ECS_SERVICE:-your-cluster-name-api}"
REGION="\${AWS_REGION:-us-east-1}"
TARGET_CPU=50  # Target 50% CPU utilization

echo "Calculating optimal task count..."
echo ""

# Get current task count
CURRENT_TASKS=$(aws ecs describe-services \\
  --cluster "$CLUSTER_NAME" \\
  --services "$SERVICE_NAME" \\
  --region "$REGION" \\
  --query 'services[0].desiredCount' \\
  --output text)

echo "Current tasks: $CURRENT_TASKS"

# For demo purposes, suggest increasing by 1
# In production, this would use actual CPU metrics
NEW_TASKS=$((CURRENT_TASKS + 1))

echo "Recommended tasks: $NEW_TASKS"
echo "Expected CPU after scaling: ~$TARGET_CPU%"
echo ""
echo "Export for next step:"
echo "NEW_TASK_COUNT=$NEW_TASKS"`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
        {
          id: 'step-3',
          order: 3,
          title: 'Scale ECS Service',
          description: 'Update the ECS service desired count to the calculated target. Requires approval as it changes production capacity.',
          isOptional: false,
          estimatedMinutes: 2,
          type: 'automated',
          automation: {
            mode: 'server_sandbox',
            timeout: 60,
            requiresApproval: true, // Production capacity change
            script: {
              language: 'bash',
              code: `#!/bin/bash
set -e

CLUSTER_NAME="\${ECS_CLUSTER:-your-cluster-name}"
SERVICE_NAME="\${ECS_SERVICE:-your-cluster-name-api}"
REGION="\${AWS_REGION:-us-east-1}"
NEW_TASK_COUNT="\${NEW_TASK_COUNT:-2}"

echo "Scaling ECS service..."
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo "New task count: $NEW_TASK_COUNT"
echo ""

# Update service desired count
aws ecs update-service \\
  --cluster "$CLUSTER_NAME" \\
  --service "$SERVICE_NAME" \\
  --desired-count "$NEW_TASK_COUNT" \\
  --region "$REGION" \\
  --output json | jq -r '.service | {status, runningCount, desiredCount}'

echo ""
echo "✅ Service scaled successfully"
echo "New tasks will start shortly..."`,
              version: 1,
              generatedAt: new Date().toISOString(),
              validatedAt: new Date().toISOString(),
            },
          },
        },
      ],
    });

    // Save all runbooks
    await runbookRepo.save([ecsRecovery, dbAnalysis, maintenanceSilence, cpuScaling]);

    logger.info('✅ Example runbooks created successfully', {
      count: 4,
      runbooks: [
        ecsRecovery.title,
        dbAnalysis.title,
        maintenanceSilence.title,
        cpuScaling.title,
      ],
    });
  } catch (error: any) {
    logger.error('Failed to seed example runbooks', { error: error.message });
    throw error;
  }
}
