import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { getSeverityBadgeColor, getStateBadgeColor } from '../lib/colors';

interface DemoStats {
  total: number;
  triggered: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
}

interface DemoIncident {
  id: string;
  number: number;
  summary: string;
  severity: string;
  state: string;
  service: {
    id: string;
    name: string;
  };
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  details: Record<string, any>;
  eventCount: number;
}

interface DemoData {
  stats: DemoStats;
  incidents: DemoIncident[];
}

export function Demo() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchDemoData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/demo/dashboard`);
        const demoData = await response.json();
        setData(demoData);
      } catch (error) {
        console.error('Error fetching demo data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDemoData();
  }, [API_BASE]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading demo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold tracking-tight hover:opacity-90">
            OnCallShift Demo
          </Link>
          <div className="flex gap-4">
            <Link to="/register">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Get Started Free
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Live Demo Dashboard</h2>
          <p className="text-muted-foreground">
            Explore OnCallShift with sample incident data
          </p>
        </div>

        {data && (
          <>
            {/* Live Stats */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Critical</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{data.stats.critical}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Warning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{data.stats.warning}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Triggered</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{data.stats.triggered}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resolved</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{data.stats.resolved}</div>
                </CardContent>
              </Card>
            </div>

            {/* Demo Incidents */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Incidents</CardTitle>
                <CardDescription>Real-time incident management interface</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.incidents.slice(0, 5).map((incident) => (
                    <div
                      key={incident.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadgeColor(incident.severity)}`}>
                            {incident.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateBadgeColor(incident.state)}`}>
                            {incident.state.toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            #{incident.number}
                          </span>
                        </div>
                        <p className="font-medium">{incident.summary}</p>
                        <p className="text-sm text-muted-foreground">
                          {incident.service.name} • {new Date(incident.triggeredAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="mt-8 text-center bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Set up your own incident management system in less than 5 minutes
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" variant="secondary">
                    Join Waitlist
                  </Button>
                </Link>
                <Link to="/">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
