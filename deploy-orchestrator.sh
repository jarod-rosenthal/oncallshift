#!/bin/bash
set -e

echo "🤖 AI Worker Orchestrator Deployment Script"
echo "============================================"
echo ""

# Get git commit for versioning
COMMIT=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%s)
VERSION="orch-${COMMIT}-${TIMESTAMP}"

echo "📝 Version: $VERSION"
echo ""

# Step 1: Rebuild backend TypeScript
echo "🔨 Rebuilding backend TypeScript..."
cd backend
npm run build
cd ..
echo "✅ TypeScript compiled"
echo ""

# Step 2: Build Docker image with unique version tag
echo "🐳 Building Docker image..."
docker build -t pagerduty-lite-dev-api:${VERSION} -f Dockerfile .
echo "✅ Docker image built: ${VERSION}"
echo ""

# Step 3: Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin REDACTED_ECR_REGISTRY
echo "✅ Logged into ECR"
echo ""

# Step 4: Tag and push to ECR
ECR_REPO="REDACTED_ECR_REGISTRY/pagerduty-lite-dev-api"
echo "⬆️  Pushing to ECR..."
docker tag pagerduty-lite-dev-api:${VERSION} ${ECR_REPO}:${VERSION}
docker push ${ECR_REPO}:${VERSION}

# Also update latest tag
docker tag pagerduty-lite-dev-api:${VERSION} ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest
echo "✅ Pushed to ECR: ${VERSION} and :latest"
echo ""

# Step 5: Force new deployment of orchestrator service
echo "🔄 Force redeploying AI Worker Orchestrator..."
aws ecs update-service \
  --cluster pagerduty-lite-dev \
  --service pagerduty-lite-dev-aiw-orch \
  --force-new-deployment \
  --region us-east-1 \
  --query 'service.{serviceName:serviceName,desiredCount:desiredCount}' \
  --output table

echo ""
echo "⏳ Waiting for new orchestrator task to start (max 2 minutes)..."

# Wait for new task to be running
for i in {1..24}; do
  RUNNING_COUNT=$(aws ecs describe-services \
    --cluster pagerduty-lite-dev \
    --services pagerduty-lite-dev-aiw-orch \
    --region us-east-1 \
    --query 'services[0].runningCount' \
    --output text)

  if [ "$RUNNING_COUNT" -ge "1" ]; then
    echo "✅ New orchestrator task is running!"
    break
  fi

  echo "   Waiting... ($i/24)"
  sleep 5
done

# Step 6: Verify new code is running by checking logs
echo ""
echo "🔍 Verifying new code is running..."
sleep 10  # Wait for logs to appear

RECENT_LOG=$(aws logs tail /ecs/pagerduty-lite-dev/aiw-orch --since 30s --region us-east-1 2>&1 | grep "Initializing\|starting" | tail -1)

if [ -n "$RECENT_LOG" ]; then
  echo "✅ Orchestrator logs detected - service is running"
  echo "   Latest log: $RECENT_LOG"
else
  echo "⚠️  No recent logs found - check manually"
fi

echo ""
echo "============================================"
echo "✅ Deployment complete!"
echo ""
echo "📊 Check status:"
echo "   aws ecs describe-services --cluster pagerduty-lite-dev --services pagerduty-lite-dev-aiw-orch --region us-east-1"
echo ""
echo "📋 View logs:"
echo "   aws logs tail /ecs/pagerduty-lite-dev/aiw-orch --follow --region us-east-1"
echo ""
echo "🧪 Now you can retry OCS-159 from Control Center"
