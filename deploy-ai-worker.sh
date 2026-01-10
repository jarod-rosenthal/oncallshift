#!/bin/bash
set -e

echo "🚀 Deploying AI Worker image..."

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker"

# Get git commit SHA for versioned tag
GIT_SHA=$(git rev-parse --short HEAD)
echo "Git SHA: $GIT_SHA"

# 1. Login to ECR
echo "📝 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# 2. Build Docker image with versioned tag
echo "🔨 Building AI Worker Docker image..."
cd backend
docker build -f Dockerfile.ai-worker -t $ECR_REPO:$GIT_SHA .
cd ..

# 3. Push to ECR
echo "⬆️  Pushing to ECR (tag: $GIT_SHA)..."
docker push $ECR_REPO:$GIT_SHA

# 4. Update Executor task definition
echo "🔄 Updating Executor task definition..."
EXECUTOR_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition pagerduty-lite-dev-ai-worker-executor \
  --region $AWS_REGION \
  --query 'taskDefinition' \
  --output json)

EXECUTOR_NEW=$(echo "$EXECUTOR_TASK_DEF" | jq --arg tag "$GIT_SHA" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].image = "593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker:" + $tag
')

echo "Registering new Executor revision with image tag: $GIT_SHA"
aws ecs register-task-definition \
  --cli-input-json "$EXECUTOR_NEW" \
  --region $AWS_REGION \
  --query 'taskDefinition.{family:family,revision:revision,image:containerDefinitions[0].image}' \
  --output table

# 5. Update Manager Executor task definition
echo "🔄 Updating Manager Executor task definition..."
MANAGER_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition pagerduty-lite-dev-ai-worker-manager-executor \
  --region $AWS_REGION \
  --query 'taskDefinition' \
  --output json)

MANAGER_NEW=$(echo "$MANAGER_TASK_DEF" | jq --arg tag "$GIT_SHA" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].image = "593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker:" + $tag
')

echo "Registering new Manager Executor revision with image tag: $GIT_SHA"
aws ecs register-task-definition \
  --cli-input-json "$MANAGER_NEW" \
  --region $AWS_REGION \
  --query 'taskDefinition.{family:family,revision:revision,image:containerDefinitions[0].image}' \
  --output table

echo ""
echo "✅ AI Worker image deployed successfully!"
echo "   Image: $ECR_REPO:$GIT_SHA"
echo ""
echo "Both Executor and Manager Executor will use the updated image on next task spawn."
