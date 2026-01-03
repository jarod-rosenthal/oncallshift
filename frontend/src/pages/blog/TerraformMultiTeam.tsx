import { BlogLayout } from './BlogLayout';

export function TerraformMultiTeam() {
  return (
    <BlogLayout
      title="Terraform Patterns for Multi-Team On-Call: Lessons from Scaling to 50 Services"
      date="January 2025"
      category="Infrastructure as Code"
      readTime="12 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        Managing on-call for one team is straightforward. Managing it for 50 services across 12 teams
        requires patterns. Here's what we learned scaling on-call configuration with Terraform.
      </p>

      <h2>The Scaling Challenge</h2>

      <p>
        When you have one team and one service, managing on-call is simple. You have a schedule, an escalation
        policy, maybe a few routing rules. Everything fits in one Terraform file.
      </p>

      <p>
        Then you grow. More teams. More services. More schedules. More complexity. Before long, your monolithic
        Terraform config is 3,000 lines of HCL that takes 10 minutes to plan.
      </p>

      <p>
        The patterns that worked for one team don't scale. Here's what does.
      </p>

      <h2>Pattern 1: Team-Owned Modules</h2>

      <p>
        The first breakthrough is recognizing that each team should own their on-call configuration, but
        share common patterns.
      </p>

      <pre><code className="language-hcl">{`# modules/team-oncall/main.tf
variable "team_name" {
  type = string
}

variable "team_members" {
  type = list(object({
    id    = string
    email = string
    role  = string  # "primary" | "secondary" | "manager"
  }))
}

variable "services" {
  type = list(string)
}

# Primary rotation - team members with "primary" role
resource "oncallshift_schedule" "primary" {
  name        = "\${var.team_name} - Primary"
  timezone    = var.timezone

  rotation {
    type = "weekly"
    participants = [
      for m in var.team_members : m.id if m.role == "primary"
    ]
  }
}

# Secondary rotation - all team members
resource "oncallshift_schedule" "secondary" {
  name = "\${var.team_name} - Secondary"
  # ...
}

# Standard escalation: primary -> secondary -> manager
resource "oncallshift_escalation_policy" "standard" {
  name = "\${var.team_name} Escalation"

  step {
    delay_minutes = 0
    targets       = [oncallshift_schedule.primary.id]
  }

  step {
    delay_minutes = 15
    targets       = [oncallshift_schedule.secondary.id]
  }

  step {
    delay_minutes = 30
    targets = [
      for m in var.team_members : m.id if m.role == "manager"
    ]
  }
}`}</code></pre>

      <p>
        Each team instantiates this module with their specific configuration:
      </p>

      <pre><code className="language-hcl">{`# teams/platform/oncall.tf
module "oncall" {
  source = "../../modules/team-oncall"

  team_name = "Platform"
  timezone  = "America/New_York"

  team_members = [
    { id = data.oncallshift_user.alice.id, email = "alice@company.com", role = "primary" },
    { id = data.oncallshift_user.bob.id, email = "bob@company.com", role = "primary" },
    { id = data.oncallshift_user.carol.id, email = "carol@company.com", role = "secondary" },
    { id = data.oncallshift_user.dave.id, email = "dave@company.com", role = "manager" },
  ]

  services = ["api-gateway", "auth-service", "user-service"]
}`}</code></pre>

      <h2>Pattern 2: Hierarchical State Management</h2>

      <p>
        Terraform state should mirror your organizational structure. Don't put everything in one state file.
      </p>

      <pre><code className="language-text">{`terraform/
├── shared/           # Shared resources (users, global policies)
│   └── terraform.tfstate
├── teams/
│   ├── platform/     # Platform team's on-call config
│   │   └── terraform.tfstate
│   ├── payments/     # Payments team's on-call config
│   │   └── terraform.tfstate
│   └── mobile/       # Mobile team's on-call config
│       └── terraform.tfstate
└── modules/          # Shared modules (no state)
    └── team-oncall/`}</code></pre>

      <p>
        Benefits of hierarchical state:
      </p>

      <ul>
        <li><strong>Faster plans</strong> — Each plan only considers resources in that state</li>
        <li><strong>Reduced blast radius</strong> — A bad apply only affects one team</li>
        <li><strong>Team autonomy</strong> — Teams can apply their changes without coordinating</li>
        <li><strong>Cleaner permissions</strong> — Teams only need write access to their state</li>
      </ul>

      <h2>Pattern 3: Data Sources for Cross-Team References</h2>

      <p>
        Teams often need to reference resources from other teams. Use data sources, not hardcoded IDs:
      </p>

      <pre><code className="language-hcl">{`# teams/payments/oncall.tf

# Reference the platform team's escalation for fallback
data "oncallshift_escalation_policy" "platform_fallback" {
  name = "Platform Escalation"
}

resource "oncallshift_escalation_policy" "payments" {
  name = "Payments Escalation"

  step {
    delay_minutes = 0
    targets       = [oncallshift_schedule.payments_primary.id]
  }

  # Final escalation to platform team as fallback
  step {
    delay_minutes = 45
    targets       = [data.oncallshift_escalation_policy.platform_fallback.id]
  }
}`}</code></pre>

      <div className="bg-amber-50 border-l-4 border-amber-600 p-6 my-8">
        <p className="font-semibold text-amber-900 mb-2">Watch out:</p>
        <p className="text-amber-800">
          Cross-team dependencies create implicit contracts. If Platform changes their escalation policy name,
          Payments' config breaks. Document these dependencies and consider using outputs/remote state for
          stronger contracts.
        </p>
      </div>

      <h2>Pattern 4: Service-to-Team Mapping</h2>

      <p>
        When you have 50 services, routing alerts to the right team becomes non-trivial. Centralize the mapping:
      </p>

      <pre><code className="language-hcl">{`# shared/service-ownership.tf

locals {
  service_owners = {
    "api-gateway"     = "platform"
    "auth-service"    = "platform"
    "user-service"    = "platform"
    "payment-api"     = "payments"
    "billing-worker"  = "payments"
    "mobile-bff"      = "mobile"
    # ... 45 more services
  }
}

output "service_owners" {
  value = local.service_owners
}

# Generate routing rules from the mapping
resource "oncallshift_routing_rule" "service_routing" {
  for_each = local.service_owners

  name = "Route \${each.key} to \${each.value}"

  condition {
    field    = "service"
    operator = "equals"
    value    = each.key
  }

  action {
    type   = "route"
    target = data.oncallshift_escalation_policy.team[each.value].id
  }
}`}</code></pre>

      <h2>Pattern 5: Schedule Templates with Overrides</h2>

      <p>
        Most teams follow similar patterns (weekly rotation, business hours secondary, etc.) but need
        flexibility for exceptions:
      </p>

      <pre><code className="language-hcl">{`# modules/team-oncall/variables.tf

variable "rotation_type" {
  type    = string
  default = "weekly"
  validation {
    condition     = contains(["daily", "weekly", "biweekly"], var.rotation_type)
    error_message = "Rotation type must be daily, weekly, or biweekly"
  }
}

variable "handoff_time" {
  type    = string
  default = "09:00"
}

variable "secondary_hours" {
  type = object({
    start = string
    end   = string
  })
  default = {
    start = "09:00"
    end   = "18:00"
  }
}

variable "overrides" {
  type = list(object({
    start = string
    end   = string
    user  = string
    reason = string
  }))
  default = []
}`}</code></pre>

      <p>
        This allows teams to customize while staying within guardrails:
      </p>

      <pre><code className="language-hcl">{`# teams/mobile/oncall.tf
module "oncall" {
  source = "../../modules/team-oncall"

  team_name     = "Mobile"
  rotation_type = "biweekly"  # Mobile prefers longer rotations
  handoff_time  = "10:00"     # Their standup is at 10am

  secondary_hours = {
    start = "10:00"
    end   = "19:00"  # They work slightly later
  }

  overrides = [
    {
      start  = "2025-12-20T00:00:00Z"
      end    = "2025-01-03T00:00:00Z"
      user   = data.oncallshift_user.mobile_lead.id
      reason = "Holiday coverage - rest of team OOO"
    }
  ]

  # ... rest of config
}`}</code></pre>

      <h2>Pattern 6: Policy as Code for Compliance</h2>

      <p>
        At scale, you need to enforce standards. Use Terraform validation and/or OPA policies:
      </p>

      <pre><code className="language-hcl">{`# modules/team-oncall/validation.tf

variable "team_members" {
  # ...

  validation {
    condition     = length(var.team_members) >= 3
    error_message = "Teams must have at least 3 members for on-call rotation"
  }

  validation {
    condition     = length([for m in var.team_members : m if m.role == "manager"]) >= 1
    error_message = "Teams must have at least one manager for escalation"
  }
}

variable "escalation_timeout" {
  type    = number
  default = 60

  validation {
    condition     = var.escalation_timeout >= 30 && var.escalation_timeout <= 120
    error_message = "Escalation timeout must be between 30 and 120 minutes"
  }
}`}</code></pre>

      <p>
        Or use OPA for more complex policies:
      </p>

      <pre><code className="language-rego">{`# policy/oncall.rego
package oncall

deny[msg] {
  input.resource_changes[_].type == "oncallshift_schedule"
  schedule := input.resource_changes[_].change.after
  count(schedule.rotation.participants) < 3
  msg := sprintf("Schedule %s must have at least 3 participants", [schedule.name])
}

deny[msg] {
  input.resource_changes[_].type == "oncallshift_escalation_policy"
  policy := input.resource_changes[_].change.after
  count(policy.steps) < 2
  msg := sprintf("Escalation policy %s must have at least 2 steps", [policy.name])
}`}</code></pre>

      <h2>Pattern 7: Automated Onboarding</h2>

      <p>
        When a new team forms, they shouldn't start from scratch:
      </p>

      <pre><code className="language-bash">{`#!/bin/bash
# scripts/create-team.sh

TEAM_NAME=$1
TEAM_LEAD_EMAIL=$2

mkdir -p "terraform/teams/\${TEAM_NAME}"

cat > "terraform/teams/\${TEAM_NAME}/main.tf" << EOF
module "oncall" {
  source = "../../modules/team-oncall"

  team_name = "\${TEAM_NAME}"
  timezone  = "America/New_York"

  team_members = [
    # Add team members here
  ]

  services = [
    # Add services here
  ]
}
EOF

cat > "terraform/teams/\${TEAM_NAME}/backend.tf" << EOF
terraform {
  backend "s3" {
    bucket = "oncallshift-terraform-state"
    key    = "teams/\${TEAM_NAME}/terraform.tfstate"
    region = "us-east-1"
  }
}
EOF

echo "Team scaffold created in terraform/teams/\${TEAM_NAME}"
echo "Next steps:"
echo "  1. Add team members to main.tf"
echo "  2. Run: cd terraform/teams/\${TEAM_NAME} && terraform init && terraform apply"`}</code></pre>

      <h2>Lessons Learned</h2>

      <p>
        After scaling to 50 services, here's what I wish I'd known from the start:
      </p>

      <ol>
        <li>
          <strong>Start with modules early</strong> — Even if you only have one team, create the module.
          The second team will thank you.
        </li>
        <li>
          <strong>Split state aggressively</strong> — The cost of managing multiple state files is lower
          than the cost of slow plans and risky applies.
        </li>
        <li>
          <strong>Document cross-team dependencies</strong> — When Team A depends on Team B's resources,
          write it down somewhere.
        </li>
        <li>
          <strong>Enforce standards with code</strong> — Validation rules catch problems before they ship.
        </li>
        <li>
          <strong>Automate the boring stuff</strong> — Team creation, user onboarding, and service mapping
          should be scripted.
        </li>
      </ol>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The goal:</p>
        <p className="text-blue-800">
          A new team should be able to set up their on-call in under 30 minutes, following patterns that
          are proven to work. That's what good infrastructure as code enables.
        </p>
      </div>
    </BlogLayout>
  );
}
