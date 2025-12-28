import { Router, Request, Response } from 'express';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, Service, Schedule, User } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { In } from 'typeorm';

const router = Router();

/**
 * GET /api/v1/demo/dashboard
 * Public endpoint for demo dashboard - NO AUTH REQUIRED
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    // Get incidents with related data
    const incidents = await incidentRepo.find({
      relations: ['service', 'acknowledgedByUser', 'resolvedByUser'],
      order: { triggeredAt: 'DESC' },
      take: 20,
    });

    // Get services count
    const servicesCount = await serviceRepo.count({
      where: { status: 'active' },
    });

    // Get schedules
    const schedules = await scheduleRepo.find();

    // Get on-call users for schedules
    const oncallUserIds = schedules
      .map(s => s.getCurrentOncallUserId())
      .filter((id): id is string => id !== null);

    const oncallUsers = oncallUserIds.length > 0
      ? await userRepo.find({ where: { id: In(oncallUserIds) } })
      : [];

    const userMap = new Map(oncallUsers.map(u => [u.id, u]));

    // Calculate statistics
    const stats = {
      total: incidents.length,
      triggered: incidents.filter(i => i.state === 'triggered').length,
      acknowledged: incidents.filter(i => i.state === 'acknowledged').length,
      resolved: incidents.filter(i => i.state === 'resolved').length,
      critical: incidents.filter(i => i.severity === 'critical' && i.state !== 'resolved').length,
      warning: incidents.filter(i => i.severity === 'warning' && i.state !== 'resolved').length,
      info: incidents.filter(i => i.severity === 'info' && i.state !== 'resolved').length,
    };

    // Format incidents for response
    const formattedIncidents = incidents.map(incident => ({
      id: incident.id,
      number: incident.incidentNumber,
      summary: incident.summary,
      severity: incident.severity,
      state: incident.state,
      service: {
        id: incident.service.id,
        name: incident.service.name,
      },
      triggeredAt: incident.triggeredAt,
      acknowledgedAt: incident.acknowledgedAt,
      acknowledgedBy: incident.acknowledgedByUser ? {
        id: incident.acknowledgedByUser.id,
        fullName: incident.acknowledgedByUser.fullName,
      } : null,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedByUser ? {
        id: incident.resolvedByUser.id,
        fullName: incident.resolvedByUser.fullName,
      } : null,
      details: incident.details,
      eventCount: incident.eventCount,
    }));

    // Format on-call info
    const oncallInfo = schedules.map(schedule => {
      const oncallUserId = schedule.getCurrentOncallUserId();
      const oncallUser = oncallUserId ? userMap.get(oncallUserId) : null;

      return {
        schedule: {
          id: schedule.id,
          name: schedule.name,
        },
        oncallUser: oncallUser ? {
          id: oncallUser.id,
          fullName: oncallUser.fullName,
          email: oncallUser.email,
        } : null,
        isOverride: schedule.overrideUserId !== null,
      };
    });

    return res.json({
      stats,
      incidents: formattedIncidents,
      servicesCount,
      oncallInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching demo dashboard:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/v1/demo/services
 * Public endpoint to list services - NO AUTH REQUIRED
 */
router.get('/services', async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const services = await serviceRepo.find({
      where: { status: 'active' },
      relations: ['schedule'],
    });

    const formattedServices = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      status: service.status,
      schedule: service.schedule ? {
        id: service.schedule.id,
        name: service.schedule.name,
      } : null,
    }));

    return res.json({
      services: formattedServices,
      count: services.length,
    });
  } catch (error) {
    logger.error('Error fetching services:', error);
    return res.status(500).json({ error: 'Failed to fetch services' });
  }
});

export default router;
