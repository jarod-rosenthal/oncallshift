import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function MigrateFromOpsgenie() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-500/5 to-transparent py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>⚠️</span>
              Opsgenie End of Life: April 5, 2027
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Opsgenie Is Sunsetting.
              <br />
              <span className="text-orange-400">You Have Options.</span>
            </h1>

            <p className="text-xl text-slate-400 mb-8">
              Atlassian ends Opsgenie support April 5, 2027. Don't get locked into
              expensive Jira Service Management licenses. Migrate to OnCallShift in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-400 text-slate-950 text-lg px-8 h-12">
                  Join Waitlist
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5">
                  See OnCallShift Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Opsgenie Sunset Timeline</h2>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/5"></div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="md:text-right md:pr-8">
                <div className="inline-block bg-yellow-500/10 text-yellow-400 font-semibold px-3 py-1 rounded text-sm mb-2">
                  June 17, 2025
                </div>
                <h3 className="font-semibold mb-1 text-white">Sales End</h3>
                <p className="text-sm text-slate-400">
                  No new Opsgenie subscriptions can be purchased
                </p>
              </div>
              <div className="hidden md:block"></div>

              <div className="hidden md:block"></div>
              <div className="md:pl-8">
                <div className="inline-block bg-orange-500/10 text-orange-400 font-semibold px-3 py-1 rounded text-sm mb-2">
                  April 5, 2027
                </div>
                <h3 className="font-semibold mb-1 text-white">Support Ends</h3>
                <p className="text-sm text-slate-400">
                  Opsgenie fully decommissioned. Data may be deleted.
                </p>
              </div>

              <div className="md:text-right md:pr-8">
                <div className="inline-block bg-green-500/10 text-green-400 font-semibold px-3 py-1 rounded text-sm mb-2">
                  Today
                </div>
                <h3 className="font-semibold mb-1 text-white">Plan Your Move</h3>
                <p className="text-sm text-slate-400">
                  Start migrating now to avoid last-minute rush
                </p>
              </div>
              <div className="hidden md:block"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Your Migration Options</h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-left bg-white/[0.03] rounded-lg overflow-hidden border border-white/5">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-4 px-6 font-semibold text-white"></th>
                  <th className="py-4 px-6 font-semibold text-slate-500">Jira Service Management</th>
                  <th className="py-4 px-6 font-semibold text-teal-400">OnCallShift</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6 font-medium text-white">Pricing</td>
                  <td className="py-4 px-6 text-slate-400">Higher than Opsgenie</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Similar to Opsgenie</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6 font-medium text-white">Setup complexity</td>
                  <td className="py-4 px-6 text-slate-400">Complex ITSM platform</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Simple, focused tool</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6 font-medium text-white">Migration effort</td>
                  <td className="py-4 px-6 text-slate-400">Manual in many cases</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Automated import</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6 font-medium text-white">Learning curve</td>
                  <td className="py-4 px-6 text-slate-400">Significant (new platform)</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Minimal (similar UX)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-6 font-medium text-white">Vendor lock-in</td>
                  <td className="py-4 px-6 text-slate-400">Atlassian ecosystem</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Open integrations</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-white">AI features</td>
                  <td className="py-4 px-6 text-slate-400">Add-on cost</td>
                  <td className="py-4 px-6 text-green-400 font-medium">Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What we import */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">What We Import</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">👥</div>
                <CardTitle className="text-lg text-white">Teams & Users</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                All your team structures and user accounts, including roles and permissions.
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">📅</div>
                <CardTitle className="text-lg text-white">On-Call Schedules</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                Rotation schedules, layers, restrictions, and handoff times.
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">🔔</div>
                <CardTitle className="text-lg text-white">Escalation Policies</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                Multi-step escalation rules and notification preferences.
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">🔗</div>
                <CardTitle className="text-lg text-white">Integrations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                API keys and webhook configurations for your monitoring tools.
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">📱</div>
                <CardTitle className="text-lg text-white">Notification Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                User notification preferences and contact methods.
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border border-white/5">
              <CardHeader>
                <div className="text-2xl mb-2">📊</div>
                <CardTitle className="text-lg text-white">Services</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                Service definitions and routing configurations.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Migration steps */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8 text-white">Migrate in 3 Simple Steps</h2>

            <div className="space-y-6">
              <div className="flex gap-4 bg-white/[0.03] rounded-lg p-6 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-400 font-bold flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-white">Export from Opsgenie</h3>
                  <p className="text-sm text-slate-400">
                    Use Opsgenie's REST API to export your configuration. We provide
                    a script that handles this automatically.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 bg-white/[0.03] rounded-lg p-6 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-400 font-bold flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-white">Import to OnCallShift</h3>
                  <p className="text-sm text-slate-400">
                    Use our Import Wizard to upload your export. Preview everything
                    before committing. Takes less than 5 minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 bg-white/[0.03] rounded-lg p-6 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-400 font-bold flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-white">Update Integrations</h3>
                  <p className="text-sm text-slate-400">
                    Point your monitoring tools to OnCallShift's webhook endpoints.
                    We're compatible with Opsgenie's API format—minimal changes needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook compatibility */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Zero Integration Changes Required</h2>
          <p className="text-slate-400 mb-8">
            OnCallShift's webhook endpoints are compatible with Opsgenie's API format.
            Just update the URL—your existing payloads work as-is.
          </p>

          <div className="bg-slate-900 rounded-lg p-6 text-left border border-white/5">
            <div className="text-sm text-slate-400 mb-2">Before (Opsgenie)</div>
            <code className="text-green-400 text-sm">
              POST https://api.opsgenie.com/v2/alerts
            </code>

            <div className="text-sm text-slate-400 mb-2 mt-4">After (OnCallShift)</div>
            <code className="text-green-400 text-sm">
              POST https://oncallshift.com/api/v1/webhooks/opsgenie
            </code>

            <div className="text-slate-500 text-xs mt-4">
              Same payload format. Same headers. Just a different URL.
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="bg-teal-500/5 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4 text-slate-500">"</div>
            <p className="text-xl text-slate-300 italic mb-6">
              When we heard Opsgenie was sunsetting, we panicked. OnCallShift's migration
              tool imported everything in under an hour. Our team didn't skip a beat.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 font-semibold">
                AR
              </div>
              <div className="text-left">
                <div className="font-medium text-white">Alex R.</div>
                <div className="text-sm text-slate-500">DevOps Lead, FinTech Startup</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to Migrate?</h2>
          <p className="text-slate-400 mb-8">
            Don't wait until the last minute. Start your migration today and
            give your team time to get comfortable before Opsgenie sunsets.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/register">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-400 text-slate-950 text-lg px-8 h-12">
                Join Waitlist
              </Button>
            </Link>
            <Link to="/company/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5">
                Schedule Migration Consultation
              </Button>
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            Import in minutes · Early access coming soon
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Migration FAQ</h2>

          <div className="max-w-3xl mx-auto space-y-4">
            <details className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <summary className="font-semibold cursor-pointer text-white">
                Can I run OnCallShift and Opsgenie in parallel?
              </summary>
              <p className="text-sm text-slate-400 mt-3">
                Yes! We recommend running both systems in parallel for a week or two
                to ensure everything is working correctly before fully switching over.
              </p>
            </details>

            <details className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <summary className="font-semibold cursor-pointer text-white">
                What if some of my Opsgenie features aren't supported?
              </summary>
              <p className="text-sm text-slate-400 mt-3">
                OnCallShift supports all core Opsgenie features. For advanced features,
                contact us and we'll help you find equivalent functionality or workarounds.
              </p>
            </details>

            <details className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <summary className="font-semibold cursor-pointer text-white">
                Do you support Opsgenie's Heartbeat feature?
              </summary>
              <p className="text-sm text-slate-400 mt-3">
                Yes, we support heartbeat monitoring. You can configure heartbeat checks
                that alert when expected signals aren't received.
              </p>
            </details>

            <details className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <summary className="font-semibold cursor-pointer text-white">
                Can I import my incident history?
              </summary>
              <p className="text-sm text-slate-400 mt-3">
                Currently, we import configuration (schedules, policies, users) but not
                historical incident data. If you need to preserve incident history,
                export it from Opsgenie before the shutdown.
              </p>
            </details>

            <details className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <summary className="font-semibold cursor-pointer text-white">
                What's the pricing difference?
              </summary>
              <p className="text-sm text-slate-400 mt-3">
                We're finalizing our pricing plans. We'll have a free tier for small teams
                and competitive paid plans. Join the waitlist to be notified when pricing is available.
              </p>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}
