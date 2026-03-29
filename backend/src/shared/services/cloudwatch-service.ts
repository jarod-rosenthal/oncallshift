import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import { logger } from '../utils/logger';

const cloudWatchClient = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
}

export interface FetchLogsOptions {
  logGroupName: string;
  startTime: Date;
  endTime: Date;
  filterPattern?: string;
  limit?: number;
}

/**
 * Fetch logs from CloudWatch Logs Insights
 */
export async function fetchCloudWatchLogs(options: FetchLogsOptions): Promise<LogEntry[]> {
  const {
    logGroupName,
    startTime,
    endTime,
    filterPattern,
    limit = 500,
  } = options;

  try {
    // Build query - filter by pattern if provided
    let query = `fields @timestamp, @message, @logStream
| sort @timestamp desc
| limit ${limit}`;

    if (filterPattern) {
      query = `fields @timestamp, @message, @logStream
| filter @message like /${filterPattern}/
| sort @timestamp desc
| limit ${limit}`;
    }

    logger.info('Starting CloudWatch Logs query', {
      logGroupName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      filterPattern,
    });

    // Start the query
    const startQueryCommand = new StartQueryCommand({
      logGroupName,
      startTime: Math.floor(startTime.getTime() / 1000),
      endTime: Math.floor(endTime.getTime() / 1000),
      queryString: query,
    });

    const startResult = await cloudWatchClient.send(startQueryCommand);
    const queryId = startResult.queryId;

    if (!queryId) {
      throw new Error('Failed to start CloudWatch query - no query ID returned');
    }

    // Poll for results
    const logs = await pollQueryResults(queryId);

    logger.info('CloudWatch Logs query completed', {
      logGroupName,
      resultCount: logs.length,
    });

    return logs;
  } catch (error) {
    logger.error('Error fetching CloudWatch logs:', error);
    throw error;
  }
}

/**
 * Poll for query results until complete or timeout
 */
async function pollQueryResults(queryId: string, maxAttempts = 30): Promise<LogEntry[]> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const getResultsCommand = new GetQueryResultsCommand({ queryId });
    const result = await cloudWatchClient.send(getResultsCommand);

    if (result.status === QueryStatus.Complete) {
      // Parse results
      const logs: LogEntry[] = [];

      if (result.results) {
        for (const row of result.results) {
          const entry: LogEntry = {
            timestamp: '',
            message: '',
          };

          for (const field of row) {
            if (field.field === '@timestamp') {
              entry.timestamp = field.value || '';
            } else if (field.field === '@message') {
              entry.message = field.value || '';
            } else if (field.field === '@logStream') {
              entry.logStream = field.value;
            }
          }

          if (entry.message) {
            logs.push(entry);
          }
        }
      }

      return logs;
    }

    if (result.status === QueryStatus.Failed || result.status === QueryStatus.Cancelled) {
      throw new Error(`CloudWatch query ${result.status}`);
    }

    // Wait before next poll (exponential backoff)
    await delay(Math.min(1000 * Math.pow(1.5, attempt), 5000));
  }

  throw new Error('CloudWatch query timed out');
}

/**
 * Get ECS service logs for a specific service
 */
export async function getECSServiceLogs(
  serviceName: string,
  lookbackMinutes: number = 60,
  filterPattern?: string
): Promise<LogEntry[]> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackMinutes * 60 * 1000);

  // Common ECS log group patterns
  const logGroupPatterns = [
    `/ecs/${process.env.ECS_CLUSTER || 'oncallshift'}/${serviceName}`,
    `/ecs/${process.env.ECS_CLUSTER || 'oncallshift'}-${serviceName}`,
    `/ecs/${serviceName}`,
    `/aws/ecs/${serviceName}`,
  ];

  // Try each pattern until we find logs
  for (const logGroupName of logGroupPatterns) {
    try {
      const logs = await fetchCloudWatchLogs({
        logGroupName,
        startTime,
        endTime,
        filterPattern,
        limit: 200,
      });

      if (logs.length > 0) {
        return logs;
      }
    } catch (error: any) {
      // Log group might not exist, try next pattern
      if (error.name === 'ResourceNotFoundException') {
        continue;
      }
      throw error;
    }
  }

  logger.warn('No logs found for service', { serviceName, logGroupPatterns });
  return [];
}

/**
 * Search for error logs across all ECS services
 */
export async function searchErrorLogs(
  lookbackMinutes: number = 30
): Promise<LogEntry[]> {
  return getECSServiceLogs('api', lookbackMinutes, 'error|Error|ERROR|exception|Exception');
}

/**
 * Get logs related to a specific incident by searching for incident number
 */
export async function getIncidentRelatedLogs(
  incidentNumber: number,
  serviceName?: string,
  lookbackMinutes: number = 60
): Promise<LogEntry[]> {
  const filterPattern = `incident|error|Error|ERROR|exception|Exception|${incidentNumber}`;

  if (serviceName) {
    return getECSServiceLogs(serviceName, lookbackMinutes, filterPattern);
  }

  // Search across all known services
  const allLogs: LogEntry[] = [];
  const services = ['api', 'alert-processor', 'notification-worker'];

  for (const service of services) {
    try {
      const logs = await getECSServiceLogs(service, lookbackMinutes, filterPattern);
      allLogs.push(...logs);
    } catch (error) {
      logger.warn(`Failed to fetch logs for service ${service}:`, error);
    }
  }

  // Sort by timestamp descending
  return allLogs.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
