import { Link } from 'react-router-dom';
import {
  DocsLayout,
  DocsContent,
  Callout,
  RelatedPages,
  FeedbackWidget,
  docsNav,
} from '../../components/docs';

export function DocsMcpServer() {
  return (
    <DocsLayout navigation={docsNav} variant="docs">
      <DocsContent
        title="MCP Server for AI Assistants"
        description="Use Claude Code, Cursor, or other AI assistants to manage OnCallShift"
        breadcrumbs={[
          { label: 'Docs', href: '/docs' },
          { label: 'AI Features', href: '' },
          { label: 'MCP Server', href: '/docs/ai/mcp' },
        ]}
        lastUpdated="January 3, 2026"
      >
        <p>
          The OnCallShift MCP (Model Context Protocol) server enables AI assistants like Claude Code,
          Cursor, and VS Code Continue to interact with your OnCallShift organization through
          natural language commands.
        </p>

        <Callout type="tip" title="What is MCP?">
          MCP (Model Context Protocol) is an open standard that allows AI assistants to securely
          connect to external tools and data sources. With the OnCallShift MCP server, you can
          manage incidents, check who's on-call, and even migrate from other platforms--all through
          natural conversation.
        </Callout>

        <h2>Installation</h2>

        <p>The MCP server is available as an npm package:</p>

        <pre className="bg-slate-900 border border-white/5 p-4 rounded-lg overflow-x-auto">
          <code>npx @oncallshift/mcp-server</code>
        </pre>

        <p className="mt-4">Or install globally:</p>

        <pre className="bg-slate-900 border border-white/5 p-4 rounded-lg overflow-x-auto">
          <code>{`npm install -g @oncallshift/mcp-server
oncallshift-mcp`}</code>
        </pre>

        <h2>Configuration</h2>

        <p>
          You'll need an API key to authenticate the MCP server. Create one at{' '}
          <Link to="/settings/api-keys" className="text-teal-400 hover:underline">
            Settings &rarr; API Keys
          </Link>.
        </p>

        <h3>Claude Code / Claude Desktop</h3>

        <p>Add to your <code>claude_desktop_config.json</code>:</p>

        <pre className="bg-slate-900 border border-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "org_your-api-key-here"
      }
    }
  }
}`}</code>
        </pre>

        <p className="mt-2 text-sm text-slate-400">
          <strong>Config file locations:</strong><br />
          macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
          Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code><br />
          Linux: <code>~/.config/Claude/claude_desktop_config.json</code>
        </p>

        <h3>Cursor</h3>

        <p>Add to <code>.cursor/mcp.json</code> in your project or global settings:</p>

        <pre className="bg-slate-900 border border-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "org_your-api-key-here"
      }
    }
  }
}`}</code>
        </pre>

        <h3>VS Code with Continue</h3>

        <p>Add to <code>.continue/config.json</code>:</p>

        <pre className="bg-slate-900 border border-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`{
  "mcpServers": [
    {
      "name": "oncallshift",
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "org_your-api-key-here"
      }
    }
  ]
}`}</code>
        </pre>

        <h2>Available Commands</h2>

        <p>Once configured, you can interact with OnCallShift naturally:</p>

        <h3>Incident Management</h3>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>"Who is on call right now?"</strong> -- Check current on-call coverage</li>
          <li><strong>"Show me triggered incidents"</strong> -- List active incidents</li>
          <li><strong>"Acknowledge incident #1234"</strong> -- Acknowledge an incident</li>
          <li><strong>"Resolve incident #1234"</strong> -- Mark as resolved</li>
          <li><strong>"Escalate incident #1234"</strong> -- Escalate to next level</li>
          <li><strong>"Add a note to incident #1234: Investigating database connection pool"</strong></li>
        </ul>

        <h3>Service & Team Management</h3>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>"List all services"</strong> -- View configured services</li>
          <li><strong>"Create a new team called Backend"</strong> -- Create a team</li>
          <li><strong>"Show me the escalation policy for the API service"</strong></li>
          <li><strong>"Check service health"</strong> -- View incident trends per service</li>
        </ul>

        <h3>Analytics</h3>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>"What's our MTTR for the last 30 days?"</strong> -- Incident metrics</li>
          <li><strong>"Analyze on-call fairness for the Platform team"</strong> -- Load distribution</li>
          <li><strong>"Suggest improvements"</strong> -- AI-powered recommendations</li>
        </ul>

        <h2>Platform Migration</h2>

        <Callout type="info" title="Migrate with a single conversation">
          The MCP server includes built-in migration tools. You can migrate your entire existing
          platform configuration through natural language--no manual export/import required.
        </Callout>

        <p>Example migration conversation:</p>

        <div className="bg-white/[0.02] p-4 rounded-lg space-y-4 my-4 border border-white/5">
          <div className="flex gap-3">
            <span className="font-medium text-teal-400">You:</span>
            <span className="text-slate-300">I want to migrate from my current incident platform to OnCallShift</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium text-green-400">AI:</span>
            <span className="text-slate-300">I can help with that! First, I need your platform's API key. You can usually create a read-only key in your account settings.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium text-teal-400">You:</span>
            <span className="text-slate-300">Here's my key: pdkey_xxx</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium text-green-400">AI:</span>
            <span className="text-slate-300">Connected! Found 15 users, 4 teams, 3 schedules, 12 services. Want me to preview what will be migrated?</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium text-teal-400">You:</span>
            <span className="text-slate-300">Yes, then migrate everything</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium text-green-400">AI:</span>
            <span className="text-slate-300">Migration complete! All users have been invited, schedules configured, and services created. Integration keys have been preserved for zero-downtime transition.</span>
          </div>
        </div>

        <h2>Available Tools</h2>

        <p>The MCP server exposes these tools to AI assistants:</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 pr-4 text-slate-300">Tool</th>
                <th className="text-left py-2 text-slate-300">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">get_oncall_now</td><td className="text-slate-400">Get currently on-call users</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">list_incidents</td><td className="text-slate-400">List incidents with filters</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">acknowledge_incident</td><td className="text-slate-400">Acknowledge an incident</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">resolve_incident</td><td className="text-slate-400">Resolve an incident</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">escalate_incident</td><td className="text-slate-400">Escalate to next level</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">list_services</td><td className="text-slate-400">List all services</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">list_teams</td><td className="text-slate-400">List all teams</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">list_schedules</td><td className="text-slate-400">List on-call schedules</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">get_incident_metrics</td><td className="text-slate-400">Get MTTR, MTTA, trends</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">analyze_oncall_fairness</td><td className="text-slate-400">Analyze on-call load distribution</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">suggest_improvements</td><td className="text-slate-400">AI-powered improvement suggestions</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-teal-400">migrate_from_mcp</td><td className="text-slate-400">Migrate from another platform</td></tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          For the complete list of 30+ tools, see the{' '}
          <a
            href="https://github.com/jarod-rosenthal/oncallshift/tree/main/packages/oncallshift-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:underline"
          >
            MCP server documentation on GitHub
          </a>.
        </p>

        <h2>Troubleshooting</h2>

        <h3>"ONCALLSHIFT_API_KEY environment variable is required"</h3>
        <p>
          Ensure your API key is set in the MCP configuration. Double-check the <code>env</code> block
          in your config file.
        </p>

        <h3>Tool not appearing in AI assistant</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Restart the AI assistant after updating configuration</li>
          <li>Verify your config JSON is valid (no trailing commas, proper quotes)</li>
          <li>Check the MCP server logs for errors</li>
        </ul>

        <h3>Connection errors</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Verify your API key is valid at <Link to="/settings/api-keys" className="text-teal-400 hover:underline">Settings &rarr; API Keys</Link></li>
          <li>Check network connectivity to oncallshift.com</li>
          <li>If behind a proxy, configure appropriate proxy environment variables</li>
        </ul>

        <RelatedPages
          pages={[
            {
              title: 'API Keys',
              href: '/settings/api-keys',
              description: 'Create and manage API keys',
            },
            {
              title: 'AI Diagnosis',
              href: '/docs/ai/diagnosis',
              description: 'AI-powered incident analysis',
            },
            {
              title: 'Migration Guide',
              href: '/docs/migration/guide',
              description: 'Complete migration guide',
            },
          ]}
        />

        <FeedbackWidget pageId="docs-mcp-server" />
      </DocsContent>
    </DocsLayout>
  );
}
