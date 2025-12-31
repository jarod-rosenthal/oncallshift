import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Navigation } from '../components/Navigation';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { incidentsAPI, setupAPI } from '../lib/api-client';
import { useAuthStore } from '../store/auth-store';
import type { Incident } from '../types/api';

interface DashboardStats {
  total: number;
  triggered: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  warning: number;
  mttr: number; // Mean Time To Resolve (minutes)
  mtta: number; // Mean Time To Acknowledge (minutes)
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    triggered: 0,
    acknowledged: 0,
    resolved: 0,
    critical: 0,
    warning: 0,
    mttr: 0,
    mtta: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadDashboardData();
    if (isAdmin) {
      checkSetupStatus();
    }
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [isAdmin]);

  const checkSetupStatus = async () => {
    try {
      const status = await setupAPI.getStatus();
      setShowSetupBanner(!status.setupCompleted);
    } catch (error) {
      // If the endpoint fails, don't show the banner
      console.error('Failed to check setup status:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const incidentsResponse = await incidentsAPI.list();
      const incidents = incidentsResponse.incidents;

      // Calculate MTTA and MTTR
      let totalAckTime = 0;
      let ackCount = 0;
      let totalResolveTime = 0;
      let resolveCount = 0;

      incidents.forEach(incident => {
        const triggeredAt = new Date(incident.triggeredAt).getTime();
        if (incident.acknowledgedAt) {
          const ackAt = new Date(incident.acknowledgedAt).getTime();
          totalAckTime += (ackAt - triggeredAt) / 60000; // Convert to minutes
          ackCount++;
        }
        if (incident.resolvedAt) {
          const resolvedAt = new Date(incident.resolvedAt).getTime();
          totalResolveTime += (resolvedAt - triggeredAt) / 60000;
          resolveCount++;
        }
      });

      const mtta = ackCount > 0 ? Math.round(totalAckTime / ackCount) : 0;
      const mttr = resolveCount > 0 ? Math.round(totalResolveTime / resolveCount) : 0;

      // Calculate stats
      const newStats: DashboardStats = {
        total: incidents.length,
        triggered: incidents.filter(i => i.state === 'triggered').length,
        acknowledged: incidents.filter(i => i.state === 'acknowledged').length,
        resolved: incidents.filter(i => i.state === 'resolved').length,
        critical: incidents.filter(i => i.severity === 'critical').length,
        warning: incidents.filter(i => i.severity === 'warning').length,
        mttr,
        mtta,
      };

      setStats(newStats);
      setRecentIncidents(incidents.slice(0, 5)); // Show 5 most recent
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

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Setup Wizard Banner */}
        {showSetupBanner && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="font-bold text-lg">Complete Your Setup</h3>
                  <p className="text-blue-100 text-sm">
                    Set up services, runbooks, and AI-powered incident response in just 5 minutes.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/setup">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50">
                    Start Setup Wizard
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowSetupBanner(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* Weekly On-Call Calendar */}
        <div className="mb-8">
          <WeeklyCalendar />
        </div>

        {/* Incident Analytics */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Incident Analytics</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Mean Time to Resolve</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{formatDuration(stats.mttr)}</div>
                <p className="text-xs text-muted-foreground mt-1">Average resolution time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Mean Time to Acknowledge</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-600">{formatDuration(stats.mtta)}</div>
                <p className="text-xs text-muted-foreground mt-1">Average response time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Resolution Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stats.resolved} of {stats.total} incidents</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open Incidents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stats.triggered + stats.acknowledged}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.triggered} triggered, {stats.acknowledged} ack'd
                </p>
              </CardContent>
            </Card>
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
                    <Link
                      key={incident.id}
                      to={`/incidents/${incident.id}`}
                      className="block"
                    >
                      <div className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
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
                    </Link>
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
