# Deploy and Verify

## IMPORTANT: AI Workers Must NOT Deploy

**Deployment is handled by humans only.** As an AI Worker, you must:

1. Make your code changes
2. Commit and push to your branch
3. Create a Pull Request
4. **STOP** - Do not run deploy.sh

Humans will:
- Review the PR
- Approve or request changes
- Deploy after approval

## Why This Matters

- Deployments affect production users
- Untested deployments can cause outages
- Human review catches issues AI might miss
- Rollbacks are easier when humans control timing

## What To Do Instead

After creating your PR:
1. Add a Jira comment summarizing your changes
2. Mark your work as complete
3. Let the orchestrator know you're done

The PR will be reviewed and deployed by a human.

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*
