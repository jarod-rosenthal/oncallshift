import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuthStore } from '../store/auth-store';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for small teams getting started',
    features: [
      'Up to 5 users',
      'Basic incident management',
      'Email notifications',
      '1 service',
      'Community support',
    ],
    current: true,
    cta: 'Current Plan',
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per user/month',
    description: 'For growing teams that need more power',
    features: [
      'Unlimited users',
      'Advanced incident management',
      'Email, SMS, and push notifications',
      'Unlimited services',
      'Slack & Teams integrations',
      'Analytics dashboard',
      'Priority support',
    ],
    current: false,
    cta: 'Coming Soon',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    features: [
      'Everything in Pro',
      'SSO/SAML authentication',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantees',
      'On-premise deployment option',
    ],
    current: false,
    cta: 'Contact Sales',
  },
];

export function Account() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Account & Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing settings
        </p>
      </div>

      {/* Current Organization */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Your current organization details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
              <p className="text-lg">{user?.organization?.name || 'Your Organization'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Current Plan</label>
              <p className="text-lg">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {user?.organization?.plan || 'Free'}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.highlighted ? 'border-blue-500 border-2 shadow-lg' : ''}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2">
                  <span>{plan.name}</span>
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                </CardDescription>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.current ? 'outline' : plan.highlighted ? 'default' : 'outline'}
                  disabled={plan.current || plan.cta === 'Coming Soon'}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Have questions about pricing or need a custom plan?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Contact our sales team for custom enterprise solutions, volume discounts, or any billing questions.
          </p>
          <Button variant="outline">
            Contact Sales
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default Account;
