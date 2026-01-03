import { BlogLayout } from './BlogLayout';

export function AlertFatigueSystemDesign() {
  return (
    <BlogLayout
      title="Alert Fatigue Is a System Design Problem, Not a Tuning Problem"
      date="January 2025"
      category="Architecture"
      readTime="9 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        You can't tune your way out of bad architecture. If your system generates too many alerts,
        the problem isn't your thresholds—it's your system.
      </p>

      <h2>The Tuning Trap</h2>

      <p>
        I've seen this pattern dozens of times: A team is drowning in alerts. They decide to "fix"
        the problem by adjusting thresholds. CPU alert at 80%? Raise it to 90%. Still too noisy?
        Raise it to 95%. Error rate alert firing? Increase the minimum error count.
      </p>

      <p>
        Six months later, they've tuned their way into a corner. Thresholds are so high that real
        problems slip through. They add more alerts to catch the gaps. Now they're back where they
        started, with even more complexity.
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-600 p-6 my-8">
        <p className="font-semibold text-amber-900 mb-2">The uncomfortable truth:</p>
        <p className="text-amber-800">
          If you're constantly tuning alerts, you're treating symptoms. The disease is a system
          that's inherently unstable, poorly observable, or fundamentally noisy.
        </p>
      </div>

      <h2>Noisy Alerts Are Symptoms</h2>

      <p>
        When an alert fires frequently without requiring action, it's telling you something:
      </p>

      <ul>
        <li><strong>Flapping services</strong> → Your health checks are too sensitive, or your service genuinely bounces</li>
        <li><strong>Threshold breaches</strong> → Your capacity is too close to demand</li>
        <li><strong>Transient errors</strong> → Your retry logic isn't working, or your dependencies are unstable</li>
        <li><strong>Metric spikes</strong> → Your system has unpredictable load patterns you haven't accounted for</li>
      </ul>

      <p>
        Each of these is a system design problem masquerading as a monitoring problem.
      </p>

      <h2>Example: The Deployment Alert Storm</h2>

      <p>
        A team I worked with had a recurring problem: every deployment triggered a cascade of alerts.
        Error rates spiked, latency went up, health checks failed temporarily. They added deployment
        annotations and suppression windows.
      </p>

      <p>
        The real problem? Their deployments weren't graceful:
      </p>

      <ul>
        <li>No connection draining before shutdown</li>
        <li>Cold starts taking 30+ seconds</li>
        <li>No gradual traffic shift</li>
        <li>Health checks passing before the app was truly ready</li>
      </ul>

      <p>
        The fix wasn't better alert suppression—it was better deployments:
      </p>

      <pre><code className="language-yaml">{`# Kubernetes deployment with proper graceful handling
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: app
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]  # Allow LB to drain
          readinessProbe:
            httpGet:
              path: /health/ready  # Not just "alive" but "ready for traffic"
            initialDelaySeconds: 30
            periodSeconds: 5`}</code></pre>

      <p>
        After fixing the deployment process, alert suppression became unnecessary. The alerts
        stopped firing because there was nothing to alert on.
      </p>

      <h2>The Retry Gap</h2>

      <p>
        Another common source of alert noise: transient failures that aren't handled gracefully.
      </p>

      <pre><code className="language-javascript">{`// BAD: One failure = one alert
try {
  await callDependency();
} catch (error) {
  metrics.increment('dependency_error');  // This fires an alert
  throw error;
}

// BETTER: Retry with backoff, alert on persistent failure
const result = await retry(
  () => callDependency(),
  {
    retries: 3,
    backoff: 'exponential',
    onRetry: () => metrics.increment('dependency_retry')
  }
);

// Only increment error metric if ALL retries failed
if (!result.success) {
  metrics.increment('dependency_error_persistent');
}`}</code></pre>

      <p>
        Now your alert fires only for persistent failures, not transient network blips.
      </p>

      <h2>Circuit Breakers: Preventing Cascade</h2>

      <p>
        When a dependency fails, a poorly designed system turns one alert into many:
      </p>

      <pre><code className="language-text">{`Dependency X fails
  → Service A gets errors (alert)
    → Service B gets errors (alert)
      → Service C gets errors (alert)
        → Service D gets errors (alert)
          → ...`}</code></pre>

      <p>
        Circuit breakers stop the cascade:
      </p>

      <pre><code className="language-javascript">{`const circuitBreaker = new CircuitBreaker(callDependency, {
  failureThreshold: 5,     // Open after 5 failures
  resetTimeout: 30000,     // Try again after 30s
  volumeThreshold: 10,     // Minimum calls before opening
});

// When circuit is open:
// - Calls fail immediately (no waiting for timeout)
// - No cascade of errors
// - One alert for the circuit opening, not N alerts for N failures`}</code></pre>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">Alert on the circuit, not the errors:</p>
        <p className="text-green-800">
          Instead of alerting on error rate, alert when the circuit opens. One alert tells you
          the dependency is down. When it closes, you know it's recovered.
        </p>
      </div>

      <h2>Capacity: The Hidden Alert Source</h2>

      <p>
        If your system is running at 70% capacity normally, any traffic spike will push you
        into the alert zone. This isn't an alerting problem—it's a capacity planning problem.
      </p>

      <p>
        The fix:
      </p>

      <ul>
        <li><strong>Auto-scaling</strong> — Scale before you hit thresholds</li>
        <li><strong>Headroom</strong> — Maintain at least 50% headroom for spikes</li>
        <li><strong>Load shedding</strong> — Gracefully degrade under extreme load</li>
        <li><strong>Rate limiting</strong> — Protect your system from runaway clients</li>
      </ul>

      <pre><code className="language-yaml">{`# Scale based on queue depth, not CPU
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker
spec:
  metrics:
    - type: External
      external:
        metric:
          name: sqs_queue_depth
          selector:
            matchLabels:
              queue: work-queue
        target:
          type: AverageValue
          averageValue: 100  # One worker per 100 messages`}</code></pre>

      <h2>The Observability Pyramid</h2>

      <p>
        Good observability reduces alert noise by providing better signals:
      </p>

      <pre><code className="language-text">{`                    /\\
                   /  \\
                  /Alert\\        ← Few, high-signal
                 /--------\\
                / Dashboard \\    ← Team health overview
               /--------------\\
              /    Logging      \\  ← Investigation
             /------------------\\
            /     Tracing         \\  ← Root cause
           /------------------------\\`}</code></pre>

      <p>
        If you're alerting on low-level metrics, you're using alerts for investigation.
        That's the job of logs and traces.
      </p>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Signal Type</th>
            <th className="border p-2 text-left">Purpose</th>
            <th className="border p-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">Alerts</td>
            <td className="border p-2">Something is broken, act now</td>
            <td className="border p-2">"Checkout success rate &lt; 95%"</td>
          </tr>
          <tr>
            <td className="border p-2">Dashboards</td>
            <td className="border p-2">Is everything healthy?</td>
            <td className="border p-2">Service health overview</td>
          </tr>
          <tr>
            <td className="border p-2">Logs</td>
            <td className="border p-2">What happened?</td>
            <td className="border p-2">Error details, stack traces</td>
          </tr>
          <tr>
            <td className="border p-2">Traces</td>
            <td className="border p-2">Where is it slow/broken?</td>
            <td className="border p-2">Request flow through services</td>
          </tr>
        </tbody>
      </table>

      <h2>Building Self-Healing Systems</h2>

      <p>
        The ultimate solution to alert fatigue: systems that fix themselves.
      </p>

      <pre><code className="language-yaml">{`# Auto-remediation for common scenarios
on:
  alert: PodCrashLoopBackOff
  service: api
actions:
  - type: restart_pod
    wait: 5m
  - type: increase_memory
    if: oom_killed
    increment: 256Mi
  - type: rollback_deployment
    if: restart_count > 3
  - type: page
    if: all_actions_failed`}</code></pre>

      <p>
        With self-healing:
      </p>

      <ul>
        <li>Transient issues fix themselves without human intervention</li>
        <li>Pages only happen when auto-remediation fails</li>
        <li>Every page represents a genuine novel problem</li>
      </ul>

      <h2>The Design Review Checklist</h2>

      <p>
        Before you tune an alert, ask:
      </p>

      <ol>
        <li><strong>Why does this condition happen?</strong> — Understand the root cause</li>
        <li><strong>Can the system handle this gracefully?</strong> — Add resilience</li>
        <li><strong>Can the system fix this automatically?</strong> — Add self-healing</li>
        <li><strong>If we must alert, what action should be taken?</strong> — Document the runbook</li>
        <li><strong>Can we prevent this in the future?</strong> — Address architectural issues</li>
      </ol>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The goal:</p>
        <p className="text-blue-800">
          A well-designed system shouldn't need many alerts. Most operational conditions should
          be handled automatically. Alerts exist for truly exceptional situations that require
          human judgment.
        </p>
      </div>

      <h2>Start With the Noisiest Alert</h2>

      <p>
        Pick your single noisiest alert. Before touching thresholds, ask:
      </p>

      <ul>
        <li>What system behavior causes this alert to fire?</li>
        <li>Is that behavior expected or a bug?</li>
        <li>If expected, can the system handle it differently?</li>
        <li>If a bug, can we fix the underlying issue?</li>
      </ul>

      <p>
        You might find that fixing the underlying system eliminates the need for the alert entirely.
        That's not just reducing noise—that's actually making things better.
      </p>
    </BlogLayout>
  );
}
