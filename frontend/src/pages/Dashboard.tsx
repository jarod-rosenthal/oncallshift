import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Navigation } from '../components/Navigation';
import { incidentsAPI, schedulesAPI } from '../lib/api-client';
import type { Incident, OnCallInfo } from '../types/api';

interface DashboardStats {
  total: number;
  triggered: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  warning: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    triggered: 0,
    acknowledged: 0,
    resolved: 0,
    critical: 0,
    warning: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [onCallData, setOnCallData] = useState<OnCallInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [incidentsResponse, onCallResponse] = await Promise.all([
        incidentsAPI.list(),
        schedulesAPI.getOnCall(),
      ]);

      const incidents = incidentsResponse.incidents;

      // Calculate stats
      const newStats: DashboardStats = {
        total: incidents.length,
        triggered: incidents.filter(i => i.state === 'triggered').length,
        acknowledged: incidents.filter(i => i.state === 'acknowledged').length,
        resolved: incidents.filter(i => i.state === 'resolved').length,
        critical: incidents.filter(i => i.severity === 'critical').length,
        warning: incidents.filter(i => i.severity === 'warning').length,
      };

      setStats(newStats);
      setRecentIncidents(incidents.slice(0, 5)); // Show 5 most recent
      setOnCallData(onCallResponse.oncall);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'triggered':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time incident management and on-call status
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Live · Updated {lastUpdated.toLocaleTimeString()}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link to="/incidents">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>Incidents</CardTitle>
                  <CardDescription>
                    View and manage active incidents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">View Incidents</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/schedules">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>Schedules</CardTitle>
                  <CardDescription>
                    Manage on-call schedules and rotations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">View Schedules</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/escalation-policies">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>Escalation Policies</CardTitle>
                  <CardDescription>
                    Configure multi-level escalation workflows
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Manage Policies</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/availability">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>My Availability</CardTitle>
                  <CardDescription>
                    Set your on-call availability hours
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Manage Availability</Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Live Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Critical</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Warning</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.warning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Triggered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.triggered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.resolved}</div>
            </CardContent>
          </Card>
        </div>

        {/* Who's On Call */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Who's On Call</CardTitle>
                <CardDescription>Current on-call assignments by service</CardDescription>
              </div>
              <Link to="/schedules">
                <Button variant="outline" size="sm">Manage Schedules</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {onCallData.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">No services with schedules configured</p>
                <p className="text-sm text-muted-foreground">
                  Create a schedule and assign it to a service to see on-call status here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {onCallData.map((item) => (
                  <div
                    key={`${item.service?.id || item.schedule.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.service?.name || item.schedule.name}</p>
                        {item.isOverride && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
                            OVERRIDE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.schedule.name}</p>
                      {item.oncallUser ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.oncallUser.fullName} • {item.oncallUser.email}
                        </p>
                      ) : (
                        <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                          No one currently on call
                        </p>
                      )}
                    </div>
                    <Link to={`/schedules/${item.schedule.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        {recentIncidents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Incidents</CardTitle>
                <Link to="/incidents">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : (
                <div className="space-y-3">
                  {recentIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                            {incident.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateColor(incident.state)}`}>
                            {incident.state.toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            #{incident.incidentNumber}
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
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
