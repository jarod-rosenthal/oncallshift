import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { getDataSource } from '../db/data-source';
import { User, Service } from '../models';
import { logger } from '../utils/logger';

// Extend Express Request to include user and service
declare global {
  namespace Express {
    interface Request {
      user?: User;
      service?: Service;
      orgId?: string;
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
