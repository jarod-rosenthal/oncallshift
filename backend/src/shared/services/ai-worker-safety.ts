/**
 * AI Worker Safety Service
 *
 * Provides guardrails and safety checks for AI worker execution.
 * Prevents dangerous commands, protects sensitive files, and enforces security policies.
 */

import { logger } from '../utils/logger';

/**
 * Risk levels for operations
 */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of a safety validation
 */
export interface SafetyValidationResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  reason?: string;
  requiresApproval?: boolean;
  blockedPatterns?: string[];
}

/**
 * Dangerous command patterns that should be blocked
 */
const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string; riskLevel: RiskLevel }> = [
  // Destructive file operations
  { pattern: /rm\s+-rf\s+[\/~]/, reason: 'Recursive delete of root or home directory', riskLevel: 'critical' },
  { pattern: /rm\s+-rf\s+\*/, reason: 'Recursive delete with wildcard', riskLevel: 'critical' },
  { pattern: /rm\s+-rf\s+\.\./, reason: 'Recursive delete of parent directory', riskLevel: 'critical' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: 'Direct write to disk device', riskLevel: 'critical' },
  { pattern: /dd\s+if=.*of=\/dev\//, reason: 'Direct disk write with dd', riskLevel: 'critical' },
  { pattern: /mkfs/, reason: 'Filesystem format command', riskLevel: 'critical' },

  // Database destruction
  { pattern: /DROP\s+DATABASE/i, reason: 'Database drop command', riskLevel: 'critical' },
  { pattern: /DROP\s+TABLE/i, reason: 'Table drop command', riskLevel: 'high' },
  { pattern: /TRUNCATE\s+TABLE/i, reason: 'Table truncate command', riskLevel: 'high' },
  { pattern: /DELETE\s+FROM\s+\w+\s*;?\s*$/i, reason: 'Delete without WHERE clause', riskLevel: 'high' },

  // Credential exposure
  { pattern: /curl.*[-]u.*:.*@/, reason: 'Credentials in curl command', riskLevel: 'high' },
  { pattern: /wget.*--password/, reason: 'Password in wget command', riskLevel: 'high' },
  { pattern: /echo.*\$\{?[A-Z_]*(?:PASSWORD|SECRET|KEY|TOKEN)/, reason: 'Echoing sensitive environment variable', riskLevel: 'high' },

  // Git force operations
  { pattern: /git\s+push.*--force.*(?:main|master)/, reason: 'Force push to main/master', riskLevel: 'critical' },
  { pattern: /git\s+push.*(?:main|master).*--force/, reason: 'Force push to main/master', riskLevel: 'critical' },
  { pattern: /git\s+reset\s+--hard\s+HEAD~/, reason: 'Hard reset removing commits', riskLevel: 'high' },
  { pattern: /git\s+clean\s+-fdx/, reason: 'Git clean removing all untracked files', riskLevel: 'medium' },

  // System modification
  { pattern: /chmod\s+777/, reason: 'Setting overly permissive file permissions', riskLevel: 'high' },
  { pattern: /chown.*root/, reason: 'Changing ownership to root', riskLevel: 'high' },
  { pattern: /sudo\s+/, reason: 'Command requiring elevated privileges', riskLevel: 'high' },
  { pattern: /su\s+-/, reason: 'Switching to root user', riskLevel: 'high' },

  // Network attacks
  { pattern: /nc\s+-l/, reason: 'Netcat listener', riskLevel: 'high' },
  { pattern: /nmap\s+/, reason: 'Network scanning', riskLevel: 'medium' },

  // Process manipulation
  { pattern: /kill\s+-9\s+-1/, reason: 'Kill all processes', riskLevel: 'critical' },
  { pattern: /pkill\s+-9/, reason: 'Force kill processes', riskLevel: 'high' },
  { pattern: /killall/, reason: 'Kill all processes by name', riskLevel: 'high' },

  // Environment modification
  { pattern: /export\s+PATH=/, reason: 'Modifying PATH environment variable', riskLevel: 'medium' },
  { pattern: /export\s+LD_PRELOAD/, reason: 'Setting LD_PRELOAD', riskLevel: 'critical' },

  // Reverse shells
  { pattern: /bash\s+-i\s+>&/, reason: 'Interactive bash redirect (potential reverse shell)', riskLevel: 'critical' },
  { pattern: /\/bin\/sh\s+-i/, reason: 'Interactive shell (potential reverse shell)', riskLevel: 'critical' },
  { pattern: /python.*socket.*connect/, reason: 'Python socket connection (potential reverse shell)', riskLevel: 'high' },

  // Crypto mining
  { pattern: /xmrig|minergate|nicehash|ethminer/, reason: 'Potential cryptocurrency miner', riskLevel: 'critical' },

  // AWS/Cloud dangerous operations
  { pattern: /aws\s+s3\s+rm.*--recursive/, reason: 'Recursive S3 deletion', riskLevel: 'high' },
  { pattern: /aws\s+ec2\s+terminate/, reason: 'EC2 instance termination', riskLevel: 'high' },
  { pattern: /aws\s+rds\s+delete/, reason: 'RDS deletion', riskLevel: 'critical' },
  { pattern: /terraform\s+destroy/, reason: 'Terraform destroy command', riskLevel: 'critical' },
];

/**
 * Patterns that require human approval but aren't blocked
 */
const APPROVAL_REQUIRED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /npm\s+publish/, reason: 'Publishing to npm registry' },
  { pattern: /docker\s+push/, reason: 'Pushing Docker image' },
  { pattern: /git\s+push.*--force/, reason: 'Force push (non-main branch)' },
  { pattern: /terraform\s+apply/, reason: 'Terraform infrastructure changes' },
  { pattern: /aws\s+deploy/, reason: 'AWS deployment' },
  { pattern: /kubectl\s+apply/, reason: 'Kubernetes deployment' },
  { pattern: /kubectl\s+delete/, reason: 'Kubernetes resource deletion' },
  { pattern: /helm\s+install|helm\s+upgrade/, reason: 'Helm chart deployment' },
];

/**
 * Sensitive file patterns that should be protected
 */
const SENSITIVE_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string; riskLevel: RiskLevel }> = [
  // Environment and secrets
  { pattern: /\.env$/, reason: 'Environment file', riskLevel: 'critical' },
  { pattern: /\.env\.[a-z]+$/, reason: 'Environment file', riskLevel: 'critical' },
  { pattern: /\.env\.local$/, reason: 'Local environment file', riskLevel: 'critical' },
  { pattern: /secrets?\.[a-z]+$/i, reason: 'Secrets file', riskLevel: 'critical' },
  { pattern: /credentials?\.[a-z]+$/i, reason: 'Credentials file', riskLevel: 'critical' },
  { pattern: /\.pem$/, reason: 'PEM key file', riskLevel: 'critical' },
  { pattern: /\.key$/, reason: 'Key file', riskLevel: 'critical' },
  { pattern: /\.p12$/, reason: 'PKCS12 certificate', riskLevel: 'critical' },
  { pattern: /\.pfx$/, reason: 'PFX certificate', riskLevel: 'critical' },
  { pattern: /id_rsa/, reason: 'SSH private key', riskLevel: 'critical' },
  { pattern: /id_ed25519/, reason: 'SSH private key', riskLevel: 'critical' },
  { pattern: /\.ssh\//, reason: 'SSH directory', riskLevel: 'critical' },

  // AWS
  { pattern: /\.aws\/credentials/, reason: 'AWS credentials', riskLevel: 'critical' },
  { pattern: /\.aws\/config/, reason: 'AWS config', riskLevel: 'high' },

  // Google Cloud
  { pattern: /google-services\.json$/, reason: 'Google Services config', riskLevel: 'high' },
  { pattern: /service-account.*\.json$/i, reason: 'Service account key', riskLevel: 'critical' },
  { pattern: /gcloud.*credentials/, reason: 'GCloud credentials', riskLevel: 'critical' },

  // Infrastructure
  { pattern: /terraform\.tfvars$/, reason: 'Terraform variables', riskLevel: 'high' },
  { pattern: /terraform\.tfstate$/, reason: 'Terraform state', riskLevel: 'critical' },
  { pattern: /\.terraform\//, reason: 'Terraform directory', riskLevel: 'high' },
  { pattern: /kubeconfig/, reason: 'Kubernetes config', riskLevel: 'critical' },

  // CI/CD
  { pattern: /\.github\/workflows\/.*\.ya?ml$/, reason: 'GitHub workflow file', riskLevel: 'high' },
  { pattern: /\.gitlab-ci\.yml$/, reason: 'GitLab CI config', riskLevel: 'high' },
  { pattern: /Jenkinsfile$/, reason: 'Jenkins pipeline', riskLevel: 'high' },
  { pattern: /\.circleci\//, reason: 'CircleCI config', riskLevel: 'high' },

  // Docker
  { pattern: /Dockerfile$/, reason: 'Dockerfile', riskLevel: 'medium' },
  { pattern: /docker-compose.*\.ya?ml$/, reason: 'Docker Compose file', riskLevel: 'medium' },

  // Package management
  { pattern: /package-lock\.json$/, reason: 'NPM lock file', riskLevel: 'low' },
  { pattern: /yarn\.lock$/, reason: 'Yarn lock file', riskLevel: 'low' },

  // Database
  { pattern: /\.sql$/, reason: 'SQL file', riskLevel: 'medium' },
  { pattern: /migrations?\/.*\.[jt]s$/, reason: 'Database migration', riskLevel: 'medium' },
];

/**
 * Patterns for content that should never be committed
 */
const SENSITIVE_CONTENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // API Keys
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i, reason: 'API key detected' },
  { pattern: /(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/, reason: 'Stripe key detected' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, reason: 'GitHub personal access token' },
  { pattern: /github_pat_[a-zA-Z0-9_]{22,}/, reason: 'GitHub fine-grained token' },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]+/, reason: 'Slack token detected' },
  { pattern: /sk-[a-zA-Z0-9]{48}/, reason: 'OpenAI API key detected' },
  { pattern: /sk-ant-[a-zA-Z0-9_-]+/, reason: 'Anthropic API key detected' },

  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, reason: 'AWS access key ID' },
  { pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9\/+=]{40}['"]/i, reason: 'AWS secret key' },

  // Private keys
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, reason: 'Private key detected' },
  { pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/, reason: 'PGP private key detected' },

  // Database connection strings
  { pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/, reason: 'Database connection string with credentials' },

  // JWTs (likely hardcoded secrets)
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, reason: 'JWT token detected' },

  // Generic passwords
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i, reason: 'Hardcoded password' },
  { pattern: /(?:secret|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i, reason: 'Hardcoded secret' },
];

/**
 * Files that are generally safe to modify
 */
const SAFE_FILE_PATTERNS: RegExp[] = [
  /\.tsx?$/,      // TypeScript files
  /\.jsx?$/,      // JavaScript files
  /\.css$/,       // CSS files
  /\.scss$/,      // SCSS files
  /\.less$/,      // Less files
  /\.html$/,      // HTML files
  /\.md$/,        // Markdown files
  /\.json$/,      // JSON files (with exceptions above)
  /\.ya?ml$/,     // YAML files (with exceptions above)
  /\.txt$/,       // Text files
  /\.test\.[jt]sx?$/, // Test files
  /\.spec\.[jt]sx?$/, // Spec files
  /__tests__\//,  // Test directories
];

/**
 * Validate a command before execution
 */
export function validateCommand(command: string): SafetyValidationResult {
  const normalizedCommand = command.trim().toLowerCase();

  // Check for blocked dangerous patterns
  for (const { pattern, reason, riskLevel } of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      logger.warn('Blocked dangerous command', { command: command.substring(0, 100), reason });
      return {
        allowed: false,
        riskLevel,
        reason: `Blocked: ${reason}`,
        blockedPatterns: [pattern.toString()],
      };
    }
  }

  // Check for patterns requiring approval
  for (const { pattern, reason } of APPROVAL_REQUIRED_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: true,
        riskLevel: 'medium',
        reason: `Requires approval: ${reason}`,
        requiresApproval: true,
      };
    }
  }

  // Check for potentially risky but not blocked commands
  if (/rm\s+/.test(normalizedCommand)) {
    return {
      allowed: true,
      riskLevel: 'low',
      reason: 'File deletion command',
    };
  }

  if (/git\s+/.test(normalizedCommand)) {
    return {
      allowed: true,
      riskLevel: 'low',
      reason: 'Git command',
    };
  }

  return {
    allowed: true,
    riskLevel: 'safe',
  };
}

/**
 * Validate a file path before modification
 */
export function validateFilePath(filePath: string): SafetyValidationResult {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

  // Check for sensitive file patterns
  for (const { pattern, reason, riskLevel } of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(normalizedPath) || pattern.test(filePath)) {
      // Check if it's a critical sensitivity level
      if (riskLevel === 'critical') {
        logger.warn('Blocked modification of sensitive file', { filePath, reason });
        return {
          allowed: false,
          riskLevel,
          reason: `Blocked: ${reason}`,
          blockedPatterns: [pattern.toString()],
        };
      }

      // High-risk files require approval
      if (riskLevel === 'high') {
        return {
          allowed: true,
          riskLevel,
          reason: `Requires approval: ${reason}`,
          requiresApproval: true,
        };
      }

      // Medium-risk files are allowed but flagged
      return {
        allowed: true,
        riskLevel,
        reason,
      };
    }
  }

  // Check if it's a safe file type
  for (const pattern of SAFE_FILE_PATTERNS) {
    if (pattern.test(normalizedPath) || pattern.test(filePath)) {
      return {
        allowed: true,
        riskLevel: 'safe',
      };
    }
  }

  // Unknown file types are allowed but flagged as low risk
  return {
    allowed: true,
    riskLevel: 'low',
    reason: 'Unknown file type',
  };
}

/**
 * Validate file content for sensitive data before commit
 */
export function validateFileContent(content: string, filePath: string): SafetyValidationResult {
  const detectedPatterns: string[] = [];

  for (const { pattern, reason } of SENSITIVE_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      detectedPatterns.push(reason);
    }
  }

  if (detectedPatterns.length > 0) {
    logger.warn('Sensitive content detected in file', { filePath, patterns: detectedPatterns });
    return {
      allowed: false,
      riskLevel: 'critical',
      reason: `Sensitive content detected: ${detectedPatterns.join(', ')}`,
      blockedPatterns: detectedPatterns,
    };
  }

  return {
    allowed: true,
    riskLevel: 'safe',
  };
}

/**
 * Validate a complete file change (path + content)
 */
export function validateFileChange(
  filePath: string,
  content: string,
  operation: 'create' | 'modify' | 'delete'
): SafetyValidationResult {
  // First validate the file path
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.allowed) {
    return pathValidation;
  }

  // For delete operations, just validate the path
  if (operation === 'delete') {
    return pathValidation;
  }

  // For create/modify, also validate the content
  const contentValidation = validateFileContent(content, filePath);
  if (!contentValidation.allowed) {
    return contentValidation;
  }

  // Return the higher risk level between path and content
  const riskLevels: RiskLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];
  const pathRiskIndex = riskLevels.indexOf(pathValidation.riskLevel);
  const contentRiskIndex = riskLevels.indexOf(contentValidation.riskLevel);

  if (pathRiskIndex > contentRiskIndex) {
    return pathValidation;
  }

  return contentValidation;
}

/**
 * Validate a git branch name
 */
export function validateBranchName(branchName: string): SafetyValidationResult {
  const protectedBranches = ['main', 'master', 'develop', 'production', 'staging'];

  if (protectedBranches.includes(branchName.toLowerCase())) {
    return {
      allowed: false,
      riskLevel: 'critical',
      reason: `Cannot directly modify protected branch: ${branchName}`,
    };
  }

  // Branch names should follow a pattern
  const validBranchPattern = /^(feat|fix|chore|docs|refactor|test|style|perf)\/[a-z0-9-]+$/;
  if (!validBranchPattern.test(branchName)) {
    return {
      allowed: true,
      riskLevel: 'low',
      reason: 'Branch name does not follow conventional naming pattern',
    };
  }

  return {
    allowed: true,
    riskLevel: 'safe',
  };
}

/**
 * Check if an operation should require human approval
 */
export function requiresApproval(operations: SafetyValidationResult[]): boolean {
  return operations.some(op => op.requiresApproval || op.riskLevel === 'high');
}

/**
 * Calculate the overall risk level from multiple operations
 */
export function calculateOverallRiskLevel(operations: SafetyValidationResult[]): RiskLevel {
  const riskLevels: RiskLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];
  let maxRiskIndex = 0;

  for (const op of operations) {
    const index = riskLevels.indexOf(op.riskLevel);
    if (index > maxRiskIndex) {
      maxRiskIndex = index;
    }
  }

  return riskLevels[maxRiskIndex];
}

/**
 * Safety limits for AI worker execution
 */
export const SAFETY_LIMITS = {
  // Maximum number of Claude conversation turns before stopping
  maxConversationTurns: 50,

  // Maximum execution time in minutes
  maxExecutionTimeMinutes: 60,

  // Maximum number of files that can be modified in one task
  maxFilesModified: 30,

  // Maximum lines of code that can be changed
  maxLinesChanged: 2000,

  // Maximum cost per task in USD
  maxCostPerTaskUsd: 5.0,

  // Maximum daily cost per worker in USD
  maxDailyCostPerWorkerUsd: 50.0,

  // Maximum monthly cost per organization in USD
  maxMonthlyCostPerOrgUsd: 500.0,
};

/**
 * Check if safety limits are exceeded
 */
export function checkSafetyLimits(params: {
  conversationTurns?: number;
  executionTimeMinutes?: number;
  filesModified?: number;
  linesChanged?: number;
  taskCostUsd?: number;
  dailyCostUsd?: number;
  monthlyCostUsd?: number;
}): { exceeded: boolean; reason?: string } {
  const {
    conversationTurns,
    executionTimeMinutes,
    filesModified,
    linesChanged,
    taskCostUsd,
    dailyCostUsd,
    monthlyCostUsd,
  } = params;

  if (conversationTurns && conversationTurns > SAFETY_LIMITS.maxConversationTurns) {
    return { exceeded: true, reason: `Conversation turns (${conversationTurns}) exceeded limit (${SAFETY_LIMITS.maxConversationTurns})` };
  }

  if (executionTimeMinutes && executionTimeMinutes > SAFETY_LIMITS.maxExecutionTimeMinutes) {
    return { exceeded: true, reason: `Execution time (${executionTimeMinutes}m) exceeded limit (${SAFETY_LIMITS.maxExecutionTimeMinutes}m)` };
  }

  if (filesModified && filesModified > SAFETY_LIMITS.maxFilesModified) {
    return { exceeded: true, reason: `Files modified (${filesModified}) exceeded limit (${SAFETY_LIMITS.maxFilesModified})` };
  }

  if (linesChanged && linesChanged > SAFETY_LIMITS.maxLinesChanged) {
    return { exceeded: true, reason: `Lines changed (${linesChanged}) exceeded limit (${SAFETY_LIMITS.maxLinesChanged})` };
  }

  if (taskCostUsd && taskCostUsd > SAFETY_LIMITS.maxCostPerTaskUsd) {
    return { exceeded: true, reason: `Task cost ($${taskCostUsd.toFixed(2)}) exceeded limit ($${SAFETY_LIMITS.maxCostPerTaskUsd})` };
  }

  if (dailyCostUsd && dailyCostUsd > SAFETY_LIMITS.maxDailyCostPerWorkerUsd) {
    return { exceeded: true, reason: `Daily cost ($${dailyCostUsd.toFixed(2)}) exceeded limit ($${SAFETY_LIMITS.maxDailyCostPerWorkerUsd})` };
  }

  if (monthlyCostUsd && monthlyCostUsd > SAFETY_LIMITS.maxMonthlyCostPerOrgUsd) {
    return { exceeded: true, reason: `Monthly cost ($${monthlyCostUsd.toFixed(2)}) exceeded limit ($${SAFETY_LIMITS.maxMonthlyCostPerOrgUsd})` };
  }

  return { exceeded: false };
}
