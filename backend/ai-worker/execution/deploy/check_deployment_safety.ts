#!/usr/bin/env node

/**
 * Check deployment safety before allowing autonomous deployment
 *
 * This script analyzes migrations and infrastructure changes to detect
 * destructive operations that require human approval.
 *
 * Inputs (environment variables):
 * - REPO_PATH: Required. Path to the repository root
 *
 * Outputs (JSON to stdout):
 * - safe: boolean - True if deployment is safe to proceed
 * - requiresApproval: boolean - True if human approval needed
 * - risks: Array of detected risks
 * - summary: Counts of risks by severity
 */

import { MigrationAnalyzer } from './migration-analyzer.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

export interface SafetyCheckResult {
  safe: boolean;
  requiresApproval: boolean;
  risks: Array<{
    type: 'migration' | 'terraform' | 'other';
    severity: 'high' | 'medium' | 'low';
    description: string;
    details?: string;
  }>;
  summary?: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Check for destructive Terraform changes
 * Looks for resource deletions in recent terraform files
 */
async function checkTerraformSafety(repoPath: string): Promise<SafetyCheckResult['risks']> {
  const risks: SafetyCheckResult['risks'] = [];

  try {
    const terraformDir = path.join(repoPath, 'infrastructure', 'terraform');
    const envDir = path.join(terraformDir, 'environments', 'dev');

    // Check if terraform directory exists
    try {
      await fs.access(terraformDir);
    } catch {
      // No terraform directory, skip check
      return risks;
    }

    // Check for recently modified .tf files
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours

    async function checkDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await checkDirectory(fullPath);
          } else if (entry.name.endsWith('.tf')) {
            const stats = await fs.stat(fullPath);

            if (stats.mtimeMs >= cutoffTime) {
              // Read file and check for destructive patterns
              const content = await fs.readFile(fullPath, 'utf-8');

              // Look for resource deletions (lines with "-" prefix in terraform plan output)
              // Note: This is a basic check - actual terraform plan should be run for accuracy
              const destructivePatterns = [
                { pattern: /resource\s+"[^"]+"\s+"[^"]+"\s+{[\s\S]*?#\s*tfsec:ignore/i, desc: 'Resource marked for deletion or modification' },
                { pattern: /lifecycle\s+{[\s\S]*?prevent_destroy\s*=\s*false/i, desc: 'Prevent destroy disabled' },
              ];

              for (const { pattern, desc } of destructivePatterns) {
                if (pattern.test(content)) {
                  risks.push({
                    type: 'terraform',
                    severity: 'high',
                    description: desc,
                    details: `File: ${path.relative(repoPath, fullPath)}`,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await checkDirectory(terraformDir);

    return risks;
  } catch (error) {
    logger.error('Safety', 'Terraform check failed', { error: error instanceof Error ? error.message : String(error) });
    // Don't fail the entire check if terraform check fails
    return risks;
  }
}

/**
 * Check deployment safety by analyzing migrations and infrastructure
 */
export async function checkDeploymentSafety(): Promise<SafetyCheckResult> {
  const result: SafetyCheckResult = {
    safe: true,
    requiresApproval: false,
    risks: [],
  };

  try {
    const repoPath = process.env.REPO_PATH;

    if (!repoPath) {
      throw new Error('REPO_PATH environment variable is required');
    }

    logger.info('Safety', 'Checking deployment safety...');

    // 1. Check database migrations
    const migrationsDir = path.join(repoPath, 'backend', 'src', 'shared', 'db', 'migrations');
    const analyzer = new MigrationAnalyzer(migrationsDir);

    const migrationRisks = await analyzer.analyzeRecentMigrations(24); // Last 24 hours

    // Convert migration risks to safety check risks
    for (const risk of migrationRisks) {
      if (risk.level === 'destructive') {
        result.risks.push({
          type: 'migration',
          severity: 'high',
          description: risk.reason,
          details: risk.fileName ? `File: ${risk.fileName}, SQL: ${risk.sqlPattern}` : undefined,
        });
      } else if (risk.level === 'warning') {
        result.risks.push({
          type: 'migration',
          severity: 'medium',
          description: risk.reason,
          details: risk.fileName ? `File: ${risk.fileName}, SQL: ${risk.sqlPattern}` : undefined,
        });
      }
      // Skip 'safe' level risks in output
    }

    // 2. Check Terraform changes
    const terraformRisks = await checkTerraformSafety(repoPath);
    result.risks.push(...terraformRisks);

    // 3. Determine if approval is required
    const highSeverityRisks = result.risks.filter(r => r.severity === 'high');
    const mediumSeverityRisks = result.risks.filter(r => r.severity === 'medium');

    // Require approval if any high severity or 2+ medium severity risks
    result.requiresApproval = highSeverityRisks.length > 0 || mediumSeverityRisks.length >= 2;

    // Mark as unsafe if approval required
    result.safe = !result.requiresApproval;

    // 4. Add summary
    result.summary = {
      high: highSeverityRisks.length,
      medium: mediumSeverityRisks.length,
      low: result.risks.filter(r => r.severity === 'low').length,
    };

    logger.info('Safety', 'Safety check complete', {
      safe: result.safe,
      requiresApproval: result.requiresApproval,
      risksFound: result.risks.length,
      summary: result.summary,
    });

    return result;
  } catch (error) {
    logger.error('Safety', 'Safety check failed', { error: error instanceof Error ? error.message : String(error) });

    // On error, fail safe and require approval
    result.safe = false;
    result.requiresApproval = true;
    result.risks.push({
      type: 'other',
      severity: 'high',
      description: 'Safety check failed due to error',
      details: error instanceof Error ? error.message : String(error),
    });

    return result;
  }
}

// CLI entry point
async function main(): Promise<void> {
  try {
    const result = await checkDeploymentSafety();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.safe ? 0 : 1);
  } catch (error) {
    logger.error('Safety', 'Fatal error during safety check', { error: error instanceof Error ? error.message : String(error) });
    const errorResult: SafetyCheckResult = {
      safe: false,
      requiresApproval: true,
      risks: [
        {
          type: 'other',
          severity: 'high',
          description: 'Fatal error during safety check',
          details: error instanceof Error ? error.message : String(error),
        },
      ],
    };
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
