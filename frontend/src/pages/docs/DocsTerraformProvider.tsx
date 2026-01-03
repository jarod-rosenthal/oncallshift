import { Link } from 'react-router-dom';
import {
  DocsLayout,
  DocsContent,
  Callout,
  RelatedPages,
  FeedbackWidget,
  docsNav,
} from '../../components/docs';

export function DocsTerraformProvider() {
  return (
    <DocsLayout navigation={docsNav} variant="docs">
      <DocsContent
        title="Terraform Provider"
        description="Manage OnCallShift resources using Infrastructure as Code"
        breadcrumbs={[
          { label: 'Docs', href: '/docs' },
          { label: 'Infrastructure as Code', href: '' },
          { label: 'Terraform Provider', href: '/docs/iac/terraform' },
        ]}
        lastUpdated="January 3, 2026"
      >
        <p>
          The OnCallShift Terraform provider enables you to manage your incident management
          infrastructure as code. Define teams, services, schedules, escalation policies, and more
          in HCL and manage them through standard Terraform workflows.
        </p>

        <Callout type="tip" title="Infrastructure as Code Benefits">
          Using Terraform for OnCallShift configuration provides version control, code review,
          reproducible environments, and integration with existing IaC workflows. Changes are
          tracked, auditable, and can be rolled back easily.
        </Callout>

        <h2>Installation</h2>

        <p>
          The provider is available for local installation. Configure it in your Terraform configuration:
        </p>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 1.0"
    }
  }
}

provider "oncallshift" {
  # API key from environment variable ONCALLSHIFT_API_KEY
  # Or specify directly: api_key = var.oncallshift_api_key
}`}</code>
        </pre>

        <h3>Local Installation (Pre-Registry)</h3>

        <p>Until the provider is published to the Terraform Registry, install locally:</p>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`# Clone the repository
git clone https://github.com/oncallshift/pagerduty-lite.git
cd pagerduty-lite/packages/terraform-provider-oncallshift

# Build and install
make install

# This installs to ~/.terraform.d/plugins/oncallshift.com/oncallshift/oncallshift/1.0.0/`}</code>
        </pre>

        <h2>Authentication</h2>

        <p>
          The provider requires an API key for authentication. Create one at{' '}
          <Link to="/settings/api-keys" className="text-blue-600 hover:underline">
            Settings → API Keys
          </Link>.
        </p>

        <h3>Environment Variable (Recommended)</h3>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`export ONCALLSHIFT_API_KEY="org_your-api-key-here"
terraform plan`}</code>
        </pre>

        <h3>Provider Configuration</h3>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`provider "oncallshift" {
  api_key = var.oncallshift_api_key
  api_url = "https://oncallshift.com/api/v1"  # Optional, default shown
}`}</code>
        </pre>

        <h2>Available Resources</h2>

        <p>The provider supports 9 resources covering core OnCallShift functionality:</p>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-slate-700">
                <th className="text-left py-2 pr-4 font-semibold">Resource</th>
                <th className="text-left py-2 pr-4 font-semibold">Description</th>
                <th className="text-left py-2 font-semibold">Import</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_team</td><td className="pr-4">Create and manage teams</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_user</td><td className="pr-4">Invite and manage users</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_service</td><td className="pr-4">Define services with escalation policies</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_schedule</td><td className="pr-4">Configure on-call schedules with layers</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_escalation_policy</td><td className="pr-4">Multi-step escalation rules</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_integration</td><td className="pr-4">Connect external monitoring tools</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_routing_rule</td><td className="pr-4">Route alerts based on conditions</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_runbook</td><td className="pr-4">Document incident response procedures</td><td>Yes</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_workflow</td><td className="pr-4">Automate actions on incident events</td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>

        <h2>Data Sources</h2>

        <p>Look up existing resources by ID or name:</p>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-slate-700">
                <th className="text-left py-2 pr-4 font-semibold">Data Source</th>
                <th className="text-left py-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_team</td><td>Look up team by ID</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_user</td><td>Look up user by ID or email</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_service</td><td>Look up service by ID</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">oncallshift_schedule</td><td>Look up schedule by ID</td></tr>
            </tbody>
          </table>
        </div>

        <h2>Example: Complete Setup</h2>

        <p>
          This example creates a team, users, schedule, escalation policy, and service with
          a Datadog integration:
        </p>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`# Create the platform team
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

# Invite team members
resource "oncallshift_user" "alice" {
  email    = "alice@company.com"
  name     = "Alice Smith"
  role     = "user"
  team_ids = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "bob" {
  email    = "bob@company.com"
  name     = "Bob Johnson"
  role     = "user"
  team_ids = [oncallshift_team.platform.id]
}

# Create a weekly rotation schedule
resource "oncallshift_schedule" "primary" {
  name        = "Platform Primary"
  description = "Primary on-call rotation"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layers {
    name            = "Primary"
    rotation_type   = "weekly"
    start_time      = "09:00"
    user_ids        = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id
    ]
  }
}

# Define escalation policy
resource "oncallshift_escalation_policy" "platform" {
  name        = "Platform Escalation"
  description = "Escalate to on-call, then team lead"

  steps {
    delay_minutes = 5
    targets {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }

  steps {
    delay_minutes = 15
    targets {
      type = "user"
      id   = oncallshift_user.alice.id
    }
  }
}

# Create the service
resource "oncallshift_service" "api" {
  name                 = "API Service"
  description          = "Main API service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.platform.id
}

# Connect Datadog integration
resource "oncallshift_integration" "datadog" {
  name       = "Datadog Monitors"
  type       = "datadog"
  service_id = oncallshift_service.api.id
  enabled    = true
}

# Create a runbook
resource "oncallshift_runbook" "api_outage" {
  title       = "API Outage Response"
  description = "Steps for responding to API outages"
  service_id  = oncallshift_service.api.id
  tags        = ["api", "critical"]

  content = <<-EOT
    # API Outage Response

    ## Initial Assessment
    1. Check service health dashboard
    2. Review recent deployments
    3. Check database connectivity

    ## Mitigation
    1. If recent deploy: rollback
    2. If database issue: check connection pool
    3. If traffic spike: scale horizontally
  EOT
}

# Output the integration webhook URL
output "datadog_webhook_url" {
  value     = "https://oncallshift.com/api/v1/webhooks/\${oncallshift_integration.datadog.integration_key}"
  sensitive = true
}`}</code>
        </pre>

        <h2>Importing Existing Resources</h2>

        <p>
          Import existing OnCallShift resources into Terraform management using the resource ID:
        </p>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`# Import an existing team
terraform import oncallshift_team.platform team_abc123

# Import an existing service
terraform import oncallshift_service.api svc_xyz789

# Import an existing schedule
terraform import oncallshift_schedule.primary sch_def456`}</code>
        </pre>

        <p className="mt-4">
          After importing, run <code>terraform plan</code> to see any drift between the actual
          configuration and your Terraform code.
        </p>

        <h2>Resource: oncallshift_team</h2>

        <p>Creates and manages a team in OnCallShift.</p>

        <h3>Example Usage</h3>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`resource "oncallshift_team" "backend" {
  name        = "Backend Engineering"
  description = "Backend services team"
}`}</code>
        </pre>

        <h3>Argument Reference</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>name</code> - (Required) The name of the team.</li>
          <li><code>description</code> - (Optional) A description of the team.</li>
        </ul>

        <h3>Attribute Reference</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>id</code> - The unique identifier of the team.</li>
        </ul>

        <h2>Resource: oncallshift_schedule</h2>

        <p>Creates and manages on-call schedules with rotation layers.</p>

        <h3>Example Usage</h3>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`resource "oncallshift_schedule" "primary_oncall" {
  name        = "Primary On-Call"
  description = "24/7 primary rotation"
  timezone    = "America/Los_Angeles"
  team_id     = oncallshift_team.platform.id

  layers {
    name            = "Primary Layer"
    rotation_type   = "weekly"
    start_time      = "09:00"
    handoff_day     = "monday"
    user_ids        = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.charlie.id
    ]
  }

  layers {
    name            = "Shadow Layer"
    rotation_type   = "daily"
    start_time      = "09:00"
    user_ids        = [oncallshift_user.intern.id]
  }
}`}</code>
        </pre>

        <h3>Argument Reference</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>name</code> - (Required) The name of the schedule.</li>
          <li><code>description</code> - (Optional) A description of the schedule.</li>
          <li><code>timezone</code> - (Required) The timezone for the schedule (e.g., "America/New_York").</li>
          <li><code>team_id</code> - (Optional) The team this schedule belongs to.</li>
          <li><code>layers</code> - (Optional) One or more rotation layers. See below.</li>
        </ul>

        <h3>Layer Blocks</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>name</code> - (Required) Name of the rotation layer.</li>
          <li><code>rotation_type</code> - (Required) Type of rotation: "daily", "weekly", or "custom".</li>
          <li><code>start_time</code> - (Required) Handoff time in HH:MM format.</li>
          <li><code>handoff_day</code> - (Optional) Day of week for weekly rotations.</li>
          <li><code>user_ids</code> - (Required) List of user IDs in the rotation.</li>
        </ul>

        <h2>Resource: oncallshift_escalation_policy</h2>

        <p>Creates multi-step escalation policies with configurable delays and targets.</p>

        <h3>Example Usage</h3>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`resource "oncallshift_escalation_policy" "critical" {
  name        = "Critical Incidents"
  description = "For P1 incidents - aggressive escalation"
  repeat_count = 2

  steps {
    delay_minutes = 0  # Notify immediately
    targets {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }

  steps {
    delay_minutes = 5  # Escalate after 5 minutes
    targets {
      type = "user"
      id   = oncallshift_user.team_lead.id
    }
    targets {
      type = "user"
      id   = oncallshift_user.eng_manager.id
    }
  }

  steps {
    delay_minutes = 15  # Final escalation
    targets {
      type = "user"
      id   = oncallshift_user.vp_eng.id
    }
  }
}`}</code>
        </pre>

        <h3>Argument Reference</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>name</code> - (Required) Name of the escalation policy.</li>
          <li><code>description</code> - (Optional) Description of the policy.</li>
          <li><code>repeat_count</code> - (Optional) Number of times to repeat the policy before stopping. Default: 0 (no repeat).</li>
          <li><code>steps</code> - (Required) One or more escalation steps. See below.</li>
        </ul>

        <h3>Step Blocks</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>delay_minutes</code> - (Required) Minutes to wait before escalating to this step.</li>
          <li><code>targets</code> - (Required) One or more notification targets.</li>
        </ul>

        <h3>Target Blocks</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li><code>type</code> - (Required) Target type: "user" or "schedule".</li>
          <li><code>id</code> - (Required) The ID of the user or schedule.</li>
        </ul>

        <Callout type="info" title="More Resources">
          For complete documentation of all resources including <code>oncallshift_integration</code>,{' '}
          <code>oncallshift_routing_rule</code>, <code>oncallshift_runbook</code>, and{' '}
          <code>oncallshift_workflow</code>, see the provider README at{' '}
          <a
            href="https://github.com/oncallshift/pagerduty-lite/tree/main/packages/terraform-provider-oncallshift"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            GitHub
          </a>.
        </Callout>

        <h2>Development Commands</h2>

        <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`cd packages/terraform-provider-oncallshift

# Build the provider
make build

# Install locally for testing
make install

# Run unit tests
make test

# Run acceptance tests (requires real API key)
ONCALLSHIFT_API_KEY=org_xxx make testacc`}</code>
        </pre>

        <RelatedPages
          pages={[
            {
              title: 'API Keys',
              href: '/settings/api-keys',
              description: 'Create and manage API keys for Terraform',
            },
            {
              title: 'MCP Server',
              href: '/docs/ai/mcp',
              description: 'Manage OnCallShift with AI assistants',
            },
            {
              title: 'API Reference',
              href: '/docs/api',
              description: 'REST API documentation',
            },
          ]}
        />

        <FeedbackWidget pageId="docs-terraform-provider" />
      </DocsContent>
    </DocsLayout>
  );
}
