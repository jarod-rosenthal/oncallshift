import { Request, Response, NextFunction } from "express";
import { unauthorized, forbidden } from "../utils/problem-details.js";

/**
 * Authenticated user attached to the request.
 * Will be fully implemented in Phase 1 with Cognito JWT verification.
 */
export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  role: "admin" | "member" | "super_admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Stub authentication middleware.
 * Phase 1 will implement: Cognito JWT, org API key, service API key.
 */
export function authenticateRequest(req: Request, res: Response, next: NextFunction): void {
  // TODO: Phase 1 — implement Cognito JWT verification, org API key, service API key
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    unauthorized(res, "Missing Authorization header.");
    return;
  }

  // Placeholder: will be replaced with real Cognito verification
  unauthorized(res, "Authentication not yet implemented.");
}

/**
 * Role-based authorization middleware.
 */
export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res);
      return;
    }
    if (!roles.includes(req.user.role)) {
      forbidden(res, `Requires one of: ${roles.join(", ")}`);
      return;
    }
    next();
  };
}
