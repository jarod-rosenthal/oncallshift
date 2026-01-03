import { Router, Request, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { Like, MoreThanOrEqual, LessThanOrEqual, FindOptionsWhere } from 'typeorm';
import { getDataSource } from '../../shared/db/data-source';
import { IncidentReport, ReportExecution } from '../../shared/models';
import { ReportGenerationService } from '../../shared/services/report-generation-service';
import { ReportDeliveryService } from '../../shared/services/report-delivery';
import { logger } from '../../shared/utils/logger';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators, sinceFilterValidator, untilFilterValidator, searchFilterValidator } from '../../shared/validators/pagination';
import { badRequest, notFound, internalError, validationError, fromExpressValidator } from '../../shared/utils/problem-details';

const router = Router();

/**
 * GET /api/v1/reports
 * List all reports for the organization
 */
router.get(
  '/',
  [
    ...paginationValidators,
    query('schedule').optional().isIn(['manual', 'daily', 'weekly', 'monthly']).withMessage('schedule must be manual, daily, weekly, or monthly'),
    query('enabled').optional().isBoolean().withMessage('enabled must be true or false'),
    searchFilterValidator,
    sinceFilterValidator,
    untilFilterValidator,
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('reports', pagination.sort, 'createdAt');
      const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

      const { schedule, enabled, search, since, until } = req.query;

      const dataSource = await getDataSource();
      const reportRepo = dataSource.getRepository(IncidentReport);

      // Build where clause with filters
      const whereClause: FindOptionsWhere<IncidentReport> = { orgId };

      if (schedule) {
        whereClause.schedule = schedule as 'manual' | 'daily' | 'weekly' | 'monthly';
      }
      if (enabled !== undefined && enabled !== '') {
        whereClause.enabled = enabled === 'true';
      }
      if (search) {
        whereClause.name = Like(`%${search}%`);
      }
      if (since) {
        whereClause.createdAt = MoreThanOrEqual(new Date(since as string));
      }
      if (until) {
        whereClause.createdAt = LessThanOrEqual(new Date(until as string));
      }

      const [reports, total] = await reportRepo.findAndCount({
        where: whereClause,
        relations: ['creator'],
        order: { [sortField]: sortOrder },
        take: pagination.limit,
        skip: pagination.offset,
      });

      const formattedReports = reports.map(report => ({
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
      }));

      const lastItem = reports[reports.length - 1];
      return res.json(paginatedResponse(
        formattedReports,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'reports'
      ));
    } catch (error: any) {
      logger.error('Error listing reports:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/reports
 * Create a new report
 */
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Report name is required'),
    body('description').optional().isString(),
    body('schedule').optional().isIn(['manual', 'daily', 'weekly', 'monthly']).withMessage('Invalid schedule type'),
    body('scheduleDay').optional().isInt({ min: 0, max: 6 }),
    body('scheduleHour').optional().isInt({ min: 0, max: 23 }),
    body('format').optional().isIn(['summary', 'detailed', 'csv']).withMessage('Invalid format type'),
    body('config').optional().isObject(),
    body('deliveryConfig').optional().isObject(),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

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
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/reports/:id
 * Update a report
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('schedule').optional().isIn(['manual', 'daily', 'weekly', 'monthly']),
    body('scheduleDay').optional().isInt({ min: 0, max: 6 }),
    body('scheduleHour').optional().isInt({ min: 0, max: 23 }),
    body('format').optional().isIn(['summary', 'detailed', 'csv']),
    body('config').optional().isObject(),
    body('deliveryConfig').optional().isObject(),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const reportRepo = dataSource.getRepository(IncidentReport);

      const report = await reportRepo.findOne({
        where: { id, orgId },
      });

      if (!report) {
        return notFound(res, 'Report', id);
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
      return internalError(res);
    }
  }
);

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
      return notFound(res, 'Report', id);
    }

    await reportRepo.remove(report);

    logger.info('Report deleted', {
      reportId: id,
      name: report.name,
    });

    return res.json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting report:', error);
    return internalError(res);
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
      return notFound(res, 'Report', id);
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
    return internalError(res);
  }
});

/**
 * GET /api/v1/reports/:id/executions
 * Get execution history for a report
 */
router.get(
  '/:id/executions',
  [...paginationValidators],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);

      const dataSource = await getDataSource();
      const executionRepo = dataSource.getRepository(ReportExecution);

      // Verify report exists and belongs to org
      const reportRepo = dataSource.getRepository(IncidentReport);
      const report = await reportRepo.findOne({
        where: { id, orgId },
      });

      if (!report) {
        return notFound(res, 'Report', id);
      }

      const [executions, total] = await executionRepo.findAndCount({
        where: { reportId: id },
        relations: ['triggeredByUser'],
        order: { createdAt: 'DESC' },
        take: pagination.limit,
        skip: pagination.offset,
      });

      const formattedExecutions = executions.map(exec => ({
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
      }));

      const lastItem = executions[executions.length - 1];
      return res.json(paginatedResponse(
        formattedExecutions,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'executions'
      ));
    } catch (error: any) {
      logger.error('Error listing executions:', error);
      return internalError(res);
    }
  }
);

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
      return notFound(res, 'Report Execution', executionId);
    }

    const report = await reportRepo.findOne({
      where: { id: execution.reportId, orgId },
    });

    if (!report) {
      return notFound(res, 'Report', execution.reportId);
    }

    if (execution.status !== 'completed') {
      return badRequest(res, 'Can only deliver completed reports');
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
    return internalError(res);
  }
});

export default router;
