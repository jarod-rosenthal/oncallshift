import { BlogLayout } from './BlogLayout';

export function BuildingMcpServers() {
  return (
    <BlogLayout
      title="Building Your Own MCP Server: Extending AI Assistants with Custom Tools"
      date="January 2025"
      category="AI & Automation"
      readTime="12 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        MCP (Model Context Protocol) lets you give AI assistants access to your own tools and data.
        Here's how to build an MCP server that connects your infrastructure to AI.
      </p>

      <h2>What is MCP?</h2>

      <p>
        MCP (Model Context Protocol) is a standard for connecting AI assistants to external tools.
        Instead of the AI just generating text, it can call functions you define—querying databases,
        running commands, or accessing APIs.
      </p>

      <pre><code className="language-text">{`AI Assistant                    MCP Server (yours)
     |                                |
     |-- "What pods are failing?" --> |
     |                                | kubectl get pods --field-selector=status.phase=Failed
     | <-- [pod1, pod2, pod3] --------|
     |                                |
     |-- "Show logs for pod1" ------> |
     |                                | kubectl logs pod1
     | <-- [log content] -------------|`}</code></pre>

      <p>
        The AI decides when to call your tools based on the conversation. You define what tools
        are available and what they do.
      </p>

      <h2>Why Build an MCP Server?</h2>

      <ul>
        <li><strong>Custom integrations</strong> — Connect AI to your internal tools</li>
        <li><strong>Security</strong> — Control exactly what the AI can access</li>
        <li><strong>Context</strong> — Give AI access to your specific environment</li>
        <li><strong>Automation</strong> — Let AI perform actions, not just answer questions</li>
      </ul>

      <h2>Your First MCP Server</h2>

      <p>
        Let's build a simple MCP server that provides Kubernetes information:
      </p>

      <pre><code className="language-typescript">{`// kubernetes-mcp/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Create the MCP server
const server = new McpServer({
  name: "kubernetes-mcp",
  version: "1.0.0",
});

// Define a tool to get pods
server.tool(
  "get_pods",
  "Get Kubernetes pods in a namespace",
  {
    namespace: {
      type: "string",
      description: "Kubernetes namespace (default: default)",
    },
    status: {
      type: "string",
      description: "Filter by status: Running, Pending, Failed",
    },
  },
  async ({ namespace = "default", status }) => {
    let cmd = \`kubectl get pods -n \${namespace} -o json\`;

    const { stdout } = await execAsync(cmd);
    const pods = JSON.parse(stdout);

    let filtered = pods.items;
    if (status) {
      filtered = filtered.filter(
        (p: any) => p.status.phase === status
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            filtered.map((p: any) => ({
              name: p.metadata.name,
              status: p.status.phase,
              restarts: p.status.containerStatuses?.[0]?.restartCount || 0,
            })),
            null,
            2
          ),
        },
      ],
    };
  }
);

// Define a tool to get pod logs
server.tool(
  "get_pod_logs",
  "Get logs from a Kubernetes pod",
  {
    pod: {
      type: "string",
      description: "Pod name",
      required: true,
    },
    namespace: {
      type: "string",
      description: "Kubernetes namespace (default: default)",
    },
    lines: {
      type: "number",
      description: "Number of log lines (default: 50)",
    },
  },
  async ({ pod, namespace = "default", lines = 50 }) => {
    const cmd = \`kubectl logs \${pod} -n \${namespace} --tail=\${lines}\`;
    const { stdout } = await execAsync(cmd);

    return {
      content: [{ type: "text", text: stdout }],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);`}</code></pre>

      <h3>Package Configuration</h3>

      <pre><code className="language-json">{`// package.json
{
  "name": "kubernetes-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}`}</code></pre>

      <pre><code className="language-json">{`// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}`}</code></pre>

      <h2>Registering with Claude Desktop</h2>

      <p>
        To use your MCP server with Claude Desktop or Claude Code:
      </p>

      <pre><code className="language-json">{`// ~/.config/claude/claude_desktop_config.json (Linux)
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
{
  "mcpServers": {
    "kubernetes": {
      "command": "node",
      "args": ["/path/to/kubernetes-mcp/dist/index.js"]
    }
  }
}`}</code></pre>

      <p>
        Now when you chat with Claude, it can use your Kubernetes tools.
      </p>

      <h2>A More Complete Example: On-Call MCP Server</h2>

      <p>
        Let's build something more relevant—an MCP server for incident management:
      </p>

      <pre><code className="language-typescript">{`// oncall-mcp/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const API_BASE = process.env.ONCALL_API_URL || "https://api.oncallshift.com";
const API_KEY = process.env.ONCALL_API_KEY;

async function apiCall(endpoint: string, method = "GET", body?: any) {
  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

const server = new McpServer({
  name: "oncall-mcp",
  version: "1.0.0",
});

// List active incidents
server.tool(
  "list_incidents",
  "List active incidents from the on-call system",
  {
    status: {
      type: "string",
      description: "Filter by status: triggered, acknowledged, resolved",
    },
    service: {
      type: "string",
      description: "Filter by service name",
    },
  },
  async ({ status, service }) => {
    let url = "/api/v1/incidents?";
    if (status) url += \`status=\${status}&\`;
    if (service) url += \`service=\${service}&\`;

    const incidents = await apiCall(url);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(incidents, null, 2),
      }],
    };
  }
);

// Acknowledge an incident
server.tool(
  "acknowledge_incident",
  "Acknowledge an incident to indicate you are working on it",
  {
    incident_id: {
      type: "string",
      description: "The incident ID to acknowledge",
      required: true,
    },
  },
  async ({ incident_id }) => {
    const result = await apiCall(
      \`/api/v1/incidents/\${incident_id}/acknowledge\`,
      "POST"
    );

    return {
      content: [{
        type: "text",
        text: \`Incident \${incident_id} acknowledged.\`,
      }],
    };
  }
);

// Add note to incident
server.tool(
  "add_incident_note",
  "Add a note to an incident timeline",
  {
    incident_id: {
      type: "string",
      description: "The incident ID",
      required: true,
    },
    note: {
      type: "string",
      description: "The note content",
      required: true,
    },
  },
  async ({ incident_id, note }) => {
    await apiCall(
      \`/api/v1/incidents/\${incident_id}/notes\`,
      "POST",
      { content: note }
    );

    return {
      content: [{ type: "text", text: "Note added." }],
    };
  }
);

// Get on-call schedule
server.tool(
  "who_is_oncall",
  "Get who is currently on-call for a service",
  {
    service: {
      type: "string",
      description: "Service name",
    },
  },
  async ({ service }) => {
    const url = service
      ? \`/api/v1/schedules/oncall?service=\${service}\`
      : "/api/v1/schedules/oncall";

    const oncall = await apiCall(url);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(oncall, null, 2),
      }],
    };
  }
);

// Get service health
server.tool(
  "get_service_health",
  "Get health status of services",
  {
    service: {
      type: "string",
      description: "Specific service name (optional)",
    },
  },
  async ({ service }) => {
    const url = service
      ? \`/api/v1/services/\${service}/health\`
      : "/api/v1/services/health";

    const health = await apiCall(url);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(health, null, 2),
      }],
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);`}</code></pre>

      <h2>MCP Resources: Exposing Data</h2>

      <p>
        Besides tools (actions), MCP supports resources (data the AI can read):
      </p>

      <pre><code className="language-typescript">{`// Add resources to your server
server.resource(
  "runbooks",
  "List of runbooks for incident response",
  async () => {
    const runbooks = await apiCall("/api/v1/runbooks");

    return {
      contents: [{
        uri: "oncall://runbooks",
        mimeType: "application/json",
        text: JSON.stringify(runbooks, null, 2),
      }],
    };
  }
);

server.resource(
  "escalation-policies",
  "Escalation policies for each service",
  async () => {
    const policies = await apiCall("/api/v1/escalation-policies");

    return {
      contents: [{
        uri: "oncall://escalation-policies",
        mimeType: "application/json",
        text: JSON.stringify(policies, null, 2),
      }],
    };
  }
);`}</code></pre>

      <h2>Security Considerations</h2>

      <p>
        MCP servers have significant power. Be careful:
      </p>

      <h3>Authentication</h3>

      <pre><code className="language-typescript">{`// Use environment variables for secrets
const API_KEY = process.env.ONCALL_API_KEY;
if (!API_KEY) {
  console.error("ONCALL_API_KEY environment variable required");
  process.exit(1);
}`}</code></pre>

      <h3>Input Validation</h3>

      <pre><code className="language-typescript">{`// Validate and sanitize inputs
server.tool(
  "get_pod_logs",
  "...",
  { pod: { type: "string", required: true } },
  async ({ pod }) => {
    // Prevent command injection
    if (!/^[a-z0-9-]+$/.test(pod)) {
      throw new Error("Invalid pod name");
    }

    const cmd = \`kubectl logs \${pod}\`;
    // ...
  }
);`}</code></pre>

      <h3>Least Privilege</h3>

      <pre><code className="language-typescript">{`// Only expose read operations for sensitive systems
// Don't add "delete_pod" unless you really need it

// Use read-only API tokens where possible
const API_KEY = process.env.ONCALL_READ_ONLY_KEY;`}</code></pre>

      <div className="bg-red-50 border-l-4 border-red-600 p-6 my-8">
        <p className="font-semibold text-red-900 mb-2">Security warning:</p>
        <p className="text-red-800">
          MCP servers can execute code and make API calls. Treat them with the same care as
          any production service. Use read-only credentials where possible, validate all inputs,
          and limit what actions are exposed.
        </p>
      </div>

      <h2>Testing Your MCP Server</h2>

      <pre><code className="language-bash">{`# Build
npm run build

# Test manually via stdin/stdout
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Test a tool call
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_incidents","arguments":{"status":"triggered"}}}' | node dist/index.js`}</code></pre>

      <h2>Deployment Patterns</h2>

      <h3>Local Development</h3>

      <pre><code className="language-json">{`// Claude Desktop config
{
  "mcpServers": {
    "oncall": {
      "command": "node",
      "args": ["/home/user/oncall-mcp/dist/index.js"],
      "env": {
        "ONCALL_API_KEY": "your-key-here"
      }
    }
  }
}`}</code></pre>

      <h3>Docker</h3>

      <pre><code className="language-dockerfile">{`FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/

CMD ["node", "dist/index.js"]`}</code></pre>

      <pre><code className="language-json">{`// Config pointing to Docker
{
  "mcpServers": {
    "oncall": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "ONCALL_API_KEY", "oncall-mcp:latest"]
    }
  }
}`}</code></pre>

      <h2>Common Patterns</h2>

      <h3>Caching</h3>

      <pre><code className="language-typescript">{`// Cache expensive API calls
const cache = new Map<string, { data: any; expires: number }>();

async function cachedApiCall(endpoint: string, ttlMs = 30000) {
  const key = endpoint;
  const cached = cache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await apiCall(endpoint);
  cache.set(key, { data, expires: Date.now() + ttlMs });
  return data;
}`}</code></pre>

      <h3>Error Handling</h3>

      <pre><code className="language-typescript">{`server.tool(
  "get_pods",
  "...",
  {},
  async () => {
    try {
      const result = await execAsync("kubectl get pods");
      return { content: [{ type: "text", text: result.stdout }] };
    } catch (error) {
      // Return error as text, not throw
      return {
        content: [{
          type: "text",
          text: \`Error: \${error.message}\`,
        }],
        isError: true,
      };
    }
  }
);`}</code></pre>

      <h2>Ideas for MCP Servers</h2>

      <ul>
        <li><strong>Database explorer</strong> — Query your databases safely</li>
        <li><strong>Log aggregator</strong> — Search CloudWatch/Datadog/Splunk</li>
        <li><strong>Infrastructure status</strong> — AWS/GCP/Azure resource info</li>
        <li><strong>CI/CD integration</strong> — Trigger builds, check status</li>
        <li><strong>Documentation search</strong> — Query internal docs and runbooks</li>
        <li><strong>Ticket management</strong> — Create/update Jira/Linear issues</li>
      </ul>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The power of MCP:</p>
        <p className="text-blue-800">
          With MCP, your AI assistant becomes a true operator. Instead of telling you how
          to check something, it can check it directly and give you the answer.
        </p>
      </div>

      <h2>Next Steps</h2>

      <ol>
        <li>Start with one tool that solves a real problem</li>
        <li>Test it manually before connecting to Claude</li>
        <li>Add tools incrementally as you find use cases</li>
        <li>Document what each tool does and what permissions it needs</li>
      </ol>

      <p>
        MCP is still young, but the pattern is powerful. Building your own MCP server puts
        your infrastructure at the AI's fingertips—while keeping you in control of what it can do.
      </p>
    </BlogLayout>
  );
}
