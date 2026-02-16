import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Users, Target, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { analyticsAPI, type AnalyticsOverview, type TopResponder, type SLAData, type TeamAnalyticsDetail, type AnalyticsTeam } from '../lib/api-client';
import { getSeveritySolidColor } from '../lib/colors';
import { IncidentHeatmap } from '../components/IncidentHeatmap';
import { SeverityBreakdownChart, DailyTrendChart, SLAComplianceTrendChart } from '../components/AnalyticsCharts';

type TimeRange = '24h' | '7d' | '30d';
type Tab = 'overview' | 'responders' | 'sla' | 'patterns';

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data states
  const [teams, setTeams] = useState<AnalyticsTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [overviewData, setOverviewData] = useState<AnalyticsOverview | null>(null);
  const [topResponders, setTopResponders] = useState<TopResponder[]>([]);
  const [slaData, setSlaData] = useState<SLAData | null>(null);
  const [teamData, setTeamData] = useState<TeamAnalyticsDetail | null>(null);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (timeRange === '24h') {
      start.setHours(start.getHours() - 24);
    } else if (timeRange === '7d') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 30);
    }
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    loadData();
  }, [timeRange, selectedTeamId]);

  const loadTeams = async () => {
    try {
      const response = await analyticsAPI.getTeams();
      // Handle paginated response - prefer legacy key, fall back to data array
      setTeams(response.teams || (response as any).data || []);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      const [overview, responders, sla] = await Promise.all([
        analyticsAPI.getOverview(startDate, endDate),
        analyticsAPI.getTopResponders(startDate, endDate, 10),
        analyticsAPI.getSLA(startDate, endDate, 15, 60),
      ]);

      setOverviewData(overview);
      // Handle response - backend returns topResponders, fall back to empty array
      setTopResponders(responders.topResponders || (responders as any).data || []);
      setSlaData(sla);

      if (selectedTeamId !== 'all') {
        const team = await analyticsAPI.getTeamAnalytics(selectedTeamId, startDate, endDate);
        setTeamData(team);
      } else {
        setTeamData(null);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number | null | undefined) => {
    if (!minutes || minutes === 0) return '-';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading && !overviewData) {
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


  // Extract metrics from overview data
  const mtta = overviewData?.mtta?.minutes || 0;
  const mttr = overviewData?.mttr?.minutes || 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Controls */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">Analytics</h2>
          <p className="text-muted-foreground">
            Incident metrics and team performance insights · {getTimeRangeLabel()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Team Selector */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-[180px]"
            >
              <option value="all">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Time Range */}
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

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'responders' ? 'default' : 'outline'}
          onClick={() => setActiveTab('responders')}
        >
          Top Responders
        </Button>
        <Button
          variant={activeTab === 'sla' ? 'default' : 'outline'}
          onClick={() => setActiveTab('sla')}
        >
          SLA Compliance
        </Button>
        <Button
          variant={activeTab === 'patterns' ? 'default' : 'outline'}
          onClick={() => setActiveTab('patterns')}
        >
          Patterns
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Incidents</CardDescription>
                <CardTitle className="text-4xl text-red-600">{overviewData?.totalIncidents || 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {overviewData?.byState?.triggered || 0} active, {overviewData?.byState?.acknowledged || 0} acknowledged
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Mean Time to Acknowledge
                </CardDescription>
                <CardTitle className="text-4xl text-yellow-600">{formatDuration(mtta)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Average response time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Mean Time to Resolve
                </CardDescription>
                <CardTitle className="text-4xl text-green-600">{formatDuration(mttr)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Average resolution time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className="text-3xl font-bold">{overviewData?.byState?.triggered || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm text-muted-foreground">Acknowledged</span>
                    </div>
                    <div className="text-3xl font-bold">{overviewData?.byState?.acknowledged || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-muted-foreground">Resolved</span>
                    </div>
                    <div className="text-3xl font-bold">{overviewData?.byState?.resolved || 0}</div>
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
              <CardContent>
                {overviewData?.bySeverity ? (
                  <SeverityBreakdownChart
                    data={overviewData.bySeverity}
                    totalIncidents={overviewData.totalIncidents || 0}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No severity data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Trend
              </CardTitle>
              <CardDescription>Incidents per day</CardDescription>
            </CardHeader>
            <CardContent>
              {(overviewData?.incidentsByDay || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data available</p>
              ) : (
                <DailyTrendChart data={overviewData.incidentsByDay} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Responders Tab */}
      {activeTab === 'responders' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Responders
              </CardTitle>
              <CardDescription>
                Team members who have handled the most incidents in {getTimeRangeLabel().toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topResponders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No responder data in this period</p>
              ) : (
                <div className="space-y-4">
                  {topResponders.map((responder, index) => (
                    <div key={responder.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative">
                          {responder.profilePictureUrl ? (
                            <img
                              src={responder.profilePictureUrl}
                              alt={responder.fullName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                              {getInitials(responder.fullName)}
                            </div>
                          )}
                          <span className={`absolute -top-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500 text-white' : 'bg-muted border'
                          }`}>
                            {index + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{responder.fullName}</p>
                          <p className="text-sm text-muted-foreground truncate">{responder.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">Acknowledged</p>
                          <p className="text-xl font-semibold text-yellow-600">{responder.incidentsAcknowledged}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Resolved</p>
                          <p className="text-xl font-semibold text-green-600">{responder.incidentsResolved}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Response</p>
                          <p className="text-xl font-semibold">{formatDuration(responder.averageResponseTimeMinutes)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Responders (if team selected) */}
          {teamData && (
            <Card>
              <CardHeader>
                <CardTitle>{teamData.team.name} - Team Stats</CardTitle>
                <CardDescription>
                  Team performance for {getTimeRangeLabel().toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold">{teamData.totalIncidents}</p>
                    <p className="text-sm text-muted-foreground">Total Incidents</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{formatDuration(teamData.mtta?.minutes)}</p>
                    <p className="text-sm text-muted-foreground">MTTA</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{formatDuration(teamData.mttr?.minutes)}</p>
                    <p className="text-sm text-muted-foreground">MTTR</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold">{teamData.topServices?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SLA Compliance Tab */}
      {activeTab === 'sla' && (
        <div className="space-y-6">
          {/* SLA Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Ack Target
                </CardDescription>
                <CardTitle className="text-2xl">{slaData?.targets?.ackTargetMinutes || 15} min</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Target acknowledgement time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ack Compliance Rate</CardDescription>
                <CardTitle className={`text-4xl ${getComplianceColor(slaData?.overall?.ackComplianceRate || 0)}`}>
                  {slaData?.overall?.ackComplianceRate || 0}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${slaData?.overall?.ackComplianceRate || 0}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {slaData?.overall?.ackWithinTarget || 0} / {slaData?.overall?.totalIncidents || 0} within target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Resolve Target
                </CardDescription>
                <CardTitle className="text-2xl">{slaData?.targets?.resolveTargetMinutes || 60} min</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Target resolution time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Resolve Compliance Rate</CardDescription>
                <CardTitle className={`text-4xl ${getComplianceColor(slaData?.overall?.resolveComplianceRate || 0)}`}>
                  {slaData?.overall?.resolveComplianceRate || 0}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${slaData?.overall?.resolveComplianceRate || 0}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {slaData?.overall?.resolveWithinTarget || 0} / {slaData?.overall?.totalIncidents || 0} within target
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SLA by Severity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  SLA by Severity
                </CardTitle>
                <CardDescription>Compliance rates by incident severity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(slaData?.bySeverity || []).map((item) => (
                    <div key={item.severity} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-medium">{item.severity}</span>
                        <span className="text-sm text-muted-foreground">{item.totalIncidents} incidents</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Ack</span>
                            <span className={getComplianceColor(item.ackComplianceRate)}>{item.ackComplianceRate}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${item.ackComplianceRate}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Resolve</span>
                            <span className={getComplianceColor(item.resolveComplianceRate)}>{item.resolveComplianceRate}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${item.resolveComplianceRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SLA by Service */}
            <Card>
              <CardHeader>
                <CardTitle>SLA by Service</CardTitle>
                <CardDescription>Top services by incident volume with compliance rates</CardDescription>
              </CardHeader>
              <CardContent>
                {(slaData?.byService || []).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No service data available</p>
                ) : (
                  <div className="space-y-3">
                    {slaData?.byService.slice(0, 5).map((service) => (
                      <div key={service.serviceId} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium truncate">{service.serviceName}</span>
                          <span className="text-sm px-2 py-1 bg-muted rounded">{service.totalIncidents} incidents</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ack:</span>
                            <span className={getComplianceColor(service.ackComplianceRate)}>{service.ackComplianceRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Resolve:</span>
                            <span className={getComplianceColor(service.resolveComplianceRate)}>{service.resolveComplianceRate}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SLA Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                SLA Compliance Trend
              </CardTitle>
              <CardDescription>Daily acknowledgement compliance rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              {(slaData?.dailyTrend || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No trend data available</p>
              ) : (
                <div className="space-y-4">
                  <SLAComplianceTrendChart data={slaData.dailyTrend} />
                  <div className="flex justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500"></div>
                      <span className="text-muted-foreground">≥90% (Good)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-yellow-500"></div>
                      <span className="text-muted-foreground">70-89% (Warning)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-500"></div>
                      <span className="text-muted-foreground">&lt;70% (Critical)</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Incident Heatmap</CardTitle>
              <CardDescription>
                When do incidents happen? Incidents clustered by day-of-week and hour-of-day · {getTimeRangeLabel().toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentHeatmap
                startDate={getDateRange().startDate}
                endDate={getDateRange().endDate}
                serviceId={selectedTeamId !== 'all' ? undefined : undefined}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Analytics;
