# Simple MCP-to-MCP Migration Plan

## The Idea

Instead of asking users for API keys, leverage their **existing PagerDuty/Opsgenie MCP connection** to migrate. If a user has PagerDuty MCP configured in Claude Desktop, the LLM can:

1. Use PagerDuty MCP tools to READ their current config
2. Use OnCallShift MCP tools to WRITE the config

**Zero API keys needed from the user. Zero technical knowledge required.**

## User Experience

```
User: "I want to switch from PagerDuty to OnCallShift"

LLM: I can see you have PagerDuty connected. Let me pull your configuration...

     [Uses pagerduty.list_services] Found 12 services
     [Uses pagerduty.list_teams] Found 4 teams
     [Uses pagerduty.list_schedules] Found 3 schedules
     [Uses pagerduty.list_escalation_policies] Found 5 policies
     [Uses pagerduty.list_users] Found 15 users

     I found your complete PagerDuty setup:
     - 12 services (API Gateway, Database, ...)
     - 4 teams (Platform, Backend, Frontend, SRE)
     - 3 on-call schedules
     - 5 escalation policies
     - 15 team members

     Ready to create all of this in OnCallShift?

User: "Yes"

LLM: [Uses oncallshift.create_team] × 4
     [Uses oncallshift.invite_user] × 15
     [Uses oncallshift.setup_schedule] × 3
     [Uses oncallshift.create_escalation_policy] × 5
     [Uses oncallshift.create_service] × 12

     Done! Your OnCallShift account is ready:

     ✅ 4 teams created
     ✅ 15 users invited (check their email)
     ✅ 3 schedules configured
     ✅ 5 escalation policies set up
     ✅ 12 services created

     Next: Your team members will receive email invitations.

     Want me to set up webhook forwarding so alerts go to OnCallShift?

User: "Yes"

LLM: [Uses oncallshift.connect_integration type=pagerduty]

     Here's your OnCallShift webhook URL:
     https://oncallshift.com/api/v1/webhooks/abc123

     To complete the migration:
     1. Go to PagerDuty → Integrations → Generic Webhook
     2. Add this URL: https://oncallshift.com/api/v1/webhooks/abc123
     3. That's it! Alerts will now go to both platforms.

     Once you're confident, you can disable PagerDuty notifications.
```

## Technical Implementation

### Required: Dual MCP Configuration

User's Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pagerduty": {
      "command": "uvx",
      "args": ["pagerduty-mcp"],
      "env": {
        "PAGERDUTY_USER_API_KEY": "their-existing-key"
      }
    },
    "oncallshift": {
      "command": "npx",
      "args": ["oncallshift-mcp"],
      "env": {
        "ONCALLSHIFT_API_KEY": "their-oncallshift-key"
      }
    }
  }
}
```

### OnCallShift MCP Tools Needed

For the migration flow, we need these tools:

```typescript
// BULK CREATION TOOLS (new)
const MIGRATION_TOOLS = {
  // Bulk import - accepts PagerDuty-format data directly
  'import_pagerduty_config': {
    description: 'Import configuration exported from PagerDuty MCP tools',
    params: {
      users: 'array',      // From pagerduty.list_users
      teams: 'array',      // From pagerduty.list_teams
      schedules: 'array',  // From pagerduty.list_schedules
      policies: 'array',   // From pagerduty.list_escalation_policies
      services: 'array'    // From pagerduty.list_services
    }
  },

  // Quick setup - single tool does everything
  'migrate_from_mcp': {
    description: 'Complete migration from another platform using their MCP data',
    params: {
      source: 'pagerduty' | 'opsgenie',
      data: {
        users: 'array',
        teams: 'array',
        schedules: 'array',
        escalation_policies: 'array',
        services: 'array'
      }
    }
  }
};
```

### MCP Prompt for LLM Guidance

```typescript
const MIGRATION_PROMPT = {
  name: 'migrate_to_oncallshift',
  description: 'Guide migration from PagerDuty or Opsgenie using MCP',
  template: `
# Migration Assistant

You are helping migrate from {source_platform} to OnCallShift.

## Prerequisites Check
1. Verify user has {source_platform} MCP connected (try listing services)
2. Verify user has oncallshift MCP connected (try listing services)

## Migration Steps

### Step 1: Gather Data from Source
Use {source_platform} MCP tools to collect:
- list_users → save as users_data
- list_teams → save as teams_data
- list_schedules → save as schedules_data
- list_escalation_policies → save as policies_data
- list_services → save as services_data

### Step 2: Preview Migration
Show user what will be created:
- "{N} users will be invited"
- "{N} teams will be created"
- "{N} schedules will be configured"
- etc.

### Step 3: Execute Migration
Use oncallshift.migrate_from_mcp with all collected data.

### Step 4: Verify
Use oncallshift tools to verify creation:
- oncallshift.list_teams
- oncallshift.list_services
- oncallshift.list_schedules

### Step 5: Setup Forwarding (Optional)
Offer to set up webhook forwarding for gradual migration.
  `
};
```

## Implementation Phases

### Phase 1: Core Migration Tool (3 days)

Create `migrate_from_mcp` tool that accepts structured data:

```typescript
// packages/oncallshift-mcp/src/tools/migration.ts
export const migrateFromMcp = {
  name: 'migrate_from_mcp',
  description: 'Import configuration from PagerDuty or Opsgenie MCP output',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        enum: ['pagerduty', 'opsgenie']
      },
      data: {
        type: 'object',
        properties: {
          users: { type: 'array' },
          teams: { type: 'array' },
          schedules: { type: 'array' },
          escalation_policies: { type: 'array' },
          services: { type: 'array' }
        }
      },
      options: {
        type: 'object',
        properties: {
          dry_run: { type: 'boolean', default: false },
          invite_users: { type: 'boolean', default: true },
          preserve_ids: { type: 'boolean', default: true }
        }
      }
    },
    required: ['source', 'data']
  },
  handler: async (params) => {
    // 1. Transform PagerDuty/Opsgenie format to OnCallShift format
    // 2. Call existing import API endpoint
    // 3. Return summary of created entities
  }
};
```

### Phase 2: Migration Prompt (1 day)

Add the migration prompt that guides the LLM:

```typescript
// packages/oncallshift-mcp/src/prompts/migration.ts
export const migrationPrompts = [
  {
    name: 'migrate_to_oncallshift',
    description: 'Step-by-step guide for migrating from PagerDuty or Opsgenie',
    arguments: [
      { name: 'source', description: 'Source platform', required: true }
    ]
  }
];
```

### Phase 3: Webhook Forwarding Setup (2 days)

Add tool to generate webhook URLs and instructions:

```typescript
export const setupWebhookForwarding = {
  name: 'setup_alert_forwarding',
  description: 'Get webhook URL for forwarding alerts from PagerDuty/Opsgenie',
  handler: async (params) => {
    // Generate unique webhook URL
    // Return URL + setup instructions for source platform
  }
};
```

## Data Mapping

### PagerDuty → OnCallShift

```typescript
// Automatic mapping of PagerDuty MCP output to OnCallShift format
function mapPagerDutyToOnCallShift(pdData) {
  return {
    users: pdData.users.map(u => ({
      email: u.email,
      name: u.name,
      role: u.role === 'admin' ? 'admin' : 'user',
      phone: u.contact_methods?.find(c => c.type === 'phone')?.address
    })),

    teams: pdData.teams.map(t => ({
      name: t.name,
      description: t.description
    })),

    schedules: pdData.schedules.map(s => ({
      name: s.name,
      timezone: s.time_zone,
      rotation_type: s.schedule_layers?.[0]?.rotation_virtual_start ? 'weekly' : 'daily',
      layers: s.schedule_layers?.map(layer => ({
        users: layer.users?.map(u => u.id),
        rotation_turn_length_seconds: layer.rotation_turn_length_seconds
      }))
    })),

    escalation_policies: pdData.escalation_policies.map(ep => ({
      name: ep.name,
      description: ep.description,
      steps: ep.escalation_rules?.map(rule => ({
        delay_minutes: rule.escalation_delay_in_minutes,
        targets: rule.targets?.map(t => ({
          type: t.type === 'schedule_reference' ? 'schedule' : 'user',
          id: t.id
        }))
      }))
    })),

    services: pdData.services.map(s => ({
      name: s.name,
      description: s.description,
      escalation_policy_name: s.escalation_policy?.summary
    }))
  };
}
```

## Total Effort

| Task | Time |
|------|------|
| Core migration tool | 3 days |
| Migration prompt | 1 day |
| Webhook forwarding | 2 days |
| Testing & docs | 1 day |
| **Total** | **1 week** |

## Why This is "Stupid Simple"

1. **No API keys to copy**: User's MCP already has credentials configured
2. **No JSON exports**: LLM reads directly from source MCP
3. **No manual mapping**: Automatic data transformation
4. **One conversation**: "Migrate me" → Done
5. **Gradual cutover**: Webhook forwarding enables parallel operation

## Example Claude Desktop Setup

Users just need to add OnCallShift MCP alongside their existing PagerDuty MCP:

```json
{
  "mcpServers": {
    "pagerduty": {
      "command": "uvx",
      "args": ["pagerduty-mcp"]
    },
    "oncallshift": {
      "command": "npx",
      "args": ["oncallshift-mcp"],
      "env": {
        "ONCALLSHIFT_API_KEY": "ocs_..."
      }
    }
  }
}
```

Then say: **"Migrate everything from PagerDuty to OnCallShift"**

The LLM handles the rest.
