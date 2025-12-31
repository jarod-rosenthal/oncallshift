import Anthropic from '@anthropic-ai/sdk';
import { LogEntry } from './cloudwatch-service';
import { logger } from '../utils/logger';

// Default Anthropic client (uses org-level API key from environment)
const defaultAnthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Get an Anthropic client, either with user credential or default
 */
function getAnthropicClient(userCredential?: string): Anthropic {
  if (userCredential) {
    return new Anthropic({ apiKey: userCredential });
  }
  return defaultAnthropic;
}

export interface IncidentContext {
  incidentNumber: number;
  summary: string;
  details?: Record<string, any>;
  severity: string;
  serviceName: string;
  triggeredAt: Date;
  state: string;
  eventCount: number;
}

export interface DiagnosisResult {
  summary: string;
  rootCause: string;
  affectedComponents: string[];
  suggestedActions: SuggestedAction[];
  confidence: 'high' | 'medium' | 'low';
  additionalContext?: string;
}

export interface SuggestedAction {
  title: string;
  description: string;
  command?: string;
  risk: 'low' | 'medium' | 'high';
  automated: boolean;
}

export interface AnalyzeOptions {
  /** User's personal Anthropic credential (API key or OAuth token) */
  userCredential?: string;
}

/**
 * Analyze an incident using Claude AI
 * @param incident - The incident context
 * @param logs - CloudWatch logs related to the incident
 * @param options - Optional parameters including user credential
 */
export async function analyzeIncident(
  incident: IncidentContext,
  logs: LogEntry[],
  options: AnalyzeOptions = {}
): Promise<DiagnosisResult> {
  const { userCredential } = options;

  // Check if we have a credential (user's or org's)
  if (!userCredential && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('No Anthropic credentials available. Please configure an API key in Settings or contact your admin.');
  }

  const anthropic = getAnthropicClient(userCredential);

  // Format logs for the prompt
  const formattedLogs = formatLogsForPrompt(logs);

  const systemPrompt = `You are an expert Site Reliability Engineer (SRE) and DevOps specialist. Your role is to analyze incidents and provide actionable diagnosis.

You have access to:
1. Incident details (summary, severity, affected service)
2. Recent application logs from CloudWatch

Your task is to:
1. Identify the root cause of the incident
2. List affected components
3. Suggest remediation actions (both automated and manual)
4. Assess your confidence level based on available information

Respond in JSON format with this exact structure:
{
  "summary": "Brief 1-2 sentence summary of the issue",
  "rootCause": "Detailed explanation of the root cause",
  "affectedComponents": ["list", "of", "affected", "components"],
  "suggestedActions": [
    {
      "title": "Action title",
      "description": "What this action does",
      "command": "optional shell command to run",
      "risk": "low|medium|high",
      "automated": true/false
    }
  ],
  "confidence": "high|medium|low",
  "additionalContext": "Any additional observations or recommendations"
}

Guidelines:
- Be specific and actionable
- Prioritize actions by impact and risk
- For automated actions, provide exact commands when possible
- Consider AWS ECS, PostgreSQL, and Node.js/Express context
- If logs are insufficient, say so and suggest what additional information is needed`;

  const userPrompt = `# Incident Details

**Incident #${incident.incidentNumber}**
- Summary: ${incident.summary}
- Severity: ${incident.severity}
- Service: ${incident.serviceName}
- State: ${incident.state}
- Triggered: ${incident.triggeredAt.toISOString()}
- Event Count: ${incident.eventCount}
${incident.details ? `- Details: ${JSON.stringify(incident.details, null, 2)}` : ''}

# Recent Logs (${logs.length} entries)

${formattedLogs}

# Task

Analyze this incident and provide a diagnosis with suggested remediation actions.`;

  try {
    logger.info('Calling Claude API for incident analysis', {
      incidentNumber: incident.incidentNumber,
      logCount: logs.length,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const diagnosis: DiagnosisResult = JSON.parse(jsonMatch[0]);

    logger.info('Claude analysis complete', {
      incidentNumber: incident.incidentNumber,
      confidence: diagnosis.confidence,
      actionCount: diagnosis.suggestedActions.length,
    });

    return diagnosis;
  } catch (error) {
    logger.error('Error calling Claude API:', error);
    throw error;
  }
}

/**
 * Format logs for the AI prompt
 */
function formatLogsForPrompt(logs: LogEntry[], maxLength = 15000): string {
  if (logs.length === 0) {
    return 'No logs available for the specified time period.';
  }

  // Sort by timestamp
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Format each log entry
  const formatted = sortedLogs.map(log => {
    const timestamp = new Date(log.timestamp).toISOString();
    const message = log.message.length > 500 ? log.message.substring(0, 500) + '...' : log.message;
    return `[${timestamp}] ${message}`;
  });

  // Join and truncate if needed
  let result = formatted.join('\n');
  if (result.length > maxLength) {
    // Take most recent logs that fit
    const lines = formatted.reverse();
    result = '';
    for (const line of lines) {
      if ((result + '\n' + line).length > maxLength) {
        break;
      }
      result = line + '\n' + result;
    }
    result = '... (earlier logs truncated)\n' + result;
  }

  return result;
}

/**
 * Stream analysis for real-time updates (returns async generator)
 * @param incident - The incident context
 * @param logs - CloudWatch logs related to the incident
 * @param options - Optional parameters including user credential
 */
export async function* streamAnalyzeIncident(
  incident: IncidentContext,
  logs: LogEntry[],
  options: AnalyzeOptions = {}
): AsyncGenerator<string, DiagnosisResult, unknown> {
  const { userCredential } = options;

  // Check if we have a credential (user's or org's)
  if (!userCredential && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('No Anthropic credentials available. Please configure an API key in Settings or contact your admin.');
  }

  const anthropic = getAnthropicClient(userCredential);
  const formattedLogs = formatLogsForPrompt(logs);

  const systemPrompt = `You are an expert Site Reliability Engineer analyzing an incident. First, provide your thinking process step by step, then provide the final JSON diagnosis.

Format your response as:
1. First, explain your analysis thinking (what patterns you see, what might be wrong)
2. Then provide the final diagnosis in JSON format

JSON structure for final diagnosis:
{
  "summary": "Brief summary",
  "rootCause": "Root cause explanation",
  "affectedComponents": ["components"],
  "suggestedActions": [{"title": "", "description": "", "command": "", "risk": "low|medium|high", "automated": boolean}],
  "confidence": "high|medium|low",
  "additionalContext": "Additional notes"
}`;

  const userPrompt = `# Incident #${incident.incidentNumber}
- Summary: ${incident.summary}
- Severity: ${incident.severity}
- Service: ${incident.serviceName}
- State: ${incident.state}

# Recent Logs
${formattedLogs}

Analyze this incident.`;

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  let fullResponse = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullResponse += event.delta.text;
      yield event.delta.text;
    }
  }

  // Parse final result
  const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from streaming response');
  }

  return JSON.parse(jsonMatch[0]) as DiagnosisResult;
}
