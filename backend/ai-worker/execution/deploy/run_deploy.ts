#!/usr/bin/env node

/**
 * Deploy changes to production using direct commands
 *
 * This script uses Kaniko for Docker builds and AWS CLI for deployment.
 * It does NOT use deploy.sh as that requires Docker daemon which is unavailable.
 *
 * Inputs (environment variables):
 * - REPO_PATH: Required. Path to the repository root
 * - DEPLOY_BACKEND: Optional. Set to "true" to deploy backend (default: true)
 * - DEPLOY_FRONTEND: Optional. Set to "true" to deploy frontend (default: true)
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

import { execSync, spawnSync } from "child_process";
import * as path from "path";
import { checkDeploymentSafety, SafetyCheckResult } from "./check_deployment_safety.js";
import { logger } from "./logger.js";

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

const ECR_REPO = "REDACTED_ECR_REGISTRY/pagerduty-lite-dev-api";
const ECS_CLUSTER = "pagerduty-lite-dev";
const ECS_SERVICE = "pagerduty-lite-dev-api";
const S3_BUCKET = "oncallshift-dev-web";
const CLOUDFRONT_DIST_ID = "REDACTED_CLOUDFRONT_DIST_ID";
const AWS_REGION = "us-east-1";

function runCommand(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const result = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600000, // 10 minute timeout
      env: {
        ...process.env,
        AWS_DEFAULT_REGION: AWS_REGION,
      },
    });
    return { success: true, output: result };
  } catch (error: unknown) {
    const execError = error as Error & { stdout?: string; stderr?: string };
    const output = [execError.stdout || "", execError.stderr || "", execError.message].join("\n");
    return { success: false, output };
  }
}

async function deployBackend(repoPath: string): Promise<{ success: boolean; logs: string }> {
  const logs: string[] = [];

  // Get git SHA for tagging
  const gitShaResult = runCommand("git rev-parse --short HEAD", repoPath);
  if (!gitShaResult.success) {
    return { success: false, logs: `Failed to get git SHA: ${gitShaResult.output}` };
  }
  const gitSha = gitShaResult.output.trim();
  logs.push(`[Deploy] Using git commit: ${gitSha}`);

  // Build Docker image with Kaniko
  logs.push("[Deploy] Building Docker image with Kaniko...");
  const kanikoCmd = `/kaniko/executor \
    --context=${repoPath} \
    --dockerfile=${path.join(repoPath, "Dockerfile")} \
    --destination=${ECR_REPO}:${gitSha} \
    --cache=true`;

  const kanikoBuild = runCommand(kanikoCmd, repoPath);
  logs.push(kanikoBuild.output);
  if (!kanikoBuild.success) {
    return { success: false, logs: logs.join("\n") + "\nKaniko build failed" };
  }

  // Update Terraform variable
  logs.push("[Deploy] Updating Terraform variable...");
  const tfDir = path.join(repoPath, "infrastructure/terraform/environments/dev");
  const sedCmd = `sed -i "s/^image_tag.*$/image_tag   = \\"${gitSha}\\"/" terraform.tfvars`;
  const sedResult = runCommand(sedCmd, tfDir);
  if (!sedResult.success) {
    logs.push(`Warning: Failed to update tfvars: ${sedResult.output}`);
  }

  // Apply Terraform
  logs.push("[Deploy] Applying Terraform...");
  const tfInit = runCommand("terraform init -upgrade", tfDir);
  logs.push(tfInit.output);

  const tfPlan = runCommand("terraform plan -out=tfplan", tfDir);
  logs.push(tfPlan.output);
  if (!tfPlan.success) {
    return { success: false, logs: logs.join("\n") + "\nTerraform plan failed" };
  }

  const tfApply = runCommand("terraform apply tfplan", tfDir);
  logs.push(tfApply.output);
  if (!tfApply.success) {
    return { success: false, logs: logs.join("\n") + "\nTerraform apply failed" };
  }

  runCommand("rm -f tfplan", tfDir);

  // Force new ECS deployment
  logs.push("[Deploy] Forcing new ECS deployment...");
  const ecsCmd = `aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION}`;

  const ecsResult = runCommand(ecsCmd, repoPath);
  logs.push(ecsResult.output);
  if (!ecsResult.success) {
    return { success: false, logs: logs.join("\n") + "\nECS deployment failed" };
  }

  logs.push("[Deploy] Backend deployment completed");
  return { success: true, logs: logs.join("\n") };
}

async function deployFrontend(repoPath: string): Promise<{ success: boolean; logs: string }> {
  const logs: string[] = [];
  const frontendDir = path.join(repoPath, "frontend");

  // Build frontend
  logs.push("[Deploy] Building frontend...");

  const npmInstall = runCommand("npm install", frontendDir);
  logs.push(npmInstall.output);
  if (!npmInstall.success) {
    return { success: false, logs: logs.join("\n") + "\nnpm install failed" };
  }

  const tscBuild = runCommand("npx tsc -b", frontendDir);
  logs.push(tscBuild.output);
  if (!tscBuild.success) {
    return { success: false, logs: logs.join("\n") + "\nTypeScript build failed" };
  }

  const viteBuild = runCommand("npx vite build", frontendDir);
  logs.push(viteBuild.output);
  if (!viteBuild.success) {
    return { success: false, logs: logs.join("\n") + "\nVite build failed" };
  }

  // Sync to S3
  logs.push("[Deploy] Uploading frontend to S3...");
  const s3Sync = runCommand(`aws s3 sync dist/ s3://${S3_BUCKET}/ --delete`, frontendDir);
  logs.push(s3Sync.output);
  if (!s3Sync.success) {
    return { success: false, logs: logs.join("\n") + "\nS3 sync failed" };
  }

  // Invalidate CloudFront
  logs.push("[Deploy] Invalidating CloudFront cache...");
  const cfInvalidate = runCommand(
    `aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DIST_ID} --paths "/*"`,
    frontendDir
  );
  logs.push(cfInvalidate.output);
  if (!cfInvalidate.success) {
    logs.push("Warning: CloudFront invalidation failed but continuing");
  }

  logs.push("[Deploy] Frontend deployment completed");
  return { success: true, logs: logs.join("\n") };
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
  const logs: string[] = [];

  try {
    const repoPath = process.env.REPO_PATH;
    const deployBackendFlag = process.env.DEPLOY_BACKEND !== "false";
    const deployFrontendFlag = process.env.DEPLOY_FRONTEND !== "false";

    if (!repoPath) {
      throw new Error("REPO_PATH environment variable is required");
    }

    logger.info("Deploy", "Running safety checks before deployment...");

    // Step 1: Run safety checks
    const safetyCheckResult = await checkDeploymentSafety();
    output.safetyCheckResult = safetyCheckResult;

    // Step 2: Check if approval is required
    if (safetyCheckResult.requiresApproval) {
      logger.warn("Deploy", "Safety checks require human approval");
      logger.warn("Deploy", "Risks detected", safetyCheckResult.summary);

      output.requiresApproval = true;
      output.approvalReason = generateApprovalReason(safetyCheckResult);

      // Return early without deploying
      output.duration = Math.round((Date.now() - startTime) / 1000);
      console.log(JSON.stringify(output, null, 2));
      process.exit(0); // Exit successfully but don't deploy
      return;
    }

    logger.info("Deploy", "Safety checks passed, proceeding with deployment...");

    // Step 3: Deploy backend
    if (deployBackendFlag) {
      const backendResult = await deployBackend(repoPath);
      logs.push(backendResult.logs);
      output.backendDeployed = backendResult.success;
      if (!backendResult.success) {
        throw new Error("Backend deployment failed");
      }
    }

    // Step 4: Deploy frontend
    if (deployFrontendFlag) {
      const frontendResult = await deployFrontend(repoPath);
      logs.push(frontendResult.logs);
      output.frontendDeployed = frontendResult.success;
      output.cloudFrontInvalidated = frontendResult.success;
      if (!frontendResult.success) {
        throw new Error("Frontend deployment failed");
      }
    }

    output.logs = logs.join("\n");
    output.success = true;
    logger.info("Deploy", "Deployment completed successfully");
  } catch (error: unknown) {
    if (error instanceof Error) {
      output.error = error.message;
    } else {
      output.error = String(error);
    }
    output.logs = logs.join("\n");
    logger.error("Deploy", "Deployment failed", { error: output.error });
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
