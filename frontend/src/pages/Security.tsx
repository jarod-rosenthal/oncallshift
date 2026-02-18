import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Security() {
  const practices = [
    {
      title: 'Encryption',
      description: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). API keys and credentials are encrypted with separate keys.',
      icon: '&#128272;',
    },
    {
      title: 'Infrastructure',
      description: 'Hosted on AWS with VPC isolation, security groups, and WAF protection. Multi-AZ deployment for high availability.',
      icon: '&#9729;&#65039;',
    },
    {
      title: 'Authentication',
      description: 'Powered by AWS Cognito with MFA support. Session tokens are short-lived and securely managed.',
      icon: '&#128273;',
    },
    {
      title: 'Access Control',
      description: 'Role-based access control (RBAC) with organization-level isolation. Audit logs for all administrative actions.',
      icon: '&#128100;',
    },
    {
      title: 'Data Isolation',
      description: 'Complete multi-tenant isolation. Each organization\'s data is logically separated and access-controlled.',
      icon: '&#127970;',
    },
    {
      title: 'Monitoring',
      description: 'Real-time security monitoring, anomaly detection, and automated alerting for suspicious activity.',
      icon: '&#128202;',
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
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-500/5 text-teal-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>&#128274; Enterprise-Grade Security</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Security at OnCallShift
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Your incident data is critical. We protect it with industry-standard security practices
          and give you full control over your data.
        </p>
      </section>

      {/* Security Practices */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">Security Practices</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            How we protect your data at every layer.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {practices.map((practice, i) => (
              <Card key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl">
                <CardContent className="pt-6">
                  <span className="text-3xl mb-3 block" dangerouslySetInnerHTML={{ __html: practice.icon }} />
                  <h3 className="font-semibold mb-2 text-white">{practice.title}</h3>
                  <p className="text-sm text-slate-400">{practice.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-white">Compliance</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          We're committed to meeting industry compliance standards.
        </p>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {compliance.map((item, i) => (
            <Card key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{item.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.status === 'Compliant'
                      ? 'bg-teal-500/10 text-teal-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Data Handling */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">Data Handling</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Transparency about how we store and process your data.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {dataHandling.map((item, i) => (
              <Card key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Responsible Disclosure</h2>
          <p className="text-slate-400 mb-6">
            If you discover a security vulnerability, please report it responsibly.
            We appreciate your help in keeping OnCallShift secure.
          </p>
          <Card className="bg-white/[0.03] border border-white/5 rounded-2xl">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-400 mb-4">
                Report security vulnerabilities to:
              </p>
              <a href="mailto:security@oncallshift.com" className="text-teal-400 font-medium hover:underline">
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
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-slate-950">Need More?</h2>
          <p className="text-slate-800 mb-6 max-w-2xl mx-auto">
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
    </div>
  );
}
