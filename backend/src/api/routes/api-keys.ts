import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { OrganizationApiKey } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { setLocationHeader } from '../../shared/utils/location-header';
import { parsePaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';

const router = Router();

// All routes require JWT authentication
router.use(authenticateUser);

// Helper to generate API key token: org_${uuid without dashes}
function generateApiKeyToken(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `org_${uuid}`;
}

// Helper to format API key for response (never include token or hash)
function formatApiKey(apiKey: OrganizationApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    key_prefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    last_used_at: apiKey.lastUsedAt,
    expires_at: apiKey.expiresAt,
    created_at: apiKey.createdAt,
    created_by: apiKey.createdBy
      ? {
          id: apiKey.createdBy.id,
          full_name: apiKey.createdBy.fullName,
          email: apiKey.createdBy.email,
        }
      : null,
  };
}

/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     summary: Create a new organization API key
 *     description: Generate a new API key for programmatic access. The full token is only returned once on creation.
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Descriptive name for the API key
 *                 example: terraform-provider
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Permission scopes for this key
 *                 default: ["*"]
 *                 example: ["services:read", "incidents:write"]
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   type: object
 *                   description: API key metadata
 *                 token:
 *                   type: string
 *                   description: The full API key token (only shown once)
 *                   example: org_abc123def456789...
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must be 255 characters or less'),
    body('scopes')
      .optional()
      .isArray()
      .withMessage('Scopes must be an array'),
    body('scopes.*')
      .optional()
      .isString()
      .withMessage('Each scope must be a string'),
    body('expires_at')
      .optional()
      .isISO8601()
      .withMessage('expires_at must be a valid ISO 8601 date'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins can create API keys
      if (req.user?.role !== 'admin' && req.user?.baseRole !== 'admin' && req.user?.baseRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { name, scopes = ['*'], expires_at } = req.body;

      const dataSource = await getDataSource();
      const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

      // Check for duplicate name in org
      const existing = await apiKeyRepo.findOne({
        where: { orgId, name },
      });

      if (existing) {
        return res.status(400).json({
          error: `An API key with name "${name}" already exists`,
        });
      }

      // Generate the token
      const token = generateApiKeyToken();
      const keyPrefix = token.substring(0, 12);

      // Hash the token with bcrypt (10 rounds)
      const keyHash = await bcrypt.hash(token, 10);

      // Create the API key
      const apiKey = apiKeyRepo.create({
        id: uuidv4(),
        orgId,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expires_at ? new Date(expires_at) : null,
        createdById: userId,
      });

      await apiKeyRepo.save(apiKey);

      // Fetch with relations for response
      const createdApiKey = await apiKeyRepo.findOne({
        where: { id: apiKey.id },
        relations: ['createdBy'],
      });

      logger.info('Organization API key created', {
        apiKeyId: apiKey.id,
        name,
        keyPrefix,
        orgId,
        createdBy: userId,
      });

      // Return the token only on creation - this is the only time it's shown
      setLocationHeader(res, req, '/api/v1/api-keys', apiKey.id);
      return res.status(201).json({
        api_key: formatApiKey(createdApiKey!),
        token,
        message: 'API key created successfully. Save this token - it will not be shown again.',
      });
    } catch (error) {
      logger.error('Error creating API key:', error);
      return res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

/**
 * @swagger
 * /api/v1/api-keys:
 *   get:
 *     summary: List all organization API keys
 *     description: Returns a list of all API keys for the organization. Tokens and hashes are never returned.
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       key_prefix:
 *                         type: string
 *                         description: First 12 characters of the key for identification
 *                       scopes:
 *                         type: array
 *                         items:
 *                           type: string
 *                       last_used_at:
 *                         type: string
 *                         format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Admin access required
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    // Only admins can list API keys
    if (req.user?.role !== 'admin' && req.user?.baseRole !== 'admin' && req.user?.baseRole !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    const dataSource = await getDataSource();
    const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

    const [apiKeys, total] = await apiKeyRepo.findAndCount({
      where: { orgId },
      relations: ['createdBy'],
      order: { createdAt: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = apiKeys[apiKeys.length - 1];
    return res.json(paginatedResponse(
      apiKeys.map(formatApiKey),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'apiKeys'
    ));
  } catch (error) {
    logger.error('Error listing API keys:', error);
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * @swagger
 * /api/v1/api-keys/{id}:
 *   delete:
 *     summary: Revoke an API key
 *     description: Permanently deletes an API key. This cannot be undone.
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: API key ID
 *     responses:
 *       204:
 *         description: API key revoked successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: API key not found
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid API key ID')],
  async (req: Request, res: Response) => {
    try {
      // Only admins can delete API keys
      if (req.user?.role !== 'admin' && req.user?.baseRole !== 'admin' && req.user?.baseRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

      const apiKey = await apiKeyRepo.findOne({
        where: { id, orgId },
      });

      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      await apiKeyRepo.remove(apiKey);

      logger.info('Organization API key revoked', {
        apiKeyId: id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        orgId,
        revokedBy: req.user!.id,
      });

      return res.status(204).send();
    } catch (error) {
      logger.error('Error revoking API key:', error);
      return res.status(500).json({ error: 'Failed to revoke API key' });
    }
  }
);

/**
 * @swagger
 * /api/v1/api-keys/{id}/rotate:
 *   post:
 *     summary: Rotate an API key
 *     description: Generate a new token for an existing API key. The old token is immediately invalidated. The new token is only returned once.
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key rotated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   type: object
 *                   description: Updated API key metadata
 *                 token:
 *                   type: string
 *                   description: The new API key token (only shown once)
 *       403:
 *         description: Admin access required
 *       404:
 *         description: API key not found
 */
router.post(
  '/:id/rotate',
  [param('id').isUUID().withMessage('Invalid API key ID')],
  async (req: Request, res: Response) => {
    try {
      // Only admins can rotate API keys
      if (req.user?.role !== 'admin' && req.user?.baseRole !== 'admin' && req.user?.baseRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

      const apiKey = await apiKeyRepo.findOne({
        where: { id, orgId },
        relations: ['createdBy'],
      });

      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      // Generate new token
      const newToken = generateApiKeyToken();
      const newKeyPrefix = newToken.substring(0, 12);

      // Hash the new token
      const newKeyHash = await bcrypt.hash(newToken, 10);

      // Update the API key
      apiKey.keyHash = newKeyHash;
      apiKey.keyPrefix = newKeyPrefix;

      await apiKeyRepo.save(apiKey);

      logger.info('Organization API key rotated', {
        apiKeyId: id,
        name: apiKey.name,
        oldKeyPrefix: apiKey.keyPrefix,
        newKeyPrefix,
        orgId,
        rotatedBy: req.user!.id,
      });

      // Return the new token - only time it's shown
      return res.json({
        api_key: formatApiKey(apiKey),
        token: newToken,
        message: 'API key rotated successfully. Save this new token - it will not be shown again.',
      });
    } catch (error) {
      logger.error('Error rotating API key:', error);
      return res.status(500).json({ error: 'Failed to rotate API key' });
    }
  }
);

export default router;
