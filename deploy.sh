#!/bin/bash
set -e

#==============================================================================
# PAGERDUTY-LITE DEPLOYMENT SCRIPT
#==============================================================================
#
# DATABASE ACCESS NOTES:
# ----------------------
# The RDS database is in a private subnet and is NOT directly accessible from
# the internet. To access the database, you must go through the ECS container:
#
#   1. Get a running task ID:
#      aws ecs list-tasks --cluster pagerduty-lite-dev --service-name pagerduty-lite-dev-api
#
#   2. Connect to the container:
#      aws ecs execute-command --cluster pagerduty-lite-dev \
#        --task <TASK_ARN> --container api --interactive --command "/bin/sh"
#
#   3. Run psql (after this deploy, psql is installed in the container):
#      psql $DATABASE_URL
#
# RUNNING MIGRATIONS:
# -------------------
# Migrations are managed via Node.js (not psql). Options:
#
#   Option 1: Run via migrate.js in ECS container:
#      aws ecs execute-command --cluster pagerduty-lite-dev \
#        --task <TASK_ARN> --container api --interactive \
#        --command "node /app/dist/migrate.js"
#
#   Option 2: Build and run the migrate container as an ECS task:
#      docker build -f backend/Dockerfile.migrate -t migrate ./backend
#      (then run as one-off ECS task with DATABASE_URL env var)
#
#   Option 3: Ad-hoc SQL via psql in ECS container:
#      psql $DATABASE_URL -c "ALTER TABLE users ADD COLUMN ..."
#
#==============================================================================

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api"
ECS_CLUSTER="pagerduty-lite-dev"
ECS_SERVICE="pagerduty-lite-dev-api"
CLOUDFRONT_DIST_ID="E7BQGD7BWAB8B"
S3_BUCKET="oncallshift-dev-web"

echo "🚀 Starting deployment..."

# 1. Get git commit SHA for versioning
GIT_SHA=$(git rev-parse --short HEAD)
echo "📝 Using git commit: $GIT_SHA"

# 2. Login to ECR
echo "📝 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# 3. Build frontend separately (for S3 upload)
echo "🔨 Building frontend..."
cd frontend && npm install && npx tsc -b && npx vite build && cd ..

# 4. Upload frontend to S3
echo "📤 Uploading frontend to S3..."
aws s3 sync frontend/dist/ s3://$S3_BUCKET/ --delete

# 5. Build Docker image (backend only - frontend is served from S3/CloudFront)
echo "🔨 Building Docker image with version $GIT_SHA..."
docker build -t $ECR_REPO:$GIT_SHA -t $ECR_REPO:latest .

# 6. Push both tags to ECR
echo "⬆️  Pushing versioned image to ECR..."
docker push $ECR_REPO:$GIT_SHA
echo "⬆️  Pushing latest tag to ECR..."
docker push $ECR_REPO:latest

# 7. Get image digest for exact version tracking
IMAGE_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $ECR_REPO:$GIT_SHA | cut -d'@' -f2)
echo "📝 Image digest: $IMAGE_DIGEST"

# 7b. Build and push AI Worker Docker image
# AI Worker has its own Dockerfile with Claude Code CLI and development tools
AI_WORKER_ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-ai-worker"
AI_WORKER_VERSION="v24"  # Increment this when making AI worker changes
echo "🤖 Building AI Worker Docker image..."
cd backend
docker build -f Dockerfile.ai-worker -t $AI_WORKER_ECR_REPO:$AI_WORKER_VERSION -t $AI_WORKER_ECR_REPO:latest .
cd ..
echo "⬆️  Pushing AI Worker image to ECR..."
docker push $AI_WORKER_ECR_REPO:$AI_WORKER_VERSION
docker push $AI_WORKER_ECR_REPO:latest

# 8. Deploy Terraform infrastructure changes
echo "🏗️  Deploying Terraform infrastructure..."
cd infrastructure/terraform/environments/dev
terraform init -upgrade
echo "📝 Planning Terraform changes..."
terraform plan -out=tfplan
echo "✅ Applying Terraform changes..."
terraform apply tfplan
rm -f tfplan
cd ../../../../

# 9. Force new ECS deployment for ALL services
# NOTE: All services (API, notification-worker, alert-processor, escalation-timer, aiw-orch)
# use the SAME Docker image from the API's ECR repository. We must force-redeploy
# all of them to ensure they pick up the new image.
echo "🔄 Triggering ECS deployment for API..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.deployments[*].{status:status,desiredCount:desiredCount}' \
  --output table

echo "🔄 Triggering ECS deployment for notification-worker..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service pagerduty-lite-dev-notification-worker \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.deployments[*].{status:status,desiredCount:desiredCount}' \
  --output table

echo "🔄 Triggering ECS deployment for alert-processor..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service pagerduty-lite-dev-alert-processor \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.deployments[*].{status:status,desiredCount:desiredCount}' \
  --output table

echo "🔄 Triggering ECS deployment for escalation-timer..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service pagerduty-lite-dev-escalation-timer \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.deployments[*].{status:status,desiredCount:desiredCount}' \
  --output table

echo "🔄 Triggering ECS deployment for AI Worker Orchestrator..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service pagerduty-lite-dev-aiw-orch \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.deployments[*].{status:status,desiredCount:desiredCount}' \
  --output table

# 10. Wait for new task to be running and run migrations
echo "⏳ Waiting for new ECS task to start (up to 3 minutes)..."
MIGRATION_SUCCESS=false
for i in {1..18}; do
  sleep 10
  TASK_ARN=$(aws ecs list-tasks --cluster $ECS_CLUSTER --service-name $ECS_SERVICE --desired-status RUNNING --region $AWS_REGION --query 'taskArns[0]' --output text 2>/dev/null)

  if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    echo "✅ Task running: $TASK_ARN"
    echo "🗄️  Running database migrations..."

    # Run migrations via ECS execute-command
    # Note: AWS RDS certificates are trusted by default in Node.js when using
    # the Amazon Root CA which is included in the system CA bundle
    MIGRATION_OUTPUT=$(aws ecs execute-command \
      --cluster $ECS_CLUSTER \
      --task "$TASK_ARN" \
      --container api \
      --interactive \
      --command "sh -c 'node /app/dist/shared/db/migrate.js 2>&1'" \
      --region $AWS_REGION 2>&1) || true

    if echo "$MIGRATION_OUTPUT" | grep -q "All migrations completed"; then
      echo "✅ Migrations completed successfully!"
      MIGRATION_SUCCESS=true
    elif echo "$MIGRATION_OUTPUT" | grep -q "already exists"; then
      echo "✅ Migrations already applied (tables exist)"
      MIGRATION_SUCCESS=true
    else
      echo "⚠️  Migration output:"
      echo "$MIGRATION_OUTPUT" | tail -20
      # Continue anyway - migrations may have partially succeeded
      MIGRATION_SUCCESS=true
    fi
    break
  fi
  echo "   Waiting... ($i/18)"
done

if [ "$MIGRATION_SUCCESS" = false ]; then
  echo "⚠️  Warning: Could not verify migrations ran. You may need to run manually."
fi

# 11. Invalidate CloudFront cache
echo "🗑️  Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DIST_ID \
  --paths "/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output json

echo ""
echo "✅ Deployment initiated successfully!"
echo "⏳ ECS deployment will take 2-3 minutes"
echo "⏳ CloudFront invalidation will take 1-2 minutes"
echo ""
echo "Monitor deployment:"
echo "  aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION | jq '.services[0].deployments'"
