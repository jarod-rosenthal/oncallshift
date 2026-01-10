# Deploy and Verify

## Deployment Workflow

**Deployment depends on the task configuration:**

### Tasks WITH `deploy` Label
You MUST deploy and verify:
1. Make your code changes
2. Commit to your branch
3. **Deploy using direct commands** (see below)
4. **Watch the deployment** - verify build completes successfully
5. **Verify deployment:**
   - Check health: `curl -s https://oncallshift.com/health | jq .`
   - For backend: Ensure API responds correctly
   - For frontend: Verify CloudFront invalidation completed
6. **If deployment fails:** Fix the issue, commit, re-deploy
7. **After successful deployment:** Create PR
8. **Merge PR** (unless `review` label present)

### Tasks WITHOUT `deploy` Label (Default)
Do NOT deploy:
1. Make your code changes
2. Commit and push to your branch
3. Create a Pull Request
4. **STOP** - Humans will review and deploy

## Direct Deployment Commands

**DO NOT use deploy.sh** - it requires Docker daemon which is not available.

Instead, use these direct commands:

### Backend Deployment

```bash
# 1. Build Docker image with Kaniko (daemonless)
/kaniko/executor \
  --context=/home/aiworker/workspace \
  --dockerfile=/home/aiworker/workspace/backend/Dockerfile \
  --destination=593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api:$(git rev-parse --short HEAD) \
  --cache=true

# 2. Update Terraform variable to use new image tag
cd /home/aiworker/workspace/infrastructure/terraform/environments/dev
GIT_SHA=$(git rev-parse --short HEAD)
sed -i "s/^image_tag.*$/image_tag   = \"$GIT_SHA\"/" terraform.tfvars

# 3. Apply Terraform (creates new task definition)
terraform init -upgrade
terraform plan -out=tfplan
terraform apply tfplan
rm -f tfplan

# 4. Force new ECS deployment
aws ecs update-service \
  --cluster pagerduty-lite-dev \
  --service pagerduty-lite-dev-api \
  --force-new-deployment \
  --region us-east-1
```

### Frontend Deployment

```bash
# 1. Build frontend
cd /home/aiworker/workspace/frontend
npm install
npx tsc -b
npx vite build

# 2. Sync to S3
aws s3 sync dist/ s3://oncallshift-dev-web/ --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E7BQGD7BWAB8B \
  --paths "/*"
```

### Full Stack Deployment

If your changes touch both backend and frontend, run both sets of commands.

### Verify Deployment

After deployment completes:
```bash
# Wait for new task to stabilize
sleep 60

# Check version endpoint
curl -s https://oncallshift.com/version | jq .

# Check health endpoint
curl -s https://oncallshift.com/health | jq .
```

## Why Deploy First (When Enabled)?

This is a **dev environment** workflow:
- Test changes in production immediately
- Verify they work before creating PR
- Catch issues faster
- Manager review focuses on code quality, not deployment approval

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*

