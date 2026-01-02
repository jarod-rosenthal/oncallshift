import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import bcrypt from 'bcrypt';
import { getDataSource } from '../db/data-source';
import { User, Service, OrganizationApiKey } from '../models';
import { logger } from '../utils/logger';

// Auth method types
export type AuthMethod = 'jwt' | 'api_key' | 'service_key';

// Extend Express Request to include user, service, and API key info
declare global {
  namespace Express {
    interface Request {
      user?: User;
      service?: Service;
      orgId?: string;
      apiKeyScopes?: string[];
      authMethod?: AuthMethod;
      organizationApiKey?: OrganizationApiKey;
    }
  }
}

// Create Cognito JWT verifier
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID || '',
});

/**
 * Middleware to verify Cognito JWT token
 * Use for mobile app API endpoints
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify JWT with Cognito
    const payload = await jwtVerifier.verify(token);

    // Get user from database
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.findOne({
      where: { cognitoSub: payload.sub },
      relations: ['organization'],
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'User account is not active' });
    }

    if (user.organization.status !== 'active') {
      return res.status(403).json({ error: 'Organization account is not active' });
    }

    // Attach user and orgId to request
    req.user = user;
    req.orgId = user.orgId;
    req.authMethod = 'jwt';

    return next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to verify API key
 * Use for webhook endpoints
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    // Get service by API key
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey },
      relations: ['organization'],
    });

    if (!service) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (service.status !== 'active') {
      return res.status(403).json({ error: 'Service is not active' });
    }

    if (service.organization.status !== 'active') {
      return res.status(403).json({ error: 'Organization account is not active' });
    }

    // Attach service and orgId to request
    req.service = service;
    req.orgId = service.orgId;
    req.authMethod = 'service_key';

    return next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(401).json({ error: 'Invalid API key' });
  }
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
}

/**
 * Middleware to verify organization-level API key (org_* prefix)
 * Used for Terraform provider and other programmatic access
 */
export async function authenticateOrgApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer org_')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header. Expected: Bearer org_*' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const keyPrefix = token.substring(0, 12); // First 12 chars for lookup

    // Find API key by prefix
    const dataSource = await getDataSource();
    const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

    const apiKey = await apiKeyRepo.findOne({
      where: { keyPrefix },
      relations: ['organization'],
    });

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Verify full token against stored hash
    const isValid = await bcrypt.compare(token, apiKey.keyHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check if key has expired
    if (apiKey.isExpired()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Check if organization is active
    if (apiKey.organization.status !== 'active') {
      return res.status(403).json({ error: 'Organization account is not active' });
    }

    // Update lastUsedAt timestamp (fire and forget)
    apiKeyRepo.update(apiKey.id, { lastUsedAt: new Date() }).catch((err) => {
      logger.warn('Failed to update API key lastUsedAt:', err);
    });

    // Attach org info and scopes to request
    req.orgId = apiKey.orgId;
    req.apiKeyScopes = apiKey.scopes;
    req.authMethod = 'api_key';
    req.organizationApiKey = apiKey;

    return next();
  } catch (error) {
    logger.error('Organization API key authentication error:', error);
    return res.status(401).json({ error: 'Invalid API key' });
  }
}

/**
 * Middleware that tries multiple authentication methods in order:
 * 1. Organization API key (Bearer org_*)
 * 2. Service API key (X-API-Key header)
 * 3. User JWT (Cognito Bearer token)
 *
 * This allows endpoints to accept any valid authentication method.
 */
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const serviceApiKey = req.headers['x-api-key'] as string;

  // Try Organization API key first (Bearer org_*)
  if (authHeader && authHeader.startsWith('Bearer org_')) {
    return authenticateOrgApiKey(req, res, next);
  }

  // Try Service API key (X-API-Key header)
  if (serviceApiKey) {
    return authenticateApiKey(req, res, next);
  }

  // Fall back to Cognito JWT (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateUser(req, res, next);
  }

  // No valid authentication provided
  return res.status(401).json({
    error: 'Authentication required. Provide Bearer token, X-API-Key header, or org API key.'
  });
}

/**
 * Middleware factory to check if API key has required scope
 * User JWT auth bypasses scope check (full access)
 *
 * @param scope - Required scope (e.g., "services:read", "incidents:write")
 * @returns Express middleware
 *
 * @example
 * router.get('/services', authenticateRequest, requireScope('services:read'), getServices);
 * router.post('/services', authenticateRequest, requireScope('services:write'), createService);
 */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // JWT auth (user login) has full access - no scope check needed
    if (req.authMethod === 'jwt') {
      return next();
    }

    // Service key auth has full access to that service's org
    if (req.authMethod === 'service_key') {
      return next();
    }

    // For API key auth, check scopes
    if (req.authMethod === 'api_key') {
      const scopes = req.apiKeyScopes || [];

      // Wildcard grants all access
      if (scopes.includes('*')) {
        return next();
      }

      // Check for exact scope match
      if (scopes.includes(scope)) {
        return next();
      }

      // Check for write scope granting read access (e.g., services:write implies services:read)
      const [resource, action] = scope.split(':');
      if (action === 'read' && scopes.includes(`${resource}:write`)) {
        return next();
      }

      return res.status(403).json({
        error: `Insufficient permissions. Required scope: ${scope}`,
        availableScopes: scopes,
      });
    }

    // No auth method set - should not reach here if authenticateRequest ran
    return res.status(401).json({ error: 'Authentication required' });
  };
}

/**
 * Helper to check if request has a specific scope
 * Useful for conditional logic within route handlers
 */
export function hasScope(req: Request, scope: string): boolean {
  // JWT and service key auth have full access
  if (req.authMethod === 'jwt' || req.authMethod === 'service_key') {
    return true;
  }

  const scopes = req.apiKeyScopes || [];

  // Wildcard grants all access
  if (scopes.includes('*')) {
    return true;
  }

  // Check exact scope
  if (scopes.includes(scope)) {
    return true;
  }

  // Write implies read
  const [resource, action] = scope.split(':');
  if (action === 'read' && scopes.includes(`${resource}:write`)) {
    return true;
  }

  return false;
}
