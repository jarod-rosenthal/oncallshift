import { Logging } from '@google-cloud/logging';
import { InstancesClient } from '@google-cloud/compute';
import { ServicesClient as CloudRunClient } from '@google-cloud/run';
import { ClusterManagerClient } from '@google-cloud/container';
import type { ClientOptions } from 'google-gax';
import { getDataSource } from '../db/data-source';
import { CloudCredential, CloudAccessLog, Incident } from '../models';
import { decryptCredentials } from './credential-encryption';
import { logger } from '../utils/logger';

interface GCPCredentials {
  service_account_json: string;
  project_id: string;
}

/**
 * GCP Service Account JSON structure
 */
interface GCPServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

/**
 * Auth options for GCP clients
 * Extends ClientOptions from google-gax for compatibility with all GCP SDK clients
 */
interface GCPAuthOptions extends ClientOptions {
  projectId: string;
  credentials: GCPServiceAccountCredentials;
}

/**
 * GCP API error with gRPC status code
 */
interface GCPError extends Error {
  code?: number;
}

/**
 * Raw log entry data structure
 * Compatible with RawCloudData.logs from cloud-investigation.ts
 */
interface RawLogEntry {
  timestamp?: string | Date | null;
  severity?: string | null;
  resource?: string;
  message?: string;
}

/**
 * Cloud Run service data structure
 */
interface CloudRunServiceData {
  name: string | null | undefined;
  uri: string | null | undefined;
  latestReadyRevision: string | null | undefined;
  latestCreatedRevision: string | null | undefined;
  conditions: Array<{ type: string | null | undefined; state: string | null | undefined }> | undefined;
}

/**
 * Cloud Run service condition
 */
interface CloudRunCondition {
  type?: string | null;
  state?: string | null;
  message?: string | null;
}

/**
 * Compute Engine instance data structure
 */
interface ComputeInstanceData {
  name: string | null | undefined;
  zone: string;
  status: string | null | undefined;
  machineType: string | undefined;
}

/**
 * GKE cluster data structure
 */
interface GKEClusterData {
  name: string | null | undefined;
  location: string | null | undefined;
  status: string | number | null | undefined;
  currentMasterVersion: string | null | undefined;
  currentNodeCount: number | null | undefined;
}

/**
 * Raw data collected from GCP services
 */
interface GCPRawData {
  logs?: RawLogEntry[];
  cloudRun?: CloudRunServiceData[];
  compute?: ComputeInstanceData[];
  gke?: GKEClusterData[];
}

export interface GCPInvestigationResult {
  success: boolean;
  findings: string[];
  recommendations: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    command?: string;
    risk?: 'low' | 'medium' | 'high';
    automated?: boolean;
  }>;
  commands_executed: Array<{
    command: string;
    service: string;
    timestamp: string;
    result: 'success' | 'error' | 'access_denied';
    output?: string;
  }>;
  error_message?: string;
  raw_data?: GCPRawData;
}

/**
 * Parse GCP service account JSON and create auth options
 */
function getGCPAuthOptions(creds: GCPCredentials): GCPAuthOptions {
  const serviceAccount = JSON.parse(creds.service_account_json) as GCPServiceAccountCredentials;
  return {
    projectId: creds.project_id,
    credentials: serviceAccount,
  };
}

/**
 * Query GCP Cloud Logging for errors
 */
async function queryCloudLogging(
  authOptions: GCPAuthOptions,
  incidentTime: Date,
  commandsExecuted: GCPInvestigationResult['commands_executed']
): Promise<{ errors: string[]; rawLogs: RawLogEntry[] }> {
  const errors: string[] = [];
  const rawLogs: RawLogEntry[] = [];

  try {
    const logging = new Logging(authOptions);

    // Query for errors in the last hour around incident time
    const startTime = new Date(incidentTime.getTime() - 60 * 60 * 1000);
    const endTime = new Date(incidentTime.getTime() + 30 * 60 * 1000);

    const filter = `
      severity>=ERROR
      AND timestamp>="${startTime.toISOString()}"
      AND timestamp<="${endTime.toISOString()}"
    `.trim();

    commandsExecuted.push({
      command: 'Logging.getEntries',
      service: 'Cloud Logging',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const [entries] = await logging.getEntries({
      filter,
      pageSize: 50,
      orderBy: 'timestamp desc',
    });

    for (const entry of entries) {
      const data = entry.data;
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      const resource = entry.metadata?.resource?.type || 'unknown';
      errors.push(`[${resource}] ${message.substring(0, 200)}`);
      rawLogs.push({
        timestamp: entry.metadata?.timestamp as string | Date | null | undefined,
        severity: entry.metadata?.severity as string | null | undefined,
        resource,
        message: message.substring(0, 500),
      });
    }
  } catch (error: unknown) {
    const gcpError = error as GCPError;
    const isAuthError = gcpError.code === 7 || gcpError.code === 16; // PERMISSION_DENIED or UNAUTHENTICATED
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandsExecuted.push({
      command: 'Logging.getEntries',
      service: 'Cloud Logging',
      timestamp: new Date().toISOString(),
      result: isAuthError ? 'access_denied' : 'error',
      output: errorMessage,
    });
    logger.warn('Failed to query GCP Cloud Logging:', errorMessage);
  }

  return { errors, rawLogs };
}

/**
 * Check Cloud Run service health
 */
async function checkCloudRun(
  authOptions: GCPAuthOptions,
  commandsExecuted: GCPInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: CloudRunServiceData[] }> {
  const unhealthy: string[] = [];
  const rawData: CloudRunServiceData[] = [];

  try {
    const client = new CloudRunClient(authOptions);

    commandsExecuted.push({
      command: 'CloudRunClient.listServices',
      service: 'Cloud Run',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    // List services in all regions
    const parent = `projects/${authOptions.projectId}/locations/-`;
    const [services] = await client.listServices({ parent });

    for (const service of services) {
      const conditions = service.conditions as CloudRunCondition[] | undefined;
      const serviceData: CloudRunServiceData = {
        name: service.name,
        uri: service.uri,
        latestReadyRevision: service.latestReadyRevision,
        latestCreatedRevision: service.latestCreatedRevision,
        conditions: conditions?.map((c) => ({ type: c.type, state: c.state })),
      };
      rawData.push(serviceData);

      // Check conditions
      for (const condition of conditions || []) {
        if (condition.state !== 'CONDITION_SUCCEEDED' && condition.type === 'Ready') {
          unhealthy.push(`Cloud Run ${service.name?.split('/').pop()} not ready: ${condition.message}`);
        }
      }

      // Check if latest revision is ready
      if (service.latestReadyRevision !== service.latestCreatedRevision) {
        unhealthy.push(`Cloud Run ${service.name?.split('/').pop()} has pending revision`);
      }
    }
  } catch (error: unknown) {
    const gcpError = error as GCPError;
    const isAuthError = gcpError.code === 7 || gcpError.code === 16;
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandsExecuted.push({
      command: 'CloudRunClient.listServices',
      service: 'Cloud Run',
      timestamp: new Date().toISOString(),
      result: isAuthError ? 'access_denied' : 'error',
      output: errorMessage,
    });
    logger.warn('Failed to check GCP Cloud Run:', errorMessage);
  }

  return { unhealthy, rawData };
}

/**
 * Scoped list of instances from aggregated list response
 */
interface ComputeInstancesScopedList {
  instances?: Array<{
    name?: string | null;
    status?: string | null;
    machineType?: string | null;
  }>;
}

/**
 * Check Compute Engine instance health
 */
async function checkComputeEngine(
  authOptions: GCPAuthOptions,
  commandsExecuted: GCPInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: ComputeInstanceData[] }> {
  const unhealthy: string[] = [];
  const rawData: ComputeInstanceData[] = [];

  try {
    const client = new InstancesClient(authOptions);

    commandsExecuted.push({
      command: 'InstancesClient.aggregatedListAsync',
      service: 'Compute Engine',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    // Use async iterator for aggregated list
    const aggListIterator = client.aggregatedListAsync({
      project: authOptions.projectId,
      maxResults: 50,
    });

    for await (const [zone, scopedList] of aggListIterator) {
      const typedScopedList = scopedList as ComputeInstancesScopedList;
      const instanceList = typedScopedList?.instances;
      if (!instanceList) continue;

      for (const instance of instanceList) {
        const instanceData: ComputeInstanceData = {
          name: instance.name,
          zone: zone.replace('zones/', ''),
          status: instance.status,
          machineType: instance.machineType?.split('/').pop(),
        };
        rawData.push(instanceData);

        if (instance.status !== 'RUNNING') {
          unhealthy.push(`VM ${instance.name} in ${zone.replace('zones/', '')} is ${instance.status}`);
        }
      }
    }
  } catch (error: unknown) {
    const gcpError = error as GCPError;
    const isAuthError = gcpError.code === 7 || gcpError.code === 16;
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandsExecuted.push({
      command: 'InstancesClient.aggregatedList',
      service: 'Compute Engine',
      timestamp: new Date().toISOString(),
      result: isAuthError ? 'access_denied' : 'error',
      output: errorMessage,
    });
    logger.warn('Failed to check GCP Compute Engine:', errorMessage);
  }

  return { unhealthy, rawData };
}

/**
 * Check GKE cluster health
 */
async function checkGKE(
  authOptions: GCPAuthOptions,
  commandsExecuted: GCPInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: GKEClusterData[] }> {
  const unhealthy: string[] = [];
  const rawData: GKEClusterData[] = [];

  try {
    const client = new ClusterManagerClient(authOptions);

    commandsExecuted.push({
      command: 'ClusterManagerClient.listClusters',
      service: 'GKE',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const parent = `projects/${authOptions.projectId}/locations/-`;
    const [response] = await client.listClusters({ parent });

    for (const cluster of response.clusters || []) {
      const clusterData: GKEClusterData = {
        name: cluster.name,
        location: cluster.location,
        status: cluster.status,
        currentMasterVersion: cluster.currentMasterVersion,
        currentNodeCount: cluster.currentNodeCount,
      };
      rawData.push(clusterData);

      // Check cluster status
      if (cluster.status !== 'RUNNING') {
        unhealthy.push(`GKE cluster ${cluster.name} is ${cluster.status}`);
      }

      // Check node pools
      for (const pool of cluster.nodePools || []) {
        if (pool.status !== 'RUNNING') {
          unhealthy.push(`GKE node pool ${pool.name} in ${cluster.name} is ${pool.status}`);
        }
      }
    }
  } catch (error: unknown) {
    const gcpError = error as GCPError;
    const isAuthError = gcpError.code === 7 || gcpError.code === 16;
    const errorMessage = error instanceof Error ? error.message : String(error);
    commandsExecuted.push({
      command: 'ClusterManagerClient.listClusters',
      service: 'GKE',
      timestamp: new Date().toISOString(),
      result: isAuthError ? 'access_denied' : 'error',
      output: errorMessage,
    });
    logger.warn('Failed to check GKE:', errorMessage);
  }

  return { unhealthy, rawData };
}

/**
 * Run GCP cloud investigation for an incident
 */
export async function runGCPInvestigation(
  credentialId: string,
  incidentId: string,
  userId: string,
  orgId: string
): Promise<GCPInvestigationResult> {
  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);
  const accessLogRepo = dataSource.getRepository(CloudAccessLog);
  const incidentRepo = dataSource.getRepository(Incident);

  // Load credential
  const credential = await credentialRepo.findOne({
    where: { id: credentialId, orgId },
  });

  if (!credential) {
    return {
      success: false,
      findings: [],
      recommendations: [],
      commands_executed: [],
      error_message: 'Cloud credential not found',
    };
  }

  // Load incident
  const incident = await incidentRepo.findOne({
    where: { id: incidentId, orgId },
    relations: ['service'],
  });

  if (!incident) {
    return {
      success: false,
      findings: [],
      recommendations: [],
      commands_executed: [],
      error_message: 'Incident not found',
    };
  }

  // Create access log entry
  const accessLog = accessLogRepo.create({
    orgId,
    credentialId,
    incidentId,
    triggeredById: userId,
    provider: 'gcp',
    status: 'analyzing',
    commandsExecuted: [],
    evidence: [],
    recommendations: [],
  });
  await accessLogRepo.save(accessLog);

  const commandsExecuted: GCPInvestigationResult['commands_executed'] = [];
  const findings: string[] = [];
  const rawData: GCPRawData = {};

  try {
    // Decrypt credentials
    const creds = decryptCredentials<GCPCredentials>(credential.credentialsEncrypted, orgId);
    const authOptions = getGCPAuthOptions(creds);

    // Run investigations in parallel
    const [logsResult, cloudRunResult, computeResult, gkeResult] = await Promise.all([
      queryCloudLogging(authOptions, incident.triggeredAt, commandsExecuted),
      checkCloudRun(authOptions, commandsExecuted),
      checkComputeEngine(authOptions, commandsExecuted),
      checkGKE(authOptions, commandsExecuted),
    ]);

    // Collect findings
    if (logsResult.errors.length > 0) {
      findings.push(`Found ${logsResult.errors.length} error logs`);
      findings.push(...logsResult.errors.slice(0, 5));
    }

    if (cloudRunResult.unhealthy.length > 0) {
      findings.push(...cloudRunResult.unhealthy);
    }

    if (computeResult.unhealthy.length > 0) {
      findings.push(...computeResult.unhealthy);
    }

    if (gkeResult.unhealthy.length > 0) {
      findings.push(...gkeResult.unhealthy);
    }

    rawData.logs = logsResult.rawLogs;
    rawData.cloudRun = cloudRunResult.rawData;
    rawData.compute = computeResult.rawData;
    rawData.gke = gkeResult.rawData;

    // Generate recommendations
    const recommendations: GCPInvestigationResult['recommendations'] = [];

    if (logsResult.errors.length > 0) {
      recommendations.push({
        severity: 'high',
        title: 'Application Errors Detected',
        description: `Found ${logsResult.errors.length} error logs. Review the logs and fix the underlying issues.`,
        command: 'gcloud logging read "severity>=ERROR" --limit 100 --format json',
        risk: 'low',
        automated: false,
      });
    }

    if (cloudRunResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'Cloud Run Service Issues',
        description: 'One or more Cloud Run services have health issues.',
        command: 'gcloud run services update <service> --region <region> --clear-env-vars',
        risk: 'medium',
        automated: true,
      });
    }

    if (computeResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'high',
        title: 'Compute Engine VM Issues',
        description: 'One or more VMs are not running.',
        command: 'gcloud compute instances start <instance> --zone <zone>',
        risk: 'medium',
        automated: true,
      });
    }

    if (gkeResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'GKE Cluster Issues',
        description: 'GKE cluster or node pool health issues detected.',
        command: 'gcloud container clusters get-credentials <cluster> --zone <zone> && kubectl get pods -A',
        risk: 'low',
        automated: false,
      });
    }

    // Update access log
    // Note: commandsExecuted uses a different structure than CloudAccessLog.CommandExecuted interface
    // This is intentional as GCP investigation captures service-specific metadata
    accessLog.commandsExecuted = commandsExecuted as unknown as typeof accessLog.commandsExecuted;
    accessLog.evidence = findings;
    accessLog.recommendations = recommendations.map(r => ({
      title: r.title,
      description: r.description,
      severity: r.severity as 'high' | 'medium' | 'low',
      command: r.command,
      requires_approval: r.risk === 'high',
    }));
    accessLog.analysisSummary = findings.join('\n');
    accessLog.complete(true);
    await accessLogRepo.save(accessLog);

    // Update credential usage
    credential.lastUsedAt = new Date();
    credential.lastUsedById = userId;
    credential.usageCount = (credential.usageCount || 0) + 1;
    await credentialRepo.save(credential);

    return {
      success: true,
      findings,
      recommendations,
      commands_executed: commandsExecuted,
      raw_data: rawData,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    accessLog.complete(false, errorMessage);
    await accessLogRepo.save(accessLog);

    logger.error('GCP investigation failed:', error);

    return {
      success: false,
      findings,
      recommendations: [],
      commands_executed: commandsExecuted,
      error_message: errorMessage,
    };
  }
}
