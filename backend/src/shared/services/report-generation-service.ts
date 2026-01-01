import { DataSource, In } from 'typeorm';
import { Incident, IncidentEvent, IncidentReport, ReportExecution, ReportData } from '../models';
import { logger } from '../utils/logger';

/**
 * Report Generation Service
 *
 * Generates incident summary reports with metrics, RCAs, and trends.
 */
export class ReportGenerationService {
  constructor(private dataSource: DataSource) {}

  /**
   * Generate a report for a specific time period
   */
  async generateReport(
    report: IncidentReport,
    periodStart: Date,
    periodEnd: Date,
    triggeredBy?: string
  ): Promise<ReportExecution> {
    const executionRepo = this.dataSource.getRepository(ReportExecution);

    // Create execution record
    const execution = executionRepo.create({
      reportId: report.id,
      orgId: report.orgId,
      status: 'pending',
      periodStart,
      periodEnd,
      triggeredBy: triggeredBy || null,
    });

    await executionRepo.save(execution);

    try {
      // Update status to generating
      execution.status = 'generating';
      execution.startedAt = new Date();
      await executionRepo.save(execution);

      // Generate the report data
      const data = await this.collectReportData(
        report.orgId,
        periodStart,
        periodEnd,
        report.config
      );

      // Update execution with data
      execution.status = 'completed';
      execution.data = data;
      execution.completedAt = new Date();
      await executionRepo.save(execution);

      logger.info('Report generated successfully', {
        reportId: report.id,
        executionId: execution.id,
        totalIncidents: data.summary.totalIncidents,
        durationMs: execution.getDurationSeconds(),
      });

      return execution;
    } catch (error: any) {
      // Mark as failed
      execution.status = 'failed';
      execution.errorMessage = error.message;
      execution.completedAt = new Date();
      await executionRepo.save(execution);

      logger.error('Report generation failed', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Collect and aggregate report data
   */
  private async collectReportData(
    orgId: string,
    start: Date,
    end: Date,
    config: any
  ): Promise<ReportData> {
    const incidentRepo = this.dataSource.getRepository(Incident);
    const eventRepo = this.dataSource.getRepository(IncidentEvent);

    // Build base query
    const queryBuilder = incidentRepo
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.service', 'service')
      .leftJoinAndSelect('incident.assignedToUser', 'assignedTo')
      .leftJoinAndSelect('incident.acknowledgedByUser', 'acknowledgedBy')
      .leftJoinAndSelect('incident.resolvedByUser', 'resolvedBy')
      .where('incident.org_id = :orgId', { orgId })
      .andWhere('incident.triggered_at BETWEEN :start AND :end', { start, end });

    // Apply filters
    if (config.severityFilter && config.severityFilter.length > 0) {
      queryBuilder.andWhere('incident.severity IN (:...severities)', {
        severities: config.severityFilter,
      });
    }

    if (config.serviceFilter && config.serviceFilter.length > 0) {
      queryBuilder.andWhere('incident.service_id IN (:...services)', {
        services: config.serviceFilter,
      });
    }

    const incidents = await queryBuilder.getMany();

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(incidents);

    // Build report data
    const data: ReportData = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        durationDays: Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
      },
      summary,
    };

    // Add service breakdown if requested
    if (config.includeServiceBreakdown) {
      data.services = await this.getServiceBreakdown(incidents);
    }

    // Add team breakdown if requested
    if (config.includeTeamBreakdown) {
      data.teams = await this.getTeamBreakdown(incidents);
    }

    // Add responder metrics if requested
    if (config.includeResponderMetrics) {
      data.responders = await this.getResponderMetrics(incidents);
    }

    // Add RCA summaries if requested
    if (config.includeRCA) {
      data.rcas = await this.extractRCAs(incidents, eventRepo);
    }

    // Add trend analysis if requested
    if (config.includeTrendAnalysis) {
      data.trends = await this.analyzeTrends(incidents, start, end);
    }

    return data;
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummaryMetrics(incidents: Incident[]): ReportData['summary'] {
    const byState: Record<string, number> = {
      triggered: 0,
      acknowledged: 0,
      resolved: 0,
    };

    const bySeverity: Record<string, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    let totalAckTime = 0;
    let ackCount = 0;
    let totalResolveTime = 0;
    let resolveCount = 0;

    for (const incident of incidents) {
      // Count by state
      byState[incident.state] = (byState[incident.state] || 0) + 1;

      // Count by severity
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;

      // Calculate MTTA (Mean Time To Acknowledge)
      if (incident.acknowledgedAt) {
        const ackTime = incident.acknowledgedAt.getTime() - new Date(incident.triggeredAt).getTime();
        totalAckTime += ackTime;
        ackCount++;
      }

      // Calculate MTTR (Mean Time To Resolve)
      if (incident.resolvedAt) {
        const resolveTime = incident.resolvedAt.getTime() - new Date(incident.triggeredAt).getTime();
        totalResolveTime += resolveTime;
        resolveCount++;
      }
    }

    return {
      totalIncidents: incidents.length,
      byState,
      bySeverity,
      avgTimeToAcknowledge: ackCount > 0 ? Math.floor(totalAckTime / ackCount / 1000) : 0,
      avgTimeToResolve: resolveCount > 0 ? Math.floor(totalResolveTime / resolveCount / 1000) : 0,
    };
  }

  /**
   * Get service breakdown
   */
  private async getServiceBreakdown(incidents: Incident[]): Promise<ReportData['services']> {
    const serviceMap = new Map<string, { id: string; name: string; incidents: Incident[] }>();

    for (const incident of incidents) {
      if (!incident.service) continue;

      const serviceId = incident.service.id;
      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, {
          id: serviceId,
          name: incident.service.name,
          incidents: [],
        });
      }

      serviceMap.get(serviceId)!.incidents.push(incident);
    }

    return Array.from(serviceMap.values())
      .map(service => {
        const resolvedIncidents = service.incidents.filter(i => i.resolvedAt);
        const totalResolveTime = resolvedIncidents.reduce((sum, i) => {
          const time = i.resolvedAt!.getTime() - new Date(i.triggeredAt).getTime();
          return sum + time;
        }, 0);

        return {
          id: service.id,
          name: service.name,
          incidentCount: service.incidents.length,
          avgResolutionTime: resolvedIncidents.length > 0
            ? Math.floor(totalResolveTime / resolvedIncidents.length / 1000)
            : 0,
        };
      })
      .sort((a, b) => b.incidentCount - a.incidentCount);
  }

  /**
   * Get team breakdown
   */
  private async getTeamBreakdown(_incidents: Incident[]): Promise<ReportData['teams']> {
    // For team breakdown, we'd need to load team assignments
    // This is a simplified version - extend as needed
    return [];
  }

  /**
   * Get responder metrics
   */
  private async getResponderMetrics(incidents: Incident[]): Promise<ReportData['responders']> {
    const responderMap = new Map<string, {
      id: string;
      name: string;
      acknowledgedIncidents: Incident[];
      resolvedIncidents: Incident[];
    }>();

    for (const incident of incidents) {
      // Track acknowledgers
      if (incident.acknowledgedByUser) {
        const userId = incident.acknowledgedByUser.id;
        if (!responderMap.has(userId)) {
          responderMap.set(userId, {
            id: userId,
            name: incident.acknowledgedByUser.fullName || incident.acknowledgedByUser.email,
            acknowledgedIncidents: [],
            resolvedIncidents: [],
          });
        }
        responderMap.get(userId)!.acknowledgedIncidents.push(incident);
      }

      // Track resolvers
      if (incident.resolvedByUser) {
        const userId = incident.resolvedByUser.id;
        if (!responderMap.has(userId)) {
          responderMap.set(userId, {
            id: userId,
            name: incident.resolvedByUser.fullName || incident.resolvedByUser.email,
            acknowledgedIncidents: [],
            resolvedIncidents: [],
          });
        }
        responderMap.get(userId)!.resolvedIncidents.push(incident);
      }
    }

    return Array.from(responderMap.values())
      .map(responder => {
        const ackTimes = responder.acknowledgedIncidents
          .filter(i => i.acknowledgedAt)
          .map(i => i.acknowledgedAt!.getTime() - new Date(i.triggeredAt).getTime());

        const resolveTimes = responder.resolvedIncidents
          .filter(i => i.resolvedAt)
          .map(i => i.resolvedAt!.getTime() - new Date(i.triggeredAt).getTime());

        return {
          id: responder.id,
          name: responder.name,
          incidentsHandled: Math.max(responder.acknowledgedIncidents.length, responder.resolvedIncidents.length),
          avgAcknowledgeTime: ackTimes.length > 0
            ? Math.floor(ackTimes.reduce((sum, t) => sum + t, 0) / ackTimes.length / 1000)
            : 0,
          avgResolveTime: resolveTimes.length > 0
            ? Math.floor(resolveTimes.reduce((sum, t) => sum + t, 0) / resolveTimes.length / 1000)
            : 0,
        };
      })
      .sort((a, b) => b.incidentsHandled - a.incidentsHandled);
  }

  /**
   * Extract RCAs from incident resolution notes
   */
  private async extractRCAs(
    incidents: Incident[],
    eventRepo: any
  ): Promise<ReportData['rcas']> {
    const rcas: ReportData['rcas'] = [];

    for (const incident of incidents) {
      if (incident.state !== 'resolved' || !incident.resolvedAt) {
        continue;
      }

      // Find resolution event with RCA
      const events = await eventRepo.find({
        where: { incidentId: incident.id, type: In(['resolve', 'note']) },
        order: { createdAt: 'DESC' },
      });

      // Look for RCA in event payload or message
      for (const event of events) {
        const message = event.message || '';
        const payload = event.payload || {};

        // Check if this looks like an RCA (contains keywords)
        const isRCA = message.toLowerCase().includes('root cause') ||
                     message.toLowerCase().includes('rca:') ||
                     payload.rca ||
                     (message.length > 50 && event.type === 'resolve');

        if (isRCA) {
          rcas.push({
            incidentId: incident.id,
            incidentNumber: incident.incidentNumber,
            summary: incident.summary,
            severity: incident.severity,
            resolvedAt: incident.resolvedAt.toISOString(),
            rca: payload.rca || message,
            preventiveMeasures: payload.preventiveMeasures,
          });
          break; // Only include one RCA per incident
        }
      }
    }

    return rcas.sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime());
  }

  /**
   * Analyze trends over the period
   */
  private async analyzeTrends(
    incidents: Incident[],
    _start: Date,
    _end: Date
  ): Promise<ReportData['trends']> {
    const dailyCounts: Array<{ date: string; count: number }> = [];
    const severityTrend: Array<{ date: string; severity: string; count: number }> = [];

    // Group incidents by day
    const dayMap = new Map<string, Incident[]>();

    for (const incident of incidents) {
      const day = new Date(incident.triggeredAt).toISOString().split('T')[0];
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(incident);
    }

    // Generate daily counts
    for (const [day, dayIncidents] of dayMap.entries()) {
      dailyCounts.push({
        date: day,
        count: dayIncidents.length,
      });

      // Severity breakdown per day
      const severityCounts: Record<string, number> = {};
      for (const incident of dayIncidents) {
        severityCounts[incident.severity] = (severityCounts[incident.severity] || 0) + 1;
      }

      for (const [severity, count] of Object.entries(severityCounts)) {
        severityTrend.push({ date: day, severity, count });
      }
    }

    return {
      dailyCounts: dailyCounts.sort((a, b) => a.date.localeCompare(b.date)),
      severityTrend: severityTrend.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
