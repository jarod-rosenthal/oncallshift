#!/bin/bash
set -e

# Quick Backend Deployment Script
# Use this for code-only changes (no infrastructure changes)

echo "=========================================="
echo "Quick Backend Deployment"
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
echo "Deploying to: ${ECR_REPO}"
echo ""

# Step 1: Build
echo "Step 1: Building TypeScript..."
cd backend
npm run build
cd ..

# Step 2: Docker build
echo ""
echo "Step 2: Building Docker image..."
docker build -t ${PROJECT_NAME}-api:latest -f Dockerfile .

# Step 3: Push to ECR
echo ""
echo "Step 3: Pushing to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
docker tag ${PROJECT_NAME}-api:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

# Step 4: Update ECS
echo ""
echo "Step 4: Updating ECS service..."
aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --force-new-deployment \
  --region ${AWS_REGION}

echo ""
echo "Deployment initiated! Service will update in ~2-3 minutes."
echo ""
echo "Monitor progress:"
echo "  aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION}"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/${PROJECT_NAME}-${ENVIRONMENT}/api --follow --region ${AWS_REGION}"
echo ""
