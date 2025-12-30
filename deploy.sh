#!/bin/bash
set -e

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api"
ECS_CLUSTER="pagerduty-lite-dev"
ECS_SERVICE="pagerduty-lite-dev-api"
CLOUDFRONT_DIST_ID="EPTCQ6774HKQ2"
S3_BUCKET="pagerduty-lite-dev-web"

echo "🚀 Starting deployment..."

# 1. Login to ECR
echo "📝 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# 2. Build frontend separately (for S3 upload)
echo "🔨 Building frontend..."
cd frontend && npm run build && cd ..

# 3. Upload frontend to S3
echo "📤 Uploading frontend to S3..."
aws s3 sync frontend/dist/ s3://$S3_BUCKET/ --delete

# 4. Build Docker image (includes backend + frontend for fallback)
echo "🔨 Building Docker image..."
docker build -t $ECR_REPO:latest .

# 5. Push to ECR
echo "⬆️  Pushing to ECR..."
docker push $ECR_REPO:latest

# 6. Force new ECS deployment
echo "🔄 Triggering ECS deployment..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --force-new-deployment \
  --region $AWS_REGION \
  --output json | jq '.service.deployments[] | {status: .status, desiredCount: .desiredCount}'

# 7. Invalidate CloudFront cache
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
