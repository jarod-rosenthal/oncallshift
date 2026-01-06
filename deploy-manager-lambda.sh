#!/bin/bash
set -e

echo "🚀 Deploying AI Worker Manager Lambda..."

# Configuration
AWS_REGION="us-east-1"
LAMBDA_NAME="pagerduty-lite-dev-ai-worker-manager"
BUILD_DIR="backend/dist/lambdas"
PACKAGE_DIR="/tmp/manager-lambda-package"

# 1. Build TypeScript
echo "🔨 Building TypeScript..."
cd backend
npm run build
cd ..

# 2. Create package directory
echo "📦 Creating deployment package..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# 3. Copy compiled Lambda function
cp "$BUILD_DIR/ai-worker-manager.js" "$PACKAGE_DIR/"

# 4. Install production dependencies in package directory
cd "$PACKAGE_DIR"
npm init -y >/dev/null
npm install @aws-sdk/client-ecs @aws-sdk/client-secrets-manager pg uuid --save --production --silent
cd -

# 5. Create zip file
echo "📦 Creating zip file..."
cd "$PACKAGE_DIR"
zip -q -r manager-lambda.zip .
cd -

# 6. Deploy to AWS Lambda
echo "⬆️  Uploading to Lambda..."
aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file "fileb://$PACKAGE_DIR/manager-lambda.zip" \
  --region "$AWS_REGION" \
  --query 'FunctionName' \
  --output text

# 7. Wait for update to complete
echo "⏳ Waiting for Lambda update to complete..."
aws lambda wait function-updated \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION"

echo "✅ Manager Lambda deployed successfully!"

# Cleanup
rm -rf "$PACKAGE_DIR"

echo ""
echo "Test the deployment:"
echo "  aws lambda invoke --function-name $LAMBDA_NAME --payload '{\"action\":\"review_pr\",\"taskId\":\"test\"}' /tmp/response.json --region $AWS_REGION"
