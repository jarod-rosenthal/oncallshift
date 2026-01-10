#!/usr/bin/env node

/**
 * Deploy changes to production
 *
 * This script runs safety checks before deployment, then executes deploy.sh.
 * Use this after your changes are committed and pushed to verify they work.
 *
 * Inputs (environment variables):
 * - REPO_PATH: Required. Path to the repository root
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - requiresApproval?: boolean - True if safety checks require human approval
 * - approvalReason?: string - Summary of why approval is needed
 * - safetyCheckResult?: SafetyCheckResult - Detailed safety check results
 * - frontendDeployed: boolean
 * - backendDeployed: boolean
 * - cloudFrontInvalidated: boolean
 * - duration: number (seconds)
 * - error?: string
 * - logs?: string
 */

import { execSync } from "child_process";
import * as path from "path";
import { checkDeploymentSafety, SafetyCheckResult } from "./check_deployment_safety.js";

interface DeploymentResult {
  success: boolean;
  requiresApproval?: boolean;
  approvalReason?: string;
  safetyCheckResult?: SafetyCheckResult;
  frontendDeployed: boolean;
  backendDeployed: boolean;
  cloudFrontInvalidated: boolean;
  duration: number;
  error?: string;
  logs?: string;
}

async function main(): Promise<void> {
  const output: DeploymentResult = {
    success: false,
    frontendDeployed: false,
    backendDeployed: false,
    cloudFrontInvalidated: false,
    duration: 0,
  };

  const startTime = Date.now();

  try {
    const repoPath = process.env.REPO_PATH;

    if (!repoPath) {
      throw new Error("REPO_PATH environment variable is required");
    }

    const deployScript = path.join(repoPath, "deploy.sh");

    console.error("[Deploy] Running safety checks before deployment...");

    // Step 1: Run safety checks
    const safetyCheckResult = await checkDeploymentSafety();
    output.safetyCheckResult = safetyCheckResult;

    // Step 2: Check if approval is required
    if (safetyCheckResult.requiresApproval) {
      console.error("[Deploy] Safety checks require human approval");
      console.error("[Deploy] Risks detected:", safetyCheckResult.summary);

      output.requiresApproval = true;
      output.approvalReason = generateApprovalReason(safetyCheckResult);

      // Return early without deploying
      output.duration = Math.round((Date.now() - startTime) / 1000);
      console.log(JSON.stringify(output, null, 2));
      process.exit(0); // Exit successfully but don't deploy
      return;
    }

    console.error("[Deploy] Safety checks passed, proceeding with deployment...");

    // Step 3: Run deploy.sh
    const result = execSync(`bash ${deployScript}`, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600000, // 10 minute timeout
      env: {
        ...process.env,
        // Ensure AWS credentials are available
        AWS_DEFAULT_REGION: process.env.AWS_REGION || "us-east-1",
      },
    });

    output.logs = result;

    // Parse output to determine what was deployed
    if (result.includes("Uploading frontend to S3")) {
      output.frontendDeployed = true;
    }
    if (result.includes("ECS deployment")) {
      output.backendDeployed = true;
    }
    if (result.includes("Invalidating CloudFront")) {
      output.cloudFrontInvalidated = true;
    }

    output.success = true;
    console.error("[Deploy] Deployment completed successfully");
  } catch (error: unknown) {
    if (error instanceof Error) {
      output.error = error.message;
      // Try to get stdout/stderr from the error
      const execError = error as Error & {
        stdout?: string;
        stderr?: string;
      };
      if (execError.stdout) {
        output.logs = execError.stdout;
      }
      if (execError.stderr) {
        output.logs = (output.logs || "") + "\n" + execError.stderr;
      }
    } else {
      output.error = String(error);
    }
    console.error("[Deploy] Deployment failed:", output.error);
  }

  output.duration = Math.round((Date.now() - startTime) / 1000);

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.success ? 0 : 1);
}

/**
 * Generate a human-readable approval reason from safety check results
 */
function generateApprovalReason(safetyCheck: SafetyCheckResult): string {
  const { summary, risks } = safetyCheck;

  if (!summary) {
    return "Safety checks detected risks that require human approval";
  }

  const parts: string[] = [];

  if (summary.high > 0) {
    parts.push(`${summary.high} high-severity risk${summary.high > 1 ? 's' : ''}`);
  }
  if (summary.medium > 0) {
    parts.push(`${summary.medium} medium-severity risk${summary.medium > 1 ? 's' : ''}`);
  }

  const reason = `Deployment blocked: ${parts.join(', ')} detected.`;

  // Add most severe risk examples
  const highRisks = risks.filter((r: { severity: string }) => r.severity === 'high').slice(0, 2);
  if (highRisks.length > 0) {
    const examples = highRisks.map((r: { description: string }) => `- ${r.description}`).join('\n');
    return `${reason}\n\nExamples:\n${examples}`;
  }

  return reason;
}

main();
