# Git Workflow

Standard Operating Procedure for all AI Workers.

## Branch Naming

Create a branch from `main` using this pattern:
```
<type>/OCS-<ticket>-<short-description>
```

Types:
- `feature/` - New functionality
- `fix/` - Bug fixes
- `refactor/` - Code improvements
- `infra/` - Infrastructure changes
- `security/` - Security fixes

Example: `feature/OCS-123-add-dark-mode`

## Commit Messages

Write clear, concise commit messages:
- Start with imperative verb (Add, Fix, Update, Remove)
- Reference the Jira ticket
- Keep under 72 characters for the first line

Example:
```
OCS-123: Add dark mode toggle to settings page

- Implement ThemeContext for state management
- Add CSS variables for dark theme colors
- Update Header and Sidebar components
```

## Pull Request

After pushing your branch:
1. Create a PR with `gh pr create`
2. Title format: `OCS-XXX: Brief description`
3. Include Summary and Test Plan sections
4. Link to the Jira ticket

### Skipping PR Creation

If the Jira ticket explicitly says "Do NOT create a PR" or you only need to push code without a PR:

1. Push your branch normally: `git push -u origin <branch>`
2. Output this marker in your final response:
   ```
   ::no_pr::true
   ```

This tells the orchestrator to skip automatic PR creation. Use this when:
- The Jira ticket requests code changes without a PR
- You're preparing code for manual review
- The changes are experimental or incomplete

## Before Creating PR

1. Review your changes for obvious errors
2. Ensure code follows existing patterns in the codebase
3. **DO NOT run deploy.sh** - deployment is handled by humans after PR approval

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*
