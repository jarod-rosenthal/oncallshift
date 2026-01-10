# Deploy and Verify

## Deployment Workflow

**Deployment depends on the task configuration:**

### Tasks WITH `ai-worker-deploy` Label
You MUST deploy and verify:
1. Make your code changes
2. Commit to your branch
3. **Run `./deploy.sh`** from `/home/aiworker/workspace`
4. **Watch the deployment** - verify build completes successfully
5. **Verify deployment:**
   - Check health: `curl -s https://oncallshift.com/health | jq .`
   - For backend: Ensure API responds correctly
   - For frontend: Verify CloudFront invalidation completed
6. **If deployment fails:** Fix the issue, commit, re-deploy
7. **After successful deployment:** Create PR
8. **Merge PR** (unless `review` label present)

### Tasks WITHOUT `ai-worker-deploy` Label (Default)
Do NOT deploy:
1. Make your code changes
2. Commit and push to your branch
3. Create a Pull Request
4. **STOP** - Humans will review and deploy

## Why Deploy First (When Enabled)?

This is a **dev environment** workflow:
- Test changes in production immediately
- Verify they work before creating PR
- Catch issues faster
- Manager review focuses on code quality, not deployment approval

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*
