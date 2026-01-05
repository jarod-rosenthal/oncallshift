# Deploy and Verify

Standard Operating Procedure for deploying changes.

## When to Deploy

Deploy after:
- Making code changes that need verification
- Fixing TypeScript errors
- Completing a feature that needs testing

## How to Deploy

From the repository root:
```bash
./deploy.sh
```

This takes 3-5 minutes and will:
1. Build frontend (Vite) and upload to S3
2. Build backend Docker image and push to ECR
3. Update ECS services
4. Run database migrations
5. Invalidate CloudFront cache

## Watching for Errors

The deploy script will:
- Show TypeScript compilation errors (fix these first!)
- Show Docker build errors
- Show deployment status

If the deploy fails:
1. Read the error message carefully
2. Fix the issue in your code
3. Run `./deploy.sh` again

## Verifying Changes

After deploy completes:
1. Visit https://oncallshift.com to verify frontend changes
2. Test API endpoints if you made backend changes
3. Check CloudWatch logs for any runtime errors:
   ```bash
   aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1
   ```

## Iteration Loop

1. Make changes
2. Run `./deploy.sh`
3. If errors, fix and repeat step 2
4. If successful, verify changes work
5. If broken at runtime, check logs, fix, repeat

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*
