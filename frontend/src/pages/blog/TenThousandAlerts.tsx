import { BlogLayout } from './BlogLayout';

export function TenThousandAlerts() {
  return (
    <BlogLayout
      title="I've Acknowledged 10,000 Alerts. Here's What I Learned About Signal vs. Noise"
      date="January 2025"
      category="Alert Fatigue"
      readTime="10 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        After 15 years of carrying pagers and phones, I've clicked "acknowledge" more times than
        I can count. Most of those clicks were unnecessary. Here's what actually matters.
      </p>

      <h2>The Alert That Changed Everything</h2>

      <p>
        It was 3am on a Tuesday. My phone buzzed with "API latency high" for the 47th time that week.
        I acknowledged it without even looking, muscle memory taking over.
      </p>

      <p>
        Fifteen minutes later, I got another alert: "Payment processing failed." By the time I woke
        up enough to investigate, we'd lost $50,000 in transactions. The latency alert had been the
        canary—the actual outage was hiding behind a wall of noise.
      </p>

      <p>
        That was the night I realized: <strong>most of our alerts weren't protecting us. They were
        training us to ignore problems.</strong>
      </p>

      <h2>The 90/10 Rule of Alerting</h2>

      <p>
        After analyzing years of alert data across multiple organizations, a pattern emerged:
      </p>

      <ul>
        <li><strong>90% of alerts</strong> resolve themselves or require no action</li>
        <li><strong>9% of alerts</strong> need investigation but aren't urgent</li>
        <li><strong>1% of alerts</strong> are true emergencies that need immediate response</li>
      </ul>

      <p>
        When you're paging someone at 3am for something that's in the 90%, you're spending trust.
        You're teaching them that pages don't matter. And when the 1% happens, they won't be ready.
      </p>

      <div className="bg-red-50 border-l-4 border-red-600 p-6 my-8">
        <p className="font-semibold text-red-900 mb-2">The math doesn't lie:</p>
        <p className="text-red-800">
          If 90% of your alerts are noise, and you get 10 alerts per day, you're training your team
          to ignore 9 alerts daily. After a month, they've learned to ignore 270 "false" alarms.
          The real emergency becomes just another notification.
        </p>
      </div>

      <h2>What Makes an Alert Actionable</h2>

      <p>
        Every alert should answer these questions immediately:
      </p>

      <ol>
        <li><strong>What's happening?</strong> — Not "error count high" but "Payment API returning 500s to 23% of requests"</li>
        <li><strong>Who's affected?</strong> — "North America customers" vs "internal batch job"</li>
        <li><strong>What should I do?</strong> — Link to the runbook, show the relevant dashboard</li>
        <li><strong>How urgent is this?</strong> — Page-worthy vs can wait until morning</li>
      </ol>

      <p>
        An alert that doesn't answer these questions forces the on-call engineer to investigate
        before deciding if it's real. That's cognitive load at the worst possible time.
      </p>

      <h2>The Alerts I Stopped Sending</h2>

      <p>
        Here are alert patterns that seem reasonable but usually create noise:
      </p>

      <h3>CPU/Memory "High" Alerts</h3>

      <pre><code className="language-yaml">{`# BAD: This will page for normal traffic spikes
- alert: HighCPU
  expr: cpu_usage > 80
  for: 5m

# BETTER: Alert on sustained resource exhaustion
- alert: CPUExhaustion
  expr: cpu_usage > 95 for 15m AND error_rate > baseline

# BEST: Alert on the symptom, not the resource
- alert: RequestLatencyDegraded
  expr: p99_latency > 500ms for 10m`}</code></pre>

      <h3>Error Count Thresholds</h3>

      <pre><code className="language-yaml">{`# BAD: Absolute thresholds don't scale with traffic
- alert: HighErrorCount
  expr: error_count > 100

# BETTER: Error rate with baseline comparison
- alert: ElevatedErrorRate
  expr: error_rate > (avg_error_rate_7d * 3) AND error_count > 10

# BEST: Error rate with user impact
- alert: UserImpactingErrors
  expr: |
    (errors_affecting_users / total_requests) > 0.01
    AND errors_affecting_users > 50`}</code></pre>

      <h3>Dependency "Down" Alerts</h3>

      <pre><code className="language-yaml">{`# BAD: Network blips cause noise
- alert: DatabaseDown
  expr: db_connection_failed == 1

# BETTER: Sustained connection failures
- alert: DatabaseUnavailable
  expr: db_connection_success_rate < 0.5 for 5m

# BEST: Impact on actual service
- alert: DatabaseDependencyDegraded
  expr: requests_failing_due_to_db > 0.1 AND request_count > 100`}</code></pre>

      <h2>The Alert Hygiene Process</h2>

      <p>
        Good alerting isn't a one-time setup. It's an ongoing process:
      </p>

      <h3>Weekly: Alert Review</h3>

      <p>
        Every week, review the alerts from the past 7 days:
      </p>

      <ul>
        <li>How many alerts fired?</li>
        <li>How many required action?</li>
        <li>How many auto-resolved?</li>
        <li>Which alerts fired most frequently?</li>
      </ul>

      <p>
        If an alert fired 10+ times with no action taken, it's a candidate for tuning or removal.
      </p>

      <h3>Monthly: Signal-to-Noise Audit</h3>

      <p>
        Calculate your signal-to-noise ratio:
      </p>

      <pre><code className="language-text">{`Signal-to-Noise = Alerts Requiring Action / Total Alerts

Good:    > 0.5 (more than half require action)
Okay:    0.2 - 0.5 (room for improvement)
Bad:     < 0.2 (your team is ignoring most alerts)`}</code></pre>

      <h3>Quarterly: Alert Effectiveness Review</h3>

      <ul>
        <li>Did any incidents happen that we DIDN'T alert on?</li>
        <li>What signals existed that we missed?</li>
        <li>What new alerts should we add?</li>
        <li>What alerts are obsolete due to architecture changes?</li>
      </ul>

      <h2>The Escalation Philosophy</h2>

      <p>
        Not every alert needs to page someone. Build an escalation hierarchy:
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Severity</th>
            <th className="border p-2 text-left">Action</th>
            <th className="border p-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">P1 - Critical</td>
            <td className="border p-2">Page immediately</td>
            <td className="border p-2">Site completely down</td>
          </tr>
          <tr>
            <td className="border p-2">P2 - High</td>
            <td className="border p-2">Page during business hours, Slack at night</td>
            <td className="border p-2">Payment failures &gt; 5%</td>
          </tr>
          <tr>
            <td className="border p-2">P3 - Medium</td>
            <td className="border p-2">Slack channel, ticket</td>
            <td className="border p-2">Non-critical service degraded</td>
          </tr>
          <tr>
            <td className="border p-2">P4 - Low</td>
            <td className="border p-2">Log only, weekly review</td>
            <td className="border p-2">Batch job slow</td>
          </tr>
        </tbody>
      </table>

      <h2>The Human Cost</h2>

      <p>
        This isn't just about efficiency. Alert fatigue has real human costs:
      </p>

      <ul>
        <li><strong>Sleep disruption</strong> — False alarms at 3am affect performance for days</li>
        <li><strong>Stress</strong> — Constant vigilance is exhausting</li>
        <li><strong>Burnout</strong> — People leave teams with bad on-call</li>
        <li><strong>Cynicism</strong> — "Pages don't matter" becomes cultural</li>
      </ul>

      <p>
        Every noisy alert you eliminate is a small gift to your future self and your teammates.
      </p>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">The standard I hold myself to:</p>
        <p className="text-green-800">
          If I page someone at 3am, I should be able to explain why it couldn't wait until morning.
          If I can't explain it, the alert shouldn't page.
        </p>
      </div>

      <h2>Start Here</h2>

      <p>
        If you're drowning in alerts, start with these three actions:
      </p>

      <ol>
        <li>
          <strong>Export your alert history</strong> — Get data on the last 30 days of alerts
        </li>
        <li>
          <strong>Identify the top 5 noisiest alerts</strong> — These are your quick wins
        </li>
        <li>
          <strong>For each: tune, demote, or delete</strong> — Raise thresholds, change severity, or remove entirely
        </li>
      </ol>

      <p>
        You can improve your signal-to-noise ratio by 50% in a week. Your on-call engineers will notice immediately.
      </p>

      <p>
        Ten thousand alerts taught me this: the best alert is the one you never have to send because
        you fixed the underlying problem. The second best is one that's so clearly actionable that
        the responder knows exactly what to do.
      </p>

      <p>
        Everything else is noise.
      </p>
    </BlogLayout>
  );
}
