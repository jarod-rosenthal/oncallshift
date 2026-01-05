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

## Before Creating PR

1. Run `./deploy.sh` to verify changes work
2. Ensure no TypeScript errors (deploy will catch these)
3. Test the feature manually if possible

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*
