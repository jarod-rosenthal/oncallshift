import { BlogLayout } from './BlogLayout';

export function WhenTeamsStopTrusting() {
  return (
    <BlogLayout
      title="The Deafening Silence: What Happens When Your Team Stops Trusting Alerts"
      date="January 2025"
      category="Team Health"
      readTime="8 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        The scariest moment in incident management isn't the alert that fires.
        It's the alert that fires and no one responds because everyone assumed it was noise.
      </p>

      <h2>The Quiet Disaster</h2>

      <p>
        I've seen it happen three times in my career. Each time, it followed the same pattern:
      </p>

      <ol>
        <li>Alert fatigue builds over months</li>
        <li>Team develops "acknowledge and ignore" reflexes</li>
        <li>A real incident happens during a noisy period</li>
        <li>The alert is lost in the noise—or acknowledged without action</li>
        <li>Hours pass before someone notices</li>
      </ol>

      <p>
        The damage isn't just the incident itself. It's the realization that your alerting
        system—the thing designed to protect you—has become background noise.
      </p>

      <h2>The Trust Erosion Cycle</h2>

      <p>
        Trust in alerting systems erodes gradually, then collapses suddenly:
      </p>

      <div className="bg-slate-100 rounded-lg p-6 my-8">
        <p className="font-mono text-sm">
          <span className="text-green-600">Phase 1: Trust</span><br/>
          Alert fires → Engineer investigates → Takes action → Resolves issue<br/><br/>

          <span className="text-amber-600">Phase 2: Skepticism</span><br/>
          Alert fires → Engineer checks → "Probably fine" → Acknowledges without action<br/><br/>

          <span className="text-red-600">Phase 3: Cynicism</span><br/>
          Alert fires → Auto-acknowledge → No investigation → Hope it resolves itself<br/><br/>

          <span className="text-slate-600">Phase 4: Learned Helplessness</span><br/>
          Alert fires → Muted channel → "Alerts are useless here"
        </p>
      </div>

      <p>
        By Phase 4, you don't have an alerting system. You have an expensive notification
        generator that everyone ignores.
      </p>

      <h2>Signs Your Team Has Lost Trust</h2>

      <p>
        Watch for these warning signals:
      </p>

      <ul>
        <li><strong>Batch acknowledgments</strong> — Multiple alerts acknowledged in seconds</li>
        <li><strong>Slack jokes</strong> — "lol not this again" when alerts fire</li>
        <li><strong>Muted channels</strong> — Alert channels have no engagement</li>
        <li><strong>Workarounds</strong> — Teams build their own monitoring instead of fixing alerts</li>
        <li><strong>Incident post-mortems</strong> — "The alert fired but we didn't notice"</li>
        <li><strong>MTTA spikes</strong> — Time-to-acknowledge creeping up</li>
      </ul>

      <h2>The Recovery Process</h2>

      <p>
        Rebuilding trust requires systematic effort. Here's the process that's worked for me:
      </p>

      <h3>Step 1: The Alert Amnesty (Week 1)</h3>

      <p>
        Declare an alert amnesty. For one week:
      </p>

      <ul>
        <li>Every alert that fires gets reviewed</li>
        <li>Noise alerts get immediately deleted or demoted to logs</li>
        <li>No new alerts get added</li>
        <li>The goal is reduction, not optimization</li>
      </ul>

      <p>
        Most teams can eliminate 50-70% of alerts in this first pass. These are the alerts
        everyone knew were noise but no one had time to fix.
      </p>

      <h3>Step 2: The Page Audit (Week 2)</h3>

      <p>
        Review the remaining alerts with this criteria:
      </p>

      <pre><code className="language-text">{`For each alert, ask:

1. What action should be taken when this fires?
   → If no clear action, demote to dashboard/log

2. Does this need immediate human attention?
   → If it can wait, downgrade severity

3. Is this alert ever ignored?
   → If yes, either fix or remove

4. When did this alert last fire for a real issue?
   → If never, remove it`}</code></pre>

      <h3>Step 3: The Runbook Requirement (Week 3)</h3>

      <p>
        Every remaining alert must have:
      </p>

      <ul>
        <li>A runbook explaining what to do when it fires</li>
        <li>Context about why this matters</li>
        <li>Links to relevant dashboards</li>
        <li>Expected resolution steps</li>
      </ul>

      <p>
        If you can't write a runbook for an alert, you probably shouldn't have the alert.
      </p>

      <h3>Step 4: The Weekly Review (Ongoing)</h3>

      <p>
        Every week, review:
      </p>

      <ul>
        <li>Alerts that fired but required no action</li>
        <li>Time-to-acknowledge trends</li>
        <li>Any patterns in alert timing or frequency</li>
        <li>Team feedback on specific alerts</li>
      </ul>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">The trust metric:</p>
        <p className="text-green-800">
          Calculate your "actionable rate": alerts that required action / total alerts.
          Aim for &gt;70%. If you're below 50%, you have a trust problem.
        </p>
      </div>

      <h2>Preventing Future Erosion</h2>

      <p>
        Once you've rebuilt trust, protect it:
      </p>

      <h3>Alert Gates</h3>

      <p>
        Every new alert must pass review:
      </p>

      <ol>
        <li>What is the actionable response?</li>
        <li>Who should be paged?</li>
        <li>What's the threshold and why?</li>
        <li>Is there a runbook?</li>
        <li>How will we know if this alert becomes noise?</li>
      </ol>

      <h3>Noise Budgets</h3>

      <p>
        Set a limit on false positives:
      </p>

      <pre><code className="language-yaml">{`# Example noise budget policy
alerts:
  max_false_positive_rate: 0.2  # 20% max noise
  review_threshold: 5           # Review after 5 fires with no action
  auto_disable_threshold: 10    # Auto-disable after 10 ignored alerts`}</code></pre>

      <h3>Regular Pruning</h3>

      <p>
        Schedule quarterly alert audits. Ask:
      </p>

      <ul>
        <li>Do we still need this alert?</li>
        <li>Is the threshold still appropriate?</li>
        <li>Has the system changed in ways that make this obsolete?</li>
        <li>Is anyone ignoring this?</li>
      </ul>

      <h2>The Cultural Component</h2>

      <p>
        Technical fixes aren't enough. You also need cultural change:
      </p>

      <ul>
        <li><strong>No shame for escalation</strong> — It's okay to say "I don't know what to do with this alert"</li>
        <li><strong>Ownership</strong> — Alert creators are responsible for alert quality</li>
        <li><strong>Feedback loops</strong> — Make it easy to report noisy alerts</li>
        <li><strong>Celebrate improvements</strong> — Removing a noisy alert is a win, not a failure</li>
      </ul>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The standard:</p>
        <p className="text-blue-800">
          If an alert wakes someone up at 3am, there should be something wrong that requires
          immediate human intervention. Every false positive at 3am costs trust that takes
          weeks to rebuild.
        </p>
      </div>

      <h2>The Recovery Timeline</h2>

      <p>
        Rebuilding trust takes time:
      </p>

      <ul>
        <li><strong>Week 1-2</strong> — Initial cleanup, skepticism remains high</li>
        <li><strong>Week 3-4</strong> — Team notices fewer false positives</li>
        <li><strong>Month 2</strong> — Acknowledge times start improving</li>
        <li><strong>Month 3</strong> — Team starts trusting pages again</li>
        <li><strong>Month 6</strong> — New normal established, alerts are actionable</li>
      </ul>

      <p>
        It took months or years to erode trust. It takes months to rebuild it. There's no shortcut.
      </p>

      <h2>The Real Cost</h2>

      <p>
        When I think about the incidents caused by ignored alerts, the cost isn't just the
        downtime or revenue loss. It's the engineer who feels guilty for not responding. It's
        the team that loses confidence in their ability to detect problems. It's the culture
        of cynicism that spreads when people feel like their tools don't work.
      </p>

      <p>
        Your alerting system is a promise: "When something is wrong, I'll tell you."
        Break that promise enough times, and no one believes you anymore.
      </p>

      <p>
        Keep that promise, and your team will respond at 3am without hesitation, knowing
        that if the page came in, it matters.
      </p>
    </BlogLayout>
  );
}
