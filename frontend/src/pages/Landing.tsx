import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📟</span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              OnCallShift
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            On-Call Management
            <br />
            Made Simple
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamlined incident management and on-call scheduling at a fraction of the cost.
            No complexity. No bloat. Just what you need.
          </p>
          <div className="flex items-center justify-center gap-4 mb-12">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Live Demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Starting at $5/month · No credit card required · Set up in minutes
          </p>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-blue-600">90%+ Savings</CardTitle>
              <CardDescription className="text-base">vs Enterprise Solutions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Get professional on-call management starting at just $5/month
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-indigo-500 transition-colors">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-indigo-600">&lt;5 min</CardTitle>
              <CardDescription className="text-base">Setup Time</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Deploy and configure your first schedule in under 5 minutes
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-purple-600">24/7</CardTitle>
              <CardDescription className="text-base">Always Available</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Reliable incident alerts via email, SMS, and push notifications
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 dark:bg-slate-900 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Everything You Need, Nothing You Don't</h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built for small to medium teams who need reliable on-call management without enterprise complexity
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">🚨</div>
                <CardTitle>Incident Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track, acknowledge, and resolve incidents with full event history and multi-channel notifications
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">📅</div>
                <CardTitle>Smart Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create rotation schedules with automatic assignment based on availability and position in queue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">🔔</div>
                <CardTitle>Multi-Channel Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receive notifications via email, SMS, and mobile push to ensure you never miss critical incidents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">🔗</div>
                <CardTitle>Webhook Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Connect monitoring tools, CI/CD pipelines, and custom systems via simple webhook API
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">👥</div>
                <CardTitle>Team Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Manage user availability, rotation order, and ensure fair distribution of on-call duties
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-3xl mb-2">📱</div>
                <CardTitle>Mobile Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Respond to incidents on the go with our React Native mobile app (coming soon)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cost Comparison */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h3>
            <p className="text-muted-foreground text-lg">
              Enterprise-grade features without the enterprise price tag
            </p>
          </div>

          <Card className="border-2 border-blue-500 shadow-lg max-w-md mx-auto">
            <CardHeader>
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-2xl">OnCallShift</CardTitle>
              </div>
              <div className="text-4xl font-bold mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center">
                $5+
              </div>
              <CardDescription className="text-center">per month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-foreground font-medium">✓ All features included</p>
              <p className="text-foreground font-medium">✓ Unlimited users</p>
              <p className="text-foreground font-medium">✓ Pay for infrastructure only</p>
              <p className="text-foreground font-medium">✓ No contracts</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-4xl font-bold text-white mb-6">
            Ready to Simplify Your On-Call?
          </h3>
          <p className="text-blue-100 text-xl mb-8 max-w-2xl mx-auto">
            Join teams who've switched to OnCallShift for reliable, affordable incident management
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Get Started Free
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 border-white text-white hover:bg-white/10">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📟</span>
                <span className="font-bold text-lg">OnCallShift</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Streamlined on-call management for modern teams
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/demo" className="hover:text-foreground">Demo</Link></li>
                <li><Link to="/api-docs" className="hover:text-foreground">API Docs</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Get Started</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/register" className="hover:text-foreground">Sign Up</Link></li>
                <li><Link to="/login" className="hover:text-foreground">Sign In</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 OnCallShift. Built with ❤️ for DevOps teams.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
