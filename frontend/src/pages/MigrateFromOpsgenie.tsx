import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function MigrateFromOpsgenie() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📟</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              OnCallShift
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-50 to-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>⚠️</span>
              Opsgenie End of Life: April 5, 2027
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Opsgenie Is Sunsetting.
              <br />
              <span className="text-orange-600">You Have Options.</span>
            </h1>

            <p className="text-xl text-slate-600 mb-8">
              Atlassian ends Opsgenie support April 5, 2027. Don't get locked into
              expensive Jira Service Management licenses. Migrate to OnCallShift in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-lg px-8 h-12">
                  Start Free Migration
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 h-12">
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
          <h2 className="text-2xl font-bold text-center mb-8">Opsgenie Sunset Timeline</h2>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200"></div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="md:text-right md:pr-8">
                <div className="inline-block bg-yellow-100 text-yellow-800 font-semibold px-3 py-1 rounded text-sm mb-2">
                  June 17, 2025
                </div>
                <h3 className="font-semibold mb-1">Sales End</h3>
                <p className="text-sm text-slate-600">
                  No new Opsgenie subscriptions can be purchased
                </p>
              </div>
              <div className="hidden md:block"></div>

              <div className="hidden md:block"></div>
              <div className="md:pl-8">
                <div className="inline-block bg-orange-100 text-orange-800 font-semibold px-3 py-1 rounded text-sm mb-2">
                  April 5, 2027
                </div>
                <h3 className="font-semibold mb-1">Support Ends</h3>
                <p className="text-sm text-slate-600">
                  Opsgenie fully decommissioned. Data may be deleted.
                </p>
              </div>

              <div className="md:text-right md:pr-8">
                <div className="inline-block bg-green-100 text-green-800 font-semibold px-3 py-1 rounded text-sm mb-2">
                  Today
                </div>
                <h3 className="font-semibold mb-1">Plan Your Move</h3>
                <p className="text-sm text-slate-600">
                  Start migrating now to avoid last-minute rush
                </p>
              </div>
              <div className="hidden md:block"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Your Migration Options</h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-left bg-white rounded-lg overflow-hidden shadow-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="py-4 px-6 font-semibold"></th>
                  <th className="py-4 px-6 font-semibold text-slate-500">Jira Service Management</th>
                  <th className="py-4 px-6 font-semibold text-blue-600">OnCallShift</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-6 font-medium">Pricing</td>
                  <td className="py-4 px-6 text-slate-600">Higher than Opsgenie</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Similar to Opsgenie</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6 font-medium">Setup complexity</td>
                  <td className="py-4 px-6 text-slate-600">Complex ITSM platform</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Simple, focused tool</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6 font-medium">Migration effort</td>
                  <td className="py-4 px-6 text-slate-600">Manual in many cases</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Automated import</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6 font-medium">Learning curve</td>
                  <td className="py-4 px-6 text-slate-600">Significant (new platform)</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Minimal (similar UX)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6 font-medium">Vendor lock-in</td>
                  <td className="py-4 px-6 text-slate-600">Atlassian ecosystem</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Open integrations</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">AI features</td>
                  <td className="py-4 px-6 text-slate-600">Add-on cost</td>
                  <td className="py-4 px-6 text-green-600 font-medium">Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What we import */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">What We Import</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">👥</div>
                <CardTitle className="text-lg">Teams & Users</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                All your team structures and user accounts, including roles and permissions.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">📅</div>
                <CardTitle className="text-lg">On-Call Schedules</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Rotation schedules, layers, restrictions, and handoff times.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">🔔</div>
                <CardTitle className="text-lg">Escalation Policies</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Multi-step escalation rules and notification preferences.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">🔗</div>
                <CardTitle className="text-lg">Integrations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                API keys and webhook configurations for your monitoring tools.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">📱</div>
                <CardTitle className="text-lg">Notification Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                User notification preferences and contact methods.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-2xl mb-2">📊</div>
                <CardTitle className="text-lg">Services</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Service definitions and routing configurations.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Migration steps */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Migrate in 3 Simple Steps</h2>

            <div className="space-y-6">
              <div className="flex gap-4 bg-white rounded-lg p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Export from Opsgenie</h3>
                  <p className="text-sm text-slate-600">
                    Use Opsgenie's REST API to export your configuration. We provide
                    a script that handles this automatically.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 bg-white rounded-lg p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Import to OnCallShift</h3>
                  <p className="text-sm text-slate-600">
                    Use our Import Wizard to upload your export. Preview everything
                    before committing. Takes less than 5 minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 bg-white rounded-lg p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Update Integrations</h3>
                  <p className="text-sm text-slate-600">
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
          <h2 className="text-2xl font-bold mb-4">Zero Integration Changes Required</h2>
          <p className="text-slate-600 mb-8">
            OnCallShift's webhook endpoints are compatible with Opsgenie's API format.
            Just update the URL—your existing payloads work as-is.
          </p>

          <div className="bg-slate-900 rounded-lg p-6 text-left">
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
      <section className="bg-blue-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4">"</div>
            <p className="text-xl text-slate-700 italic mb-6">
              When we heard Opsgenie was sunsetting, we panicked. OnCallShift's migration
              tool imported everything in under an hour. Our team didn't skip a beat.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-semibold">
                AR
              </div>
              <div className="text-left">
                <div className="font-medium">Alex R.</div>
                <div className="text-sm text-slate-500">DevOps Lead, FinTech Startup</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Migrate?</h2>
          <p className="text-slate-600 mb-8">
            Don't wait until the last minute. Start your migration today and
            give your team time to get comfortable before Opsgenie sunsets.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/register">
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-lg px-8 h-12">
                Start Free Migration
              </Button>
            </Link>
            <Link to="/company/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                Schedule Migration Consultation
              </Button>
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            No credit card required · 14-day free trial · Import in minutes
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Migration FAQ</h2>

          <div className="max-w-3xl mx-auto space-y-4">
            <details className="bg-white rounded-lg p-4 shadow-sm">
              <summary className="font-semibold cursor-pointer">
                Can I run OnCallShift and Opsgenie in parallel?
              </summary>
              <p className="text-sm text-slate-600 mt-3">
                Yes! We recommend running both systems in parallel for a week or two
                to ensure everything is working correctly before fully switching over.
              </p>
            </details>

            <details className="bg-white rounded-lg p-4 shadow-sm">
              <summary className="font-semibold cursor-pointer">
                What if some of my Opsgenie features aren't supported?
              </summary>
              <p className="text-sm text-slate-600 mt-3">
                OnCallShift supports all core Opsgenie features. For advanced features,
                contact us and we'll help you find equivalent functionality or workarounds.
              </p>
            </details>

            <details className="bg-white rounded-lg p-4 shadow-sm">
              <summary className="font-semibold cursor-pointer">
                Do you support Opsgenie's Heartbeat feature?
              </summary>
              <p className="text-sm text-slate-600 mt-3">
                Yes, we support heartbeat monitoring. You can configure heartbeat checks
                that alert when expected signals aren't received.
              </p>
            </details>

            <details className="bg-white rounded-lg p-4 shadow-sm">
              <summary className="font-semibold cursor-pointer">
                Can I import my incident history?
              </summary>
              <p className="text-sm text-slate-600 mt-3">
                Currently, we import configuration (schedules, policies, users) but not
                historical incident data. If you need to preserve incident history,
                export it from Opsgenie before the shutdown.
              </p>
            </details>

            <details className="bg-white rounded-lg p-4 shadow-sm">
              <summary className="font-semibold cursor-pointer">
                What's the pricing difference?
              </summary>
              <p className="text-sm text-slate-600 mt-3">
                OnCallShift Professional is $15/user/month (billed annually), which is
                comparable to Opsgenie's pricing. Our free tier supports up to 5 users
                with basic features.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>&copy; 2025 OnCallShift. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/" className="hover:text-slate-700">Home</Link>
            <Link to="/pricing" className="hover:text-slate-700">Pricing</Link>
            <Link to="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/company/contact" className="hover:text-slate-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
