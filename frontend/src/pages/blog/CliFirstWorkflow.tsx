import { BlogLayout } from './BlogLayout';

export function CliFirstWorkflow() {
  return (
    <BlogLayout
      title="The CLI-First On-Call Workflow: For Engineers Who Live in the Terminal"
      date="January 2025"
      category="Developer Experience"
      readTime="7 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        You spend all day in the terminal. Why should incident management require a browser?
        Here's how to build a CLI-first on-call workflow.
      </p>

      <h2>The Tab Problem</h2>

      <p>
        It's 2am. Your phone wakes you. You stumble to your laptop, open a browser, log in to
        your incident management platform, wait for it to load, click through three pages to
        find the incident, then finally see what's happening.
      </p>

      <p>
        By the time you're oriented, five minutes have passed. Five minutes that could have
        been five seconds.
      </p>

      <div className="bg-slate-100 rounded-lg p-6 my-8">
        <p className="font-mono text-sm">
          <span className="text-slate-500"># The CLI alternative</span><br/>
          $ ocs incidents list --triggered<br/>
          <span className="text-red-500">INC-1234</span> [P1] API Gateway 500 Errors - 5m ago<br/>
          <br/>
          $ ocs incidents show INC-1234<br/>
          <span className="text-slate-500"># Full context in 2 seconds</span>
        </p>
      </div>

      <h2>Essential CLI Commands</h2>

      <p>
        A good incident CLI should support these workflows:
      </p>

      <h3>Quick Status Check</h3>

      <pre><code className="language-bash">{`# What's happening right now?
$ ocs status

TRIGGERED INCIDENTS (2)
  INC-1234  [P1]  API Gateway 500 Errors           5m ago
  INC-1235  [P2]  Payment processing slow          12m ago

ACKNOWLEDGED INCIDENTS (1)
  INC-1230  [P3]  Batch job delayed               Sarah, 2h ago

ON-CALL NOW
  Primary:   You (until 09:00)
  Secondary: Mike`}</code></pre>

      <h3>Fast Acknowledgment</h3>

      <pre><code className="language-bash">{`# Acknowledge from anywhere
$ ocs incidents ack INC-1234
Incident INC-1234 acknowledged.

# Or ack all triggered for your services
$ ocs incidents ack --mine --triggered
Acknowledged 2 incidents.`}</code></pre>

      <h3>Incident Investigation</h3>

      <pre><code className="language-bash">{`# Full incident details
$ ocs incidents show INC-1234 --with-timeline

Incident INC-1234
  Title:     API Gateway 500 Errors
  Status:    Acknowledged (by you, 30s ago)
  Priority:  P1 - Critical
  Service:   api-gateway
  Created:   2025-01-03 02:15:00 UTC

TIMELINE
  02:15:00  Alert triggered (Datadog: error_rate > 5%)
  02:15:05  Page sent to: you (primary on-call)
  02:15:47  Acknowledged by you

RELATED LOGS (last 5m)
  02:14:52  [ERROR] Connection refused: payments-api:443
  02:14:53  [ERROR] Connection refused: payments-api:443
  ... (23 more similar)

RUNBOOK: https://runbooks.company.com/api-gateway-500`}</code></pre>

      <h3>Quick Actions</h3>

      <pre><code className="language-bash">{`# Add a note
$ ocs incidents note INC-1234 "Investigating payments-api connectivity"
Note added.

# Escalate
$ ocs incidents escalate INC-1234 --reason "Need database expertise"
Escalated to: DBA team

# Resolve
$ ocs incidents resolve INC-1234 --summary "Payments-api pod restarted"
Incident INC-1234 resolved.`}</code></pre>

      <h2>Building Your Shell Aliases</h2>

      <p>
        Make common operations even faster:
      </p>

      <pre><code className="language-bash">{`# ~/.bashrc or ~/.zshrc

# Quick status
alias oncall='ocs status'

# What's on fire?
alias fires='ocs incidents list --triggered --priority P1,P2'

# Acknowledge everything I'm paged for
alias ackall='ocs incidents ack --mine --triggered'

# My current on-call schedule
alias myshift='ocs schedules show --mine'

# Who's on call for a service?
whosoncall() {
  ocs schedules oncall --service "$1"
}

# Quick incident lookup
inc() {
  ocs incidents show "$1" --with-timeline
}`}</code></pre>

      <h3>Integration with fzf</h3>

      <pre><code className="language-bash">{`# Fuzzy-find incidents to act on
alias incpick='ocs incidents list --json | jq -r ".[] | \"\\(.id) [\\(.priority)] \\(.title)\"" | fzf | cut -d" " -f1'

# Ack with fuzzy selection
ackpick() {
  local inc=$(incpick)
  [ -n "$inc" ] && ocs incidents ack "$inc"
}`}</code></pre>

      <h2>Terminal Multiplexer Setup</h2>

      <p>
        When an incident hits, you need multiple views. Here's a tmux layout:
      </p>

      <pre><code className="language-bash">{`# ~/.tmux/incident-mode.sh

#!/bin/bash
# Launch incident investigation layout

tmux new-session -d -s incident

# Pane 1: Incident details (auto-refresh)
tmux send-keys 'watch -n 30 "ocs incidents show $1 --with-timeline"' C-m

# Pane 2: Logs
tmux split-window -h
tmux send-keys 'stern -n production api-gateway' C-m

# Pane 3: Metrics (if you have termgraph or similar)
tmux split-window -v
tmux send-keys 'while true; do ocs metrics service api-gateway; sleep 60; done' C-m

# Focus on main pane
tmux select-pane -t 0

tmux attach-session -t incident`}</code></pre>

      <h2>Notifications in Terminal</h2>

      <p>
        Don't rely on phone-only notifications:
      </p>

      <pre><code className="language-bash">{`# Background incident monitor
ocs watch --triggered --notify terminal &

# This sends desktop notifications for new incidents
# Works with notify-send (Linux), osascript (Mac), or similar

# Or integrate with tmux status bar
# ~/.tmux.conf
set -g status-right '#(ocs incidents count --triggered) fires | #(ocs oncall --short)'`}</code></pre>

      <h2>The Power User Workflow</h2>

      <p>
        Here's what a CLI-first workflow looks like in practice:
      </p>

      <pre><code className="language-text">{`[Phone buzzes - 2:15 AM]

$ oncall                          # 1 second
> 1 triggered incident

$ fires                           # 1 second
> INC-1234 [P1] API Gateway 500 Errors

$ inc INC-1234                    # 2 seconds
> [Full incident details with timeline and logs]

$ ocs incidents ack INC-1234      # 1 second
> Acknowledged.

$ ocs incidents note INC-1234 "Investigating"  # 2 seconds
> Note added.

[investigate in another pane]

$ ocs incidents resolve INC-1234 --summary "Fixed db connection pool"
> Resolved.

Total time: ~30 seconds vs 5+ minutes with web UI`}</code></pre>

      <h2>CI/CD Integration</h2>

      <p>
        The CLI enables automation in your pipelines:
      </p>

      <pre><code className="language-yaml">{`# .github/workflows/deploy.yml
deploy:
  steps:
    - name: Deploy
      run: ./deploy.sh

    - name: Check for related incidents
      run: |
        if ocs incidents list --service api-gateway --status triggered | grep -q .; then
          echo "::warning::Active incidents on api-gateway!"
          ocs incidents list --service api-gateway --status triggered
        fi

    - name: Auto-resolve deployment incidents
      if: success()
      run: |
        ocs incidents list --service api-gateway --triggered --json | \\
          jq -r '.[].id' | \\
          xargs -I {} ocs incidents resolve {} --summary "Fixed by deployment $GITHUB_SHA"`}</code></pre>

      <h2>Building Your Own CLI Extensions</h2>

      <p>
        Wrap the CLI for team-specific workflows:
      </p>

      <pre><code className="language-bash">{`#!/bin/bash
# team-oncall - Team-specific on-call helper

case "$1" in
  "handoff")
    # Generate handoff report
    echo "=== On-Call Handoff ==="
    echo ""
    echo "Active Incidents:"
    ocs incidents list --status triggered,acknowledged
    echo ""
    echo "Resolved Today:"
    ocs incidents list --resolved-after today --status resolved
    echo ""
    echo "Notes from previous shift:"
    ocs notes list --last-shift
    ;;

  "stats")
    # Show on-call stats
    ocs metrics oncall --last 7d
    ;;

  "silence")
    # Silence alerts for maintenance
    ocs maintenance create --service "$2" --duration "$3" --reason "$4"
    ;;

  *)
    echo "Usage: team-oncall {handoff|stats|silence}"
    ;;
esac`}</code></pre>

      <h2>The Keyboard-First Philosophy</h2>

      <p>
        The CLI isn't just faster—it's more reliable:
      </p>

      <ul>
        <li><strong>Works offline</strong> — Cache recent data for degraded connectivity</li>
        <li><strong>Scriptable</strong> — Automate repetitive actions</li>
        <li><strong>Auditable</strong> — Commands in shell history</li>
        <li><strong>Muscle memory</strong> — Same commands at 2am as 2pm</li>
      </ul>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The lazy DevOps principle:</p>
        <p className="text-blue-800">
          If you're doing something manually more than twice, automate it.
          The CLI is your automation foundation.
        </p>
      </div>

      <h2>Getting Started</h2>

      <p>
        Start with three commands:
      </p>

      <ol>
        <li><code>ocs status</code> — Your morning check</li>
        <li><code>ocs incidents ack</code> — Fast acknowledgment</li>
        <li><code>ocs incidents show</code> — Quick investigation</li>
      </ol>

      <p>
        Build aliases as you find patterns. Within a week, you'll wonder how you ever
        managed incidents through a web browser.
      </p>
    </BlogLayout>
  );
}
