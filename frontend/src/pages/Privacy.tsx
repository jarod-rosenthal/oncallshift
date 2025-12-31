import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function Privacy() {
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

      {/* Content */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-slate-500 mb-8">Last updated: January 1, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
            <p className="text-slate-600 mb-4">
              OnCallShift ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our
              incident management platform and related services.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mt-6 mb-2">Account Information</h3>
            <p className="text-slate-600 mb-4">
              When you create an account, we collect your name, email address, and organization details.
              If you sign up through a third-party service, we may receive additional profile information.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-2">Incident Data</h3>
            <p className="text-slate-600 mb-4">
              We store incident data that flows through our platform, including alert payloads, timestamps,
              and associated metadata. This data is necessary to provide the service.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-2">Usage Data</h3>
            <p className="text-slate-600 mb-4">
              We automatically collect certain information when you use OnCallShift, including IP addresses,
              browser type, pages visited, and actions taken within the application.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>To provide and maintain our service</li>
              <li>To notify you about changes to our service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve our service</li>
              <li>To detect, prevent and address technical issues</li>
              <li>To send you transactional emails (incident notifications, account updates)</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. AI Features and BYOK</h2>
            <p className="text-slate-600 mb-4">
              When you use our AI diagnosis feature with your own Anthropic API key (BYOK), your incident
              data is sent directly from your browser to Anthropic's servers. OnCallShift does not proxy,
              store, or have access to the content of these AI conversations.
            </p>
            <p className="text-slate-600 mb-4">
              Your API key is stored encrypted in our database and is only used to authenticate requests
              to Anthropic on your behalf.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Retention</h2>
            <p className="text-slate-600 mb-4">
              We retain your incident data according to your plan's data retention period:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Free plan: 7 days</li>
              <li>Professional plan: 90 days</li>
              <li>Enterprise plan: Unlimited (or as specified in your contract)</li>
            </ul>
            <p className="text-slate-600 mb-4">
              You may request deletion of your account and associated data at any time.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Security</h2>
            <p className="text-slate-600 mb-4">
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Encryption in transit (TLS) and at rest (AES-256)</li>
              <li>Regular security audits</li>
              <li>Access controls and audit logging</li>
              <li>SOC 2 Type II compliance (Enterprise plan)</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Third-Party Services</h2>
            <p className="text-slate-600 mb-4">
              We use the following third-party services:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Amazon Web Services (infrastructure)</li>
              <li>AWS Cognito (authentication)</li>
              <li>Anthropic (AI features, when you opt in)</li>
              <li>Analytics providers (aggregated, non-personal data)</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Your Rights</h2>
            <p className="text-slate-600 mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing</li>
              <li>Data portability</li>
              <li>Withdraw consent</li>
            </ul>
            <p className="text-slate-600 mb-4">
              To exercise these rights, contact us at privacy@oncallshift.com.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. International Transfers</h2>
            <p className="text-slate-600 mb-4">
              Your data may be transferred to and processed in the United States. We ensure appropriate
              safeguards are in place for such transfers in accordance with applicable law.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Children's Privacy</h2>
            <p className="text-slate-600 mb-4">
              OnCallShift is not intended for use by children under 16. We do not knowingly collect
              personal information from children.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">11. Changes to This Policy</h2>
            <p className="text-slate-600 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">12. Contact Us</h2>
            <p className="text-slate-600 mb-4">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Email: privacy@oncallshift.com</li>
              <li>Web: <Link to="/company/contact" className="text-blue-600 hover:underline">Contact Form</Link></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-slate-50">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>&copy; 2025 OnCallShift. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-slate-700">Terms</Link>
            <Link to="/company/contact" className="hover:text-slate-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
