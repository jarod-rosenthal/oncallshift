#!/usr/bin/env node

/**
 * Deploy changes to production
 *
 * This script runs the deploy.sh script and captures output.
 * Use this after your changes are committed and pushed to verify they work.
 *
 * Inputs (environment variables):
 * - REPO_PATH: Required. Path to the repository root
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - frontendDeployed: boolean
 * - backendDeployed: boolean
 * - cloudFrontInvalidated: boolean
 * - duration: number (seconds)
 * - error?: string
 */

import { execSync } from "child_process";
import * as path from "path";

interface Output {
  success: boolean;
  frontendDeployed: boolean;
  backendDeployed: boolean;
  cloudFrontInvalidated: boolean;
  duration: number;
  error?: string;
  logs?: string;
}

async function main(): Promise<void> {
  const output: Output = {
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

    console.error("[Deploy] Starting deployment...");

    // Run deploy.sh and capture output
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

main();
