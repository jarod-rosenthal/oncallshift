# PagerDuty-Lite MVP Deployment Guide

Complete guide to deploy the PagerDuty-Lite MVP to AWS.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Terraform >= 1.0 installed
- Docker installed
- Node.js >= 18 installed
- Git

## Deployment Overview

1. **Infrastructure**: Deploy AWS resources with Terraform
2. **Database**: Run migrations
3. **Backend**: Build and push Docker images, deploy to ECS
4. **Mobile**: Configure and build mobile apps
5. **Testing**: Verify end-to-end functionality

Estimated time: **1-2 hours**

---

## Step 1: Infrastructure Deployment

### 1.1 Prepare Terraform Variables

```bash
cd infrastructure/terraform/environments/dev

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
nano terraform.tfvars
```

**Minimal configuration for MVP:**
```hcl
aws_region   = "us-east-1"
project_name = "pagerduty-lite"
environment  = "dev"

# Start with HTTP only (no SSL certificate)
acm_certificate_arn = null

# Push notifications (optional for initial testing)
fcm_server_key = null  # Add later after setting up Firebase
apns_certificate = null # Add later after Apple Developer setup
```

### 1.2 Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (takes ~10-15 minutes)
terraform apply

# Save outputs for later use
terraform output > ../../../outputs.txt
```

**Terraform will create:**
- VPC with public/private subnets
- Aurora Serverless v2 PostgreSQL database
- ECS cluster
- Application Load Balancer
- SQS queues (alerts, notifications)
- SNS topics
- Cognito User Pool
- IAM roles and security groups
- ECR repositories

**Cost:** ~$100/month (~$5/user for 20 users)

---

## Step 2: Database Setup

### 2.1 Get Database Credentials

```bash
# Get database secret from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id $(terraform output -raw database_secret_arn) \
  --query SecretString \
  --output text | jq '.'
```

### 2.2 Run Migrations

**Option A: From local machine (development)**

```bash
cd backend

# Create .env file with database credentials
cat > .env <<EOF
NODE_ENV=development
DATABASE_URL=postgres://USERNAME:PASSWORD@HOST:5432/pagerduty_lite
AWS_REGION=us-east-1
EOF

# Install dependencies
npm install

# Run migration
npm run migrate
```

**Option B: From ECS task (production)**

```bash
# Run migration as one-off ECS task
aws ecs run-task \
  --cluster pagerduty-lite-dev \
  --task-definition pagerduty-lite-dev-api:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[SUBNET_ID],securityGroups=[SG_ID]}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["node","dist/shared/db/migrate.js"]}]}'
```

---

## Step 3: Backend Deployment

### 3.1 Get ECR Repository URLs

```bash
cd infrastructure/terraform/environments/dev

# Get repository URLs
API_REPO=$(terraform output -raw api_ecr_repository_url)
WORKER_REPO=$(terraform output -raw worker_ecr_repository_url)

echo "API Repository: $API_REPO"
echo "Worker Repository: $WORKER_REPO"
```

### 3.2 Build and Push Docker Images

```bash
cd ../../../backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $API_REPO

# Build API image
docker build -t $API_REPO:latest -f Dockerfile.api .

# Push API image
docker push $API_REPO:latest

# Build worker image
docker build -t $WORKER_REPO:latest -f Dockerfile.worker .

# Push worker image
docker push $WORKER_REPO:latest
```

**Build time:** ~5-10 minutes

### 3.3 Deploy to ECS

The ECS services are already created by Terraform and will automatically pull the `:latest` images.

**Force new deployment:**
```bash
# Force API service to redeploy
aws ecs update-service \
  --cluster pagerduty-lite-dev \
  --service pagerduty-lite-dev-api \
  --force-new-deployment

# Force worker service to redeploy
aws ecs update-service \
  --cluster pagerduty-lite-dev \
  --service pagerduty-lite-dev-notification-worker \
  --force-new-deployment
```

### 3.4 Verify Deployment

```bash
# Check API health
ALB_DNS=$(cd infrastructure/terraform/environments/dev && terraform output -raw alb_dns_name)
curl http://$ALB_DNS/health

# Expected response:
# {"status":"healthy","timestamp":"...","service":"pagerduty-lite-api"}

# Check ECS task status
aws ecs describe-services \
  --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api pagerduty-lite-dev-notification-worker \
  --query 'services[*].[serviceName,runningCount,desiredCount]' \
  --output table
```

---

## Step 4: Create First Organization and User

### 4.1 Create Cognito User

```bash
USER_POOL_ID=$(cd infrastructure/terraform/environments/dev && terraform output -raw cognito_user_pool_id)

# Sign up user
aws cognito-idp sign-up \
  --client-id $(cd infrastructure/terraform/environments/dev && terraform output -raw cognito_client_id) \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --user-attributes Name=email,Value=admin@example.com

# Confirm user (admin bypass for testing)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --permanent
```

### 4.2 Create Organization, User, Service, and Schedule

```bash
# Get JWT token (requires aws-jwt-verify or manual login via mobile app)
# For now, we'll insert directly into database

# Connect to database
psql $DATABASE_URL

-- Create organization
INSERT INTO organizations (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Organization', 'active');

-- Create user
INSERT INTO users (id, org_id, email, cognito_sub, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin@example.com',
  'COGNITO_SUB_HERE',  -- Get from Cognito
  'Admin User',
  'admin'
);

-- Create schedule
INSERT INTO schedules (id, org_id, name, type, current_oncall_user_id)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Default On-Call',
  'manual',
  '00000000-0000-0000-0000-000000000002'
);

-- Create service
INSERT INTO services (id, org_id, name, api_key, schedule_id)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'Production Service',
  'svc_demo_key_12345',
  '00000000-0000-0000-0000-000000000003'
);
```

---

## Step 5: Test Alert Ingestion

### 5.1 Send Test Alert

```bash
ALB_DNS=$(cd infrastructure/terraform/environments/dev && terraform output -raw alb_dns_name)

curl -X POST http://$ALB_DNS/api/v1/alerts/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: svc_demo_key_12345" \
  -d '{
    "summary": "Test Alert - Database High CPU",
    "severity": "critical",
    "details": {
      "cpu": "95%",
      "host": "db-prod-01",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

**Expected response:**
```json
{
  "message": "Alert received and queued for processing",
  "service": {
    "id": "00000000-0000-0000-0000-000000000004",
    "name": "Production Service"
  }
}
```

### 5.2 Verify Incident Created

```bash
# Check incidents via API (need JWT token from mobile login)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://$ALB_DNS/api/v1/incidents

# Or check database directly
psql $DATABASE_URL -c "SELECT id, incident_number, summary, state, severity FROM incidents ORDER BY created_at DESC LIMIT 5;"
```

---

## Step 6: Mobile App Configuration

### 6.1 Configure Environment

```bash
cd mobile

cp .env.example .env

# Edit .env
nano .env
```

**Add values from Terraform outputs:**
```bash
API_URL=http://YOUR_ALB_DNS/api
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
```

### 6.2 Install and Run

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS (requires Mac)
npm run ios

# Run on Android
npm run android
```

### 6.3 Login and Test

1. Open app on device/emulator
2. Login with `admin@example.com` / `YourSecurePassword123!`
3. You should see the test incident created in Step 5
4. Tap incident to view details
5. Tap "Acknowledge" button
6. Verify state changes to "Acknowledged"

---

## Step 7: Push Notifications Setup (Optional)

### 7.1 Firebase Cloud Messaging (Android)

1. **Create Firebase Project:**
   - Go to https://console.firebase.google.com/
   - Create new project
   - Add Android app with package name: `com.yourcompany.pagerdutylite`
   - Download `google-services.json`

2. **Get FCM Server Key:**
   - Project Settings → Cloud Messaging → Server Key

3. **Update Terraform:**
   ```hcl
   # terraform.tfvars
   fcm_server_key = "YOUR_FCM_SERVER_KEY"
   ```

4. **Redeploy:**
   ```bash
   terraform apply
   ```

### 7.2 Apple Push Notification Service (iOS)

1. **Create APNs Certificate:**
   - Apple Developer Portal → Certificates, Identifiers & Profiles
   - Create Push Notification certificate
   - Download `.p12` file

2. **Convert to PEM:**
   ```bash
   openssl pkcs12 -in cert.p12 -out cert.pem -nodes -clcerts
   openssl pkcs12 -in cert.p12 -out key.pem -nodes -nocerts
   ```

3. **Update Terraform:**
   ```hcl
   # terraform.tfvars
   apns_certificate = file("cert.pem")
   apns_private_key = file("key.pem")
   apns_use_sandbox = true  # false for production
   ```

4. **Redeploy:**
   ```bash
   terraform apply
   ```

### 7.3 Test Push Notifications

1. Register device token from mobile app
2. Send test alert (Step 5.1)
3. Push notification should appear on device

---

## Step 8: Monitoring and Logs

### 8.1 View Application Logs

```bash
# API logs
aws logs tail /ecs/pagerduty-lite-dev/api --follow

# Worker logs
aws logs tail /ecs/pagerduty-lite-dev/notification-worker --follow
```

### 8.2 Monitor ECS Services

```bash
# View ECS console
open https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/pagerduty-lite-dev

# CLI monitoring
watch -n 5 'aws ecs describe-services --cluster pagerduty-lite-dev --services pagerduty-lite-dev-api --query "services[0].[runningCount,desiredCount,status]"'
```

### 8.3 Database Monitoring

```bash
# Aurora metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBClusterIdentifier,Value=pagerduty-lite-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## Troubleshooting

### Issue: ECS tasks failing to start

**Check logs:**
```bash
aws ecs describe-tasks \
  --cluster pagerduty-lite-dev \
  --tasks TASK_ID \
  --query 'tasks[0].containers[0].reason'
```

**Common causes:**
- Image not found in ECR
- Environment variables missing
- Secrets Manager permissions
- Database connection failure

### Issue: Cannot connect to database

**Check security groups:**
```bash
# ECS tasks should have access to RDS security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw rds_security_group_id)
```

**Test connectivity from ECS task:**
```bash
aws ecs run-task \
  --cluster pagerduty-lite-dev \
  --task-definition pagerduty-lite-dev-api:1 \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"api","command":["sh","-c","apt-get update && apt-get install -y postgresql-client && psql $DATABASE_URL -c \"SELECT 1\""]}]}'
```

### Issue: Push notifications not working

**Check SNS platform application:**
```bash
aws sns list-platform-applications
aws sns get-endpoint-attributes --endpoint-arn YOUR_ENDPOINT_ARN
```

**Check device token registration:**
```sql
SELECT * FROM device_tokens WHERE user_id = 'YOUR_USER_ID';
```

---

## Production Checklist

Before going to production:

- [ ] Enable HTTPS (get ACM certificate)
- [ ] Configure remote Terraform state (S3 + DynamoDB)
- [ ] Enable enhanced monitoring on Aurora
- [ ] Set up CloudWatch alarms
- [ ] Configure backup retention (7+ days)
- [ ] Enable deletion protection on resources
- [ ] Implement proper secret rotation
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add rate limiting on API
- [ ] Configure custom domain
- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Load test the application
- [ ] Create runbooks for common issues
- [ ] Set up on-call rotation for ops team

---

## Estimated Costs

**MVP (Dev Environment):**
- Infrastructure: ~$100/month
- No NAT Gateway (using VPC endpoints)
- Aurora Serverless v2 (0.5 ACU min)
- 2-3 ECS Fargate tasks

**Per User Cost:** ~$5/month for 20 users

**Scaling to Production:**
- Add staging environment: +$100/month
- Add production environment: +$150/month
- SMS/Voice (Phase 2): +$10-20/month
- Total: ~$350-400/month for all environments

---

## Next Steps (Post-MVP)

1. **Phase 2**: SMS/Voice fallback, email-to-incident
2. **Phase 3**: Schedule rotations, multi-level escalation
3. **Phase 4**: Web admin interface
4. **Phase 5**: Billing integration (Stripe)
5. **Phase 6**: Enhanced monitoring and analytics

See [docs/MVP-ROADMAP.md](docs/MVP-ROADMAP.md) for complete roadmap.

---

## Support

For issues or questions:
- Check CloudWatch Logs
- Review Terraform outputs
- Consult architecture documentation: `docs/ARCHITECTURE.md`
- Check GitHub Issues (if using GitHub)

**Congratulations! Your PagerDuty-Lite MVP is now deployed!** 🚀
