import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { servicesAPI, incidentsAPI } from '../lib/api-client';
import { cn } from '../lib/utils';
import type { Service, Incident } from '../types/api';

interface ServiceHealth {
  service: Service;
  status: 'operational' | 'degraded' | 'critical';
  activeIncidents: number;
}

interface BusinessServiceGroup {
  name: string;
  services: ServiceHealth[];
  overallStatus: 'operational' | 'degraded' | 'critical';
}

// Status icons and colors
const statusConfig = {
  operational: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    label: 'Operational',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    label: 'Degraded',
  },
  critical: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    label: 'Critical',
  },
};

function ServiceGroupAccordion({ group }: { group: BusinessServiceGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-4 bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-3 h-3 rounded-full', statusConfig[group.overallStatus].bgColor)} />
          <span className="font-medium text-foreground">{group.name}</span>
          <span className="text-sm text-muted-foreground">
            ({group.services.length} service{group.services.length !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/30">
          {group.services.map((serviceHealth) => {
            const ServiceStatusIcon = statusConfig[serviceHealth.status].icon;
            return (
              <div
                key={serviceHealth.service.id}
                className="flex items-center justify-between px-6 py-3 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <ServiceStatusIcon
                    className={cn('w-4 h-4', statusConfig[serviceHealth.status].color)}
                  />
                  <Link
                    to={`/services/${serviceHealth.service.id}`}
                    className="text-sm text-foreground hover:text-primary"
                  >
                    {serviceHealth.service.name}
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={cn('font-medium', statusConfig[serviceHealth.status].color)}>
                    {statusConfig[serviceHealth.status].label}
                  </span>
                  {serviceHealth.activeIncidents > 0 && (
                    <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                      {serviceHealth.activeIncidents} incident{serviceHealth.activeIncidents !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StatusDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        servicesAPI.list(),
        incidentsAPI.list(),
      ]);
      setServices(servicesRes.services);
      setIncidents(incidentsRes.incidents);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load status data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate service health based on active incidents
  const serviceHealthMap = useMemo(() => {
    const map = new Map<string, ServiceHealth>();

    services.forEach((service) => {
      const activeIncidents = incidents.filter(
        (i) => i.service?.id === service.id && i.state !== 'resolved'
      );

      const criticalCount = activeIncidents.filter((i) => i.severity === 'critical').length;
      const errorCount = activeIncidents.filter((i) => i.severity === 'error').length;

      let status: 'operational' | 'degraded' | 'critical' = 'operational';
      if (criticalCount > 0) {
        status = 'critical';
      } else if (errorCount > 0 || activeIncidents.length > 2) {
        status = 'degraded';
      } else if (activeIncidents.length > 0) {
        status = 'degraded';
      }

      map.set(service.id, {
        service,
        status,
        activeIncidents: activeIncidents.length,
      });
    });

    return map;
  }, [services, incidents]);

  // Group services by team or create default groups
  const businessGroups = useMemo(() => {
    const groups: BusinessServiceGroup[] = [];
    const teamMap = new Map<string, ServiceHealth[]>();

    // Group by team
    serviceHealthMap.forEach((serviceHealth) => {
      const teamName = (serviceHealth.service as any).team?.name || 'Other Services';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(serviceHealth);
    });

    // Create business groups with overall status
    teamMap.forEach((services, name) => {
      let overallStatus: 'operational' | 'degraded' | 'critical' = 'operational';

      if (services.some((s) => s.status === 'critical')) {
        overallStatus = 'critical';
      } else if (services.some((s) => s.status === 'degraded')) {
        overallStatus = 'degraded';
      }

      groups.push({
        name,
        services,
        overallStatus,
      });
    });

    // Sort by status (critical first) then alphabetically
    return groups.sort((a, b) => {
      const statusOrder = { critical: 0, degraded: 1, operational: 2 };
      const statusDiff = statusOrder[a.overallStatus] - statusOrder[b.overallStatus];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
  }, [serviceHealthMap]);

  // Calculate overall status
  const overallStatus = useMemo(() => {
    if (businessGroups.some((g) => g.overallStatus === 'critical')) {
      return 'critical';
    }
    if (businessGroups.some((g) => g.overallStatus === 'degraded')) {
      return 'degraded';
    }
    return 'operational';
  }, [businessGroups]);

  // Count active incidents
  const activeIncidentCount = incidents.filter((i) => i.state !== 'resolved').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Status Section */}
        <div className="text-center mb-12">
          {/* Large status icon */}
          <div
            className={cn(
              'w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center',
              overallStatus === 'operational' && 'bg-green-500/20',
              overallStatus === 'degraded' && 'bg-orange-500/20',
              overallStatus === 'critical' && 'bg-red-500/20'
            )}
          >
            {overallStatus === 'operational' ? (
              <CheckCircle className="w-12 h-12 text-green-500" />
            ) : overallStatus === 'degraded' ? (
              <AlertTriangle className="w-12 h-12 text-orange-500" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500" />
            )}
          </div>

          {/* Status headline */}
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {overallStatus === 'operational' && 'All business services operational'}
            {overallStatus === 'degraded' && 'Some services experiencing issues'}
            {overallStatus === 'critical' && 'Critical issues affecting services'}
          </h1>

          {/* Last updated */}
          <p className="text-muted-foreground">
            Last updated {lastUpdated.toLocaleTimeString()}
          </p>

          {/* Active incident banner */}
          {activeIncidentCount > 0 && (
            <div className="mt-6">
              <Link
                to="/incidents?status=triggered"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-600/50 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-600/30 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                {activeIncidentCount} active incident{activeIncidentCount !== 1 ? 's' : ''}
              </Link>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Operational</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">Degraded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Critical</span>
          </div>
        </div>

        {/* Business Services Section */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Business Services
          </h2>
          <div className="space-y-3">
            {businessGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No services configured yet.
                <Link to="/services" className="text-primary ml-1 hover:underline">
                  Add services
                </Link>
              </div>
            ) : (
              businessGroups.map((group) => (
                <ServiceGroupAccordion key={group.name} group={group} />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Powered by{' '}
            <Link to="/dashboard" className="text-primary hover:underline">
              OnCallShift
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default StatusDashboard;
