import { BlogLayout } from './BlogLayout';

export function BuildingReflexes() {
  return (
    <BlogLayout
      title="The Incident Response Playbook: Building Reflexes, Not Procedures"
      date="January 2025"
      category="Preparation"
      readTime="11 min read"
    >
      <p className="lead text-xl text-slate-600 mb-8">
        When your database is melting at 3am, you don't have time to read documentation.
        You need muscle memory. Here's how to build incident response reflexes that work when your brain doesn't.
      </p>

      <h2>The 3am Brain Problem</h2>

      <p>
        At 3am, your cognitive capacity is roughly 60% of your daytime peak. Your working memory
        is impaired. Your decision-making is slower. Complex reasoning is nearly impossible.
      </p>

      <p>
        This is exactly when incidents happen.
      </p>

      <p>
        Procedures help, but procedures require reading. Reading requires focus. Focus at 3am is
        a scarce resource. What you need instead are reflexes—actions so ingrained that you perform
        them automatically.
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-600 p-6 my-8">
        <p className="font-semibold text-amber-900 mb-2">The uncomfortable truth:</p>
        <p className="text-amber-800">
          If you're figuring out what to do during an incident, you've already failed the preparation
          phase. The time for thinking is before the incident, not during.
        </p>
      </div>

      <h2>The Three Layers of Preparedness</h2>

      <h3>Layer 1: Muscle Memory (Seconds)</h3>

      <p>
        These are the things you do without thinking:
      </p>

      <ul>
        <li>Acknowledge the page (within 30 seconds)</li>
        <li>Open the incident (your CLI alias or browser shortcut)</li>
        <li>Check the basics: what service, what symptoms, who else is paged</li>
        <li>Start communicating: "Looking at INC-1234, will update in 5"</li>
      </ul>

      <p>
        These should be automatic. Practice them until you can do them half-asleep. Because you will.
      </p>

      <h3>Layer 2: Runbook Execution (Minutes)</h3>

      <p>
        Once you're oriented, the runbook takes over. Good runbooks are:
      </p>

      <ul>
        <li><strong>Scannable</strong> — Headers, bullet points, no walls of text</li>
        <li><strong>Copy-pasteable</strong> — Commands you can run without modification</li>
        <li><strong>Decision trees</strong> — "If X, do Y. If not X, do Z."</li>
        <li><strong>Exit criteria</strong> — "The incident is resolved when..."</li>
      </ul>

      <pre><code className="language-markdown">{`# Database Connection Exhaustion

## Quick Check
\`\`\`bash
psql -c "SELECT count(*) FROM pg_stat_activity;"
# Normal: < 80 | Warning: 80-95 | Critical: > 95
\`\`\`

## If connections > 95:
1. Identify the source:
   \`\`\`bash
   psql -c "SELECT client_addr, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC LIMIT 5;"
   \`\`\`

2. If one client dominates:
   - Check that service's logs for connection leaks
   - Consider restarting that service (see: Service Restart Runbook)

3. If distributed across clients:
   - Likely a traffic spike
   - Scale up connection pool (terraform apply -target=...)
   - Consider read replicas for read traffic

## Resolution Criteria
- Connections below 80
- Error rate returned to baseline
- No customer-facing impact`}</code></pre>

      <h3>Layer 3: Problem Solving (Longer)</h3>

      <p>
        When the runbook doesn't cover the situation, you need actual thinking. But you can
        still prepare for this:
      </p>

      <ul>
        <li><strong>Mental models</strong> — Understand how your systems fail</li>
        <li><strong>Investigation patterns</strong> — Know where to look for different symptom types</li>
        <li><strong>Escalation paths</strong> — Know who to call for what expertise</li>
        <li><strong>Communication templates</strong> — Have status update formats ready</li>
      </ul>

      <h2>Dry Runs: Practice for the Real Thing</h2>

      <p>
        You wouldn't expect a pilot to fly an emergency without practicing in a simulator.
        Why do we expect engineers to handle production incidents without practice?
      </p>

      <h3>The Weekly Chaos Exercise</h3>

      <p>
        Pick a time slot during business hours. Run a simulated incident:
      </p>

      <ol>
        <li><strong>Scenario</strong> — "The API is returning 500s to 10% of requests"</li>
        <li><strong>Page</strong> — Send a test page to the on-call</li>
        <li><strong>Response</strong> — Follow the actual incident process</li>
        <li><strong>Investigation</strong> — Use real tools, fake symptoms</li>
        <li><strong>Resolution</strong> — Practice the resolution steps</li>
        <li><strong>Debrief</strong> — What went well? What was confusing?</li>
      </ol>

      <div className="bg-green-50 border-l-4 border-green-600 p-6 my-8">
        <p className="font-semibold text-green-900 mb-2">The key insight:</p>
        <p className="text-green-800">
          Dry runs aren't about finding bugs. They're about building muscle memory. The more
          times you practice the response, the more automatic it becomes.
        </p>
      </div>

      <h3>Tabletop Exercises</h3>

      <p>
        For more complex scenarios, run tabletop exercises:
      </p>

      <pre><code className="language-text">{`SCENARIO: Major Payment Outage

Context:
- It's Friday 4pm
- You're about to ship a big release
- Payment processing is completely down
- Customer support is getting flooded

Questions to walk through:
1. Who needs to be involved?
2. What's our communication plan to customers?
3. Do we roll back the pending release?
4. What are our database rollback options?
5. How do we handle the transaction backlog?
6. What's our estimated timeline to resolution?

No computers. Just discussion. Build the mental model.`}</code></pre>

      <h2>The First Five Minutes</h2>

      <p>
        The first five minutes of an incident set the tone. Here's a checklist that should
        become automatic:
      </p>

      <pre><code className="language-markdown">{`## First Five Minutes Checklist

☐ Acknowledge the page (< 30 seconds)
☐ Open incident in browser/CLI
☐ Quick scan: what service, what symptoms
☐ Post in incident channel: "Looking at INC-XXX, will update in 5"
☐ Check: is this affecting customers?
☐ Check: is anyone else already working on this?
☐ Pull up relevant dashboards
☐ Locate the runbook
☐ Make a call: can I handle this or need to escalate?

If escalating:
☐ Page the appropriate person/team
☐ Brief them: "Service X is doing Y, I've tried Z"
☐ Stay available to assist`}</code></pre>

      <h2>Communication Templates</h2>

      <p>
        Don't craft messages during an incident. Have templates ready:
      </p>

      <h3>Initial Status Update</h3>

      <pre><code className="language-text">{`🔴 INCIDENT: [Brief description]

Impact: [What's affected, who's affected]
Status: Investigating
Current actions: [What we're doing]
Next update: [Time]

Incident commander: @you`}</code></pre>

      <h3>Progress Update</h3>

      <pre><code className="language-text">{`🟡 UPDATE: [Incident name]

Progress: [What we've learned/done]
Current theory: [What we think is happening]
Next steps: [What we're doing next]
Next update: [Time]`}</code></pre>

      <h3>Resolution</h3>

      <pre><code className="language-text">{`🟢 RESOLVED: [Incident name]

Root cause: [Brief explanation]
Fix applied: [What we did]
Duration: [Start to end]
Monitoring: [Are we watching for recurrence?]

Follow-up: [Post-mortem scheduled for X]`}</code></pre>

      <h2>Building Your Reflex Library</h2>

      <p>
        Track the reflexes you need to build:
      </p>

      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Trigger</th>
            <th className="border p-2 text-left">Reflex</th>
            <th className="border p-2 text-left">Practice Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">Phone buzzes with page</td>
            <td className="border p-2">Ack, open incident, post "investigating"</td>
            <td className="border p-2">Automatic</td>
          </tr>
          <tr>
            <td className="border p-2">500 error spike</td>
            <td className="border p-2">Check deployment history, check dependencies</td>
            <td className="border p-2">Needs practice</td>
          </tr>
          <tr>
            <td className="border p-2">Database slow</td>
            <td className="border p-2">Check connections, check slow queries</td>
            <td className="border p-2">Automatic</td>
          </tr>
          <tr>
            <td className="border p-2">Memory alert</td>
            <td className="border p-2">Check top processes, check for leaks</td>
            <td className="border p-2">Needs practice</td>
          </tr>
          <tr>
            <td className="border p-2">Unsure what to do</td>
            <td className="border p-2">Escalate, brief the expert, assist</td>
            <td className="border p-2">Automatic</td>
          </tr>
        </tbody>
      </table>

      <h2>The 80% Solution</h2>

      <p>
        You can't prepare for every scenario. But you can prepare for the 80% that happen
        most frequently:
      </p>

      <ol>
        <li><strong>Review incident history</strong> — What incidents have we had?</li>
        <li><strong>Categorize</strong> — What are the common patterns?</li>
        <li><strong>Prioritize</strong> — What 5 scenarios cover 80% of incidents?</li>
        <li><strong>Document</strong> — Write runbooks for each</li>
        <li><strong>Practice</strong> — Dry run each one quarterly</li>
      </ol>

      <p>
        For the remaining 20%, you rely on fundamentals: investigation skills, communication
        patterns, and knowing when to escalate.
      </p>

      <h2>The Preparation Mindset</h2>

      <p>
        This isn't about being paranoid. It's about being lazy in the right way:
      </p>

      <ul>
        <li><strong>Lazy at 3am</strong> — Because you prepared during business hours</li>
        <li><strong>Lazy during incidents</strong> — Because the runbook tells you what to do</li>
        <li><strong>Lazy during resolution</strong> — Because the templates are ready</li>
      </ul>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
        <p className="font-semibold text-blue-900 mb-2">The lazy DevOps philosophy:</p>
        <p className="text-blue-800">
          Work hard on preparation so you can be lazy during incidents. The 3am version of
          you shouldn't have to think—just execute.
        </p>
      </div>

      <h2>Start This Week</h2>

      <ol>
        <li><strong>Today</strong> — Write down the last 3 incidents and what you did</li>
        <li><strong>Tomorrow</strong> — Create/update runbooks for those scenarios</li>
        <li><strong>This week</strong> — Run one dry run with your team</li>
        <li><strong>This month</strong> — Build the first-five-minutes habit</li>
        <li><strong>This quarter</strong> — Review and practice your top 5 scenarios</li>
      </ol>

      <p>
        The goal isn't perfection. The goal is that when the page comes at 3am, your hands
        know what to do even when your brain is still booting up.
      </p>
    </BlogLayout>
  );
}
