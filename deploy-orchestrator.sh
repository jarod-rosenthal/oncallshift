#!/bin/bash
set -e

echo "🤖 AI Worker Orchestrator Deployment"
echo "====================================="
echo ""

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api"
ECS_CLUSTER="pagerduty-lite-dev"
ECS_SERVICE="pagerduty-lite-dev-aiw-orch"

# Get git commit SHA and build time for versioning
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "📝 Version: $GIT_SHA"
echo "📝 Build time: $BUILD_TIME"
echo ""

# Step 1: Rebuild backend TypeScript
echo "🔨 Rebuilding backend TypeScript..."
cd backend
npm run build
cd ..
echo "✅ TypeScript compiled"
echo ""

# Step 2: Build Docker image with metadata
echo "🐳 Building Docker image..."
docker build \
  --build-arg GIT_COMMIT=$GIT_SHA \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  -t $ECR_REPO:$GIT_SHA \
  .
echo "✅ Docker image built: $GIT_SHA"
echo ""

# Step 3: Login to ECR and push
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 593971626975.dkr.ecr.us-east-1.amazonaws.com
echo "✅ Logged into ECR"
echo ""

echo "⬆️  Pushing versioned image to ECR..."
docker push $ECR_REPO:$GIT_SHA
echo "✅ Pushed to ECR: $GIT_SHA"
echo ""

# Step 4: Update Terraform with new image tag
echo "🏗️  Updating Terraform..."
cd infrastructure/terraform/environments/dev
echo "image_tag = \"$GIT_SHA\"" > terraform.tfvars
terraform apply -auto-approve -target=module.ai_worker_orchestrator
cd ../../../../
echo "✅ Terraform updated with new image tag"
echo ""

# Step 5: Verify deployment
echo "🔍 Verifying orchestrator deployment..."
echo "   Waiting for new task to stabilize (20 seconds)..."
sleep 20

# Check task is running with new image
TASK_ARN=$(aws ecs list-tasks \
  --cluster $ECS_CLUSTER \
  --service-name $ECS_SERVICE \
  --desired-status RUNNING \
  --region $AWS_REGION \
  --query 'taskArns[0]' \
  --output text)

if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
  TASK_IMAGE=$(aws ecs describe-tasks \
    --cluster $ECS_CLUSTER \
    --tasks "$TASK_ARN" \
    --region $AWS_REGION \
    --query 'tasks[0].containers[0].image' \
    --output text)

  if echo "$TASK_IMAGE" | grep -q "$GIT_SHA"; then
    echo "✅ Deployment verified! Running version: $GIT_SHA"
  else
    echo "⚠️  Warning: Task image doesn't match expected version"
    echo "   Expected tag: $GIT_SHA"
    echo "   Running: $TASK_IMAGE"
  fi
else
  echo "⚠️  Warning: Could not find running task"
fi

echo ""
echo "====================================="
echo "✅ Orchestrator deployment complete!"
echo ""
echo "📋 View logs:"
echo "   aws logs tail /ecs/pagerduty-lite-dev/aiw-orch --follow --region us-east-1"
echo ""
