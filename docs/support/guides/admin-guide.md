# Admin Guide

This guide covers organization administration tasks in OnCallShift. As an admin, you manage users, configure integrations, handle billing, and maintain security settings.

## Table of Contents

- [User Management](#user-management)
- [Team Administration](#team-administration)
- [Billing and Plans](#billing-and-plans)
- [API Keys and Security](#api-keys-and-security)
- [Organization Settings](#organization-settings)
- [Integrations](#integrations)
- [Audit Logs](#audit-logs)
- [Data Management](#data-management)

---

## User Management

### Inviting Users

Add new team members to your organization:

1. Navigate to **Settings** > **Users**
2. Click **Invite User**
3. Enter their email address
4. Select their role:
   - **Admin** - Full organization access
   - **Manager** - Team and schedule management
   - **Responder** - Incident response only
5. Optionally assign to teams
6. Click **Send Invite**

The user receives an email with a link to create their account.

[Screenshot: User invitation modal with role selection]

### Managing User Roles

Change a user's role:

1. Go to **Settings** > **Users**
2. Find the user and click **Edit**
3. Update their role
4. Click **Save**

#### Role Permissions

| Permission | Admin | Manager | Responder |
|------------|-------|---------|-----------|
| Manage incidents | Yes | Yes | Yes |
| Create/edit services | Yes | Yes | No |
| Manage schedules | Yes | Yes | No |
| Manage escalation policies | Yes | Yes | No |
| Invite users | Yes | No | No |
| Remove users | Yes | No | No |
| Billing access | Yes | No | No |
| API key management | Yes | No | No |
| Organization settings | Yes | No | No |

### Deactivating Users

When someone leaves your organization:

1. Go to **Settings** > **Users**
2. Find the user and click **Deactivate**
3. Confirm the deactivation

**Important**: Deactivated users:
- Cannot log in
- Are removed from schedules automatically
- Incidents assigned to them are reassigned
- Their history is preserved for audit purposes

### Single Sign-On (SSO)

Enterprise plans support SAML 2.0 SSO:

1. Navigate to **Settings** > **Security** > **Single Sign-On**
2. Enable SSO
3. Configure your identity provider:
   - **Entity ID**: `https://oncallshift.com/saml`
   - **ACS URL**: `https://oncallshift.com/api/v1/auth/saml/callback`
4. Upload your IdP metadata XML
5. Test the connection before enforcing

---

## Team Administration

### Creating Teams

Teams organize users, services, and schedules:

1. Go to **Settings** > **Teams**
2. Click **Create Team**
3. Enter:
   - **Name**: e.g., "Platform Engineering"
   - **Description**: Team responsibilities
   - **Slug**: URL-friendly identifier
4. Add team members

### Team Managers

Assign managers who can configure team settings:

1. Edit the team
2. Under **Managers**, add users
3. Managers can:
   - Edit team services
   - Manage team schedules
   - Create escalation policies
   - View team analytics

### Transferring Ownership

Move services or schedules between teams:

1. Open the service or schedule
2. Click **Settings** or **Edit**
3. Change the **Team** assignment
4. Confirm the transfer

---

## Billing and Plans

### Viewing Your Plan

1. Navigate to **Settings** > **Billing**
2. View your current plan and usage

### Plan Comparison

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Users | Up to 5 | Unlimited | Unlimited |
| Incidents/month | 100 | Unlimited | Unlimited |
| Integrations | 3 | Unlimited | Unlimited |
| SMS notifications | 100/month | 1,000/month | Unlimited |
| AI Diagnosis | Basic | Full | Full + Custom |
| SSO | No | No | Yes |
| Audit Logs | 7 days | 90 days | 1 year |
| Support | Email | Priority | Dedicated |

### Upgrading Your Plan

1. Go to **Settings** > **Billing**
2. Click **Upgrade Plan**
3. Select your new plan
4. Enter payment information
5. Confirm upgrade

Upgrades take effect immediately. You'll be charged a prorated amount.

### Managing Payment Methods

1. Navigate to **Settings** > **Billing** > **Payment Methods**
2. Click **Add Payment Method**
3. Enter card details
4. Set as default if desired

### Viewing Invoices

1. Go to **Settings** > **Billing** > **Invoices**
2. Download PDF invoices for your records
3. Invoices are generated monthly

---

## API Keys and Security

### Creating API Keys

API keys authenticate external integrations:

1. Navigate to **Settings** > **API Keys**
2. Click **Create API Key**
3. Configure:
   - **Name**: Descriptive identifier
   - **Permissions**: Read-only or Read-write
   - **Expiration**: Optional expiry date
4. Click **Create**
5. **Copy the key immediately** - it won't be shown again

[Screenshot: API key creation with permissions]

### API Key Best Practices

- **Use descriptive names**: "Terraform Production", "Datadog Integration"
- **Limit permissions**: Use read-only when write isn't needed
- **Set expiration**: Rotate keys regularly
- **One key per integration**: Easier to revoke if compromised
- **Never commit keys**: Use environment variables

### Revoking API Keys

If a key is compromised:

1. Go to **Settings** > **API Keys**
2. Find the key and click **Revoke**
3. Confirm revocation
4. Update any systems using that key

### AI Integration Keys

For organizations using their own Anthropic API key for AI features:

1. Navigate to **Settings** > **AI Configuration**
2. Enter your Anthropic API key
3. Test the connection
4. Save

Benefits:
- Use your own usage limits
- Direct billing from Anthropic
- Required for advanced AI features

---

## Organization Settings

### General Settings

1. Go to **Settings** > **Organization**
2. Configure:
   - **Organization name**: Display name
   - **Slug**: URL path (e.g., oncallshift.com/orgs/acme)
   - **Default timezone**: For new users
   - **Logo**: Brand your instance

### Notification Defaults

Set organization-wide notification defaults:

1. Navigate to **Settings** > **Notifications**
2. Configure defaults for:
   - Default notification channels
   - Escalation timeout defaults
   - SMS usage limits per user

### Security Settings

1. Go to **Settings** > **Security**
2. Options include:
   - **Password requirements**: Minimum length, complexity
   - **Session timeout**: Auto-logout duration
   - **Two-factor authentication**: Require for all users
   - **IP allowlist**: Restrict access by IP (Enterprise)

---

## Integrations

### Managing Integrations

View and configure all connected services:

1. Navigate to **Settings** > **Integrations**
2. Browse available integrations
3. Click to configure or view status

### Webhook Endpoints

Create endpoints for monitoring tools:

1. Go to **Services** > Select a service > **Integrations**
2. Click **Add Integration**
3. Choose integration type
4. Copy the webhook URL
5. Configure in your monitoring tool

See [Integration Guides](../integrations/overview.md) for detailed setup.

### Integration Health

Monitor integration status:

1. Go to **Settings** > **Integrations**
2. View last received event time
3. Check for connection errors
4. Test integrations manually

---

## Audit Logs

Track all actions in your organization:

### Viewing Audit Logs

1. Navigate to **Settings** > **Audit Log**
2. Filter by:
   - **User**: Who performed the action
   - **Action type**: Created, updated, deleted
   - **Resource**: Users, services, incidents, etc.
   - **Date range**: When it occurred

### Audit Log Events

Events tracked include:
- User login/logout
- User invitations and removals
- Role changes
- Service creation and updates
- Escalation policy changes
- API key creation and revocation
- Incident actions
- Settings changes

### Exporting Audit Logs

For compliance and record-keeping:

1. Go to **Settings** > **Audit Log**
2. Apply desired filters
3. Click **Export**
4. Choose format (CSV or JSON)
5. Download the file

---

## Data Management

### Exporting Organization Data

Export your data for backup or migration:

1. Navigate to **Settings** > **Data Management**
2. Click **Export Data**
3. Select what to export:
   - Users and teams
   - Services and escalation policies
   - Schedules
   - Historical incidents
4. Choose format (JSON recommended)
5. Download when ready

### Importing Data

Migrate from another platform:

1. Go to **Settings** > **Data Management** > **Import**
2. Supported formats:
   - PagerDuty export
   - Opsgenie export
   - OnCallShift JSON
3. Upload your file
4. Review the import preview
5. Confirm import

### Data Retention

Configure how long data is kept:

1. Navigate to **Settings** > **Data Management**
2. Set retention periods for:
   - Resolved incidents: 90 days - 2 years
   - Audit logs: 7 days - 1 year (plan dependent)
   - Notifications: 30 - 90 days

### Deleting Your Organization

To permanently delete your organization:

1. Go to **Settings** > **Organization** > **Danger Zone**
2. Click **Delete Organization**
3. Type your organization name to confirm
4. Enter your password
5. Confirm deletion

**Warning**: This action is irreversible. All data, users, and configuration will be permanently deleted.

---

## Best Practices for Admins

### Onboarding Checklist

When setting up OnCallShift:

- [ ] Create teams for each engineering group
- [ ] Set up services for all production systems
- [ ] Configure escalation policies with multiple steps
- [ ] Create on-call schedules
- [ ] Invite all team members
- [ ] Configure integrations with monitoring tools
- [ ] Test the alert flow end-to-end
- [ ] Document runbooks for common issues

### Regular Maintenance

Weekly:
- Review unacknowledged/unresolved incidents
- Check integration health

Monthly:
- Audit user access and remove stale accounts
- Review and rotate API keys
- Update escalation policies as team changes
- Generate and review team performance reports

Quarterly:
- Review billing and optimize plan
- Export audit logs for compliance
- Test disaster recovery procedures
- Update runbooks based on incident learnings

---

*Need help with admin tasks? Contact support@oncallshift.com*
