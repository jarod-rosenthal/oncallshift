#!/bin/bash
set -e

echo "🚀 Deploying AI Worker image..."

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker"

# 1. Login to ECR
echo "📝 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# 2. Build Docker image
echo "🔨 Building AI Worker Docker image..."
cd backend
docker build -f Dockerfile.ai-worker -t $ECR_REPO:latest .
cd ..

# 3. Push to ECR
echo "⬆️  Pushing to ECR..."
docker push $ECR_REPO:latest

# 4. Update Manager Executor task definition to use :latest
echo "🔄 Updating Manager Executor task definition..."
TASK_DEF_ARN=$(aws ecs describe-task-definition \
  --task-definition pagerduty-lite-dev-ai-worker-manager-executor \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "Current task definition: $TASK_DEF_ARN"

# Register new task definition with :latest tag
TASK_DEF_JSON=$(aws ecs describe-task-definition \
  --task-definition pagerduty-lite-dev-ai-worker-manager-executor \
  --region $AWS_REGION \
  --query 'taskDefinition' \
  --output json)

# Remove read-only fields and update image tag
NEW_TASK_DEF=$(echo "$TASK_DEF_JSON" | jq '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].image = "593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker:latest"
')

echo "$NEW_TASK_DEF" | jq '.containerDefinitions[0].image'

# Register new revision
aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --region $AWS_REGION \
  --query 'taskDefinition.{family:family,revision:revision,image:containerDefinitions[0].image}' \
  --output table

echo "✅ AI Worker image deployed successfully!"
echo ""
echo "Manager Executor will use the updated image on next task spawn."
