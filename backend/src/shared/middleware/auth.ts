import type { Request, Response, NextFunction } from "express";
import { unauthorized } from "../utils/problem-details.js";

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware — validates JWT from Cognito.
 * Full implementation will be added in Phase 1 (Auth story).
 * This placeholder extracts the token but defers real validation.
 */
export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized(res, "Missing or invalid Authorization header.");
    return;
  }

  // TODO: Phase 1 — validate JWT with aws-jwt-verify against Cognito
  // For now, pass through to allow development without auth
  next();
}
