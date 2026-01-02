import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ECSClient, DescribeServicesCommand, ListServicesCommand, ListClustersCommand } from '@aws-sdk/client-ecs';
import { EC2Client, DescribeInstanceStatusCommand } from '@aws-sdk/client-ec2';
import { getDataSource } from '../db/data-source';
import { CloudCredential, CloudAccessLog, Incident, IncidentEvent, Alert, ServiceDependency } from '../models';
import { decryptCredentials } from './credential-encryption';
import { logger } from '../utils/logger';
import { runAzureInvestigation } from './azure-investigation';
import { runGCPInvestigation } from './gcp-investigation';
import { analyzeWithAI, AIAnalysisResult } from './cloud-analysis-ai';

interface AWSCredentials {
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_role_arn?: string;
  external_id?: string;
  aws_region: string;
}

/**
 * Raw data structure for cloud investigation evidence
 * These types are intentionally flexible to accommodate different cloud provider responses
 */
interface RawCloudData {
  logs?: Array<{
    timestamp?: string | Date | null;
    severity?: string | null;
    resource?: string;
    message?: string;
    exceptionType?: string;
    appRole?: string;
    time?: string | Date;
  }>;
  appServices?: Array<{
    name?: string;
    state?: string;
    resourceGroup?: string;
    defaultHostName?: string;
  }>;
  vms?: Array<{
    name?: string;
    resourceGroup?: string;
    vmSize?: string;
    statuses?: Array<{ code?: string; displayStatus?: string }>;
    zone?: string;
    status?: string | null;
    machineType?: string;
  }>;
  aks?: Array<{
    name?: string;
    provisioningState?: string;
    powerState?: string;
    kubernetesVersion?: string;
    nodeResourceGroup?: string;
  }>;
  cloudRun?: Array<{
    name?: string | null;
    uri?: string | null;
    latestReadyRevision?: string | null;
    latestCreatedRevision?: string | null;
    conditions?: Array<{ type?: string | null; state?: string | null }>;
  }>;
  compute?: Array<{
    name?: string | null;
    zone?: string;
    status?: string | null;
    machineType?: string;
  }>;
  gke?: Array<{
    name?: string | null;
    location?: string | null;
    status?: string | number | null;
    currentMasterVersion?: string | null;
    currentNodeCount?: number | null;
  }>;
}

/**
 * Evidence collected during cloud investigation
 */
interface CloudInvestigationEvidence {
  errorPatterns?: string[];
  unhealthyResources?: string[];
  logEntries?: string[];
  resourceStates?: Record<string, string>;
}

interface InvestigationResult {
  success: boolean;
  findings: string[];
  recommendations: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    suggested_action?: string;
  }>;
  commands_executed: Array<{
    command: string;
    service: string;
    timestamp: string;
    result: 'success' | 'error' | 'access_denied';
    output?: string;
  }>;
  error_message?: string;
  root_cause?: string;
  evidence?: CloudInvestigationEvidence;
  raw_data?: RawCloudData;
}

/**
 * Get AWS credentials for API calls
 */
async function getAWSCredentials(credential: CloudCredential, orgId: string): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}> {
  const decrypted = decryptCredentials<AWSCredentials>(credential.credentialsEncrypted, orgId);

  if (decrypted.aws_role_arn) {
    // Use STS to assume the role
    const stsClient = new STSClient({
      region: decrypted.aws_region,
      credentials: decrypted.aws_access_key_id ? {
        accessKeyId: decrypted.aws_access_key_id,
        secretAccessKey: decrypted.aws_secret_access_key!,
      } : undefined,
    });

    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: decrypted.aws_role_arn,
      RoleSessionName: `oncallshift-investigation-${Date.now()}`,
      ExternalId: decrypted.external_id,
      DurationSeconds: Math.min(credential.maxSessionDurationMinutes * 60, 3600),
    });

    const response = await stsClient.send(assumeRoleCommand);

    if (!response.Credentials) {
      throw new Error('Failed to assume AWS role');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken,
      region: decrypted.aws_region,
    };
  }

  // Use access keys directly
  if (!decrypted.aws_access_key_id || !decrypted.aws_secret_access_key) {
    throw new Error('AWS credentials not properly configured');
  }

  return {
    accessKeyId: decrypted.aws_access_key_id,
    secretAccessKey: decrypted.aws_secret_access_key,
    region: decrypted.aws_region,
  };
}

/**
 * Search CloudWatch logs for error patterns
 */
async function searchCloudWatchLogs(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string },
  incident: Incident,
  commands: InvestigationResult['commands_executed']
): Promise<{ findings: string[]; errors: string[] }> {
  const findings: string[] = [];
  const errors: string[] = [];

  try {
    const client = new CloudWatchLogsClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    // Get log groups
    commands.push({
      command: 'DescribeLogGroups',
      service: 'CloudWatch Logs',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const logGroupsResponse = await client.send(new DescribeLogGroupsCommand({ limit: 50 }));
    const logGroups = logGroupsResponse.logGroups || [];

    // Search for errors in the last hour around incident time
    const incidentTime = new Date(incident.createdAt).getTime();
    const startTime = incidentTime - 60 * 60 * 1000; // 1 hour before
    const endTime = incidentTime + 30 * 60 * 1000; // 30 min after

    // Search relevant log groups (ECS, Lambda, API Gateway, etc.)
    const relevantPatterns = ['/ecs/', '/aws/lambda/', '/aws/apigateway/', 'application'];
    const relevantLogGroups = logGroups.filter(lg =>
      relevantPatterns.some(pattern => lg.logGroupName?.toLowerCase().includes(pattern.toLowerCase()))
    ).slice(0, 5); // Limit to 5 log groups

    for (const logGroup of relevantLogGroups) {
      try {
        commands.push({
          command: `FilterLogEvents: ${logGroup.logGroupName}`,
          service: 'CloudWatch Logs',
          timestamp: new Date().toISOString(),
          result: 'success',
        });

        const filterResponse = await client.send(new FilterLogEventsCommand({
          logGroupName: logGroup.logGroupName,
          startTime,
          endTime,
          filterPattern: '?ERROR ?Exception ?FATAL ?CRITICAL',
          limit: 100,
        }));

        const events = filterResponse.events || [];
        if (events.length > 0) {
          findings.push(`Found ${events.length} error events in ${logGroup.logGroupName}`);

          // Extract unique error patterns
          const errorPatterns = new Set<string>();
          events.forEach(event => {
            const message = event.message || '';
            // Extract error type if present
            const errorMatch = message.match(/(Error|Exception|FATAL|CRITICAL)[:\s]+([^\n]{0,100})/i);
            if (errorMatch) {
              errorPatterns.add(errorMatch[0].substring(0, 100));
            }
          });

          errorPatterns.forEach(pattern => {
            errors.push(pattern);
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        commands.push({
          command: `FilterLogEvents: ${logGroup.logGroupName}`,
          service: 'CloudWatch Logs',
          timestamp: new Date().toISOString(),
          result: 'error',
          output: errorMessage,
        });
      }
    }

    if (relevantLogGroups.length === 0) {
      findings.push('No relevant CloudWatch Log groups found for investigation');
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    findings.push(`CloudWatch Logs access failed: ${errorMessage}`);
    commands[commands.length - 1].result = 'error';
    commands[commands.length - 1].output = errorMessage;
  }

  return { findings, errors };
}

/**
 * Check ECS service status
 */
async function checkECSServices(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string },
  commands: InvestigationResult['commands_executed']
): Promise<{ findings: string[]; unhealthyServices: string[] }> {
  const findings: string[] = [];
  const unhealthyServices: string[] = [];

  try {
    const client = new ECSClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    // List clusters
    commands.push({
      command: 'ListClusters',
      service: 'ECS',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const clustersResponse = await client.send(new ListClustersCommand({ maxResults: 10 }));
    const clusterArns = clustersResponse.clusterArns || [];

    for (const clusterArn of clusterArns) {
      try {
        // List services in cluster
        const servicesResponse = await client.send(new ListServicesCommand({
          cluster: clusterArn,
          maxResults: 20,
        }));

        const serviceArns = servicesResponse.serviceArns || [];
        if (serviceArns.length === 0) continue;

        commands.push({
          command: `DescribeServices: ${clusterArn.split('/').pop()}`,
          service: 'ECS',
          timestamp: new Date().toISOString(),
          result: 'success',
        });

        const describeResponse = await client.send(new DescribeServicesCommand({
          cluster: clusterArn,
          services: serviceArns.slice(0, 10),
        }));

        for (const service of describeResponse.services || []) {
          const runningCount = service.runningCount || 0;
          const desiredCount = service.desiredCount || 0;

          if (runningCount < desiredCount) {
            unhealthyServices.push(service.serviceName || 'Unknown');
            findings.push(`ECS Service ${service.serviceName} has ${runningCount}/${desiredCount} tasks running`);
          }

          // Check for recent deployment issues
          const deployments = service.deployments || [];
          const failedDeployments = deployments.filter(d => d.rolloutState === 'FAILED');
          if (failedDeployments.length > 0) {
            findings.push(`ECS Service ${service.serviceName} has failed deployments`);
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        commands.push({
          command: `DescribeServices: ${clusterArn}`,
          service: 'ECS',
          timestamp: new Date().toISOString(),
          result: 'error',
          output: errorMessage,
        });
      }
    }

    if (clusterArns.length === 0) {
      findings.push('No ECS clusters found in this region');
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    findings.push(`ECS access failed: ${errorMessage}`);
    commands[commands.length - 1].result = 'error';
    commands[commands.length - 1].output = errorMessage;
  }

  return { findings, unhealthyServices };
}

/**
 * Check EC2 instance status
 */
async function checkEC2Instances(
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string },
  commands: InvestigationResult['commands_executed']
): Promise<{ findings: string[]; unhealthyInstances: string[] }> {
  const findings: string[] = [];
  const unhealthyInstances: string[] = [];

  try {
    const client = new EC2Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    commands.push({
      command: 'DescribeInstanceStatus',
      service: 'EC2',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const statusResponse = await client.send(new DescribeInstanceStatusCommand({
      IncludeAllInstances: true,
      MaxResults: 50,
    }));

    for (const status of statusResponse.InstanceStatuses || []) {
      const instanceId = status.InstanceId || 'Unknown';
      const instanceState = status.InstanceState?.Name;
      const systemStatus = status.SystemStatus?.Status;
      const instanceStatus = status.InstanceStatus?.Status;

      if (instanceState !== 'running') {
        findings.push(`EC2 Instance ${instanceId} is in state: ${instanceState}`);
        unhealthyInstances.push(instanceId);
      } else if (systemStatus !== 'ok' || instanceStatus !== 'ok') {
        findings.push(`EC2 Instance ${instanceId} has status issues - System: ${systemStatus}, Instance: ${instanceStatus}`);
        unhealthyInstances.push(instanceId);
      }
    }

    if ((statusResponse.InstanceStatuses?.length || 0) === 0) {
      findings.push('No EC2 instances found or no instance status available');
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    findings.push(`EC2 access failed: ${errorMessage}`);
    commands[commands.length - 1].result = 'error';
    commands[commands.length - 1].output = errorMessage;
  }

  return { findings, unhealthyInstances };
}

/**
 * Run cloud investigation for an incident
 */
export async function runAWSInvestigation(
  credentialId: string,
  incidentId: string,
  userId: string,
  orgId: string
): Promise<InvestigationResult> {
  const result: InvestigationResult = {
    success: false,
    findings: [],
    recommendations: [],
    commands_executed: [],
  };

  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);
  const incidentRepo = dataSource.getRepository(Incident);
  const logRepo = dataSource.getRepository(CloudAccessLog);

  try {
    // Get credential
    const credential = await credentialRepo.findOne({
      where: { id: credentialId, orgId },
    });

    if (!credential) {
      throw new Error('Cloud credential not found');
    }

    if (!credential.enabled) {
      throw new Error('Cloud credential is disabled');
    }

    if (credential.provider !== 'aws') {
      throw new Error('Only AWS investigation is currently supported');
    }

    // Get incident
    const incident = await incidentRepo.findOne({
      where: { id: incidentId, orgId },
      relations: ['service'],
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    // Create access log entry
    const accessLog = logRepo.create({
      orgId,
      credentialId,
      incidentId,
      triggeredById: userId,
      provider: 'aws',
      status: 'analyzing',
      sessionStartedAt: new Date(),
      commandsExecuted: [],
      recommendations: [],
      evidence: [],
    });
    await logRepo.save(accessLog);

    // Get AWS credentials
    const awsCreds = await getAWSCredentials(credential, orgId);
    result.findings.push(`Connected to AWS in region ${awsCreds.region}`);

    // Run investigations in parallel
    const [logsResult, ecsResult, ec2Result] = await Promise.all([
      searchCloudWatchLogs(awsCreds, incident, result.commands_executed),
      checkECSServices(awsCreds, result.commands_executed),
      checkEC2Instances(awsCreds, result.commands_executed),
    ]);

    // Aggregate findings
    result.findings.push(...logsResult.findings);
    result.findings.push(...ecsResult.findings);
    result.findings.push(...ec2Result.findings);

    // Generate recommendations based on findings
    if (logsResult.errors.length > 0) {
      result.recommendations.push({
        severity: 'high',
        title: 'Application Errors Detected',
        description: `Found ${logsResult.errors.length} error patterns in CloudWatch Logs around the incident time.`,
        suggested_action: 'Review the error patterns and stack traces to identify the root cause.',
      });
    }

    if (ecsResult.unhealthyServices.length > 0) {
      result.recommendations.push({
        severity: 'critical',
        title: 'ECS Services Unhealthy',
        description: `${ecsResult.unhealthyServices.length} ECS services are not running at desired capacity: ${ecsResult.unhealthyServices.join(', ')}`,
        suggested_action: 'Check ECS service events and task logs for deployment or health check failures.',
      });
    }

    if (ec2Result.unhealthyInstances.length > 0) {
      result.recommendations.push({
        severity: 'high',
        title: 'EC2 Instance Issues',
        description: `${ec2Result.unhealthyInstances.length} EC2 instances have status issues.`,
        suggested_action: 'Check instance system logs and consider restarting affected instances.',
      });
    }

    if (result.recommendations.length === 0) {
      result.recommendations.push({
        severity: 'info',
        title: 'No Obvious Issues Found',
        description: 'Initial investigation did not reveal obvious infrastructure issues.',
        suggested_action: 'Consider checking application-level logs, database connections, or external service dependencies.',
      });
    }

    // Update access log with results
    accessLog.status = 'completed';
    accessLog.sessionEndedAt = new Date();
    accessLog.durationSeconds = accessLog.calculateDuration();
    accessLog.success = true;
    accessLog.commandsExecuted = result.commands_executed.map(cmd => ({
      command: cmd.command,
      timestamp: cmd.timestamp,
      success: cmd.result === 'success',
      duration_ms: 0,
      output_summary: cmd.output,
      error: cmd.result !== 'success' ? cmd.output : undefined,
    }));
    accessLog.analysisSummary = result.findings.join('\n');
    accessLog.recommendations = result.recommendations.map(rec => ({
      title: rec.title,
      description: rec.description,
      severity: rec.severity === 'critical' ? 'high' : rec.severity as 'high' | 'medium' | 'low',
      requires_approval: false,
      expected_impact: rec.suggested_action,
    }));
    accessLog.evidence = [
      ...logsResult.errors.slice(0, 10),
      ...ecsResult.unhealthyServices.map(s => `Unhealthy ECS service: ${s}`),
      ...ec2Result.unhealthyInstances.map(i => `Unhealthy EC2 instance: ${i}`),
    ];
    await logRepo.save(accessLog);

    // Update credential usage
    credential.lastUsedAt = new Date();
    credential.lastUsedById = userId;
    credential.usageCount = (credential.usageCount || 0) + 1;
    await credentialRepo.save(credential);

    result.success = true;
    logger.info('AWS investigation completed', { credentialId, incidentId, findingsCount: result.findings.length });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.error_message = errorMessage;
    result.findings.push(`Investigation failed: ${errorMessage}`);
    logger.error('AWS investigation failed', { credentialId, incidentId, error: errorMessage });

    // Update access log with failure
    try {
      await logRepo.update(
        { credentialId, incidentId, status: 'analyzing' },
        {
          status: 'failed',
          success: false,
          sessionEndedAt: new Date(),
          errorMessage: errorMessage,
          commandsExecuted: result.commands_executed.map(cmd => ({
            command: cmd.command,
            timestamp: cmd.timestamp,
            success: cmd.result === 'success',
            duration_ms: 0,
            output_summary: cmd.output,
          })),
        }
      );
    } catch (updateError: unknown) {
      const updateErrorMessage = updateError instanceof Error ? updateError.message : String(updateError);
      logger.error('Failed to update access log', { error: updateErrorMessage });
    }
  }

  return result;
}

/**
 * Unified investigation result with AI analysis
 */
export interface EnhancedInvestigationResult extends InvestigationResult {
  provider: 'aws' | 'azure' | 'gcp';
  aiAnalysis?: AIAnalysisResult;
  incidentContext?: {
    incidentNumber: number;
    summary: string;
    severity: string;
    serviceName: string;
    eventCount: number;
  };
}

/**
 * Fetch incident context for AI analysis
 */
async function getIncidentContext(incidentId: string, orgId: string) {
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const eventRepo = dataSource.getRepository(IncidentEvent);
  const alertRepo = dataSource.getRepository(Alert);
  const dependencyRepo = dataSource.getRepository(ServiceDependency);

  const incident = await incidentRepo.findOne({
    where: { id: incidentId, orgId },
    relations: ['service'],
  });

  if (!incident) {
    throw new Error('Incident not found');
  }

  // Get timeline events
  const events = await eventRepo.find({
    where: { incidentId },
    order: { createdAt: 'DESC' },
    take: 20,
  });

  // Get associated alerts
  const alerts = await alertRepo.find({
    where: { incidentId },
    order: { createdAt: 'DESC' },
    take: 10,
  });

  // Get service dependencies
  let dependencies: ServiceDependency[] = [];
  if (incident.serviceId) {
    dependencies = await dependencyRepo.find({
      where: { dependentServiceId: incident.serviceId },
      relations: ['supportingService'],
    });
  }

  return {
    incidentNumber: incident.incidentNumber,
    summary: incident.summary,
    details: incident.details || undefined,
    severity: incident.severity,
    serviceName: incident.service?.name || 'Unknown Service',
    triggeredAt: incident.triggeredAt,
    state: incident.state,
    eventCount: events.length,
    timeline: events.map(e => ({
      type: e.type,
      message: e.message,
      createdAt: e.createdAt,
    })),
    alerts: alerts.map(a => ({
      summary: a.summary,
      severity: a.severity,
      payload: a.payload,
    })),
    dependencies: dependencies.map(d => ({
      serviceName: d.supportingService?.name || 'Unknown',
      type: d.dependencyType,
    })),
  };
}

/**
 * Run cloud investigation for any provider with AI analysis
 */
export async function runCloudInvestigation(
  credentialId: string,
  incidentId: string,
  userId: string,
  orgId: string,
  enableAI: boolean = true
): Promise<EnhancedInvestigationResult> {
  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);

  // Get credential to determine provider
  const credential = await credentialRepo.findOne({
    where: { id: credentialId, orgId },
  });

  if (!credential) {
    throw new Error('Cloud credential not found');
  }

  if (!credential.enabled) {
    throw new Error('Cloud credential is disabled');
  }

  let baseResult: InvestigationResult;
  const provider = credential.provider as 'aws' | 'azure' | 'gcp';

  // Route to appropriate provider
  switch (provider) {
    case 'aws':
      baseResult = await runAWSInvestigation(credentialId, incidentId, userId, orgId);
      break;
    case 'azure':
      baseResult = await runAzureInvestigation(credentialId, incidentId, userId, orgId);
      break;
    case 'gcp':
      baseResult = await runGCPInvestigation(credentialId, incidentId, userId, orgId);
      break;
    default:
      throw new Error(`Unsupported cloud provider: ${provider}`);
  }

  const result: EnhancedInvestigationResult = {
    ...baseResult,
    provider,
  };

  // If investigation was successful and AI is enabled, run AI analysis
  if (baseResult.success && enableAI && process.env.ANTHROPIC_API_KEY) {
    try {
      const incidentContext = await getIncidentContext(incidentId, orgId);
      result.incidentContext = {
        incidentNumber: incidentContext.incidentNumber,
        summary: incidentContext.summary,
        severity: incidentContext.severity,
        serviceName: incidentContext.serviceName,
        eventCount: incidentContext.eventCount,
      };

      // Prepare cloud data for AI analysis
      const cloudData = {
        provider,
        findings: baseResult.findings,
        commands_executed: baseResult.commands_executed,
        raw_data: baseResult.raw_data,
      };

      logger.info('Running AI analysis on cloud investigation', {
        credentialId,
        incidentId,
        provider,
        findingsCount: baseResult.findings.length,
      });

      const aiAnalysis = await analyzeWithAI(cloudData, incidentContext);
      result.aiAnalysis = aiAnalysis;

      // Update the root cause with AI analysis
      if (aiAnalysis.rootCause) {
        result.root_cause = aiAnalysis.rootCause;
      }

      // Merge AI recommendations with base recommendations
      if (aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0) {
        result.recommendations = aiAnalysis.recommendations.map(rec => ({
          severity: rec.severity,
          title: rec.title,
          description: rec.description,
          suggested_action: rec.command,
          risk: rec.risk,
          automated: rec.automated,
          expectedImpact: rec.expectedImpact,
          rollbackPlan: rec.rollbackPlan,
        }));
      }

      // Update access log with AI analysis
      const logRepo = dataSource.getRepository(CloudAccessLog);
      await logRepo.update(
        { credentialId, incidentId, status: 'completed' },
        {
          rootCause: aiAnalysis.rootCause,
          aiConfidence: aiAnalysis.confidence,
          affectedResources: aiAnalysis.affectedResources,
          recommendations: aiAnalysis.recommendations.map(r => ({
            title: r.title,
            description: r.description,
            severity: r.severity === 'critical' ? 'high' : r.severity as 'high' | 'medium' | 'low',
            command: r.command,
            requires_approval: r.risk === 'high',
            expected_impact: r.expectedImpact,
            rollback_plan: r.rollbackPlan,
          })),
        }
      );

      logger.info('AI analysis completed', {
        credentialId,
        incidentId,
        confidence: aiAnalysis.confidence,
        recommendationsCount: aiAnalysis.recommendations.length,
      });
    } catch (aiError: unknown) {
      const aiErrorMessage = aiError instanceof Error ? aiError.message : String(aiError);
      logger.error('AI analysis failed', {
        credentialId,
        incidentId,
        error: aiErrorMessage,
      });
      // Don't fail the whole investigation if AI fails
      result.findings.push(`AI analysis unavailable: ${aiErrorMessage}`);
    }
  }

  return result;
}

export default {
  runAWSInvestigation,
  runCloudInvestigation,
};
