#!/bin/bash
set -e

# AI Diagnosis Feature Deployment Script
# This script deploys the AI-powered incident diagnosis feature

echo "=========================================="
echo "AI Diagnosis Feature Deployment"
echo "=========================================="

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROJECT_NAME="pagerduty-lite"
ENVIRONMENT="${ENVIRONMENT:-dev}"
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-${ENVIRONMENT}-api"
CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
SERVICE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-api"

echo ""
echo "Configuration:"
echo "  AWS Region: ${AWS_REGION}"
echo "  AWS Account: ${AWS_ACCOUNT_ID}"
echo "  Environment: ${ENVIRONMENT}"
echo "  ECR Repo: ${ECR_REPO}"
echo ""

# Check for Anthropic API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "WARNING: ANTHROPIC_API_KEY environment variable not set"
  echo "You will need to set it manually after deployment:"
  echo "  aws secretsmanager put-secret-value \\"
  echo "    --secret-id ${PROJECT_NAME}-${ENVIRONMENT}-anthropic-key \\"
  echo "    --secret-string 'sk-ant-your-key-here' \\"
  echo "    --region ${AWS_REGION}"
  echo ""
fi

# Step 1: Run Terraform to create/update infrastructure
echo "Step 1: Applying Terraform changes..."
cd infrastructure/terraform/environments/${ENVIRONMENT}

terraform init -input=false
terraform plan -out=tfplan -input=false
echo ""
read -p "Review the plan above. Apply changes? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Deployment cancelled"
  exit 1
fi

terraform apply tfplan
cd ../../../..

# Step 2: Set Anthropic API key if provided
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "Step 2: Setting Anthropic API key in Secrets Manager..."
  aws secretsmanager put-secret-value \
    --secret-id ${PROJECT_NAME}-${ENVIRONMENT}-anthropic-key \
    --secret-string "${ANTHROPIC_API_KEY}" \
    --region ${AWS_REGION} || \
  aws secretsmanager create-secret \
    --name ${PROJECT_NAME}-${ENVIRONMENT}-anthropic-key \
    --secret-string "${ANTHROPIC_API_KEY}" \
    --region ${AWS_REGION}
  echo "Anthropic API key configured"
else
  echo ""
  echo "Step 2: Skipping Anthropic API key (not provided)"
fi

# Step 3: Build backend Docker image
echo ""
echo "Step 3: Building backend Docker image..."
cd backend
npm run build
cd ..
docker build -t ${PROJECT_NAME}-api:latest -f backend/Dockerfile .

# Step 4: Push to ECR
echo ""
echo "Step 4: Pushing to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
docker tag ${PROJECT_NAME}-api:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

# Step 5: Update ECS service
echo ""
echo "Step 5: Updating ECS service..."
aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --force-new-deployment \
  --region ${AWS_REGION}

# Step 6: Wait for deployment
echo ""
echo "Step 6: Waiting for deployment to complete..."
aws ecs wait services-stable \
  --cluster ${CLUSTER_NAME} \
  --services ${SERVICE_NAME} \
  --region ${AWS_REGION}

# Step 7: Apply database migration
echo ""
echo "Step 7: Applying database migration..."
echo "NOTE: Run the following SQL migration manually if not already applied:"
echo "  psql \$DATABASE_URL -f backend/src/shared/db/migrations/005_add_performance_indexes.sql"
echo ""

# Done
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "New endpoints available:"
echo "  POST /api/v1/incidents/:id/diagnose     - AI diagnosis"
echo "  GET  /api/v1/incidents/:id/diagnose/stream - Streaming diagnosis (SSE)"
echo ""
echo "Production hardening enabled:"
echo "  - Rate limiting: 100 requests/minute per API key"
echo "  - Webhook signature verification: HMAC-SHA256 (optional per service)"
echo ""
echo "To test:"
echo "  curl -X POST https://oncallshift.com/api/v1/incidents/<id>/diagnose \\"
echo "    -H 'Authorization: Bearer <token>' \\"
echo "    -H 'Content-Type: application/json'"
echo ""
