# Deploy and Verify Changes

## Purpose
After making code changes, deploy them to production and verify they work. This allows you to iterate in real-time rather than just creating PRs and hoping they work.

## When to Deploy

Deploy when:
- You've made code changes that need verification
- You've fixed a bug and want to confirm it's resolved
- You've added a feature and want to test it works
- A previous deployment failed and you've fixed the issue

Do NOT deploy when:
- You haven't made any code changes
- Your changes haven't been committed and pushed
- You're unsure if the changes are correct (ask for review first)

## Deployment Process

### Step 1: Ensure Changes Are Committed and Pushed

```bash
# Check status
git status

# If there are uncommitted changes, commit them
git add -A
git commit -m "your commit message"

# Push to remote (usually your feature branch)
git push origin HEAD
```

### Step 2: Run the Deploy Script

From the repository root:

```bash
./deploy.sh
```

This script will:
1. Build the frontend and upload to S3
2. Build the backend Docker image and push to ECR
3. Deploy to ECS (triggers rolling update)
4. Run database migrations
5. Invalidate CloudFront cache

**Expected duration:** 3-5 minutes

### Step 3: Verify Deployment Success

Watch for these indicators in the output:
- `✅ Deployment initiated successfully!` - Good sign
- `ERROR:` or `error:` - Something failed

If deployment fails:
1. Read the error message carefully
2. Fix the issue in your code
3. Commit and push the fix
4. Re-run deploy.sh

### Step 4: Verify Changes Work

After deployment completes (wait 2-3 minutes for ECS):

1. **For API changes:** Test the endpoint
   ```bash
   curl -s https://oncallshift.com/api/v1/your-endpoint | jq
   ```

2. **For frontend changes:** The site auto-updates after CloudFront invalidation

3. **For backend logic:** Check the logs
   ```bash
   aws logs tail /ecs/pagerduty-lite-dev/api --follow --since 5m
   ```

## Common Deployment Errors

### TypeScript Compilation Error
```
error TS7030: Not all code paths return a value
```
**Fix:** Add missing return statements

### Docker Build Failure
```
ERROR: failed to build
```
**Fix:** Check the error, usually a missing dependency or syntax error

### ECS Deployment Stuck
```
desiredCount: 1, runningCount: 0
```
**Fix:** Check CloudWatch logs for the failing container

## Iteration Loop

1. Make changes
2. Commit & push
3. Deploy
4. Verify
5. If broken, goto 1

This is how you work like a real developer - deploy early, deploy often, fix issues as they arise.
