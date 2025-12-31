import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Security() {
  const practices = [
    {
      title: 'Encryption',
      description: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). API keys and credentials are encrypted with separate keys.',
      icon: '🔐',
    },
    {
      title: 'Infrastructure',
      description: 'Hosted on AWS with VPC isolation, security groups, and WAF protection. Multi-AZ deployment for high availability.',
      icon: '☁️',
    },
    {
      title: 'Authentication',
      description: 'Powered by AWS Cognito with MFA support. Session tokens are short-lived and securely managed.',
      icon: '🔑',
    },
    {
      title: 'Access Control',
      description: 'Role-based access control (RBAC) with organization-level isolation. Audit logs for all administrative actions.',
      icon: '👤',
    },
    {
      title: 'Data Isolation',
      description: 'Complete multi-tenant isolation. Each organization\'s data is logically separated and access-controlled.',
      icon: '🏢',
    },
    {
      title: 'Monitoring',
      description: 'Real-time security monitoring, anomaly detection, and automated alerting for suspicious activity.',
      icon: '📊',
    },
  ];

  const compliance = [
    {
      name: 'SOC 2 Type II',
      status: 'In Progress',
      description: 'Annual audit for security, availability, and confidentiality controls.',
    },
    {
      name: 'GDPR',
      status: 'Compliant',
      description: 'EU data protection regulation compliance with DPA available.',
    },
    {
      name: 'CCPA',
      status: 'Compliant',
      description: 'California Consumer Privacy Act compliance.',
    },
  ];

  const dataHandling = [
    {
      title: 'Data Retention',
      description: 'Incident data is retained according to your plan (7-90 days, or unlimited for Enterprise). You can request deletion at any time.',
    },
    {
      title: 'Data Location',
      description: 'All data is stored in AWS us-east-1 (N. Virginia). Enterprise customers can request specific regions.',
    },
    {
      title: 'Backups',
      description: 'Automated daily backups with 30-day retention. Point-in-time recovery available.',
    },
    {
      title: 'AI Data Privacy',
      description: 'With BYOK (Bring Your Own Key), AI requests go directly to Anthropic. OnCallShift never sees AI conversation content.',
    },
  ];

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
            <Link to="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
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
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>🔒 Enterprise-Grade Security</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Security at OnCallShift
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Your incident data is critical. We protect it with industry-standard security practices
          and give you full control over your data.
        </p>
      </section>

      {/* Security Practices */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Security Practices</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            How we protect your data at every layer.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {practices.map((practice, i) => (
              <Card key={i} className="border bg-white">
                <CardContent className="pt-6">
                  <span className="text-3xl mb-3 block">{practice.icon}</span>
                  <h3 className="font-semibold mb-2">{practice.title}</h3>
                  <p className="text-sm text-slate-600">{practice.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Compliance</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          We're committed to meeting industry compliance standards.
        </p>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {compliance.map((item, i) => (
            <Card key={i} className="border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.status === 'Compliant'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Data Handling */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Data Handling</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Transparency about how we store and process your data.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {dataHandling.map((item, i) => (
              <Card key={i} className="border bg-white">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Responsible Disclosure</h2>
          <p className="text-slate-600 mb-6">
            If you discover a security vulnerability, please report it responsibly.
            We appreciate your help in keeping OnCallShift secure.
          </p>
          <Card className="border bg-slate-50">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-4">
                Report security vulnerabilities to:
              </p>
              <a href="mailto:security@oncallshift.com" className="text-blue-600 font-medium hover:underline">
                security@oncallshift.com
              </a>
              <p className="text-xs text-slate-500 mt-4">
                We aim to respond within 24 hours and will work with you to understand and address the issue.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Enterprise */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Need More?</h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Enterprise customers get custom security reviews, dedicated infrastructure options,
            SSO/SAML, and custom data retention policies.
          </p>
          <Link to="/company/contact">
            <Button size="lg" variant="secondary">
              Contact Sales
            </Button>
          </Link>
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
