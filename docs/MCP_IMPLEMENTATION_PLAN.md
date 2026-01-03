# OnCallShift MCP Server Implementation Plan

## Executive Summary

This plan outlines the implementation of a PagerDuty-compatible MCP (Model Context Protocol) server for OnCallShift that enables users to migrate from PagerDuty/Opsgenie via natural language commands through their LLM.

**Goal**: Allow users to say: *"Move all my PagerDuty configuration to OnCallShift"* and have it just work.

## Research Findings

### PagerDuty MCP Server Analysis

PagerDuty's official MCP server ([GitHub](https://github.com/PagerDuty/pagerduty-mcp-server)) provides **60+ tools** across these categories:

| Category | Tools | Key Functions |
|----------|-------|---------------|
| Incidents | 9 | create, list, manage, add_note, add_responders |
| Services | 4 | create, list, get, update |
| Teams | 7 | create, list, add/remove members |
| Schedules | 6 | create, list, override, update |
| Escalation Policies | 2 | list, get |
| On-Call | 1 | list_oncalls |
| Users | 2 | get_user_data, list_users |
| Status Pages | 8 | create posts, updates, list impacts/severities |
| Alert Grouping | 5 | CRUD for grouping settings |
| Event Orchestration | 7 | manage routing rules |
| Incident Workflows | 3 | get, list, start workflows |
| Change Events | 4 | list, get change events |

**Key Design Decisions in PagerDuty's Implementation:**
- Read-only by default, requires `--enable-write-tools` flag for mutations
- Uses Python (99.2% of codebase)
- Supports stdio, SSE, and HTTP transports
- Compatible with Claude Desktop, VS Code, Cursor

### Opsgenie MCP Servers

Community-driven implementations exist:
- [burakdirin/mcp-opsgenie](https://github.com/burakdirin/mcp-opsgenie) - Full alert management
- [giantswarm/mcp-opsgenie](https://github.com/giantswarm/mcp-opsgenie) - Alerts, teams, heartbeats

### OnCallShift Current State

**Existing Import Capabilities** (in `backend/src/api/routes/import.ts`):
- `POST /import/pagerduty` - Full PagerDuty data import
- `POST /import/opsgenie` - Full Opsgenie data import
- `POST /import/fetch/pagerduty` - Direct API fetch from PagerDuty
- `POST /import/fetch/opsgenie` - Direct API fetch from Opsgenie
- `POST /import/preview` - Preview import before committing
- `POST /import/validate` - Validate import data

**Existing MCP Tools** (configured but needs API key):
- `get_oncall_now`, `list_incidents`, `get_incident`
- `list_services`, `list_teams`, `list_schedules`
- `acknowledge_incident`, `resolve_incident`, `escalate_incident`
- `create_team`, `setup_schedule`, `create_escalation_policy`
- `create_service`, `create_runbook`, `invite_user`
- `connect_integration`, `import_from_platform`
- `get_incident_metrics`, `analyze_oncall_fairness`
- `suggest_improvements`, `get_service_health`

## Implementation Strategy

### Phase 1: PagerDuty-Compatible Tool Names (Week 1)

Create tool aliases that match PagerDuty's naming convention for seamless migration:

```typescript
// PagerDuty tool name → OnCallShift implementation
const PAGERDUTY_COMPATIBLE_TOOLS = {
  // Incidents
  'list_incidents': 'list_incidents',           // Already exists
  'get_incident': 'get_incident',               // Already exists
  'create_incident': 'create_incident',         // NEW
  'manage_incidents': 'update_incident_status', // NEW (acknowledge, resolve, escalate)
  'add_note_to_incident': 'add_incident_note',  // Already exists
  'add_responders': 'add_responders',           // NEW

  // Services
  'list_services': 'list_services',             // Already exists
  'get_service': 'get_service',                 // NEW
  'create_service': 'create_service',           // Already exists
  'update_service': 'update_service',           // NEW

  // Teams
  'list_teams': 'list_teams',                   // Already exists
  'get_team': 'get_team',                       // NEW
  'create_team': 'create_team',                 // Already exists
  'add_team_member': 'add_team_member',         // NEW
  'remove_team_member': 'remove_team_member',   // NEW

  // Schedules
  'list_schedules': 'list_schedules',           // Already exists
  'get_schedule': 'get_schedule',               // NEW
  'create_schedule': 'setup_schedule',          // Already exists (rename)
  'update_schedule': 'update_schedule',         // NEW
  'create_schedule_override': 'create_override',// NEW

  // Escalation Policies
  'list_escalation_policies': 'list_escalation_policies', // NEW
  'get_escalation_policy': 'get_escalation_policy',       // NEW

  // On-Call
  'list_oncalls': 'get_oncall_now',             // Already exists

  // Users
  'list_users': 'list_users',                   // NEW
  'get_user_data': 'get_current_user',          // NEW
};
```

### Phase 2: Migration-Focused Tools (Week 2)

Add specialized tools for platform migration:

```typescript
// Migration-specific tools
const MIGRATION_TOOLS = {
  // Test connectivity
  'test_pagerduty_connection': {
    description: 'Test connection to PagerDuty API with provided credentials',
    params: { api_key: 'string' }
  },
  'test_opsgenie_connection': {
    description: 'Test connection to Opsgenie API with provided credentials',
    params: { api_key: 'string', region?: 'us' | 'eu' }
  },

  // Fetch and preview
  'fetch_pagerduty_config': {
    description: 'Fetch all configuration from PagerDuty account',
    params: { api_key: 'string', include?: string[] }
  },
  'fetch_opsgenie_config': {
    description: 'Fetch all configuration from Opsgenie account',
    params: { api_key: 'string', region?: 'us' | 'eu' }
  },

  // Preview before import
  'preview_migration': {
    description: 'Preview what will be created without making changes',
    params: { source: 'pagerduty' | 'opsgenie', data: object }
  },

  // Execute migration
  'migrate_from_pagerduty': {
    description: 'Migrate all configuration from PagerDuty to OnCallShift',
    params: {
      api_key: 'string',
      options?: {
        include_users?: boolean,
        include_schedules?: boolean,
        include_escalation_policies?: boolean,
        include_services?: boolean,
        preserve_integration_keys?: boolean
      }
    }
  },
  'migrate_from_opsgenie': {
    description: 'Migrate all configuration from Opsgenie to OnCallShift',
    params: {
      api_key: 'string',
      region?: 'us' | 'eu',
      options?: { /* same as above */ }
    }
  },

  // Status and rollback
  'get_migration_status': {
    description: 'Get status of ongoing or recent migration',
    params: { migration_id?: 'string' }
  },
  'rollback_migration': {
    description: 'Rollback a recent migration',
    params: { migration_id: 'string' }
  }
};
```

### Phase 3: Natural Language Migration Flow (Week 3)

Implement conversational migration prompts:

```typescript
const MIGRATION_PROMPTS = {
  'migrate_platform': {
    name: 'migrate_platform',
    description: 'Guide user through migrating from another incident management platform',
    arguments: [
      { name: 'source_platform', description: 'Platform to migrate from (pagerduty, opsgenie)', required: true }
    ],
    template: `
You are helping a user migrate from {source_platform} to OnCallShift.

## Migration Steps:

1. **Verify Credentials**: Ask for their {source_platform} API key
2. **Test Connection**: Use test_{source_platform}_connection to verify access
3. **Fetch Configuration**: Use fetch_{source_platform}_config to retrieve their setup
4. **Preview Changes**: Use preview_migration to show what will be created
5. **Confirm Migration**: Get user confirmation before proceeding
6. **Execute Migration**: Use migrate_from_{source_platform} to perform the migration
7. **Verify Results**: Show summary of migrated entities

## Important Notes:
- Integration keys can be preserved for zero-downtime migration
- User passwords are not migrated; users will receive invite emails
- Existing OnCallShift data is not affected
    `
  }
};
```

### Phase 4: Bidirectional Sync Tools (Week 4)

Enable gradual migration with sync capabilities:

```typescript
const SYNC_TOOLS = {
  // Compare configurations
  'compare_configurations': {
    description: 'Compare OnCallShift config with source platform',
    params: { source: 'pagerduty' | 'opsgenie', api_key: 'string' }
  },

  // Sync specific entities
  'sync_users': {
    description: 'Sync user list from source platform',
    params: { source: 'pagerduty' | 'opsgenie', api_key: 'string' }
  },
  'sync_schedules': {
    description: 'Sync on-call schedules from source platform',
    params: { source: 'pagerduty' | 'opsgenie', api_key: 'string' }
  },

  // Webhook forwarding setup
  'setup_webhook_forwarding': {
    description: 'Configure PagerDuty/Opsgenie to forward alerts to OnCallShift',
    params: { source: 'pagerduty' | 'opsgenie' }
  }
};
```

## Technical Architecture

### MCP Server Structure

```
packages/oncallshift-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── server.ts             # Server configuration
│   ├── tools/
│   │   ├── incidents.ts      # Incident management tools
│   │   ├── services.ts       # Service management tools
│   │   ├── teams.ts          # Team management tools
│   │   ├── schedules.ts      # Schedule management tools
│   │   ├── escalations.ts    # Escalation policy tools
│   │   ├── oncall.ts         # On-call tools
│   │   ├── users.ts          # User management tools
│   │   ├── migration.ts      # Migration-specific tools
│   │   └── analytics.ts      # Metrics and recommendations
│   ├── prompts/
│   │   ├── migration.ts      # Migration conversation prompts
│   │   └── troubleshooting.ts# Incident troubleshooting prompts
│   ├── resources/
│   │   └── config.ts         # Configuration resources
│   └── utils/
│       ├── api-client.ts     # OnCallShift API client
│       ├── pagerduty.ts      # PagerDuty API client
│       └── opsgenie.ts       # Opsgenie API client
├── package.json
├── tsconfig.json
└── README.md
```

### API Client Integration

```typescript
// src/utils/api-client.ts
export class OnCallShiftClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  // All API calls go through authenticated endpoints
  async incidents() { /* ... */ }
  async services() { /* ... */ }
  async teams() { /* ... */ }
  async schedules() { /* ... */ }
  async import(platform: string, data: any) { /* ... */ }
}

// src/utils/pagerduty.ts
export class PagerDutyClient {
  constructor(private apiKey: string) {}

  async fetchAll(): Promise<PagerDutyExport> {
    // Fetches users, teams, schedules, policies, services
    // Uses existing import.ts logic
  }
}
```

### Deployment Options

1. **NPM Package**: `npx oncallshift-mcp` (like PagerDuty)
2. **Docker**: `docker run oncallshift/mcp-server`
3. **Built into CLI**: `oncallshift mcp start`

## Tool Compatibility Matrix

| PagerDuty Tool | OnCallShift Equivalent | Status |
|----------------|------------------------|--------|
| `list_incidents` | `list_incidents` | Exists |
| `get_incident` | `get_incident` | Exists |
| `create_incident` | - | To Add |
| `manage_incidents` | `acknowledge_incident`, `resolve_incident`, `escalate_incident` | Exists (split) |
| `add_note_to_incident` | `add_incident_note` | Exists |
| `add_responders` | - | To Add |
| `list_services` | `list_services` | Exists |
| `create_service` | `create_service` | Exists |
| `get_service` | - | To Add |
| `update_service` | - | To Add |
| `list_teams` | `list_teams` | Exists |
| `create_team` | `create_team` | Exists |
| `add_team_member` | - | To Add |
| `remove_team_member` | - | To Add |
| `list_schedules` | `list_schedules` | Exists |
| `create_schedule` | `setup_schedule` | Exists |
| `list_oncalls` | `get_oncall_now` | Exists |
| `list_escalation_policies` | - | To Add |
| `get_escalation_policy` | - | To Add |
| `list_users` | - | To Add |

## Effort Estimation

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| Phase 1 | PagerDuty-compatible tool names | 1 week | None |
| Phase 2 | Migration-focused tools | 1 week | Phase 1 |
| Phase 3 | Natural language prompts | 1 week | Phase 2 |
| Phase 4 | Bidirectional sync | 1 week | Phase 2 |

**Total Effort**: 4 weeks

### What Makes This "Not a Big Lift"

1. **Existing Import Infrastructure**: The heavy lifting is already done in `import.ts` with full PagerDuty and Opsgenie data mapping

2. **Existing MCP Tools**: 20+ tools already exist and work (just need API key configuration)

3. **Standard Protocol**: MCP is well-documented with TypeScript SDK

4. **Reusable Code**: API clients for PagerDuty/Opsgenie already exist in import fetcher code

## User Experience Flow

### Migration Scenario

```
User: "I want to move from PagerDuty to OnCallShift"

LLM: I'll help you migrate from PagerDuty. First, I need your PagerDuty API key.
     You can find this in User Settings → API Access → Create API Key.

User: "Here's my key: pdkeyXXXXXXXX"

LLM: [Uses test_pagerduty_connection]
     Great! I connected successfully and found:
     - 15 users
     - 4 teams
     - 3 schedules
     - 5 escalation policies
     - 12 services

     Would you like me to preview what will be created in OnCallShift?

User: "Yes, show me"

LLM: [Uses preview_migration]
     Here's what will be created:

     **Users** (15): john@example.com, jane@example.com, ...
     **Teams** (4): Platform, Backend, Frontend, SRE
     **Schedules** (3): Primary On-Call, Secondary, Weekend
     **Escalation Policies** (5): P1-Critical, P2-High, ...
     **Services** (12): API Gateway, Database, Cache, ...

     Note: Integration keys will be preserved for zero-downtime migration.

     Ready to proceed?

User: "Do it"

LLM: [Uses migrate_from_pagerduty]
     Migration complete! Here's the summary:

     ✅ 15 users invited (they'll receive email invitations)
     ✅ 4 teams created
     ✅ 3 schedules configured
     ✅ 5 escalation policies set up
     ✅ 12 services created with preserved integration keys

     Your PagerDuty alerts will now flow to OnCallShift automatically.

     Next steps:
     1. Have your team accept their email invitations
     2. Verify on-call schedules at oncallshift.com/schedules
     3. Test by triggering a test alert
```

## Success Criteria

1. **Drop-in Compatibility**: LLMs trained on PagerDuty MCP docs can use OnCallShift with minimal adjustment
2. **One-Command Migration**: `migrate_from_pagerduty` works end-to-end
3. **Zero Downtime**: Integration keys preserved, alerts flow immediately
4. **Rollback Capability**: Users can undo migration within 24 hours

## References

- [PagerDuty MCP Server](https://github.com/PagerDuty/pagerduty-mcp-server)
- [PagerDuty MCP Integration Guide](https://support.pagerduty.com/main/docs/pagerduty-mcp-server-integration-guide)
- [Opsgenie MCP Server](https://github.com/burakdirin/mcp-opsgenie)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
