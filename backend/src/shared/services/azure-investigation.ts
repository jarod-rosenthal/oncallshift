import { ClientSecretCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ComputeManagementClient } from '@azure/arm-compute';
import { ContainerServiceClient } from '@azure/arm-containerservice';
import { getDataSource } from '../db/data-source';
import { CloudCredential, CloudAccessLog, Incident } from '../models';
import { decryptCredentials } from './credential-encryption';
import { logger } from '../utils/logger';

interface AzureCredentials {
  client_id: string;
  client_secret: string;
  tenant_id: string;
  subscription_id: string;
  log_analytics_workspace_id?: string;
}

export interface AzureInvestigationResult {
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
  raw_data?: {
    logs?: any[];
    appServices?: any[];
    vms?: any[];
    aks?: any[];
  };
}

/**
 * Get Azure credentials for API calls
 */
function getAzureCredential(creds: AzureCredentials): ClientSecretCredential {
  return new ClientSecretCredential(
    creds.tenant_id,
    creds.client_id,
    creds.client_secret
  );
}

/**
 * Query Azure Log Analytics for errors
 */
async function queryLogAnalytics(
  credential: ClientSecretCredential,
  workspaceId: string,
  incidentTime: Date,
  commandsExecuted: AzureInvestigationResult['commands_executed']
): Promise<{ errors: string[]; rawLogs: any[] }> {
  const errors: string[] = [];
  const rawLogs: any[] = [];

  try {
    const client = new LogsQueryClient(credential);

    // Query for errors in the last hour around incident time
    const startTime = new Date(incidentTime.getTime() - 60 * 60 * 1000);
    const endTime = new Date(incidentTime.getTime() + 30 * 60 * 1000);

    const query = `
      AppExceptions
      | where TimeGenerated between (datetime('${startTime.toISOString()}') .. datetime('${endTime.toISOString()}'))
      | project TimeGenerated, ExceptionType, OuterMessage, InnermostMessage, AppRoleName
      | order by TimeGenerated desc
      | take 50
    `;

    commandsExecuted.push({
      command: 'LogsQueryClient.queryWorkspace',
      service: 'Azure Monitor',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const result = await client.queryWorkspace(workspaceId, query, {
      startTime,
      endTime,
    });

    // Handle both full and partial results
    const tables = 'tables' in result ? result.tables :
                   ('partialTables' in result ? result.partialTables : []);

    if (tables && tables.length > 0) {
      const table = tables[0];
      for (const row of table.rows || []) {
        const exceptionType = row[1] || 'Unknown';
        const message = row[2] || row[3] || 'No message';
        const appRole = row[4] || 'Unknown';
        errors.push(`[${appRole}] ${exceptionType}: ${message}`);
        rawLogs.push({ exceptionType, message, appRole, time: row[0] });
      }
    }
  } catch (error: any) {
    commandsExecuted.push({
      command: 'LogsQueryClient.queryWorkspace',
      service: 'Azure Monitor',
      timestamp: new Date().toISOString(),
      result: error.code === 'AuthorizationFailed' ? 'access_denied' : 'error',
      output: error.message,
    });
    logger.warn('Failed to query Azure Log Analytics:', error.message);
  }

  return { errors, rawLogs };
}

/**
 * Check Azure App Service health
 */
async function checkAppServices(
  credential: ClientSecretCredential,
  subscriptionId: string,
  commandsExecuted: AzureInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: any[] }> {
  const unhealthy: string[] = [];
  const rawData: any[] = [];

  try {
    const client = new WebSiteManagementClient(credential, subscriptionId);

    commandsExecuted.push({
      command: 'WebSiteManagementClient.webApps.list',
      service: 'Azure App Service',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const webApps = client.webApps.list();

    for await (const app of webApps) {
      const appData: any = {
        name: app.name,
        state: app.state,
        resourceGroup: app.resourceGroup,
        defaultHostName: app.defaultHostName,
      };
      rawData.push(appData);

      if (app.state !== 'Running') {
        unhealthy.push(`App Service ${app.name} is ${app.state}`);
      }

      // Check availability state if possible
      if (app.availabilityState && app.availabilityState !== 'Normal') {
        unhealthy.push(`App Service ${app.name} availability: ${app.availabilityState}`);
      }
    }
  } catch (error: any) {
    commandsExecuted.push({
      command: 'WebSiteManagementClient.webApps.list',
      service: 'Azure App Service',
      timestamp: new Date().toISOString(),
      result: error.code === 'AuthorizationFailed' ? 'access_denied' : 'error',
      output: error.message,
    });
    logger.warn('Failed to check Azure App Services:', error.message);
  }

  return { unhealthy, rawData };
}

/**
 * Check Azure VM health
 */
async function checkVMs(
  credential: ClientSecretCredential,
  subscriptionId: string,
  commandsExecuted: AzureInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: any[] }> {
  const unhealthy: string[] = [];
  const rawData: any[] = [];

  try {
    const client = new ComputeManagementClient(credential, subscriptionId);

    commandsExecuted.push({
      command: 'ComputeManagementClient.virtualMachines.listAll',
      service: 'Azure Compute',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const vms = client.virtualMachines.listAll();

    for await (const vm of vms) {
      // Get instance view for detailed status
      if (vm.name && vm.id) {
        const resourceGroup = vm.id.split('/')[4];
        try {
          const instanceView = await client.virtualMachines.instanceView(resourceGroup, vm.name);

          const vmData: any = {
            name: vm.name,
            resourceGroup,
            vmSize: vm.hardwareProfile?.vmSize,
            statuses: instanceView.statuses?.map((s: { code?: string; displayStatus?: string }) => ({ code: s.code, displayStatus: s.displayStatus })),
          };
          rawData.push(vmData);

          // Check power state
          const powerState = instanceView.statuses?.find((s: { code?: string }) => s.code?.startsWith('PowerState/'));
          if (powerState && powerState.code !== 'PowerState/running') {
            unhealthy.push(`VM ${vm.name} is ${powerState.displayStatus}`);
          }

          // Check VM agent status
          const agentStatus = instanceView.vmAgent?.statuses?.[0];
          if (agentStatus && agentStatus.level === 'Error') {
            unhealthy.push(`VM ${vm.name} agent error: ${agentStatus.message}`);
          }
        } catch (err) {
          // Skip if can't get instance view
        }
      }
    }
  } catch (error: any) {
    commandsExecuted.push({
      command: 'ComputeManagementClient.virtualMachines.listAll',
      service: 'Azure Compute',
      timestamp: new Date().toISOString(),
      result: error.code === 'AuthorizationFailed' ? 'access_denied' : 'error',
      output: error.message,
    });
    logger.warn('Failed to check Azure VMs:', error.message);
  }

  return { unhealthy, rawData };
}

/**
 * Check Azure AKS health
 */
async function checkAKS(
  credential: ClientSecretCredential,
  subscriptionId: string,
  commandsExecuted: AzureInvestigationResult['commands_executed']
): Promise<{ unhealthy: string[]; rawData: any[] }> {
  const unhealthy: string[] = [];
  const rawData: any[] = [];

  try {
    const client = new ContainerServiceClient(credential, subscriptionId);

    commandsExecuted.push({
      command: 'ContainerServiceClient.managedClusters.list',
      service: 'Azure AKS',
      timestamp: new Date().toISOString(),
      result: 'success',
    });

    const clusters = client.managedClusters.list();

    for await (const cluster of clusters) {
      const clusterData: any = {
        name: cluster.name,
        provisioningState: cluster.provisioningState,
        powerState: cluster.powerState?.code,
        kubernetesVersion: cluster.kubernetesVersion,
        nodeResourceGroup: cluster.nodeResourceGroup,
      };
      rawData.push(clusterData);

      if (cluster.provisioningState !== 'Succeeded') {
        unhealthy.push(`AKS cluster ${cluster.name} provisioning: ${cluster.provisioningState}`);
      }

      if (cluster.powerState?.code !== 'Running') {
        unhealthy.push(`AKS cluster ${cluster.name} power state: ${cluster.powerState?.code}`);
      }

      // Check agent pool profiles
      for (const pool of cluster.agentPoolProfiles || []) {
        if (pool.provisioningState !== 'Succeeded') {
          unhealthy.push(`AKS pool ${pool.name} in ${cluster.name}: ${pool.provisioningState}`);
        }
      }
    }
  } catch (error: any) {
    commandsExecuted.push({
      command: 'ContainerServiceClient.managedClusters.list',
      service: 'Azure AKS',
      timestamp: new Date().toISOString(),
      result: error.code === 'AuthorizationFailed' ? 'access_denied' : 'error',
      output: error.message,
    });
    logger.warn('Failed to check Azure AKS:', error.message);
  }

  return { unhealthy, rawData };
}

/**
 * Run Azure cloud investigation for an incident
 */
export async function runAzureInvestigation(
  credentialId: string,
  incidentId: string,
  userId: string,
  orgId: string
): Promise<AzureInvestigationResult> {
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
    provider: 'azure',
    status: 'analyzing',
    commandsExecuted: [],
    evidence: [],
    recommendations: [],
  });
  await accessLogRepo.save(accessLog);

  const commandsExecuted: AzureInvestigationResult['commands_executed'] = [];
  const findings: string[] = [];
  const rawData: any = {};

  try {
    // Decrypt credentials
    const creds = decryptCredentials<AzureCredentials>(credential.credentialsEncrypted, orgId);
    const azureCredential = getAzureCredential(creds);

    // Run investigations in parallel
    const [logsResult, appServicesResult, vmsResult, aksResult] = await Promise.all([
      creds.log_analytics_workspace_id
        ? queryLogAnalytics(azureCredential, creds.log_analytics_workspace_id, incident.triggeredAt, commandsExecuted)
        : Promise.resolve({ errors: [], rawLogs: [] }),
      checkAppServices(azureCredential, creds.subscription_id, commandsExecuted),
      checkVMs(azureCredential, creds.subscription_id, commandsExecuted),
      checkAKS(azureCredential, creds.subscription_id, commandsExecuted),
    ]);

    // Collect findings
    if (logsResult.errors.length > 0) {
      findings.push(`Found ${logsResult.errors.length} application exceptions in logs`);
      findings.push(...logsResult.errors.slice(0, 5));
    }

    if (appServicesResult.unhealthy.length > 0) {
      findings.push(...appServicesResult.unhealthy);
    }

    if (vmsResult.unhealthy.length > 0) {
      findings.push(...vmsResult.unhealthy);
    }

    if (aksResult.unhealthy.length > 0) {
      findings.push(...aksResult.unhealthy);
    }

    rawData.logs = logsResult.rawLogs;
    rawData.appServices = appServicesResult.rawData;
    rawData.vms = vmsResult.rawData;
    rawData.aks = aksResult.rawData;

    // Generate recommendations
    const recommendations: AzureInvestigationResult['recommendations'] = [];

    if (logsResult.errors.length > 0) {
      recommendations.push({
        severity: 'high',
        title: 'Application Exceptions Detected',
        description: `Found ${logsResult.errors.length} exceptions in Application Insights. Review the exception details and fix the underlying code issues.`,
        command: 'az monitor app-insights query --app <app-id> --analytics-query "exceptions | take 100"',
        risk: 'low',
        automated: false,
      });
    }

    if (appServicesResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'Restart Unhealthy App Services',
        description: 'One or more App Services are not running. Restart them to restore service.',
        command: 'az webapp restart --name <app-name> --resource-group <rg>',
        risk: 'low',
        automated: true,
      });
    }

    if (vmsResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'high',
        title: 'VM Health Issues',
        description: 'One or more VMs are not running or have agent issues.',
        command: 'az vm start --name <vm-name> --resource-group <rg>',
        risk: 'medium',
        automated: true,
      });
    }

    if (aksResult.unhealthy.length > 0) {
      recommendations.push({
        severity: 'critical',
        title: 'AKS Cluster Issues',
        description: 'AKS cluster or node pool health issues detected.',
        command: 'az aks get-credentials --name <cluster> --resource-group <rg> && kubectl get pods -A',
        risk: 'low',
        automated: false,
      });
    }

    // Update access log
    accessLog.commandsExecuted = commandsExecuted as any;
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
  } catch (error: any) {
    accessLog.complete(false, error.message);
    await accessLogRepo.save(accessLog);

    logger.error('Azure investigation failed:', error);

    return {
      success: false,
      findings,
      recommendations: [],
      commands_executed: commandsExecuted,
      error_message: error.message,
    };
  }
}
