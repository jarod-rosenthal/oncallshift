/**
 * Report Scheduler Worker
 *
 * Checks for scheduled reports that are due to run and generates them automatically.
 * Runs on a configurable interval (default: 60 seconds).
 */

import 'dotenv/config';
import { initSentry } from '../shared/config/sentry';

// Initialize Sentry for this worker
initSentry({ workerName: 'report-scheduler' });

import { LessThanOrEqual } from 'typeorm';
import { getDataSource } from '../shared/db/data-source';
import { IncidentReport } from '../shared/models';
import { ReportGenerationService } from '../shared/services/report-generation-service';
import { ReportDeliveryService } from '../shared/services/report-delivery';
import { logger } from '../shared/utils/logger';

const CHECK_INTERVAL_MS = parseInt(process.env.REPORT_CHECK_INTERVAL_MS || '60000', 10);

async function checkScheduledReports(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const reportRepo = dataSource.getRepository(IncidentReport);
    const now = new Date();

    // Find all enabled reports that are due to run
    const dueReports = await reportRepo.find({
      where: {
        enabled: true,
        nextRunAt: LessThanOrEqual(now),
      },
      order: { nextRunAt: 'ASC' },
    });

    if (dueReports.length === 0) {
      logger.debug('No scheduled reports due at this time');
      return;
    }

    logger.info(`Found ${dueReports.length} scheduled report(s) due to run`);

    for (const report of dueReports) {
      try {
        await processScheduledReport(report, dataSource);
      } catch (error: any) {
        logger.error('Failed to process scheduled report', {
          reportId: report.id,
          reportName: report.name,
          error: error.message,
          stack: error.stack,
        });
        // Continue with next report even if one fails
      }
    }
  } catch (error: any) {
    logger.error('Error checking scheduled reports', {
      error: error.message,
      stack: error.stack,
    });
  }
}

async function processScheduledReport(report: IncidentReport, dataSource: any): Promise<void> {
  const reportRepo = dataSource.getRepository(IncidentReport);
  const reportService = new ReportGenerationService(dataSource);
  const deliveryService = new ReportDeliveryService(dataSource);

  logger.info('Processing scheduled report', {
    reportId: report.id,
    reportName: report.name,
    schedule: report.schedule,
    nextRunAt: report.nextRunAt,
  });

  // Calculate report period based on schedule
  const { periodStart, periodEnd } = calculateReportPeriod(report);

  logger.info('Generating scheduled report', {
    reportId: report.id,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  // Generate the report
  const execution = await reportService.generateReport(
    report,
    periodStart,
    periodEnd,
    undefined // No user trigger for scheduled reports
  );

  // Deliver the report if generation succeeded
  if (execution.status === 'completed') {
    logger.info('Delivering scheduled report', {
      reportId: report.id,
      executionId: execution.id,
    });

    try {
      await deliveryService.deliverReport(report, execution);
    } catch (error: any) {
      logger.error('Failed to deliver scheduled report', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });
      // Don't fail the whole process if delivery fails
    }
  }

  // Update report run times
  report.lastRunAt = new Date();
  report.nextRunAt = report.calculateNextRun();

  await reportRepo.save(report);

  logger.info('Scheduled report completed', {
    reportId: report.id,
    executionId: execution.id,
    status: execution.status,
    nextRunAt: report.nextRunAt?.toISOString() || null,
  });
}

/**
 * Calculate the time period for a scheduled report
 */
function calculateReportPeriod(report: IncidentReport): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = new Date();

  let periodStart: Date;

  switch (report.schedule) {
    case 'daily':
      // Last 24 hours
      periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
      break;

    case 'weekly':
      // Last 7 days
      periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;

    case 'monthly':
      // Last 30 days
      periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;

    case 'manual':
    default:
      // Shouldn't happen for scheduled reports, but default to last 7 days
      periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  return { periodStart, periodEnd };
}

async function main() {
  logger.info('Report Scheduler Worker starting...', {
    checkIntervalMs: CHECK_INTERVAL_MS,
  });

  // Initialize database connection
  try {
    await getDataSource();
    logger.info('Database connection established');
  } catch (error: any) {
    logger.error('Failed to initialize database connection', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }

  // Run initial check
  await checkScheduledReports();

  // Set up recurring checks
  setInterval(async () => {
    await checkScheduledReports();
  }, CHECK_INTERVAL_MS);

  logger.info('Report Scheduler Worker running', {
    checkIntervalSeconds: CHECK_INTERVAL_MS / 1000,
  });
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  logger.error('Fatal error in Report Scheduler Worker', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
