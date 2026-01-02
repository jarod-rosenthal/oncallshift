import { Request, Response } from 'express';

/**
 * Location header utility functions for HTTP responses (RFC 7231)
 *
 * According to HTTP best practices, POST requests that create resources
 * should return a Location header pointing to the newly created resource.
 * This helps clients discover the URL of the newly created resource.
 */

/**
 * Build the full URL for a resource
 *
 * @param req - Express request object
 * @param resourcePath - The API path to the resource (e.g., '/api/v1/incidents')
 * @param resourceId - The ID of the created resource
 * @returns Full URL to the resource
 */
export function getResourceUrl(req: Request, resourcePath: string, resourceId: string): string {
  // Use X-Forwarded-Proto if behind a proxy (like CloudFront/ALB), otherwise use req.protocol
  const protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('host');

  // Ensure resourcePath starts with /
  const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;

  return `${protocol}://${host}${normalizedPath}/${resourceId}`;
}

/**
 * Set the Location header for a newly created resource
 *
 * @param res - Express response object
 * @param req - Express request object
 * @param resourcePath - The API path to the resource (e.g., '/api/v1/incidents')
 * @param resourceId - The ID of the created resource
 */
export function setLocationHeader(
  res: Response,
  req: Request,
  resourcePath: string,
  resourceId: string
): void {
  const url = getResourceUrl(req, resourcePath, resourceId);
  res.setHeader('Location', url);
}
