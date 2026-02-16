import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, User, Team, Service, ScheduleLayerMember } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { Between, In } from 'typeorm';

const router = Router();

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * Helper to get date range from query params
 */
function getDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  return { start, end };
}

/**
 * Format minutes as human-readable string
 */
function formatMinutes(minutes: number): string {
  if (minutes === 0) return '-';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Helper to calculate MTTA and MTTR
 */
function calculateMetrics(incidents: Incident[]): {
  mtta: { minutes: number; formatted: string } | null;
  mttr: { minutes: number; formatted: string } | null;
  totalIncidents: number;
  byState: { triggered: number; acknowledged: number; resolved: number };
} {
  let totalAckTime = 0;
  let ackCount = 0;
  let totalResolveTime = 0;
  let resolveCount = 0;

  incidents.forEach((incident) => {
    const triggeredAt = new Date(incident.triggeredAt).getTime();
    if (incident.acknowledgedAt) {
      const ackAt = new Date(incident.acknowledgedAt).getTime();
      totalAckTime += (ackAt - triggeredAt) / 60000; // Convert to minutes
      ackCount++;
    }
    if (incident.resolvedAt) {
      const resolvedAt = new Date(incident.resolvedAt).getTime();
      totalResolveTime += (resolvedAt - triggeredAt) / 60000; // Convert to minutes
      resolveCount++;
    }
  });

  const mttaMinutes = ackCount > 0 ? Math.round(totalAckTime / ackCount) : 0;
  const mttrMinutes = resolveCount > 0 ? Math.round(totalResolveTime / resolveCount) : 0;

  return {
    mtta: ackCount > 0 ? { minutes: mttaMinutes, formatted: formatMinutes(mttaMinutes) } : null,
    mttr: resolveCount > 0 ? { minutes: mttrMinutes, formatted: formatMinutes(mttrMinutes) } : null,
    totalIncidents: incidents.length,
    byState: {
      triggered: incidents.filter(i => i.state === 'triggered').length,
      acknowledged: incidents.filter(i => i.state === 'acknowledged').length,
      resolved: incidents.filter(i => i.state === 'resolved').length,
    },
  };
}

/**
 * GET /api/v1/analytics/overview
 * Get organization-wide analytics with optional date range
 */
router.get(
  '/overview',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      const incidents = await incidentRepo.find({
        where: {
          orgId,
          triggeredAt: Between(start, end),
        },
        relations: ['service'],
      });

      const metrics = calculateMetrics(incidents);

      // Incidents by severity
      const bySeverity = {
        critical: incidents.filter(i => i.severity === 'critical').length,
        error: incidents.filter(i => i.severity === 'error').length,
        warning: incidents.filter(i => i.severity === 'warning').length,
        info: incidents.filter(i => i.severity === 'info').length,
      };

      // Incidents by service
      const serviceMap = new Map<string, { name: string; count: number }>();
      incidents.forEach((incident) => {
        const existing = serviceMap.get(incident.service.id);
        if (existing) {
          existing.count++;
        } else {
          serviceMap.set(incident.service.id, {
            name: incident.service.name,
            count: 1,
          });
        }
      });
      const incidentsByService = Array.from(serviceMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Daily trend (renamed to incidentsByDay for frontend)
      const dailyMap = new Map<string, number>();
      incidents.forEach((incident) => {
        const dateStr = new Date(incident.triggeredAt).toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
      });
      const incidentsByDay = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return res.json({
        ...metrics,
        bySeverity,
        incidentsByService,
        incidentsByDay,
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching analytics overview:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

/**
 * GET /api/v1/analytics/teams
 * Get list of teams with basic metrics for selector
 */
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);

    const teams = await teamRepo.find({
      where: { orgId },
      relations: ['memberships'],
      order: { name: 'ASC' },
    });

    return res.json({
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        memberCount: team.memberships?.length || 0,
      })),
    });
  } catch (error) {
    logger.error('Error fetching teams for analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

/**
 * GET /api/v1/analytics/teams/:teamId
 * Get team-level metrics
 */
router.get(
  '/teams/:teamId',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { teamId } = req.params;
      const { startDate, endDate } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const teamRepo = dataSource.getRepository(Team);
      const incidentRepo = dataSource.getRepository(Incident);
      const serviceRepo = dataSource.getRepository(Service);

      // Get team
      const team = await teamRepo.findOne({
        where: { id: teamId, orgId },
        relations: ['memberships', 'memberships.user'],
      });

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Get services owned by this team
      const services = await serviceRepo.find({
        where: { orgId, teamId },
      });
      const serviceIds = services.map(s => s.id);

      // Get incidents for team's services
      let incidents: Incident[] = [];
      if (serviceIds.length > 0) {
        incidents = await incidentRepo.find({
          where: {
            orgId,
            serviceId: In(serviceIds),
            triggeredAt: Between(start, end),
          },
          relations: ['service', 'acknowledgedByUser', 'resolvedByUser'],
        });
      }

      const metrics = calculateMetrics(incidents);

      // Get team member IDs
      const memberIds = team.memberships?.map(m => m.userId) || [];

      // Incidents handled by team members (acknowledged or resolved by them)
      const handledByTeam = incidents.filter(
        i => (i.acknowledgedBy && memberIds.includes(i.acknowledgedBy)) ||
             (i.resolvedBy && memberIds.includes(i.resolvedBy))
      );

      // Top responders in team
      const responderMap = new Map<string, { userId: string; name: string; email: string; count: number; avgResponseTime: number; totalResponseTime: number }>();

      incidents.forEach((incident) => {
        if (incident.acknowledgedBy && memberIds.includes(incident.acknowledgedBy)) {
          const user = incident.acknowledgedByUser;
          const existing = responderMap.get(incident.acknowledgedBy);
          const responseTime = incident.acknowledgedAt
            ? (new Date(incident.acknowledgedAt).getTime() - new Date(incident.triggeredAt).getTime()) / 60000
            : 0;

          if (existing) {
            existing.count++;
            existing.totalResponseTime += responseTime;
            existing.avgResponseTime = existing.totalResponseTime / existing.count;
          } else {
            responderMap.set(incident.acknowledgedBy, {
              userId: incident.acknowledgedBy,
              name: user?.fullName || 'Unknown',
              email: user?.email || '',
              count: 1,
              avgResponseTime: responseTime,
              totalResponseTime: responseTime,
            });
          }
        }
      });

      const topResponders = Array.from(responderMap.values())
        .map(({ totalResponseTime, ...rest }) => rest)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Incidents by service
      const serviceIncidentMap = new Map<string, { name: string; count: number }>();
      incidents.forEach((incident) => {
        const existing = serviceIncidentMap.get(incident.service.id);
        if (existing) {
          existing.count++;
        } else {
          serviceIncidentMap.set(incident.service.id, {
            name: incident.service.name,
            count: 1,
          });
        }
      });
      const incidentsByService = Array.from(serviceIncidentMap.values())
        .sort((a, b) => b.count - a.count);

      return res.json({
        team: {
          id: team.id,
          name: team.name,
          memberCount: memberIds.length,
        },
        metrics: {
          ...metrics,
          incidentsHandledByTeam: handledByTeam.length,
        },
        topResponders,
        incidentsByService,
        serviceCount: services.length,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching team analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch team analytics' });
    }
  }
);

/**
 * GET /api/v1/analytics/users/:userId
 * Get user-level metrics
 */
router.get(
  '/users/:userId',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);
      const incidentRepo = dataSource.getRepository(Incident);
      const scheduleMemberRepo = dataSource.getRepository(ScheduleLayerMember);

      // Get user
      const user = await userRepo.findOne({
        where: { id: userId, orgId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get incidents acknowledged by this user
      const acknowledgedIncidents = await incidentRepo.find({
        where: {
          orgId,
          acknowledgedBy: userId,
          triggeredAt: Between(start, end),
        },
        relations: ['service'],
      });

      // Get incidents resolved by this user
      const resolvedIncidents = await incidentRepo.find({
        where: {
          orgId,
          resolvedBy: userId,
          triggeredAt: Between(start, end),
        },
        relations: ['service'],
      });

      // Calculate response times
      let totalAckTime = 0;
      let totalResolveTime = 0;

      acknowledgedIncidents.forEach((incident) => {
        if (incident.acknowledgedAt) {
          const triggeredAt = new Date(incident.triggeredAt).getTime();
          const ackAt = new Date(incident.acknowledgedAt).getTime();
          totalAckTime += (ackAt - triggeredAt) / 60000;
        }
      });

      resolvedIncidents.forEach((incident) => {
        if (incident.resolvedAt) {
          const triggeredAt = new Date(incident.triggeredAt).getTime();
          const resolvedAt = new Date(incident.resolvedAt).getTime();
          totalResolveTime += (resolvedAt - triggeredAt) / 60000;
        }
      });

      const avgAckTime = acknowledgedIncidents.length > 0
        ? Math.round(totalAckTime / acknowledgedIncidents.length)
        : 0;
      const avgResolveTime = resolvedIncidents.length > 0
        ? Math.round(totalResolveTime / resolvedIncidents.length)
        : 0;

      // Calculate on-call hours (estimate based on schedule memberships)
      const scheduleMemberships = await scheduleMemberRepo.find({
        where: { userId },
        relations: ['layer', 'layer.schedule'],
      });

      // Estimate on-call hours based on rotation
      let estimatedOnCallHours = 0;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

      scheduleMemberships.forEach((membership) => {
        const layer = membership.layer;
        if (layer) {
          const membersInLayer = 1; // Would need to count other members
          // Get rotation days based on rotation type
          let rotationDays = 7; // default to weekly
          if (layer.rotationType === 'daily') {
            rotationDays = 1;
          } else if (layer.rotationType === 'custom') {
            rotationDays = layer.rotationLength || 7;
          }
          const onCallDaysPerRotation = rotationDays / membersInLayer;
          const rotationsInPeriod = daysDiff / rotationDays;
          estimatedOnCallHours += rotationsInPeriod * onCallDaysPerRotation * 24;
        }
      });

      // Incidents by severity
      const allUserIncidents = [...new Set([...acknowledgedIncidents, ...resolvedIncidents])];
      const incidentsBySeverity = {
        critical: allUserIncidents.filter(i => i.severity === 'critical').length,
        error: allUserIncidents.filter(i => i.severity === 'error').length,
        warning: allUserIncidents.filter(i => i.severity === 'warning').length,
        info: allUserIncidents.filter(i => i.severity === 'info').length,
      };

      // Daily activity
      const dailyMap = new Map<string, number>();
      allUserIncidents.forEach((incident) => {
        const dateStr = incident.acknowledgedAt
          ? new Date(incident.acknowledgedAt).toISOString().split('T')[0]
          : new Date(incident.triggeredAt).toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
      });
      const dailyActivity = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return res.json({
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
        metrics: {
          incidentsAcknowledged: acknowledgedIncidents.length,
          incidentsResolved: resolvedIncidents.length,
          avgAcknowledgeTime: avgAckTime,
          avgResolveTime: avgResolveTime,
          estimatedOnCallHours: Math.round(estimatedOnCallHours),
        },
        incidentsBySeverity,
        dailyActivity,
        scheduleCount: scheduleMemberships.length,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching user analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch user analytics' });
    }
  }
);

/**
 * GET /api/v1/analytics/top-responders
 * Get top responders across the organization
 */
router.get(
  '/top-responders',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, limit = 10 } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      const incidents = await incidentRepo.find({
        where: {
          orgId,
          triggeredAt: Between(start, end),
        },
        relations: ['acknowledgedByUser', 'resolvedByUser'],
      });

      // Build responder stats
      const responderMap = new Map<string, {
        userId: string;
        name: string;
        email: string;
        profilePictureUrl: string | null;
        acknowledged: number;
        resolved: number;
        avgResponseTime: number;
        totalResponseTime: number;
        responseCount: number;
      }>();

      incidents.forEach((incident) => {
        // Track acknowledged by
        if (incident.acknowledgedBy && incident.acknowledgedByUser) {
          const user = incident.acknowledgedByUser;
          const existing = responderMap.get(user.id);
          const responseTime = incident.acknowledgedAt
            ? (new Date(incident.acknowledgedAt).getTime() - new Date(incident.triggeredAt).getTime()) / 60000
            : 0;

          if (existing) {
            existing.acknowledged++;
            existing.totalResponseTime += responseTime;
            existing.responseCount++;
            existing.avgResponseTime = existing.totalResponseTime / existing.responseCount;
          } else {
            responderMap.set(user.id, {
              userId: user.id,
              name: user.fullName || user.email,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl || null,
              acknowledged: 1,
              resolved: 0,
              avgResponseTime: responseTime,
              totalResponseTime: responseTime,
              responseCount: 1,
            });
          }
        }

        // Track resolved by
        if (incident.resolvedBy && incident.resolvedByUser) {
          const user = incident.resolvedByUser;
          const existing = responderMap.get(user.id);

          if (existing) {
            existing.resolved++;
          } else {
            responderMap.set(user.id, {
              userId: user.id,
              name: user.fullName || user.email,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl || null,
              acknowledged: 0,
              resolved: 1,
              avgResponseTime: 0,
              totalResponseTime: 0,
              responseCount: 0,
            });
          }
        }
      });

      const topResponders = Array.from(responderMap.values())
        .map(({ totalResponseTime, responseCount, ...rest }) => ({
          ...rest,
          totalHandled: rest.acknowledged + rest.resolved,
        }))
        .sort((a, b) => b.totalHandled - a.totalHandled)
        .slice(0, limit as number);

      return res.json({
        topResponders,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching top responders:', error);
      return res.status(500).json({ error: 'Failed to fetch top responders' });
    }
  }
);

/**
 * GET /api/v1/analytics/sla
 * Get SLA compliance metrics
 */
router.get(
  '/sla',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('ackTargetMinutes').optional().isInt({ min: 1 }).toInt(),
    query('resolveTargetMinutes').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, ackTargetMinutes = 15, resolveTargetMinutes = 60 } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      const incidents = await incidentRepo.find({
        where: {
          orgId,
          triggeredAt: Between(start, end),
        },
        relations: ['service'],
      });

      // Calculate SLA compliance
      let ackWithinTarget = 0;
      let ackOutsideTarget = 0;
      let resolveWithinTarget = 0;
      let resolveOutsideTarget = 0;
      let noAck = 0;
      let noResolve = 0;

      const ackTarget = (ackTargetMinutes as number) * 60 * 1000; // Convert to ms
      const resolveTarget = (resolveTargetMinutes as number) * 60 * 1000;

      // SLA by severity
      const slaBySeverity: Record<string, { total: number; ackCompliant: number; resolveCompliant: number }> = {
        critical: { total: 0, ackCompliant: 0, resolveCompliant: 0 },
        error: { total: 0, ackCompliant: 0, resolveCompliant: 0 },
        warning: { total: 0, ackCompliant: 0, resolveCompliant: 0 },
        info: { total: 0, ackCompliant: 0, resolveCompliant: 0 },
      };

      // SLA by service
      const slaByService = new Map<string, {
        name: string;
        total: number;
        ackCompliant: number;
        resolveCompliant: number
      }>();

      // Daily SLA trend
      const dailySlaMap = new Map<string, {
        total: number;
        ackCompliant: number;
        resolveCompliant: number
      }>();

      incidents.forEach((incident) => {
        const triggeredAt = new Date(incident.triggeredAt).getTime();
        const dateStr = new Date(incident.triggeredAt).toISOString().split('T')[0];

        // Initialize daily entry
        if (!dailySlaMap.has(dateStr)) {
          dailySlaMap.set(dateStr, { total: 0, ackCompliant: 0, resolveCompliant: 0 });
        }
        const daily = dailySlaMap.get(dateStr)!;
        daily.total++;

        // Initialize severity entry
        const severity = incident.severity || 'info';
        if (slaBySeverity[severity]) {
          slaBySeverity[severity].total++;
        }

        // Initialize service entry
        const serviceId = incident.service.id;
        if (!slaByService.has(serviceId)) {
          slaByService.set(serviceId, {
            name: incident.service.name,
            total: 0,
            ackCompliant: 0,
            resolveCompliant: 0
          });
        }
        const serviceSla = slaByService.get(serviceId)!;
        serviceSla.total++;

        // Check acknowledgement SLA
        if (incident.acknowledgedAt) {
          const ackAt = new Date(incident.acknowledgedAt).getTime();
          const ackTime = ackAt - triggeredAt;
          if (ackTime <= ackTarget) {
            ackWithinTarget++;
            daily.ackCompliant++;
            if (slaBySeverity[severity]) slaBySeverity[severity].ackCompliant++;
            serviceSla.ackCompliant++;
          } else {
            ackOutsideTarget++;
          }
        } else {
          noAck++;
        }

        // Check resolution SLA
        if (incident.resolvedAt) {
          const resolveAt = new Date(incident.resolvedAt).getTime();
          const resolveTime = resolveAt - triggeredAt;
          if (resolveTime <= resolveTarget) {
            resolveWithinTarget++;
            daily.resolveCompliant++;
            if (slaBySeverity[severity]) slaBySeverity[severity].resolveCompliant++;
            serviceSla.resolveCompliant++;
          } else {
            resolveOutsideTarget++;
          }
        } else {
          noResolve++;
        }
      });

      const totalIncidents = incidents.length;
      const totalAcknowledged = ackWithinTarget + ackOutsideTarget;
      const totalResolved = resolveWithinTarget + resolveOutsideTarget;

      const ackComplianceRate = totalAcknowledged > 0
        ? Math.round((ackWithinTarget / totalAcknowledged) * 100)
        : 0;
      const resolveComplianceRate = totalResolved > 0
        ? Math.round((resolveWithinTarget / totalResolved) * 100)
        : 0;

      // Convert maps to arrays
      const slaByServiceArray = Array.from(slaByService.values())
        .map(s => ({
          ...s,
          ackComplianceRate: s.total > 0 ? Math.round((s.ackCompliant / s.total) * 100) : 0,
          resolveComplianceRate: s.total > 0 ? Math.round((s.resolveCompliant / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const dailySlaTrend = Array.from(dailySlaMap.entries())
        .map(([date, data]) => ({
          date,
          ...data,
          ackComplianceRate: data.total > 0 ? Math.round((data.ackCompliant / data.total) * 100) : 0,
          resolveComplianceRate: data.total > 0 ? Math.round((data.resolveCompliant / data.total) * 100) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Convert severity SLA to include rates
      const slaBySeverityWithRates = Object.entries(slaBySeverity).reduce((acc, [key, value]) => {
        acc[key] = {
          ...value,
          ackComplianceRate: value.total > 0 ? Math.round((value.ackCompliant / value.total) * 100) : 0,
          resolveComplianceRate: value.total > 0 ? Math.round((value.resolveCompliant / value.total) * 100) : 0,
        };
        return acc;
      }, {} as Record<string, any>);

      return res.json({
        summary: {
          totalIncidents,
          ackTarget: ackTargetMinutes,
          resolveTarget: resolveTargetMinutes,
          ackComplianceRate,
          resolveComplianceRate,
          ackWithinTarget,
          ackOutsideTarget,
          noAck,
          resolveWithinTarget,
          resolveOutsideTarget,
          noResolve,
        },
        slaBySeverity: slaBySeverityWithRates,
        slaByService: slaByServiceArray,
        dailyTrend: dailySlaTrend,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching SLA analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch SLA analytics' });
    }
  }
);

/**
 * GET /api/v1/analytics/heatmap
 * Get incident heatmap showing incident counts by day-of-week and hour
 */
router.get(
  '/heatmap',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('severity').optional().isIn(['critical', 'error', 'warning', 'info']),
    query('serviceId').optional().isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, severity, serviceId } = req.query;
      const orgId = req.orgId!;
      const { start, end } = getDateRange(startDate as string, endDate as string);

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      // Build query conditions
      const whereConditions: any = {
        orgId,
        triggeredAt: Between(start, end),
      };

      if (severity) {
        whereConditions.severity = severity;
      }

      if (serviceId) {
        whereConditions.serviceId = serviceId;
      }

      const incidents = await incidentRepo.find({
        where: whereConditions,
        relations: ['service'],
      });

      // Initialize heatmap data structure - dayOfWeek (0-6) x hour (0-23)
      const heatmapData: Array<{ dayOfWeek: number; hour: number; count: number }> = [];

      // Create a map for fast lookups during aggregation
      const heatmapMap = new Map<string, number>();

      // Initialize all buckets with 0
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          heatmapMap.set(key, 0);
          heatmapData.push({ dayOfWeek: day, hour, count: 0 });
        }
      }

      // Aggregate incidents by day of week and hour
      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const hour = date.getUTCHours(); // 0-23
        const key = `${dayOfWeek}-${hour}`;

        const currentCount = heatmapMap.get(key) || 0;
        heatmapMap.set(key, currentCount + 1);
      });

      // Update heatmapData with actual counts
      heatmapData.forEach((bucket) => {
        const key = `${bucket.dayOfWeek}-${bucket.hour}`;
        bucket.count = heatmapMap.get(key) || 0;
      });

      // Calculate summary stats
      const totalIncidents = incidents.length;
      const maxCount = Math.max(...heatmapData.map(d => d.count), 0);
      const avgCount = totalIncidents > 0 ? Math.round(totalIncidents / 168) : 0; // 168 = 7 days * 24 hours

      // Find peak hours
      const peakHour = heatmapData.reduce((prev, curr) =>
        curr.count > prev.count ? curr : prev
      );

      return res.json({
        data: heatmapData,
        summary: {
          totalIncidents,
          maxCount,
          avgCount,
          peakHour: {
            dayOfWeek: peakHour.dayOfWeek,
            hour: peakHour.hour,
            count: peakHour.count,
          },
        },
        filters: {
          severity: severity || null,
          serviceId: serviceId || null,
        },
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
      });
    } catch (error) {
      logger.error('Error fetching heatmap analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch heatmap analytics' });
    }
  }
);

export default router;
