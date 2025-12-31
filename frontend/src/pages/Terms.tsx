import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function Terms() {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-slate-500 mb-8">Last updated: January 1, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600 mb-4">
              By accessing or using OnCallShift ("Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you disagree with any part of the terms, you may not access the Service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Description of Service</h2>
            <p className="text-slate-600 mb-4">
              OnCallShift is an incident management platform that provides on-call scheduling, alerting,
              escalation, and AI-powered incident diagnosis. The Service is provided on a subscription basis
              with various plan tiers.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Account Registration</h2>
            <p className="text-slate-600 mb-4">
              To use the Service, you must create an account with accurate and complete information.
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activities that occur under your account.
            </p>
            <p className="text-slate-600 mb-4">
              You must be at least 16 years old and have the authority to enter into these Terms on
              behalf of yourself or your organization.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Subscription and Payment</h2>
            <h3 className="text-lg font-medium mt-6 mb-2">Free Plan</h3>
            <p className="text-slate-600 mb-4">
              The Free plan is provided at no cost with limited features and usage. We reserve the right
              to modify or discontinue the Free plan at any time.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-2">Paid Plans</h3>
            <p className="text-slate-600 mb-4">
              Paid subscriptions are billed in advance on a monthly or annual basis. Prices are subject
              to change with 30 days notice. Refunds are provided on a prorated basis for annual plans
              cancelled within the first 30 days.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Acceptable Use</h2>
            <p className="text-slate-600 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Transmit malware, viruses, or other harmful code</li>
              <li>Impersonate any person or entity</li>
              <li>Use the Service to send spam or unsolicited communications</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Intellectual Property</h2>
            <p className="text-slate-600 mb-4">
              The Service and its original content, features, and functionality are owned by OnCallShift
              and are protected by international copyright, trademark, patent, trade secret, and other
              intellectual property laws.
            </p>
            <p className="text-slate-600 mb-4">
              You retain ownership of all data you submit to the Service. By using the Service, you grant
              us a limited license to use your data solely for the purpose of providing the Service.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. AI Features</h2>
            <p className="text-slate-600 mb-4">
              The AI diagnosis feature uses third-party AI services (Anthropic Claude). When using BYOK
              (Bring Your Own Key), you are responsible for compliance with Anthropic's terms of service.
              AI suggestions are provided for informational purposes and should not be relied upon as the
              sole basis for critical decisions.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Service Level Agreement</h2>
            <p className="text-slate-600 mb-4">
              Professional plan users receive a 99.9% uptime SLA. Enterprise plan users receive a 99.99%
              uptime SLA with custom terms. SLA credits are applied automatically for qualifying downtime.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Limitation of Liability</h2>
            <p className="text-slate-600 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONCALLSHIFT SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION,
              LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
            <p className="text-slate-600 mb-4">
              Our total liability shall not exceed the amount paid by you for the Service during the
              twelve (12) months preceding the claim.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-slate-600 mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY,
              SECURE, OR ERROR-FREE.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">11. Indemnification</h2>
            <p className="text-slate-600 mb-4">
              You agree to defend, indemnify, and hold harmless OnCallShift and its officers, directors,
              employees, and agents from any claims, damages, or expenses arising from your use of the
              Service or violation of these Terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">12. Termination</h2>
            <p className="text-slate-600 mb-4">
              We may terminate or suspend your account immediately, without prior notice, for conduct
              that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>
            <p className="text-slate-600 mb-4">
              You may terminate your account at any time through the account settings. Upon termination,
              your right to use the Service will cease immediately.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">13. Governing Law</h2>
            <p className="text-slate-600 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of
              Delaware, without regard to its conflict of law provisions.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">14. Dispute Resolution</h2>
            <p className="text-slate-600 mb-4">
              Any disputes arising from these Terms or your use of the Service shall be resolved through
              binding arbitration in accordance with the rules of the American Arbitration Association.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">15. Changes to Terms</h2>
            <p className="text-slate-600 mb-4">
              We reserve the right to modify these Terms at any time. We will provide notice of material
              changes by posting the new Terms on this page and updating the "Last updated" date.
              Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">16. Severability</h2>
            <p className="text-slate-600 mb-4">
              If any provision of these Terms is found to be unenforceable, the remaining provisions
              will remain in full force and effect.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">17. Contact</h2>
            <p className="text-slate-600 mb-4">
              If you have questions about these Terms, please contact us:
            </p>
            <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
              <li>Email: legal@oncallshift.com</li>
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
