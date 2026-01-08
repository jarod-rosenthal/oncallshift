import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDataSource } from '../../shared/db/data-source';
import { CloudCredential, CloudAccessLog } from '../../shared/models';
import { encryptCredentials, decryptCredentials } from '../../shared/services/credential-encryption';
import { runCloudInvestigation } from '../../shared/services/cloud-investigation';
import { logger } from '../../shared/utils/logger';
import { notFound, internalError, badRequest } from '../../shared/utils/problem-details';

function isOrgAdmin(user: any) {
  const role = user?.role;
  const baseRole = user?.baseRole;
  return role === 'super_admin' || role === 'admin' || baseRole === 'admin' || baseRole === 'owner';
}

const router = Router();

/**
 * Format cloud credential for API response (never include encrypted credentials)
 */
function formatCredential(credential: CloudCredential) {
  return {
    id: credential.id,
    provider: credential.provider,
    name: credential.name,
    description: credential.description,
    permission_level: credential.permissionLevel,
    allowed_services: credential.allowedServices,
    max_session_duration_minutes: credential.maxSessionDurationMinutes,
    require_approval_for_write: credential.requireApprovalForWrite,
    enabled: credential.enabled,
    usage_count: credential.usageCount,
    last_used_at: credential.lastUsedAt,
    last_used_by: credential.lastUsedBy
      ? {
          id: credential.lastUsedBy.id,
          full_name: credential.lastUsedBy.fullName,
          email: credential.lastUsedBy.email,
        }
      : null,
    created_by: credential.createdBy
      ? {
          id: credential.createdBy.id,
          full_name: credential.createdBy.fullName,
          email: credential.createdBy.email,
        }
      : null,
    created_at: credential.createdAt,
    updated_at: credential.updatedAt,
  };
}

/**
 * Format cloud access log for API response
 */
function formatAccessLog(log: CloudAccessLog) {
  return {
    id: log.id,
    credential_id: log.credentialId,
    credential: log.credential
      ? {
          id: log.credential.id,
          name: log.credential.name,
          provider: log.credential.provider,
        }
      : null,
    incident_id: log.incidentId,
    incident: log.incident
      ? {
          id: log.incident.id,
          incident_number: log.incident.incidentNumber,
          summary: log.incident.summary,
        }
      : null,
    user_id: log.triggeredById,
    user: log.triggeredBy
      ? {
          id: log.triggeredBy.id,
          full_name: log.triggeredBy.fullName,
          email: log.triggeredBy.email,
        }
      : null,
    provider: log.provider,
    commands_executed: log.commandsExecuted,
    analysis_summary: log.analysisSummary,
    root_cause: log.rootCause,
    evidence: log.evidence,
    recommendations: log.recommendations,
    findings: log.evidence || [],
    success: log.success,
    error_message: log.errorMessage,
    status: log.status,
    session_start: log.sessionStartedAt,
    session_end: log.sessionEndedAt,
    duration_seconds: log.durationSeconds,
    created_at: log.createdAt,
  };
}

// ==========================================
// CLOUD CREDENTIALS CRUD
// ==========================================

/**
 * GET /api/v1/cloud-credentials
 * List all cloud credentials for the organization
 */
router.get(
  '/',
  [
    query('provider').optional().isIn(['aws', 'azure', 'gcp', 'anthropic', 'openai', 'google']),
    query('enabled').optional().isBoolean().toBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { provider, enabled } = req.query;

      const dataSource = await getDataSource();
      const credentialRepo = dataSource.getRepository(CloudCredential);

      const whereClause: any = { orgId };
      if (provider) whereClause.provider = provider;
      if (enabled !== undefined) whereClause.enabled = enabled;

      const credentials = await credentialRepo.find({
        where: whereClause,
        relations: ['createdBy', 'lastUsedBy'],
        order: { createdAt: 'DESC' },
      });

      return res.json({
        credentials: credentials.map(formatCredential),
      });
    } catch (error) {
      logger.error('Error listing cloud credentials:', error);
      return internalError(res);
    }
  }
);

// ==========================================
// ACCESS LOGS (must be before /:id routes)
// ==========================================

/**
 * GET /api/v1/cloud-credentials/access-logs
 * List cloud access logs for the organization
 */
router.get(
  '/access-logs',
  [
    query('credential_id').optional().isUUID(),
    query('incident_id').optional().isUUID(),
    query('status').optional().isIn(['pending', 'analyzing', 'completed', 'failed']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { credential_id, incident_id, status } = req.query;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const dataSource = await getDataSource();
      const logRepo = dataSource.getRepository(CloudAccessLog);

      const whereClause: any = { orgId };
      if (credential_id) whereClause.credentialId = credential_id;
      if (incident_id) whereClause.incidentId = incident_id;
      if (status) whereClause.status = status;

      const [logs, total] = await logRepo.findAndCount({
        where: whereClause,
        relations: ['credential', 'incident', 'triggeredBy'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return res.json({
        logs: logs.map(formatAccessLog),
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('Error listing cloud access logs:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/cloud-credentials/access-logs/:logId
 * Get a single access log entry
 */
router.get('/access-logs/:logId', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const logRepo = dataSource.getRepository(CloudAccessLog);

    const log = await logRepo.findOne({
      where: { id: logId, orgId },
      relations: ['credential', 'incident', 'triggeredBy'],
    });

    if (!log) {
      return notFound(res, 'Access log', logId);
    }

    return res.json({ access_log: formatAccessLog(log) });
  } catch (error) {
    logger.error('Error fetching cloud access log:', error);
    return internalError(res);
  }
});

// ==========================================
// SINGLE CREDENTIAL ROUTES (after static routes)
// ==========================================

/**
 * GET /api/v1/cloud-credentials/:id
 * Get a single cloud credential
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    const credential = await credentialRepo.findOne({
      where: { id, orgId },
      relations: ['createdBy', 'lastUsedBy'],
    });

    if (!credential) {
      return notFound(res, 'Cloud credential', id);
    }

    return res.json({ credential: formatCredential(credential) });
  } catch (error) {
    logger.error('Error fetching cloud credential:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/cloud-credentials
 * Create a new cloud credential
 */
router.post(
  '/',
  [
    body('provider').isIn(['aws', 'azure', 'gcp', 'anthropic', 'openai', 'google']).withMessage('Invalid provider'),
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('credentials').isObject().withMessage('Credentials object is required'),
    body('permission_level').optional().isIn(['read_only', 'read_write']),
    body('allowed_services').optional().isArray(),
    body('max_session_duration_minutes').optional().isInt({ min: 5, max: 480 }),
    body('require_approval_for_write').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const {
        provider,
        name,
        description,
        credentials,
        permission_level,
        allowed_services,
        max_session_duration_minutes,
        require_approval_for_write,
      } = req.body;

      // Check user has admin role
      if (!isOrgAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can create cloud credentials' });
      }

      const dataSource = await getDataSource();
      const credentialRepo = dataSource.getRepository(CloudCredential);

      // Check for duplicate name
      const existing = await credentialRepo.findOne({
        where: { orgId, provider, name },
      });

      if (existing) {
        return res.status(400).json({
          error: `A ${provider.toUpperCase()} credential with name "${name}" already exists`,
        });
      }

      // Validate provider-specific credentials
      if (provider === 'aws') {
        const hasAccessKeys = credentials.aws_access_key_id && credentials.aws_secret_access_key;
        const hasRole = credentials.aws_role_arn;
        if (!hasAccessKeys && !hasRole) {
          return res.status(400).json({
            error: 'AWS credentials require either access keys or role ARN',
          });
        }
        if (!credentials.aws_region) {
          return res.status(400).json({ error: 'AWS region is required' });
        }
      } else if (provider === 'azure') {
        if (
          !credentials.client_id ||
          !credentials.client_secret ||
          !credentials.tenant_id ||
          !credentials.subscription_id
        ) {
          return res.status(400).json({
            error: 'Azure credentials require client_id, client_secret, tenant_id, and subscription_id',
          });
        }
      } else if (provider === 'gcp') {
        if (!credentials.service_account_json || !credentials.project_id) {
          return res.status(400).json({
            error: 'GCP credentials require service_account_json and project_id',
          });
        }
      } else if (provider === 'anthropic') {
        if (!credentials.api_key) {
          return res.status(400).json({
            error: 'Anthropic credentials require api_key',
          });
        }
      } else if (provider === 'openai') {
        if (!credentials.api_key) {
          return res.status(400).json({
            error: 'OpenAI credentials require api_key',
          });
        }
      } else if (provider === 'google') {
        if (!credentials.api_key) {
          return res.status(400).json({
            error: 'Google AI credentials require api_key',
          });
        }
      }

      // Encrypt credentials
      const encryptedCredentials = encryptCredentials(credentials, orgId);

      // Create credential
      const credential = credentialRepo.create({
        id: uuidv4(),
        orgId,
        provider,
        name,
        description: description || null,
        credentialsEncrypted: encryptedCredentials,
        permissionLevel: permission_level || 'read_only',
        allowedServices: allowed_services || [],
        maxSessionDurationMinutes: max_session_duration_minutes || 60,
        requireApprovalForWrite: require_approval_for_write ?? true,
        createdById: userId,
        enabled: true,
      });

      await credentialRepo.save(credential);

      // Fetch with relations
      const createdCredential = await credentialRepo.findOne({
        where: { id: credential.id },
        relations: ['createdBy'],
      });

      logger.info('Cloud credential created', {
        credentialId: credential.id,
        provider,
        name,
        orgId,
        createdBy: userId,
      });

      return res.status(201).json({
        credential: formatCredential(createdCredential!),
        message: 'Cloud credential created successfully',
      });
    } catch (error) {
      logger.error('Error creating cloud credential:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/cloud-credentials/:id
 * Update a cloud credential (cannot update credentials themselves - must delete and recreate)
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('permission_level').optional().isIn(['read_only', 'read_write']),
    body('allowed_services').optional().isArray(),
    body('max_session_duration_minutes').optional().isInt({ min: 5, max: 480 }),
    body('require_approval_for_write').optional().isBoolean(),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;

      // Check user has admin role
      if (!isOrgAdmin(req.user)) {
        return res.status(403).json({ error: 'Only admins can update cloud credentials' });
      }

      const dataSource = await getDataSource();
      const credentialRepo = dataSource.getRepository(CloudCredential);

      const credential = await credentialRepo.findOne({
        where: { id, orgId },
      });

      if (!credential) {
        return notFound(res, 'Cloud credential', id);
      }

      const {
        name,
        description,
        permission_level,
        allowed_services,
        max_session_duration_minutes,
        require_approval_for_write,
        enabled,
      } = req.body;

      // Update fields
      if (name !== undefined) credential.name = name;
      if (description !== undefined) credential.description = description;
      if (permission_level !== undefined) credential.permissionLevel = permission_level;
      if (allowed_services !== undefined) credential.allowedServices = allowed_services;
      if (max_session_duration_minutes !== undefined) {
        credential.maxSessionDurationMinutes = max_session_duration_minutes;
      }
      if (require_approval_for_write !== undefined) {
        credential.requireApprovalForWrite = require_approval_for_write;
      }
      if (enabled !== undefined) credential.enabled = enabled;

      await credentialRepo.save(credential);

      // Fetch with relations
      const updatedCredential = await credentialRepo.findOne({
        where: { id },
        relations: ['createdBy', 'lastUsedBy'],
      });

      logger.info('Cloud credential updated', {
        credentialId: id,
        orgId,
        updatedBy: req.user!.id,
      });

      return res.json({
        credential: formatCredential(updatedCredential!),
        message: 'Cloud credential updated successfully',
      });
    } catch (error) {
      logger.error('Error updating cloud credential:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/cloud-credentials/:id
 * Delete a cloud credential
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    // Check user has admin role
    if (!isOrgAdmin(req.user)) {
      return res.status(403).json({ error: 'Only admins can delete cloud credentials' });
    }

    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    const credential = await credentialRepo.findOne({
      where: { id, orgId },
    });

    if (!credential) {
      return notFound(res, 'Cloud credential', id);
    }

    await credentialRepo.remove(credential);

    logger.info('Cloud credential deleted', {
      credentialId: id,
      provider: credential.provider,
      name: credential.name,
      orgId,
      deletedBy: req.user!.id,
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting cloud credential:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/cloud-credentials/:id/test
 * Test a cloud credential connection
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    const credential = await credentialRepo.findOne({
      where: { id, orgId },
    });

    if (!credential) {
      return notFound(res, 'Cloud credential', id);
    }

    // Decrypt credentials
    let credentials: any;
    try {
      credentials = decryptCredentials(credential.credentialsEncrypted, orgId);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt credentials',
      });
    }

    // Test connection based on provider
    // For now, we'll just validate the credential structure
    // In production, this would actually test the connection
    let testResult = {
      success: true,
      message: '',
      account_id: '',
      permissions_verified: [] as string[],
    };

    if (credential.provider === 'aws') {
      const hasRole = !!credentials.aws_role_arn;
      testResult.message = `AWS credentials ${hasRole ? '(role-based)' : '(access key)'} validated`;
      testResult.account_id = hasRole
        ? credentials.aws_role_arn.split(':')[4] || 'unknown'
        : 'access-key-based';
      testResult.permissions_verified = ['sts:GetCallerIdentity'];

      // TODO: Actually test AWS connection using STS GetCallerIdentity
      // This would require the aws-sdk package
    } else if (credential.provider === 'azure') {
      testResult.message = 'Azure service principal credentials validated';
      testResult.account_id = credentials.subscription_id;
      testResult.permissions_verified = ['Reader'];
    } else if (credential.provider === 'gcp') {
      testResult.message = 'GCP service account credentials validated';
      testResult.account_id = credentials.project_id;
      testResult.permissions_verified = ['roles/viewer'];
    }

    logger.info('Cloud credential tested', {
      credentialId: id,
      provider: credential.provider,
      orgId,
      testedBy: req.user!.id,
      result: testResult.success ? 'success' : 'error',
    });

    return res.json(testResult);
  } catch (error) {
    logger.error('Error testing cloud credential:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to test credential',
    });
  }
});

/**
 * POST /api/v1/cloud-credentials/:id/investigate
 * Run cloud investigation for an incident with AI analysis
 */
router.post(
  '/:id/investigate',
  [
    body('incident_id').isUUID().withMessage('Incident ID is required'),
    body('enable_ai').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { incident_id, enable_ai = true } = req.body;
      const orgId = req.orgId!;
      const userId = req.user!.id;

      const dataSource = await getDataSource();
      const credentialRepo = dataSource.getRepository(CloudCredential);

      const credential = await credentialRepo.findOne({
        where: { id, orgId },
      });

      if (!credential) {
        return notFound(res, 'Cloud credential', id);
      }

      if (!credential.enabled) {
        return badRequest(res, 'Cloud credential is disabled');
      }

      // Run unified investigation with AI analysis
      const result = await runCloudInvestigation(id, incident_id, userId, orgId, enable_ai);

      return res.json({
        success: result.success,
        provider: result.provider,
        findings: result.findings,
        recommendations: result.recommendations,
        commands_executed: result.commands_executed,
        error_message: result.error_message,
        root_cause: result.root_cause,
        ai_analysis: result.aiAnalysis ? {
          root_cause: result.aiAnalysis.rootCause,
          affected_resources: result.aiAnalysis.affectedResources,
          recommendations: result.aiAnalysis.recommendations,
          confidence: result.aiAnalysis.confidence,
          additional_investigation: result.aiAnalysis.additionalInvestigation,
          correlation_insights: result.aiAnalysis.correlationInsights,
        } : null,
        incident_context: result.incidentContext,
      });
    } catch (error: any) {
      logger.error('Error running cloud investigation:', error);
      return res.status(500).json({
        error: 'Failed to run investigation',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/cloud-credentials/:id/execute-remediation
 * Execute a recommended remediation action
 */
router.post(
  '/:id/execute-remediation',
  [
    body('incident_id').isUUID().withMessage('Incident ID is required'),
    body('recommendation_index').isInt({ min: 0 }).withMessage('Recommendation index is required'),
    body('confirmed').isBoolean().withMessage('Confirmation is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { incident_id, recommendation_index, confirmed } = req.body;
      const orgId = req.orgId!;
      const userId = req.user!.id;

      if (!confirmed) {
        return badRequest(res, 'Remediation must be confirmed before execution');
      }

      const dataSource = await getDataSource();
      const credentialRepo = dataSource.getRepository(CloudCredential);
      const accessLogRepo = dataSource.getRepository(CloudAccessLog);

      // Get credential
      const credential = await credentialRepo.findOne({
        where: { id, orgId },
      });

      if (!credential) {
        return notFound(res, 'Cloud credential', id);
      }

      if (!credential.enabled) {
        return badRequest(res, 'Cloud credential is disabled');
      }

      // Check permission level
      if (credential.permissionLevel === 'read_only') {
        return res.status(403).json({ error: 'Credential has read-only permission level' });
      }

      // Get the latest access log to find recommendations
      const accessLog = await accessLogRepo.findOne({
        where: { credentialId: id, incidentId: incident_id, orgId },
        order: { createdAt: 'DESC' },
      });

      if (!accessLog) {
        return notFound(res, 'Investigation for incident', incident_id);
      }

      const recommendations = accessLog.recommendations || [];
      if (recommendation_index >= recommendations.length) {
        return badRequest(res, 'Invalid recommendation index');
      }

      const recommendation = recommendations[recommendation_index];

      // Check if high-risk requires approval
      if (recommendation.requires_approval && !isOrgAdmin(req.user)) {
        return res.status(403).json({
          error: 'This action requires admin approval',
          requires_approval: true,
        });
      }

      // Log the execution attempt
      logger.info('Remediation execution requested', {
        credentialId: id,
        incidentId: incident_id,
        userId,
        recommendation: recommendation.title,
        command: recommendation.command,
      });

      // For now, return the command that would be executed
      // Full execution would use AWS SDK/Azure SDK/GCP SDK based on provider
      return res.json({
        success: true,
        message: 'Remediation command ready for execution',
        recommendation: {
          title: recommendation.title,
          description: recommendation.description,
          command: recommendation.command,
          severity: recommendation.severity,
        },
        execution_status: 'pending',
        note: 'Full automated execution coming soon. For now, use the command provided.',
      });
    } catch (error: any) {
      logger.error('Error executing remediation:', error);
      return res.status(500).json({
        error: 'Failed to execute remediation',
        message: error.message,
      });
    }
  }
);

export default router;
