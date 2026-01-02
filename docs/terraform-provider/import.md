# Importing Existing Resources

Terraform import allows you to bring existing OnCallShift resources under Terraform management. This is useful when you've manually created resources through the UI or API and want to manage them as code.

## Import Syntax

The general syntax for importing resources is:

```bash
terraform import <resource_type>.<resource_name> <resource_id>
```

All OnCallShift resources use UUIDs as identifiers.

## Finding Resource IDs

### Via the Web UI

1. Navigate to the resource in the OnCallShift dashboard
2. The ID is typically shown in the URL or in resource details
3. Format: `550e8400-e29b-41d4-a716-446655440000`

### Via the API

```bash
# List teams
curl -s https://oncallshift.com/api/v1/teams \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  | jq '.teams[] | {id, name}'

# List users
curl -s https://oncallshift.com/api/v1/users \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  | jq '.users[] | {id, email}'

# List services
curl -s https://oncallshift.com/api/v1/services \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  | jq '.services[] | {id, name}'

# List schedules
curl -s https://oncallshift.com/api/v1/schedules \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  | jq '.schedules[] | {id, name}'

# List escalation policies
curl -s https://oncallshift.com/api/v1/escalation-policies \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  | jq '.policies[] | {id, name}'
```

## Import Examples by Resource Type

### Teams

```bash
# Import a team
terraform import oncallshift_team.platform 550e8400-e29b-41d4-a716-446655440000
```

Corresponding resource block:
```hcl
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
  # After import, run terraform plan to see all attributes
}
```

### Users

```bash
# Import a user
terraform import oncallshift_user.alice 550e8400-e29b-41d4-a716-446655440001
```

Corresponding resource block:
```hcl
resource "oncallshift_user" "alice" {
  email = "alice@example.com"
  # After import, run terraform plan to see all attributes
}
```

### Services

```bash
# Import a service
terraform import oncallshift_service.api 550e8400-e29b-41d4-a716-446655440002
```

Corresponding resource block:
```hcl
resource "oncallshift_service" "api" {
  name = "API Service"
  # After import, run terraform plan to see all attributes
}
```

### Schedules

```bash
# Import a schedule
terraform import oncallshift_schedule.primary 550e8400-e29b-41d4-a716-446655440003
```

Corresponding resource block:
```hcl
resource "oncallshift_schedule" "primary" {
  name     = "Primary On-Call"
  timezone = "America/New_York"
  # After import, run terraform plan to see all attributes
}
```

### Escalation Policies

```bash
# Import an escalation policy
terraform import oncallshift_escalation_policy.standard 550e8400-e29b-41d4-a716-446655440004
```

Corresponding resource block:
```hcl
resource "oncallshift_escalation_policy" "standard" {
  name = "Standard Escalation"
  # After import, run terraform plan to see all attributes
}
```

### Integrations

```bash
# Import an integration
terraform import oncallshift_integration.slack 550e8400-e29b-41d4-a716-446655440005
```

Corresponding resource block:
```hcl
resource "oncallshift_integration" "slack" {
  name = "Slack Integration"
  type = "slack"
  # After import, run terraform plan to see all attributes
}
```

## Bulk Import Workflow

For importing many resources, follow this workflow:

### Step 1: Export Current State

Create a script to list all resources:

```bash
#!/bin/bash
# export_resources.sh

API_KEY="${ONCALLSHIFT_API_KEY}"
BASE_URL="https://oncallshift.com/api/v1"

echo "# Teams"
curl -s "$BASE_URL/teams" -H "Authorization: Bearer $API_KEY" \
  | jq -r '.teams[] | "terraform import oncallshift_team.\(.slug // .name | gsub("[^a-z0-9]"; "_") | ascii_downcase) \(.id)"'

echo ""
echo "# Users"
curl -s "$BASE_URL/users" -H "Authorization: Bearer $API_KEY" \
  | jq -r '.users[] | "terraform import oncallshift_user.\(.email | split("@")[0] | gsub("[^a-z0-9]"; "_") | ascii_downcase) \(.id)"'

echo ""
echo "# Services"
curl -s "$BASE_URL/services" -H "Authorization: Bearer $API_KEY" \
  | jq -r '.services[] | "terraform import oncallshift_service.\(.name | gsub("[^a-z0-9]"; "_") | ascii_downcase) \(.id)"'

echo ""
echo "# Schedules"
curl -s "$BASE_URL/schedules" -H "Authorization: Bearer $API_KEY" \
  | jq -r '.schedules[] | "terraform import oncallshift_schedule.\(.name | gsub("[^a-z0-9]"; "_") | ascii_downcase) \(.id)"'

echo ""
echo "# Escalation Policies"
curl -s "$BASE_URL/escalation-policies" -H "Authorization: Bearer $API_KEY" \
  | jq -r '.policies[] | "terraform import oncallshift_escalation_policy.\(.name | gsub("[^a-z0-9]"; "_") | ascii_downcase) \(.id)"'
```

Run:
```bash
chmod +x export_resources.sh
./export_resources.sh > import_commands.sh
```

### Step 2: Create Empty Resource Blocks

Create placeholder resources for each item to import:

```hcl
# teams.tf
resource "oncallshift_team" "platform_engineering" {}
resource "oncallshift_team" "backend" {}

# users.tf
resource "oncallshift_user" "alice" {}
resource "oncallshift_user" "bob" {}

# services.tf
resource "oncallshift_service" "api_service" {}
resource "oncallshift_service" "database" {}

# schedules.tf
resource "oncallshift_schedule" "primary_on_call" {}

# escalation_policies.tf
resource "oncallshift_escalation_policy" "standard" {}
```

### Step 3: Run Import Commands

```bash
chmod +x import_commands.sh
./import_commands.sh
```

### Step 4: Generate Configuration

After importing, run `terraform plan` to see what configuration is needed:

```bash
terraform plan
```

Terraform will show the difference between the imported state and your (empty) configuration. Use this output to fill in the resource blocks.

### Step 5: Verify No Changes

Once you've filled in all the configuration, run plan again:

```bash
terraform plan
```

The output should show no changes if your configuration matches the imported state.

## Import Tips

### 1. Import Order Matters

Import resources in dependency order:

1. **Teams** (no dependencies)
2. **Users** (may have team memberships)
3. **Schedules** (may reference teams and users)
4. **Escalation Policies** (may reference schedules and users)
5. **Services** (may reference teams, schedules, and policies)
6. **Integrations** (may reference services)

### 2. Use Data Sources for References

If you only need to reference a resource (not manage it), use data sources instead:

```hcl
# Don't import if you only need to reference
data "oncallshift_user" "existing_admin" {
  email = "admin@example.com"
}

resource "oncallshift_escalation_policy" "new_policy" {
  name = "New Policy"

  step {
    timeout_seconds = 300
    target {
      type    = "user"
      user_id = data.oncallshift_user.existing_admin.id
    }
  }
}
```

### 3. Handle Sensitive Attributes

Some attributes won't be imported because they're sensitive:

- User passwords/tokens
- Integration secrets
- API keys

You may need to manually set these after import or use `lifecycle.ignore_changes`:

```hcl
resource "oncallshift_integration" "webhook" {
  name           = "Webhook"
  type           = "webhook"
  webhook_secret = var.webhook_secret

  lifecycle {
    ignore_changes = [webhook_secret]
  }
}
```

### 4. Validate Imported State

After bulk import, verify the state is correct:

```bash
# List all resources in state
terraform state list

# Show details of a specific resource
terraform state show oncallshift_team.platform

# Verify against API
curl -s https://oncallshift.com/api/v1/teams/TEAM_ID \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" | jq
```

### 5. Use Terraform Import Blocks (1.5+)

Terraform 1.5+ supports import blocks in configuration:

```hcl
import {
  to = oncallshift_team.platform
  id = "550e8400-e29b-41d4-a716-446655440000"
}

resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Platform team"
}
```

Then run:
```bash
terraform plan -generate-config-out=generated.tf
```

## Troubleshooting Import Issues

### "Resource not found"

```
Error: Cannot import non-existent remote object
```

**Solutions:**
- Verify the resource ID is correct
- Check the resource hasn't been deleted
- Ensure your API key has read access to the resource

### "Resource already managed"

```
Error: Resource already managed by Terraform
```

**Solutions:**
- The resource is already in your state file
- Remove from state first: `terraform state rm <resource_address>`
- Then re-import

### "Configuration required"

```
Error: resource address "oncallshift_team.platform" does not exist in configuration
```

**Solutions:**
- Add an empty resource block before importing
- Ensure the resource name matches exactly

### State Lock Issues

```
Error: Error acquiring the state lock
```

**Solutions:**
- Wait for other Terraform operations to complete
- Use `terraform force-unlock <lock_id>` if necessary (with caution)
