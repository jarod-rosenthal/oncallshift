# @oncallshift/mcp-server

MCP (Model Context Protocol) server for the OnCallShift incident management platform. This package enables AI assistants like Claude Code, Cursor, and other MCP-compatible tools to interact with OnCallShift through natural language.

## Features

- **Incident Management**: List, acknowledge, resolve, and escalate incidents
- **On-Call Information**: Check who is currently on-call
- **Service Management**: List and manage services
- **Team Management**: Create and list teams
- **Schedule Management**: Create and list on-call schedules

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
| `acknowledge_incident` | Acknowledge an incident (stops escalations) |
| `resolve_incident` | Mark an incident as resolved |
| `escalate_incident` | Escalate an incident to the next level |
| `add_incident_note` | Add a note to an incident |

### On-Call Operations

| Tool | Description |
|------|-------------|
| `get_oncall_now` | Get all currently on-call users |

### Service Operations

| Tool | Description |
|------|-------------|
| `list_services` | List all services, optionally filtered by team |

### Team Operations

| Tool | Description |
|------|-------------|
| `list_teams` | List all teams in the organization |
| `create_team` | Create a new team |

### Schedule Operations

| Tool | Description |
|------|-------------|
| `list_schedules` | List all on-call schedules |
| `setup_schedule` | Create a new on-call schedule with rotation |

## Example Conversations

Once configured, you can interact with OnCallShift naturally:

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

## Programmatic Usage

You can also use the client directly in your Node.js applications:

```typescript
import { OnCallShiftClient } from '@oncallshift/mcp-server';

const client = new OnCallShiftClient({
  apiKey: process.env.ONCALLSHIFT_API_KEY,
  baseUrl: 'https://oncallshift.com/api/v1'
});

// List active incidents
const incidents = await client.listIncidents({ status: 'triggered' });

// Acknowledge an incident
await client.acknowledgeIncident('incident-id');

// Get on-call information
const oncall = await client.getOnCallNow();
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
