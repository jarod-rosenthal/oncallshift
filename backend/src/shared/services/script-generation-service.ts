import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from './ai-assistant-service';
import { validateScript } from './script-sandbox';
import { logger } from '../utils/logger';

export interface ScriptGenerationRequest {
  description: string;
  language: 'bash' | 'python' | 'javascript';
  context?: {
    incidentSummary?: string;
    severity?: string;
    serviceName?: string;
    availableCredentials?: string[];
  };
  constraints?: {
    requireIdempotency?: boolean;
    readOnly?: boolean;
    maxDuration?: number;
  };
}

export interface ScriptGenerationResult {
  success: boolean;
  script?: {
    code: string;
    language: 'bash' | 'python' | 'javascript';
    explanation: string;
    warnings?: string[];
    estimatedDuration?: number;
  };
  error?: string;
  validationErrors?: string[];
}

export interface ScriptRevalidationRequest {
  script: {
    code: string;
    language: 'bash' | 'python' | 'javascript';
    description: string;
  };
  incident: {
    id: string;
    summary: string;
    severity: string;
    serviceName?: string;
  };
  previousVersion?: {
    code: string;
    generatedAt: string;
  };
}

export interface ScriptRevalidationResult {
  needsUpdate: boolean;
  updatedScript?: {
    code: string;
    changes: string;
    reason: string;
  };
  safeToExecute: boolean;
  warnings?: string[];
}

/**
 * Generate a runbook automation script from natural language description
 */
export async function generateScriptFromNaturalLanguage(
  request: ScriptGenerationRequest,
  orgId: string
): Promise<ScriptGenerationResult> {
  try {
    const apiKey = await getAnthropicApiKey(orgId);
    const anthropic = new Anthropic({ apiKey });

    // Build system prompt
    const systemPrompt = buildGenerationSystemPrompt(request.language, request.constraints);

    // Build user prompt
    const userPrompt = buildGenerationUserPrompt(request);

    logger.info('Generating script from natural language', {
      language: request.language,
      descriptionLength: request.description.length,
    });

    // Call Claude to generate script
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const result = parseScriptGenerationResponse(content.text, request.language);

    // Validate generated script
    const validation = validateScript(result.code, request.language);
    if (!validation.safe) {
      return {
        success: false,
        error: 'Generated script failed safety validation',
        validationErrors: [validation.reason || 'Unknown validation error'],
      };
    }

    logger.info('Script generated successfully', {
      language: request.language,
      codeLength: result.code.length,
    });

    return {
      success: true,
      script: {
        code: result.code,
        language: request.language,
        explanation: result.explanation,
        warnings: result.warnings,
        estimatedDuration: result.estimatedDuration,
      },
    };
  } catch (error: any) {
    logger.error('Failed to generate script', {
      error: error.message,
      language: request.language,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Revalidate a script in the context of a specific incident
 */
export async function revalidateScript(
  request: ScriptRevalidationRequest,
  orgId: string
): Promise<ScriptRevalidationResult> {
  try {
    const apiKey = await getAnthropicApiKey(orgId);
    const anthropic = new Anthropic({ apiKey });

    // Build prompts
    const systemPrompt = buildRevalidationSystemPrompt();
    const userPrompt = buildRevalidationUserPrompt(request);

    logger.info('Revalidating script', {
      language: request.script.language,
      incidentId: request.incident.id,
    });

    // Call Claude to revalidate
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const result = parseRevalidationResponse(content.text);

    // Validate any updated script
    if (result.needsUpdate && result.updatedScript) {
      const validation = validateScript(result.updatedScript.code, request.script.language as any);
      if (!validation.safe) {
        result.safeToExecute = false;
        result.warnings = result.warnings || [];
        result.warnings.push(`Updated script failed validation: ${validation.reason}`);
      }
    }

    logger.info('Script revalidation completed', {
      needsUpdate: result.needsUpdate,
      safeToExecute: result.safeToExecute,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to revalidate script', {
      error: error.message,
      incidentId: request.incident.id,
    });

    return {
      needsUpdate: false,
      safeToExecute: false,
      warnings: [`Revalidation failed: ${error.message}`],
    };
  }
}

/**
 * Build system prompt for script generation
 */
function buildGenerationSystemPrompt(
  language: 'bash' | 'python' | 'javascript',
  constraints?: ScriptGenerationRequest['constraints']
): string {
  const languageTips = {
    bash: 'Use standard bash commands. Prefer AWS CLI for AWS operations. Include error handling with set -e.',
    python: 'Use Python 3 syntax. Prefer boto3 for AWS, requests for HTTP. Include proper error handling.',
    javascript: 'Use Node.js syntax. Prefer aws-sdk for AWS, axios for HTTP. Include proper error handling and async/await.',
  };

  let prompt = `You are an expert DevOps engineer generating production-ready ${language} automation scripts for incident response.

CRITICAL REQUIREMENTS:
1. Script must be SAFE - no destructive operations without explicit user intent
2. Script must be IDEMPOTENT - running multiple times produces same result
3. Script must be TESTABLE - include verification of operations
4. Include clear error messages and exit codes
5. Follow best practices for ${language}

${languageTips[language]}

FORBIDDEN OPERATIONS:
- Do NOT use: rm -rf /, dd, mkfs, format commands
- Do NOT use: eval, exec (unless absolutely necessary)
- Do NOT make permanent infrastructure changes without approval
- Do NOT expose credentials in output`;

  if (constraints?.readOnly) {
    prompt += '\n- Script must be READ-ONLY (no modifications allowed)';
  }

  if (constraints?.requireIdempotency) {
    prompt += '\n- Script must be strictly IDEMPOTENT';
  }

  if (constraints?.maxDuration) {
    prompt += `\n- Script should complete in under ${constraints.maxDuration} seconds`;
  }

  prompt += `\n\nRESPONSE FORMAT:
Provide your response in this exact format:

\`\`\`${language}
[complete working script here]
\`\`\`

EXPLANATION:
[2-3 sentences explaining what the script does]

WARNINGS:
[Any warnings or considerations for the user, or "None"]

ESTIMATED_DURATION:
[Estimated duration in seconds, e.g., "30"]`;

  return prompt;
}

/**
 * Build user prompt for script generation
 */
function buildGenerationUserPrompt(request: ScriptGenerationRequest): string {
  let prompt = `Generate a ${request.language} script that: ${request.description}`;

  if (request.context) {
    prompt += '\n\nCONTEXT:';
    if (request.context.incidentSummary) {
      prompt += `\n- Incident: ${request.context.incidentSummary}`;
    }
    if (request.context.severity) {
      prompt += `\n- Severity: ${request.context.severity}`;
    }
    if (request.context.serviceName) {
      prompt += `\n- Service: ${request.context.serviceName}`;
    }
    if (request.context.availableCredentials && request.context.availableCredentials.length > 0) {
      prompt += `\n- Available credentials: ${request.context.availableCredentials.join(', ')}`;
    }
  }

  return prompt;
}

/**
 * Build system prompt for script revalidation
 */
function buildRevalidationSystemPrompt(): string {
  return `You are an expert DevOps engineer reviewing automation scripts before execution.

Your task is to:
1. Check if the script is still appropriate for the current incident context
2. Identify any necessary updates based on the incident details
3. Ensure the script is safe to execute

RESPONSE FORMAT:
Provide your response in this exact format:

NEEDS_UPDATE: [YES or NO]
SAFE_TO_EXECUTE: [YES or NO]

[If NEEDS_UPDATE is YES, include:]
UPDATED_SCRIPT:
\`\`\`[language]
[updated script]
\`\`\`

CHANGES:
[List of changes made]

REASON:
[Why updates were needed]

[Always include:]
WARNINGS:
[Any warnings or "None"]`;
}

/**
 * Build user prompt for script revalidation
 */
function buildRevalidationUserPrompt(request: ScriptRevalidationRequest): string {
  let prompt = `Review this automation script before execution:

ORIGINAL DESCRIPTION: ${request.script.description}

CURRENT SCRIPT (${request.script.language}):
\`\`\`
${request.script.code}
\`\`\`

CURRENT INCIDENT CONTEXT:
- ID: ${request.incident.id}
- Summary: ${request.incident.summary}
- Severity: ${request.incident.severity}`;

  if (request.incident.serviceName) {
    prompt += `\n- Service: ${request.incident.serviceName}`;
  }

  if (request.previousVersion) {
    prompt += `\n\nNOTE: This script was generated at ${request.previousVersion.generatedAt}. Check if it needs updates for current context.`;
  }

  return prompt;
}

/**
 * Parse script generation response from Claude
 */
function parseScriptGenerationResponse(
  response: string,
  language: string
): { code: string; explanation: string; warnings?: string[]; estimatedDuration?: number } {
  // Extract code block
  const codeRegex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, 'i');
  const codeMatch = response.match(codeRegex);

  if (!codeMatch) {
    throw new Error('Could not extract code from response');
  }

  const code = codeMatch[1].trim();

  // Extract explanation
  const explanationRegex = /EXPLANATION:\s*([^\n]+(?:\n(?!WARNINGS:|ESTIMATED_DURATION:)[^\n]+)*)/i;
  const explanationMatch = response.match(explanationRegex);
  const explanation = explanationMatch ? explanationMatch[1].trim() : 'No explanation provided';

  // Extract warnings
  const warningsRegex = /WARNINGS:\s*([^\n]+(?:\n(?!ESTIMATED_DURATION:)[^\n]+)*)/i;
  const warningsMatch = response.match(warningsRegex);
  const warningsText = warningsMatch ? warningsMatch[1].trim() : 'None';
  const warnings = warningsText !== 'None' ? [warningsText] : undefined;

  // Extract estimated duration
  const durationRegex = /ESTIMATED_DURATION:\s*(\d+)/i;
  const durationMatch = response.match(durationRegex);
  const estimatedDuration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;

  return { code, explanation, warnings, estimatedDuration };
}

/**
 * Parse script revalidation response from Claude
 */
function parseRevalidationResponse(response: string): ScriptRevalidationResult {
  // Check if update is needed
  const needsUpdateMatch = response.match(/NEEDS_UPDATE:\s*(YES|NO)/i);
  const needsUpdate = needsUpdateMatch ? needsUpdateMatch[1].toUpperCase() === 'YES' : false;

  // Check if safe to execute
  const safeMatch = response.match(/SAFE_TO_EXECUTE:\s*(YES|NO)/i);
  const safeToExecute = safeMatch ? safeMatch[1].toUpperCase() === 'YES' : false;

  // Extract updated script if present
  let updatedScript;
  if (needsUpdate) {
    const scriptMatch = response.match(/UPDATED_SCRIPT:\s*```[\w]*\s*([^`]*?)```/is);
    const changesMatch = response.match(/CHANGES:\s*([^\n]+(?:\n(?!REASON:|WARNINGS:)[^\n]+)*)/i);
    const reasonMatch = response.match(/REASON:\s*([^\n]+(?:\n(?!WARNINGS:)[^\n]+)*)/i);

    if (scriptMatch) {
      updatedScript = {
        code: scriptMatch[1].trim(),
        changes: changesMatch ? changesMatch[1].trim() : 'Updates applied',
        reason: reasonMatch ? reasonMatch[1].trim() : 'Context changed',
      };
    }
  }

  // Extract warnings
  const warningsMatch = response.match(/WARNINGS:\s*([^\n]+(?:\n[^\n]+)*)/i);
  const warningsText = warningsMatch ? warningsMatch[1].trim() : '';
  const warnings = warningsText && warningsText !== 'None' ? [warningsText] : undefined;

  return {
    needsUpdate,
    updatedScript,
    safeToExecute,
    warnings,
  };
}
