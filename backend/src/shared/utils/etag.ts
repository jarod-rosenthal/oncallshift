import crypto from 'crypto';

/**
 * ETag utility functions for HTTP caching (RFC 7232)
 *
 * ETags are used for:
 * 1. Cache validation (If-None-Match) - Returns 304 Not Modified if resource unchanged
 * 2. Optimistic concurrency control (If-Match) - Prevents lost updates
 *
 * Types:
 * - Strong ETags: "abc123" - Byte-for-byte identical
 * - Weak ETags: W/"abc123" - Semantically equivalent (used for collections)
 */

/**
 * Generate a strong ETag from data
 * Strong ETags indicate byte-for-byte identical content
 *
 * @param data - Any serializable data (object, string, etc.)
 * @returns Strong ETag string (e.g., "abc123def456")
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Generate a weak ETag from data
 * Weak ETags indicate semantically equivalent content
 * Useful for collections where order might vary but content is the same
 *
 * @param data - Any serializable data (object, string, etc.)
 * @returns Weak ETag string (e.g., W/"abc123def456")
 */
export function generateWeakETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `W/"${hash}"`;
}

/**
 * Generate an ETag from an entity with updatedAt timestamp
 * This is more efficient as it doesn't require serializing the entire object
 *
 * @param id - Entity ID
 * @param updatedAt - Entity's updatedAt timestamp
 * @returns Strong ETag string
 */
export function generateEntityETag(id: string, updatedAt: Date | string): string {
  const timestamp = updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt;
  const content = `${id}:${timestamp}`;
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Generate a weak ETag for a collection
 * Uses the count and max updatedAt to create a fingerprint
 *
 * @param items - Array of items with updatedAt property
 * @returns Weak ETag string
 */
export function generateCollectionETag(items: Array<{ updatedAt?: Date | string }>): string {
  if (items.length === 0) {
    return `W/"empty"`;
  }

  // Find the most recently updated item
  let maxTimestamp = 0;
  for (const item of items) {
    if (item.updatedAt) {
      const ts = item.updatedAt instanceof Date
        ? item.updatedAt.getTime()
        : new Date(item.updatedAt).getTime();
      if (ts > maxTimestamp) {
        maxTimestamp = ts;
      }
    }
  }

  const content = `${items.length}:${maxTimestamp}`;
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `W/"${hash}"`;
}

/**
 * Parse an ETag string into its components
 *
 * @param etag - ETag string (e.g., "abc123" or W/"abc123")
 * @returns Object with weak flag and value
 */
export function parseETag(etag: string): { weak: boolean; value: string } {
  const trimmed = etag.trim();

  if (trimmed.startsWith('W/')) {
    // Weak ETag
    const value = trimmed.slice(2).replace(/^"|"$/g, '');
    return { weak: true, value };
  }

  // Strong ETag
  const value = trimmed.replace(/^"|"$/g, '');
  return { weak: false, value };
}

/**
 * Compare ETags according to RFC 7232 rules
 *
 * For strong comparison (If-Match):
 * - Both ETags must be strong
 * - Values must be identical
 *
 * For weak comparison (If-None-Match):
 * - Either ETag can be weak
 * - Values must be identical (ignoring weak indicator)
 *
 * @param clientETag - ETag from client request header
 * @param serverETag - ETag generated from current server data
 * @param strongComparison - Use strong comparison rules (default: false)
 * @returns true if ETags match according to comparison rules
 */
export function compareETags(
  clientETag: string,
  serverETag: string,
  strongComparison: boolean = false
): boolean {
  const client = parseETag(clientETag);
  const server = parseETag(serverETag);

  if (strongComparison) {
    // Strong comparison: both must be strong and values must match
    if (client.weak || server.weak) {
      return false;
    }
    return client.value === server.value;
  }

  // Weak comparison: values must match (ignoring weak indicator)
  return client.value === server.value;
}

/**
 * Check if any ETag in a list matches the server ETag
 * Handles the If-None-Match header which can contain multiple ETags
 *
 * @param clientETags - Comma-separated list of ETags or "*"
 * @param serverETag - Current server ETag
 * @param strongComparison - Use strong comparison rules
 * @returns true if any client ETag matches
 */
export function matchesAnyETag(
  clientETags: string,
  serverETag: string,
  strongComparison: boolean = false
): boolean {
  const trimmed = clientETags.trim();

  // Wildcard matches everything
  if (trimmed === '*') {
    return true;
  }

  // Split by comma and check each
  const etags = trimmed.split(',').map(e => e.trim());

  for (const etag of etags) {
    if (compareETags(etag, serverETag, strongComparison)) {
      return true;
    }
  }

  return false;
}
