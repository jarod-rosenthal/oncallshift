import { Router, Request, Response } from 'express';
import { getDataSource } from '../../shared/db/data-source';
import { IncidentReport, ReportExecution } from '../../shared/models';
import { ReportGenerationService } from '../../shared/services/report-generation-service';
import { ReportDeliveryService } from '../../shared/services/report-delivery';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/v1/reports
 * List all reports for the organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);

    const reports = await reportRepo.find({
      where: { orgId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });

    return res.json({
      reports: reports.map(report => ({
        id: report.id,
        name: report.name,
        description: report.description,
        schedule: report.schedule,
        scheduleDescription: report.getScheduleDescription(),
        format: report.format,
        enabled: report.enabled,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        config: report.config,
        deliveryConfig: report.deliveryConfig,
        createdBy: report.creator ? {
          id: report.creator.id,
          name: report.creator.fullName || report.creator.email,
        } : null,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
    });
  } catch (error: any) {
    logger.error('Error listing reports:', error);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * POST /api/v1/reports
 * Create a new report
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const user = req.user!;
    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);

    const {
      name,
      description,
      schedule,
      scheduleDay,
      scheduleHour,
      format,
      config,
      deliveryConfig,
      enabled,
    } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Report name is required' });
    }

    const report = reportRepo.create({
      orgId,
      name: name.trim(),
      description: description?.trim() || null,
      schedule: schedule || 'manual',
      scheduleDay: scheduleDay || null,
      scheduleHour: scheduleHour ?? 9,
      format: format || 'summary',
      config: config || {},
      deliveryConfig: deliveryConfig || {},
      enabled: enabled ?? true,
      createdBy: user.id,
    });

    // Calculate next run time if scheduled
    if (report.isScheduled()) {
      report.nextRunAt = report.calculateNextRun();
    }

    await reportRepo.save(report);

    logger.info('Report created', {
      reportId: report.id,
      name: report.name,
      schedule: report.schedule,
      createdBy: user.id,
    });

    return res.status(201).json({
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        schedule: report.schedule,
        scheduleDescription: report.getScheduleDescription(),
        format: report.format,
        enabled: report.enabled,
        nextRunAt: report.nextRunAt,
        config: report.config,
        deliveryConfig: report.deliveryConfig,
        createdAt: report.createdAt,
      },
    });
  } catch (error: any) {
    logger.error('Error creating report:', error);
    return res.status(500).json({ error: 'Failed to create report' });
  }
});

/**
 * PUT /api/v1/reports/:id
 * Update a report
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);

    const report = await reportRepo.findOne({
      where: { id, orgId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const {
      name,
      description,
      schedule,
      scheduleDay,
      scheduleHour,
      format,
      config,
      deliveryConfig,
      enabled,
    } = req.body;

    // Update fields
    if (name !== undefined) report.name = name.trim();
    if (description !== undefined) report.description = description?.trim() || null;
    if (schedule !== undefined) report.schedule = schedule;
    if (scheduleDay !== undefined) report.scheduleDay = scheduleDay;
    if (scheduleHour !== undefined) report.scheduleHour = scheduleHour;
    if (format !== undefined) report.format = format;
    if (config !== undefined) report.config = config;
    if (deliveryConfig !== undefined) report.deliveryConfig = deliveryConfig;
    if (enabled !== undefined) report.enabled = enabled;

    // Recalculate next run if schedule changed
    if (schedule !== undefined || scheduleDay !== undefined || scheduleHour !== undefined) {
      report.nextRunAt = report.calculateNextRun();
    }

    await reportRepo.save(report);

    logger.info('Report updated', {
      reportId: report.id,
      name: report.name,
    });

    return res.json({
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        schedule: report.schedule,
        scheduleDescription: report.getScheduleDescription(),
        format: report.format,
        enabled: report.enabled,
        nextRunAt: report.nextRunAt,
        config: report.config,
        deliveryConfig: report.deliveryConfig,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error('Error updating report:', error);
    return res.status(500).json({ error: 'Failed to update report' });
  }
});

/**
 * DELETE /api/v1/reports/:id
 * Delete a report
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);

    const report = await reportRepo.findOne({
      where: { id, orgId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await reportRepo.remove(report);

    logger.info('Report deleted', {
      reportId: id,
      name: report.name,
    });

    return res.json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting report:', error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
});

/**
 * POST /api/v1/reports/:id/run
 * Manually trigger a report
 */
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const user = req.user!;
    const { periodStart, periodEnd } = req.body;

    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);

    const report = await reportRepo.findOne({
      where: { id, orgId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Parse dates or use defaults (last 7 days)
    const end = periodEnd ? new Date(periodEnd) : new Date();
    const start = periodStart ? new Date(periodStart) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Generate report
    const reportService = new ReportGenerationService(dataSource);
    const execution = await reportService.generateReport(report, start, end, user.id);

    // Update last run time
    report.lastRunAt = new Date();
    await reportRepo.save(report);

    logger.info('Report triggered manually', {
      reportId: report.id,
      executionId: execution.id,
      triggeredBy: user.id,
    });

    return res.json({
      execution: {
        id: execution.id,
        status: execution.status,
        periodStart: execution.periodStart,
        periodEnd: execution.periodEnd,
        data: execution.data,
        createdAt: execution.createdAt,
        completedAt: execution.completedAt,
      },
    });
  } catch (error: any) {
    logger.error('Error running report:', error);
    return res.status(500).json({ error: 'Failed to run report' });
  }
});

/**
 * GET /api/v1/reports/:id/executions
 * Get execution history for a report
 */
router.get('/:id/executions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const limit = parseInt(req.query.limit as string) || 20;

    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(ReportExecution);

    // Verify report exists and belongs to org
    const reportRepo = dataSource.getRepository(IncidentReport);
    const report = await reportRepo.findOne({
      where: { id, orgId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const executions = await executionRepo.find({
      where: { reportId: id },
      relations: ['triggeredByUser'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return res.json({
      executions: executions.map(exec => ({
        id: exec.id,
        status: exec.status,
        periodStart: exec.periodStart,
        periodEnd: exec.periodEnd,
        data: exec.data,
        deliveryStatus: exec.deliveryStatus,
        triggeredBy: exec.triggeredByUser ? {
          id: exec.triggeredByUser.id,
          name: exec.triggeredByUser.fullName || exec.triggeredByUser.email,
        } : null,
        createdAt: exec.createdAt,
        completedAt: exec.completedAt,
        durationSeconds: exec.getDurationSeconds(),
      })),
    });
  } catch (error: any) {
    logger.error('Error listing executions:', error);
    return res.status(500).json({ error: 'Failed to list executions' });
  }
});

/**
 * POST /api/v1/reports/executions/:id/deliver
 * Manually trigger delivery for an existing execution
 */
router.post('/executions/:executionId/deliver', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(ReportExecution);
    const reportRepo = dataSource.getRepository(IncidentReport);

    const execution = await executionRepo.findOne({
      where: { id: executionId, orgId },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Report execution not found' });
    }

    const report = await reportRepo.findOne({
      where: { id: execution.reportId, orgId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (execution.status !== 'completed') {
      return res.status(400).json({ error: 'Can only deliver completed reports' });
    }

    // Deliver the report
    const deliveryService = new ReportDeliveryService(dataSource);
    const deliveryStatus = await deliveryService.deliverReport(report, execution);

    logger.info('Report delivery triggered manually', {
      reportId: report.id,
      executionId: execution.id,
      deliveryStatus,
    });

    return res.json({
      message: 'Report delivery triggered',
      deliveryStatus,
    });
  } catch (error: any) {
    logger.error('Error delivering report:', error);
    return res.status(500).json({ error: 'Failed to deliver report' });
  }
});

export default router;
