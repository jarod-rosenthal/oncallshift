import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authenticateUser } from '../../shared/auth/middleware';
import { logger } from '../../shared/utils/logger';

const execAsync = promisify(exec);

const router = Router();

// All action routes require authentication
router.use(authenticateUser);

// Generic action executor - for demo purposes, simulates action execution
const executeAction = async (
  actionName: string,
  params: Record<string, unknown>,
  userId: string,
  orgId: string
): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> => {
  // Log the action for audit trail
  logger.info(`Runbook action executed`, {
    action: actionName,
    params,
    userId,
    orgId,
    timestamp: new Date().toISOString(),
  });

  // Simulate action execution delay (1-2 seconds)
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  // For demo, always return success with simulated details
  return {
    success: true,
    message: `Action "${actionName}" executed successfully`,
    details: {
      executedAt: new Date().toISOString(),
      executedBy: userId,
      ...params,
    },
  };
};

/**
 * POST /api/v1/actions/restart-pods
 * Simulates restarting Kubernetes pods
 */
router.post(
  '/restart-pods',
  [
    body('deployment').isString().notEmpty(),
    body('namespace').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { deployment, namespace = 'default' } = req.body;
    const result = await executeAction(
      'restart-pods',
      { deployment, namespace, podsRestarted: Math.floor(Math.random() * 3) + 2 },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/scale-deployment
 * Simulates scaling a deployment
 */
router.post(
  '/scale-deployment',
  [
    body('deployment').isString().notEmpty(),
    body('replicas').isInt({ min: 1, max: 20 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { deployment, replicas } = req.body;
    const result = await executeAction(
      'scale-deployment',
      { deployment, replicas, previousReplicas: Math.floor(Math.random() * 3) + 1 },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/rollback
 * Simulates rolling back a deployment
 */
router.post(
  '/rollback',
  [body('deployment').isString().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { deployment } = req.body;
    const result = await executeAction(
      'rollback',
      {
        deployment,
        rolledBackFrom: `v1.${Math.floor(Math.random() * 50) + 50}`,
        rolledBackTo: `v1.${Math.floor(Math.random() * 50)}`,
      },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/rate-limit
 * Simulates enabling/disabling rate limiting
 */
router.post(
  '/rate-limit',
  [
    body('enabled').isBoolean(),
    body('rps').optional().isInt({ min: 10, max: 10000 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { enabled, rps = 100 } = req.body;
    const result = await executeAction(
      'rate-limit',
      { enabled, rps },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/clear-cache
 * Simulates clearing application cache
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  const result = await executeAction(
    'clear-cache',
    { entriesCleared: Math.floor(Math.random() * 10000) + 1000 },
    req.user!.id,
    req.user!.orgId
  );

  res.json(result);
});

/**
 * POST /api/v1/actions/flush-pgbouncer
 * Simulates flushing PgBouncer connections
 */
router.post('/flush-pgbouncer', async (req: Request, res: Response) => {
  const result = await executeAction(
    'flush-pgbouncer',
    { connectionsFlushed: Math.floor(Math.random() * 50) + 10 },
    req.user!.id,
    req.user!.orgId
  );

  res.json(result);
});

/**
 * POST /api/v1/actions/traffic-shed
 * Simulates enabling traffic shedding
 */
router.post(
  '/traffic-shed',
  [body('percentage').isInt({ min: 1, max: 50 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { percentage } = req.body;
    const result = await executeAction(
      'traffic-shed',
      { percentage, estimatedRequestsDropped: Math.floor(Math.random() * 1000) + 100 },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/kill-queries
 * Simulates killing long-running database queries
 */
router.post(
  '/kill-queries',
  [body('threshold_seconds').isInt({ min: 5, max: 300 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { threshold_seconds } = req.body;
    const result = await executeAction(
      'kill-queries',
      { threshold_seconds, queriesKilled: Math.floor(Math.random() * 5) },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/rotate-logs
 * Simulates rotating log files
 */
router.post('/rotate-logs', async (req: Request, res: Response) => {
  const result = await executeAction(
    'rotate-logs',
    {
      filesRotated: Math.floor(Math.random() * 20) + 5,
      spaceFreedMB: Math.floor(Math.random() * 500) + 100,
    },
    req.user!.id,
    req.user!.orgId
  );

  res.json(result);
});

/**
 * POST /api/v1/actions/clear-temp
 * Simulates clearing temporary files
 */
router.post(
  '/clear-temp',
  [body('older_than_hours').optional().isInt({ min: 1, max: 168 })],
  async (req: Request, res: Response) => {
    const { older_than_hours = 24 } = req.body;
    const result = await executeAction(
      'clear-temp',
      {
        older_than_hours,
        filesDeleted: Math.floor(Math.random() * 1000) + 100,
        spaceFreedMB: Math.floor(Math.random() * 200) + 50,
      },
      req.user!.id,
      req.user!.orgId
    );

    res.json(result);
  }
);

/**
 * POST /api/v1/actions/docker-prune
 * Simulates pruning Docker resources
 */
router.post('/docker-prune', async (req: Request, res: Response) => {
  const result = await executeAction(
    'docker-prune',
    {
      imagesRemoved: Math.floor(Math.random() * 10) + 2,
      containersRemoved: Math.floor(Math.random() * 5),
      spaceFreedGB: (Math.random() * 5 + 1).toFixed(2),
    },
    req.user!.id,
    req.user!.orgId
  );

  res.json(result);
});

/**
 * POST /api/v1/actions/aws-identity
 * REAL ACTION: Runs aws sts get-caller-identity to show authenticated AWS identity
 */
router.post('/aws-identity', async (req: Request, res: Response) => {
  logger.info('Executing AWS identity check', {
    userId: req.user!.id,
    orgId: req.user!.orgId,
    timestamp: new Date().toISOString(),
  });

  try {
    const { stdout, stderr } = await execAsync('aws sts get-caller-identity --output json', {
      timeout: 10000, // 10 second timeout
    });

    if (stderr) {
      logger.warn('AWS CLI stderr:', { stderr });
    }

    const identity = JSON.parse(stdout);

    logger.info('AWS identity retrieved successfully', {
      userId: req.user!.id,
      account: identity.Account,
      arn: identity.Arn,
    });

    res.json({
      success: true,
      message: `AWS Identity: ${identity.Arn}`,
      details: {
        account: identity.Account,
        userId: identity.UserId,
        arn: identity.Arn,
        executedAt: new Date().toISOString(),
        executedBy: req.user!.id,
      },
    });
  } catch (error: any) {
    logger.error('AWS identity check failed', {
      error: error.message,
      userId: req.user!.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get AWS identity',
      error: error.stderr || error.message,
    });
  }
});

/**
 * POST /api/v1/actions/shell-command
 * REAL ACTION: Executes a whitelisted shell command (for demo purposes)
 * Only allows safe, read-only commands
 */
router.post(
  '/shell-command',
  [body('command').isString().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { command } = req.body;

    // Whitelist of allowed commands (read-only, safe commands)
    const allowedCommands: Record<string, string> = {
      'whoami': 'whoami',
      'hostname': 'hostname',
      'uptime': 'uptime',
      'date': 'date',
      'aws-identity': 'aws sts get-caller-identity --output json',
      'aws-region': 'aws configure get region',
      'disk-usage': 'df -h',
      'memory': 'free -h',
      'node-version': 'node --version',
      'npm-version': 'npm --version',
    };

    const actualCommand = allowedCommands[command];
    if (!actualCommand) {
      res.status(400).json({
        success: false,
        message: `Command "${command}" is not allowed. Allowed commands: ${Object.keys(allowedCommands).join(', ')}`,
      });
      return;
    }

    logger.info('Executing shell command', {
      command,
      actualCommand,
      userId: req.user!.id,
      orgId: req.user!.orgId,
    });

    try {
      const { stdout, stderr } = await execAsync(actualCommand, {
        timeout: 10000,
      });

      res.json({
        success: true,
        message: `Command "${command}" executed successfully`,
        details: {
          command,
          output: stdout.trim(),
          stderr: stderr?.trim() || undefined,
          executedAt: new Date().toISOString(),
          executedBy: req.user!.id,
        },
      });
    } catch (error: any) {
      logger.error('Shell command failed', {
        command,
        error: error.message,
        userId: req.user!.id,
      });

      res.status(500).json({
        success: false,
        message: `Command "${command}" failed: ${error.message}`,
        error: error.stderr || error.message,
      });
    }
  }
);

export default router;
