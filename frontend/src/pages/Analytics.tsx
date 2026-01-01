import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { incidentsAPI } from '../lib/api-client';
import type { Incident } from '../types/api';

interface AnalyticsData {
  totalIncidents: number;
  triggeredCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  mtta: number; // Mean Time To Acknowledge (minutes)
  mttr: number; // Mean Time To Resolve (minutes)
  incidentsBySeverity: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  incidentsByService: Array<{
    serviceName: string;
    count: number;
  }>;
  dailyTrend: Array<{
    date: string;
    count: number;
  }>;
}

type TimeRange = '24h' | '7d' | '30d';

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await incidentsAPI.list();
      const incidents = response.incidents;

      const rangeStart = new Date();
      if (timeRange === '24h') {
        rangeStart.setHours(rangeStart.getHours() - 24);
      } else if (timeRange === '7d') {
        rangeStart.setDate(rangeStart.getDate() - 7);
      } else {
        rangeStart.setDate(rangeStart.getDate() - 30);
      }

      const filteredIncidents = incidents.filter(
        (i: Incident) => new Date(i.triggeredAt) >= rangeStart
      );

      // Calculate metrics
      const triggeredCount = filteredIncidents.filter((i: Incident) => i.state === 'triggered').length;
      const acknowledgedCount = filteredIncidents.filter((i: Incident) => i.state === 'acknowledged').length;
      const resolvedCount = filteredIncidents.filter((i: Incident) => i.state === 'resolved').length;

      // Calculate MTTA and MTTR
      let totalAckTime = 0;
      let ackCount = 0;
      let totalResolveTime = 0;
      let resolveCount = 0;

      filteredIncidents.forEach((incident: Incident) => {
        const triggeredAt = new Date(incident.triggeredAt).getTime();
        if (incident.acknowledgedAt) {
          const ackAt = new Date(incident.acknowledgedAt).getTime();
          totalAckTime += (ackAt - triggeredAt) / 60000;
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

      // Count by severity
      const incidentsBySeverity = {
        critical: filteredIncidents.filter((i: Incident) => i.severity === 'critical').length,
        error: filteredIncidents.filter((i: Incident) => i.severity === 'error').length,
        warning: filteredIncidents.filter((i: Incident) => i.severity === 'warning').length,
        info: filteredIncidents.filter((i: Incident) => i.severity === 'info').length,
      };

      // Count by service
      const serviceMap = new Map<string, number>();
      filteredIncidents.forEach((incident: Incident) => {
        const serviceName = incident.service.name;
        serviceMap.set(serviceName, (serviceMap.get(serviceName) || 0) + 1);
      });
      const incidentsByService = Array.from(serviceMap.entries())
        .map(([serviceName, count]) => ({ serviceName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Daily trend
      const dailyMap = new Map<string, number>();
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, 0);
      }
      filteredIncidents.forEach((incident: Incident) => {
        const dateStr = incident.triggeredAt.split('T')[0];
        if (dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
        }
      });
      const dailyTrend = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

      setData({
        totalIncidents: filteredIncidents.length,
        triggeredCount,
        acknowledgedCount,
        resolvedCount,
        mtta,
        mttr,
        incidentsBySeverity,
        incidentsByService,
        dailyTrend,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'error': return 'bg-orange-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Analytics</h2>
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const maxDailyCount = Math.max(...(data?.dailyTrend.map(d => d.count) || [1]), 1);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Time Range Selector */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">Analytics</h2>
          <p className="text-muted-foreground">
            Incident metrics and team performance insights · {getTimeRangeLabel()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeRange === '24h' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('24h')}
          >
            24h
          </Button>
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Incidents</CardDescription>
            <CardTitle className="text-4xl text-red-600">{data?.totalIncidents || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data?.triggeredCount || 0} active, {data?.acknowledgedCount || 0} acknowledged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mean Time to Acknowledge</CardDescription>
            <CardTitle className="text-4xl text-yellow-600">{formatDuration(data?.mtta || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Average response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mean Time to Resolve</CardDescription>
            <CardTitle className="text-4xl text-green-600">{formatDuration(data?.mttr || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Average resolution time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Current incident states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-muted-foreground">Triggered</span>
                </div>
                <div className="text-3xl font-bold">{data?.triggeredCount || 0}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-muted-foreground">Acknowledged</span>
                </div>
                <div className="text-3xl font-bold">{data?.acknowledgedCount || 0}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">Resolved</span>
                </div>
                <div className="text-3xl font-bold">{data?.resolvedCount || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By Severity</CardTitle>
            <CardDescription>Incident distribution by severity level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data?.incidentsBySeverity || {}).map(([severity, count]) => (
              <div key={severity}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{severity}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getSeverityColor(severity)} transition-all duration-300`}
                    style={{
                      width: `${Math.min((count / (data?.totalIncidents || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle>Top Services</CardTitle>
            <CardDescription>Services with most incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.incidentsByService.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No incidents in this period</p>
            ) : (
              <div className="space-y-3">
                {data?.incidentsByService.map((service, index) => (
                  <div key={service.serviceName} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{service.serviceName}</p>
                    </div>
                    <div className="text-lg font-semibold">{service.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
            <CardDescription>Incidents per day</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.dailyTrend.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data?.dailyTrend.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex justify-center mb-1">
                      <div
                        className="w-full max-w-8 bg-primary rounded-t transition-all duration-300"
                        style={{
                          height: `${Math.max((day.count / maxDailyCount) * 100, 4)}%`,
                          minHeight: day.count > 0 ? '8px' : '4px',
                        }}
                        title={`${day.date}: ${day.count} incidents`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Analytics;
