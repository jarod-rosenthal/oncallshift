import { BlogLayout } from './BlogLayout';

export function StopClickingAround() {
  return (
    <BlogLayout
      title="Stop Clicking Around: Why Your On-Call Configuration Belongs in Git"
      date="January 2025"
      category="Infrastructure as Code"
      readTime="8 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        Every time you click through a UI to update an on-call schedule, you're creating configuration drift
        that will haunt you at 3am. Here's why your on-call config deserves the same treatment as your infrastructure.
      </p>

      <h2>The Hidden Cost of Point-and-Click Configuration</h2>

      <p>
        Picture this: It's 2am, and your production database is throwing errors. You're pretty sure Sarah
        is on-call this week, but when you check the schedule, it shows Mike. Someone changed it last Friday—
        no one remembers who or why. There's no audit trail, no PR to review, no way to know what the schedule
        was supposed to be.
      </p>

      <p>
        This isn't a hypothetical. It happens every week at companies that manage on-call through web UIs.
        And it's entirely preventable.
      </p>

      <div className="bg-slate-100 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-slate-900 mb-2">The fundamental problem:</p>
        <p className="text-slate-700">
          When configuration lives in a database behind a UI, it exists outside your software development lifecycle.
          No version control. No code review. No rollback. No audit trail worth trusting.
        </p>
      </div>

      <h2>What "Configuration as Code" Actually Means</h2>

      <p>
        Configuration as Code isn't just about storing config files in Git. It's about treating your operational
        configuration with the same rigor you apply to your application code:
      </p>

      <ul>
        <li><strong>Version control</strong> — Every change is tracked, attributed, and reversible</li>
        <li><strong>Code review</strong> — Changes require approval before they go live</li>
        <li><strong>Testing</strong> — Validate configuration before applying it</li>
        <li><strong>Automation</strong> — Deploy configuration through CI/CD, not manual processes</li>
        <li><strong>Documentation</strong> — The code IS the documentation</li>
      </ul>

      <h2>Terraform: The Right Tool for the Job</h2>

      <p>
        Terraform has become the lingua franca of infrastructure management for good reason. It's declarative,
        it has a robust state management system, and it handles the complexity of partial failures gracefully.
      </p>

      <p>
        Here's what an on-call schedule looks like in Terraform:
      </p>

      <pre><code className="language-hcl">{`resource "oncallshift_schedule" "platform_primary" {
  name        = "Platform Team - Primary"
  description = "Primary on-call rotation for platform services"
  timezone    = "America/New_York"

  rotation {
    type       = "weekly"
    start_time = "09:00"

    participants = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.carol.id,
    ]
  }

  # Holiday coverage override
  override {
    start = "2025-12-24T00:00:00Z"
    end   = "2025-12-26T00:00:00Z"
    user  = oncallshift_user.volunteer_dan.id
  }
}`}</code></pre>

      <p>
        This isn't just configuration—it's <em>self-documenting</em> configuration. Anyone can read this and
        understand exactly what the schedule does. When Dan volunteers for holiday coverage next year, you'll
        see it in the Git history.
      </p>

      <h2>The GitOps Workflow</h2>

      <p>
        Once your on-call configuration lives in Git, you can apply GitOps principles:
      </p>

      <ol>
        <li><strong>Branch</strong> — Create a feature branch for your change</li>
        <li><strong>Commit</strong> — Make your configuration change</li>
        <li><strong>PR</strong> — Open a pull request with the proposed changes</li>
        <li><strong>Review</strong> — Team reviews the change (especially important for schedule changes!)</li>
        <li><strong>Plan</strong> — CI runs <code>terraform plan</code> and posts the diff as a PR comment</li>
        <li><strong>Merge</strong> — After approval, merge to main</li>
        <li><strong>Apply</strong> — CD runs <code>terraform apply</code> automatically</li>
      </ol>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">Real benefit:</p>
        <p className="text-green-800">
          When Alice opens a PR to change the schedule, Bob sees it. He can comment "Hey, I'm actually on
          vacation that week." This conversation happens BEFORE the change goes live, not after the
          incident at 3am.
        </p>
      </div>

      <h2>What About Emergency Changes?</h2>

      <p>
        "But what if I need to change something RIGHT NOW during an incident?"
      </p>

      <p>
        Good question. The answer isn't to abandon IaC—it's to make your IaC workflow fast enough for emergencies:
      </p>

      <ul>
        <li><strong>Fast CI</strong> — Your plan/apply should complete in under 2 minutes</li>
        <li><strong>Expedited review</strong> — Have a process for emergency approvals</li>
        <li><strong>CLI fallback</strong> — <code>ocs schedule override add</code> for truly urgent changes</li>
        <li><strong>Reconciliation</strong> — CLI changes get reconciled back to Terraform</li>
      </ul>

      <p>
        The goal isn't to slow down emergencies—it's to make non-emergencies go through proper process.
      </p>

      <h2>Drift Detection: Trust But Verify</h2>

      <p>
        Even with the best intentions, configuration drift happens. Someone uses the UI "just this once."
        Someone makes a CLI change and forgets to update Terraform.
      </p>

      <p>
        That's why drift detection matters:
      </p>

      <pre><code className="language-bash">{`# Run daily in CI
terraform plan -detailed-exitcode

# Exit code 2 means drift detected
if [ $? -eq 2 ]; then
  alert "Configuration drift detected in on-call config"
fi`}</code></pre>

      <p>
        Catch drift before it causes problems. Either update Terraform to match reality, or apply Terraform
        to fix the drift—but make a conscious decision either way.
      </p>

      <h2>Getting Started</h2>

      <p>
        If you're currently managing on-call through a web UI, here's how to transition:
      </p>

      <ol>
        <li><strong>Export current state</strong> — Most platforms support JSON/CSV export</li>
        <li><strong>Generate Terraform</strong> — Write (or generate) Terraform resources matching current config</li>
        <li><strong>Import</strong> — Use <code>terraform import</code> to adopt existing resources</li>
        <li><strong>Verify</strong> — Run <code>terraform plan</code>—should show no changes</li>
        <li><strong>Lock the UI</strong> — Restrict UI access to read-only where possible</li>
        <li><strong>Train the team</strong> — Document the new workflow</li>
      </ol>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">Pro tip:</p>
        <p className="text-blue-800">
          Start with a single team or schedule. Prove the workflow works before rolling out broadly.
          Success stories spread faster than mandates.
        </p>
      </div>

      <h2>The Lazy DevOps Philosophy</h2>

      <p>
        Being a "lazy" DevOps engineer doesn't mean being slow or careless. It means being so well-prepared
        that you don't have to think during incidents. It means automation handles the routine so you can
        focus on the exceptional.
      </p>

      <p>
        When your on-call configuration is code:
      </p>

      <ul>
        <li>New team member? Add them to the Terraform config, PR, merge, done.</li>
        <li>Schedule audit? <code>git log</code></li>
        <li>Rollback a bad change? <code>git revert</code></li>
        <li>Replicate to new environment? <code>terraform apply</code></li>
      </ul>

      <p>
        Stop clicking around. Start committing.
      </p>
    </BlogLayout>
  );
}
