import { getDataSource } from '../db/data-source';
import {
  Runbook,
  RunbookExecution,
  RunbookExecutionApproval,
  Incident,
  CloudCredential,
} from '../models';
import { RunbookStep } from '../models/Runbook';
import { StepResult, ExecutionContext } from '../models/RunbookExecution';
import { logger } from '../utils/logger';
import { executeScript, validateScript } from './script-sandbox';
import { decryptCredentials } from './credential-encryption';
import { generateScriptFromNaturalLanguage } from './script-generation-service';

export interface StartExecutionParams {
  runbookId: string;
  incidentId: string;
  userId: string;
  orgId: string;
  credentialIds?: string[];
}

export interface ExecuteStepParams {
  executionId: string;
  stepIndex: number;
  orgId: string;
  approved?: boolean; // Set to true when user has confirmed approval
}

export interface ApprovalDecisionParams {
  approvalId: string;
  userId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}

export class RunbookExecutionService {
  /**
   * Start a new runbook execution for an incident
   */
  async startExecution(params: StartExecutionParams): Promise<RunbookExecution> {
    const { runbookId, incidentId, userId, orgId, credentialIds } = params;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);
    const incidentRepo = dataSource.getRepository(Incident);
    const executionRepo = dataSource.getRepository(RunbookExecution);

    try {
      // Load runbook
      const runbook = await runbookRepo.findOne({
        where: { id: runbookId, orgId },
      });

      if (!runbook) {
        throw new Error('Runbook not found');
      }

      // Load incident
      const incident = await incidentRepo.findOne({
        where: { id: incidentId, orgId },
        relations: ['service'],
      });

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Build execution context
      const executionContext: ExecutionContext = {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        severity: incident.severity,
        serviceName: incident.service?.name,
        credentialIds: credentialIds || [],
      };

      // Create execution record
      const execution = executionRepo.create({
        orgId,
        runbookId,
        incidentId,
        startedById: userId,
        startedAt: new Date(),
        status: 'pending',
        currentStepIndex: 0,
        stepResults: [],
        executionContext,
      });

      await executionRepo.save(execution);

      logger.info('Started runbook execution', {
        executionId: execution.id,
        runbookId,
        incidentId,
        userId,
      });

      return execution;
    } catch (error: any) {
      logger.error('Failed to start runbook execution', {
        error: error.message,
        runbookId,
        incidentId,
      });
      throw error;
    }
  }

  /**
   * Execute a specific step in a runbook execution
   * This will be expanded in Phase 2 with actual script execution
   */
  async executeStep(params: ExecuteStepParams): Promise<StepResult> {
    const { executionId, stepIndex, orgId, approved } = params;
    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(RunbookExecution);

    try {
      // Load execution
      const execution = await executionRepo.findOne({
        where: { id: executionId, orgId },
        relations: ['runbook'],
      });

      if (!execution) {
        throw new Error('Execution not found');
      }

      // Load runbook to get step details
      const runbookRepo = dataSource.getRepository(Runbook);
      const runbook = await runbookRepo.findOne({
        where: { id: execution.runbookId },
      });

      if (!runbook || !runbook.steps[stepIndex]) {
        throw new Error('Step not found');
      }

      const step: RunbookStep = runbook.steps[stepIndex];

      // Update execution status
      execution.status = 'running';
      execution.currentStepIndex = stepIndex;
      await executionRepo.save(execution);

      // Create step result
      const stepResult: StepResult = {
        stepId: step.id,
        stepIndex,
        status: 'success',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };

      // Check if step requires approval (skip if already approved by user)
      if (step.type === 'automated' && step.automation?.requiresApproval && !approved) {
        // Return requires_approval status - user needs to confirm first
        execution.status = 'requires_approval';
        stepResult.status = 'skipped';
        stepResult.output = 'Awaiting approval - click Confirm to proceed';
        await executionRepo.save(execution);
        return stepResult;
      }

      if (step.type === 'automated' && step.automation?.script) {
        // Execute automated step with script
        const script = step.automation.script;
        const startTime = Date.now();

        try {
          // Validate script first
          if (script.language !== 'natural_language') {
            const validation = validateScript(script.code, script.language as 'bash' | 'python' | 'javascript');
            if (!validation.safe) {
              throw new Error(`Script validation failed: ${validation.reason}`);
            }
          }

          // Prepare environment with credentials if needed
          const environment: Record<string, string> = {};
          if (step.automation.credentialIds && step.automation.credentialIds.length > 0) {
            const credentialRepo = dataSource.getRepository(CloudCredential);
            for (const credId of step.automation.credentialIds) {
              const credential = await credentialRepo.findOne({
                where: { id: credId, orgId },
              });
              if (credential) {
                const decrypted = decryptCredentials(credential.credentialsEncrypted, orgId);
                // Inject credentials as environment variables
                if (credential.provider === 'aws' && 'aws_access_key_id' in decrypted) {
                  environment.AWS_ACCESS_KEY_ID = (decrypted as any).aws_access_key_id || '';
                  environment.AWS_SECRET_ACCESS_KEY = (decrypted as any).aws_secret_access_key || '';
                  environment.AWS_REGION = (decrypted as any).aws_region || 'us-east-1';
                }
              }
            }
          }

          // Handle natural language scripts
          let actualCode = script.code;
          let actualLanguage = script.language;

          if (script.language === 'natural_language') {
            // Generate script from natural language using Claude
            const genResult = await generateScriptFromNaturalLanguage(
              {
                description: script.code,
                language: 'bash', // Default to bash for natural language
                context: {
                  incidentSummary: execution.executionContext?.incidentId,
                  severity: execution.executionContext?.severity,
                  serviceName: execution.executionContext?.serviceName,
                },
              },
              orgId
            );

            if (!genResult.success || !genResult.script) {
              throw new Error(`Script generation failed: ${genResult.error || 'Unknown error'}`);
            }

            actualCode = genResult.script.code;
            actualLanguage = genResult.script.language;
            stepResult.output = `[Generated from: "${script.code}"]\n\n${genResult.script.explanation}\n\n`;
          }

          // Execute script in sandbox
          const result = await executeScript(
            actualLanguage as 'bash' | 'python' | 'javascript',
            actualCode,
            {
              timeout: step.automation.timeout * 1000, // convert seconds to ms
              environment,
            }
          );

          stepResult.status = result.success ? 'success' : 'failed';
          stepResult.output = (stepResult.output || '') + result.stdout;
          stepResult.error = result.stderr || result.error;
          stepResult.exitCode = result.exitCode;
          stepResult.durationMs = Date.now() - startTime;
          stepResult.completedAt = new Date().toISOString();

          if (!result.success) {
            execution.status = 'failed';
            execution.errorMessage = `Step ${stepIndex} failed: ${result.error || result.stderr}`;
          }
        } catch (error: any) {
          stepResult.status = 'failed';
          stepResult.error = error.message;
          stepResult.durationMs = Date.now() - startTime;
          stepResult.completedAt = new Date().toISOString();
          execution.status = 'failed';
          execution.errorMessage = `Step ${stepIndex} failed: ${error.message}`;
        }
      } else if (step.type === 'automated') {
        // Automated step without script
        stepResult.output = 'Automated step (no script provided)';
      } else {
        // Manual step - just mark as completed
        stepResult.output = 'Manual step completed by user';
      }

      // Save step result
      execution.stepResults = [...execution.stepResults, stepResult];
      await executionRepo.save(execution);

      logger.info('Executed runbook step', {
        executionId,
        stepIndex,
        stepType: step.type,
        status: stepResult.status,
      });

      return stepResult;
    } catch (error: any) {
      logger.error('Failed to execute runbook step', {
        error: error.message,
        executionId,
        stepIndex,
      });
      throw error;
    }
  }

  /**
   * Complete a runbook execution
   */
  async completeExecution(
    executionId: string,
    orgId: string,
    status: 'completed' | 'failed' | 'cancelled',
    errorMessage?: string
  ): Promise<void> {
    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(RunbookExecution);

    const execution = await executionRepo.findOne({
      where: { id: executionId, orgId },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = status;
    execution.completedAt = new Date();
    if (errorMessage) {
      execution.errorMessage = errorMessage;
    }

    await executionRepo.save(execution);

    logger.info('Completed runbook execution', {
      executionId,
      status,
      hasError: !!errorMessage,
    });
  }

  /**
   * Get execution status and details
   */
  async getExecution(executionId: string, orgId: string): Promise<RunbookExecution | null> {
    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(RunbookExecution);

    return executionRepo.findOne({
      where: { id: executionId, orgId },
      relations: ['runbook', 'incident', 'startedBy', 'approvals'],
    });
  }

  /**
   * List executions for an incident
   */
  async listExecutionsForIncident(incidentId: string, orgId: string): Promise<RunbookExecution[]> {
    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(RunbookExecution);

    return executionRepo.find({
      where: { incidentId, orgId },
      order: { createdAt: 'DESC' },
      relations: ['runbook', 'startedBy'],
    });
  }

  /**
   * Request approval for a step (will be fully implemented in Phase 3)
   */
  async requestApproval(
    executionId: string,
    stepIndex: number,
    requestedBy: string,
    scriptDetails: {
      language: string;
      code: string;
      description: string;
    }
  ): Promise<RunbookExecutionApproval> {
    const dataSource = await getDataSource();
    const approvalRepo = dataSource.getRepository(RunbookExecutionApproval);

    const approval = approvalRepo.create({
      executionId,
      stepIndex,
      requestedById: requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      scriptLanguage: scriptDetails.language,
      scriptCode: scriptDetails.code,
      scriptDescription: scriptDetails.description,
    });

    await approvalRepo.save(approval);

    logger.info('Created approval request', {
      approvalId: approval.id,
      executionId,
      stepIndex,
    });

    return approval;
  }

  /**
   * Handle approval decision (will be fully implemented in Phase 3)
   */
  async handleApprovalDecision(params: ApprovalDecisionParams): Promise<void> {
    const { approvalId, userId, decision, notes } = params;
    const dataSource = await getDataSource();
    const approvalRepo = dataSource.getRepository(RunbookExecutionApproval);

    const approval = await approvalRepo.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new Error('Approval already processed');
    }

    approval.status = decision;
    approval.respondedById = userId;
    approval.respondedAt = new Date();
    approval.responseNotes = notes || null;

    await approvalRepo.save(approval);

    logger.info('Processed approval decision', {
      approvalId,
      decision,
      userId,
    });

    // Continue execution if approved (will be implemented in Phase 3)
  }
}
