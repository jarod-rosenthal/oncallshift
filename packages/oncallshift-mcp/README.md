# @oncallshift/mcp-server

MCP (Model Context Protocol) server for the OnCallShift incident management platform. This package enables AI assistants like Claude Code, Cursor, and other MCP-compatible tools to interact with OnCallShift through natural language.

## Features

- **Incident Management**: List, acknowledge, resolve, escalate, and create incidents
- **On-Call Information**: Check who is currently on-call
- **Service Management**: Full CRUD for services
- **Team Management**: Create teams, add/remove members
- **Schedule Management**: Create schedules and overrides
- **Platform Migration**: Migrate from PagerDuty or Opsgenie with one command
- **Analytics**: Incident metrics, on-call fairness, improvement suggestions
- **Guided Workflows**: Built-in prompts for common tasks

## Installation

### Using npx (Recommended)

```bash
npx @oncallshift/mcp-server
```

### Global Installation

```bash
npm install -g @oncallshift/mcp-server
oncallshift-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ONCALLSHIFT_API_KEY` | Yes | - | Your OnCallShift API key |
| `ONCALLSHIFT_BASE_URL` | No | `https://oncallshift.com/api/v1` | API base URL |

### Getting an API Key

1. Log in to your OnCallShift account at https://oncallshift.com
2. Navigate to **Settings** > **API Keys**
3. Click **Create API Key**
4. Copy the generated key

## Usage with AI Assistants

### Claude Code (Claude Desktop)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### VS Code with Continue

Add to your Continue configuration (`.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "oncallshift",
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "your-api-key-here"
      }
    }
  ]
}
```

### Generic MCP Client

```bash
export ONCALLSHIFT_API_KEY=your-api-key
npx @oncallshift/mcp-server
```

## Available Tools

Once connected, the following tools are available to the AI assistant:

### Incident Operations

| Tool | Description |
|------|-------------|
| `list_incidents` | List incidents with optional status and service filters |
| `get_incident` | Get detailed information about a specific incident |
| `create_incident` | Create a new incident manually |
| `acknowledge_incident` | Acknowledge an incident (stops escalations) |
| `resolve_incident` | Mark an incident as resolved |
| `escalate_incident` | Escalate an incident to the next level |
| `add_incident_note` | Add a note to an incident |
| `add_responders` | Add additional responders to an incident |

### On-Call Operations

| Tool | Description |
|------|-------------|
| `get_oncall_now` | Get all currently on-call users |

### User Operations

| Tool | Description |
|------|-------------|
| `list_users` | List all users, optionally filtered by team |
| `get_user` | Get detailed information about a specific user |
| `invite_user` | Invite a new user to the organization |

### Service Operations

| Tool | Description |
|------|-------------|
| `list_services` | List all services, optionally filtered by team |
| `create_service` | Create a new service |

### Team Operations

| Tool | Description |
|------|-------------|
| `list_teams` | List all teams in the organization |
| `create_team` | Create a new team |
| `add_team_member` | Add a user to a team |
| `remove_team_member` | Remove a user from a team |

### Schedule Operations

| Tool | Description |
|------|-------------|
| `list_schedules` | List all on-call schedules |
| `setup_schedule` | Create a new on-call schedule with rotation |
| `create_schedule_override` | Create a temporary schedule override |

### Escalation Policy Operations

| Tool | Description |
|------|-------------|
| `list_escalation_policies` | List all escalation policies |
| `get_escalation_policy` | Get details of a specific escalation policy |
| `create_escalation_policy` | Create a new escalation policy |

### Analytics Operations

| Tool | Description |
|------|-------------|
| `get_incident_metrics` | Get MTTR, MTTA, and incident trends |
| `analyze_oncall_fairness` | Analyze on-call load distribution |
| `suggest_improvements` | Get AI-powered improvement suggestions |
| `get_service_health` | Get health status for services |

### Migration Operations

| Tool | Description |
|------|-------------|
| `test_pagerduty_connection` | Test connection to PagerDuty API |
| `test_opsgenie_connection` | Test connection to Opsgenie API |
| `fetch_pagerduty_config` | Fetch all configuration from PagerDuty |
| `fetch_opsgenie_config` | Fetch all configuration from Opsgenie |
| `migrate_from_mcp` | Import data from another platform's MCP tools |
| `import_from_platform` | Import data from exported JSON |

### Integration Operations

| Tool | Description |
|------|-------------|
| `connect_integration` | Set up Slack, Datadog, or other integrations |
| `create_runbook` | Create a new runbook for incident response |

## Example Conversations

Once configured, you can interact with OnCallShift naturally:

### Basic Incident Management

```
User: Who is on call right now?
Assistant: [Uses get_oncall_now tool]
Currently on-call:
  - API Platform: John Smith (john@example.com)
  - Database Team: Jane Doe (jane@example.com)

User: Are there any triggered incidents?
Assistant: [Uses list_incidents tool]
Found 2 triggered incidents:
  [!] #1234 [CRITICAL] Database connection pool exhausted
  [!] #1235 [ERROR] API response time degraded

User: Acknowledge incident #1234
Assistant: [Uses acknowledge_incident tool]
Incident #1234 has been acknowledged successfully.
```

### Platform Migration

Migrate from PagerDuty or Opsgenie with a simple conversation:

```
User: I want to migrate from PagerDuty to OnCallShift

Assistant: I can help with that\! First, let me test your PagerDuty connection.
[Uses test_pagerduty_connection tool]
Connection successful\! Found 15 users, 4 teams, 3 schedules.

Assistant: [Uses fetch_pagerduty_config tool]
Fetched complete configuration. Ready to migrate:
- 15 users
- 4 teams (Platform, Backend, Frontend, SRE)
- 3 on-call schedules
- 5 escalation policies
- 12 services

Shall I proceed with the migration?

User: Yes, do it

Assistant: [Uses migrate_from_mcp tool]
Migration completed successfully\!

Created:
- 4 teams
- 3 schedules
- 5 escalation policies
- 12 services
- 15 user invitations sent

Next steps:
1. Team members should check their email for invitations
2. Verify schedules at oncallshift.com/schedules
3. Set up webhook forwarding from PagerDuty
```

## Development

### Building from Source

```bash
cd packages/oncallshift-mcp
npm install
npm run build
```

### Running in Development

```bash
export ONCALLSHIFT_API_KEY=your-key
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

## Troubleshooting

### "ONCALLSHIFT_API_KEY environment variable is required"

Make sure you have set your API key in the MCP configuration or environment:

```bash
export ONCALLSHIFT_API_KEY=your-api-key
```

### "Connection refused" or "Network error"

1. Check that you can reach https://oncallshift.com from your machine
2. If you are behind a proxy, configure the appropriate proxy environment variables

### Tool not appearing in AI assistant

1. Restart the AI assistant after updating the configuration
2. Check the MCP server logs for errors
3. Verify the configuration JSON is valid

## Support

- Documentation: https://oncallshift.com/docs
- Issues: https://github.com/oncallshift/pagerduty-lite/issues
- Email: support@oncallshift.com

## License

MIT
