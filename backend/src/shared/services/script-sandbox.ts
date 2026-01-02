import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

export interface SandboxConfig {
  timeout: number; // milliseconds
  maxMemoryMB: number;
  maxOutputSize: number; // bytes
  workingDir?: string;
  environment?: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

const DEFAULT_CONFIG: SandboxConfig = {
  timeout: 60000, // 60 seconds
  maxMemoryMB: 512,
  maxOutputSize: 1024 * 1024, // 1MB
};

/**
 * Dangerous patterns that should be blocked in scripts
 */
const DANGEROUS_PATTERNS = {
  bash: [
    /rm\s+-rf\s+\//, // Deleting root
    /:\(\)\{\s*:\|:&\s*\};:/, // Fork bomb
    />\s*\/dev\/sd[a-z]/, // Writing to disk devices
    /mkfs/, // Format filesystem
    /dd\s+if=.*of=\/dev/, // Disk operations
    /wget.*\|\s*sh/, // Download and execute
    /curl.*\|\s*bash/, // Download and execute
    /eval\s*\(/, // Eval (risky)
    /chmod\s+777/, // Overly permissive
    /chown\s+root/, // Privilege escalation attempt
  ],
  python: [
    /__import__\s*\(\s*['"]os['"]\s*\)\.system/, // os.system
    /exec\s*\(/, // exec is dangerous
    /eval\s*\(/, // eval is dangerous
    /compile\s*\(/, // compile and exec
    /open\s*\(.*['"]\/etc\/passwd['"]/, // Reading sensitive files
    /subprocess\.call.*shell\s*=\s*True/, // Shell injection
  ],
  javascript: [
    /eval\s*\(/, // eval is dangerous
    /Function\s*\(/, // Function constructor (like eval)
    /require\s*\(\s*['"]child_process['"]\s*\)/, // Executing commands
    /process\.exit/, // Killing the process
    /require\s*\(\s*['"]fs['"]\s*\).*unlinkSync/, // Deleting files
  ],
};

/**
 * Validate script for dangerous patterns
 */
export function validateScript(code: string, language: 'bash' | 'python' | 'javascript'): { safe: boolean; reason?: string } {
  const patterns = DANGEROUS_PATTERNS[language] || [];

  for (const pattern of patterns) {
    if (pattern.test(code)) {
      return {
        safe: false,
        reason: `Potentially dangerous pattern detected: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}

/**
 * Execute Bash script in sandbox
 */
export async function executeBashScript(
  script: string,
  config: Partial<SandboxConfig> = {}
): Promise<ExecutionResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate script
  const validation = validateScript(script, 'bash');
  if (!validation.safe) {
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: validation.reason || 'Script validation failed',
      durationMs: 0,
      error: validation.reason,
    };
  }

  // Create temporary script file
  const scriptId = crypto.randomBytes(16).toString('hex');
  const tmpDir = fullConfig.workingDir || os.tmpdir();
  const scriptPath = path.join(tmpDir, `runbook-${scriptId}.sh`);

  try {
    await fs.writeFile(scriptPath, script, { mode: 0o700 });

    const result = await executeCommand(
      'bash',
      [scriptPath],
      fullConfig
    );

    // Cleanup
    await fs.unlink(scriptPath).catch(() => {});

    return result;
  } catch (error: any) {
    // Cleanup on error
    await fs.unlink(scriptPath).catch(() => {});

    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: error.message,
      durationMs: 0,
      error: error.message,
    };
  }
}

/**
 * Execute Python script in sandbox
 */
export async function executePythonScript(
  script: string,
  config: Partial<SandboxConfig> = {}
): Promise<ExecutionResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate script
  const validation = validateScript(script, 'python');
  if (!validation.safe) {
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: validation.reason || 'Script validation failed',
      durationMs: 0,
      error: validation.reason,
    };
  }

  // Create temporary script file
  const scriptId = crypto.randomBytes(16).toString('hex');
  const tmpDir = fullConfig.workingDir || os.tmpdir();
  const scriptPath = path.join(tmpDir, `runbook-${scriptId}.py`);

  try {
    await fs.writeFile(scriptPath, script, { mode: 0o600 });

    const result = await executeCommand(
      'python3',
      [scriptPath],
      fullConfig
    );

    // Cleanup
    await fs.unlink(scriptPath).catch(() => {});

    return result;
  } catch (error: any) {
    // Cleanup on error
    await fs.unlink(scriptPath).catch(() => {});

    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: error.message,
      durationMs: 0,
      error: error.message,
    };
  }
}

/**
 * Execute JavaScript script in sandbox (Node.js)
 */
export async function executeJavaScriptScript(
  script: string,
  config: Partial<SandboxConfig> = {}
): Promise<ExecutionResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate script
  const validation = validateScript(script, 'javascript');
  if (!validation.safe) {
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: validation.reason || 'Script validation failed',
      durationMs: 0,
      error: validation.reason,
    };
  }

  // Create temporary script file
  const scriptId = crypto.randomBytes(16).toString('hex');
  const tmpDir = fullConfig.workingDir || os.tmpdir();
  const scriptPath = path.join(tmpDir, `runbook-${scriptId}.js`);

  try {
    await fs.writeFile(scriptPath, script, { mode: 0o600 });

    const result = await executeCommand(
      'node',
      [scriptPath],
      fullConfig
    );

    // Cleanup
    await fs.unlink(scriptPath).catch(() => {});

    return result;
  } catch (error: any) {
    // Cleanup on error
    await fs.unlink(scriptPath).catch(() => {});

    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: error.message,
      durationMs: 0,
      error: error.message,
    };
  }
}

/**
 * Execute command with resource limits
 */
async function executeCommand(
  command: string,
  args: string[],
  config: SandboxConfig
): Promise<ExecutionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    // Prepare environment
    const env = {
      ...process.env,
      ...(config.environment || {}),
      // Restrict path to minimize available commands
      PATH: '/usr/local/bin:/usr/bin:/bin',
    };

    // Spawn process
    const child = spawn(command, args, {
      env,
      cwd: config.workingDir || os.tmpdir(),
      timeout: config.timeout,
    });

    // Capture stdout
    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= config.maxOutputSize) {
        stdout += chunk;
      } else {
        // Output too large, kill process
        if (!killed) {
          killed = true;
          child.kill('SIGTERM');
          stderr += '\nOutput size limit exceeded\n';
        }
      }
    });

    // Capture stderr
    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= config.maxOutputSize) {
        stderr += chunk;
      }
    });

    // Handle process exit
    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startTime;

      const result: ExecutionResult = {
        success: code === 0 && !killed,
        exitCode: code || -1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs,
      };

      if (killed) {
        result.error = 'Execution killed (timeout or resource limit exceeded)';
      } else if (signal) {
        result.error = `Process terminated by signal: ${signal}`;
      } else if (code !== 0) {
        result.error = `Process exited with code ${code}`;
      }

      logger.info('Script execution completed', {
        command,
        exitCode: code,
        durationMs,
        success: result.success,
      });

      resolve(result);
    });

    // Handle execution errors
    child.on('error', (error) => {
      const durationMs = Date.now() - startTime;

      logger.error('Script execution error', { error: error.message, command });

      resolve({
        success: false,
        exitCode: -1,
        stdout: stdout.trim(),
        stderr: stderr.trim() + '\n' + error.message,
        durationMs,
        error: error.message,
      });
    });

    // Set timeout
    setTimeout(() => {
      if (!child.killed) {
        killed = true;
        child.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    }, config.timeout);
  });
}

/**
 * Execute script based on language
 */
export async function executeScript(
  language: 'bash' | 'python' | 'javascript',
  code: string,
  config: Partial<SandboxConfig> = {}
): Promise<ExecutionResult> {
  logger.info('Executing script', { language, codeLength: code.length });

  switch (language) {
    case 'bash':
      return executeBashScript(code, config);
    case 'python':
      return executePythonScript(code, config);
    case 'javascript':
      return executeJavaScriptScript(code, config);
    default:
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        durationMs: 0,
        error: `Unsupported language: ${language}`,
      };
  }
}
