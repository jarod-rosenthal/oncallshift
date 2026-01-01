import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

interface CloudInvestigationData {
  provider: 'aws' | 'azure' | 'gcp';
  findings: string[];
  commands_executed: Array<{
    command: string;
    service: string;
    timestamp: string;
    result: string;
    output?: string;
  }>;
  raw_data?: {
    logs?: any[];
    [key: string]: any;
  };
}

interface IncidentContext {
  incidentNumber: number;
  summary: string;
  details?: Record<string, any>;
  severity: string;
  serviceName: string;
  triggeredAt: Date;
  state: string;
  eventCount: number;
  timeline?: Array<{
    type: string;
    message: string | null;
    createdAt: Date;
  }>;
  alerts?: Array<{
    summary: string;
    severity: string;
    payload?: Record<string, any> | null;
  }>;
  dependencies?: Array<{
    serviceName: string;
    type: string;
  }>;
}

export interface AIAnalysisResult {
  rootCause: string;
  affectedResources: string[];
  recommendations: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    command?: string;
    risk: 'low' | 'medium' | 'high';
    automated: boolean;
    expectedImpact?: string;
    rollbackPlan?: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  additionalInvestigation: string[];
  correlationInsights?: string;
}

const CLOUD_ARCHITECT_SYSTEM_PROMPT = `You are an expert cloud architect, site reliability engineer (SRE), and DevOps specialist with deep expertise in AWS, Azure, and GCP.

Your role is to analyze cloud infrastructure investigation data along with incident details to:
1. Identify the root cause of the incident
2. Correlate cloud findings with the incident timeline
3. Suggest specific, actionable remediation steps
4. Assess risk levels and provide rollback plans for each action

You have expertise in:
- AWS: ECS, EC2, Lambda, RDS, CloudWatch, S3, ALB/NLB, SQS, SNS
- Azure: App Service, VMs, AKS, Azure Monitor, Azure SQL, Storage
- GCP: Cloud Run, Compute Engine, GKE, Cloud Logging, Cloud SQL

When analyzing:
- Look for error patterns in logs that correlate with the incident time
- Check for resource health issues (unhealthy tasks, stopped VMs, failed deployments)
- Consider cascade effects (e.g., database connection issues causing app failures)
- Prioritize recommendations by severity and risk
- Provide specific CLI commands that can be executed

Always respond with valid JSON matching the expected schema.`;

function buildUserPrompt(
  cloudData: CloudInvestigationData,
  incidentContext: IncidentContext
): string {
  const parts: string[] = [];

  // Incident context
  parts.push('# Incident Details\n');
  parts.push(`**Incident #${incidentContext.incidentNumber}**`);
  parts.push(`- Summary: ${incidentContext.summary}`);
  parts.push(`- Severity: ${incidentContext.severity}`);
  parts.push(`- Service: ${incidentContext.serviceName}`);
  parts.push(`- State: ${incidentContext.state}`);
  parts.push(`- Triggered: ${incidentContext.triggeredAt.toISOString()}`);
  parts.push(`- Event Count: ${incidentContext.eventCount}`);

  if (incidentContext.details) {
    parts.push(`- Details: ${JSON.stringify(incidentContext.details, null, 2)}`);
  }

  // Timeline
  if (incidentContext.timeline && incidentContext.timeline.length > 0) {
    parts.push('\n# Incident Timeline (Recent Events)\n');
    for (const event of incidentContext.timeline.slice(0, 10)) {
      parts.push(`- [${event.createdAt}] ${event.type}: ${event.message}`);
    }
  }

  // Alerts
  if (incidentContext.alerts && incidentContext.alerts.length > 0) {
    parts.push('\n# Associated Alerts\n');
    for (const alert of incidentContext.alerts.slice(0, 5)) {
      parts.push(`- ${alert.severity.toUpperCase()}: ${alert.summary}`);
      if (alert.payload) {
        parts.push(`  Payload: ${JSON.stringify(alert.payload, null, 2).substring(0, 500)}`);
      }
    }
  }

  // Cloud investigation data
  parts.push(`\n# Cloud Investigation (${cloudData.provider.toUpperCase()})\n`);

  // Commands executed
  parts.push('## API Calls Made\n');
  for (const cmd of cloudData.commands_executed) {
    parts.push(`- ${cmd.service}: ${cmd.command} → ${cmd.result}`);
    if (cmd.output) {
      parts.push(`  Output: ${cmd.output.substring(0, 200)}`);
    }
  }

  // Findings
  parts.push('\n## Findings\n');
  if (cloudData.findings.length === 0) {
    parts.push('No issues detected in cloud infrastructure.');
  } else {
    for (const finding of cloudData.findings) {
      parts.push(`- ${finding}`);
    }
  }

  // Raw data summary
  if (cloudData.raw_data) {
    parts.push('\n## Raw Data Summary\n');
    if (cloudData.raw_data.logs && cloudData.raw_data.logs.length > 0) {
      parts.push(`- Log entries analyzed: ${cloudData.raw_data.logs.length}`);
      // Include sample errors
      const errorLogs = cloudData.raw_data.logs.slice(0, 3);
      if (errorLogs.length > 0) {
        parts.push('- Sample log entries:');
        for (const log of errorLogs) {
          parts.push(`  ${JSON.stringify(log).substring(0, 300)}`);
        }
      }
    }
    // Include other resource summaries
    for (const [key, value] of Object.entries(cloudData.raw_data)) {
      if (key !== 'logs' && Array.isArray(value) && value.length > 0) {
        parts.push(`- ${key}: ${value.length} resources checked`);
      }
    }
  }

  // Task
  parts.push('\n# Task\n');
  parts.push('Analyze this incident and cloud investigation data. Provide:');
  parts.push('1. Root cause analysis correlating cloud findings with the incident');
  parts.push('2. List of affected resources');
  parts.push('3. Prioritized remediation recommendations with specific commands');
  parts.push('4. Confidence level in your analysis');
  parts.push('5. Additional investigation steps if needed');
  parts.push('\nRespond with valid JSON matching this schema:');
  parts.push(`{
  "rootCause": "Detailed root cause explanation",
  "affectedResources": ["resource1", "resource2"],
  "recommendations": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "Action title",
      "description": "What this does and why",
      "command": "CLI command to execute",
      "risk": "low|medium|high",
      "automated": true|false,
      "expectedImpact": "What happens when executed",
      "rollbackPlan": "How to undo if needed"
    }
  ],
  "confidence": "high|medium|low",
  "additionalInvestigation": ["Check X", "Review Y"],
  "correlationInsights": "How cloud findings relate to the incident"
}`);

  return parts.join('\n');
}

/**
 * Analyze cloud investigation data using Claude AI
 */
export async function analyzeWithAI(
  cloudData: CloudInvestigationData,
  incidentContext: IncidentContext
): Promise<AIAnalysisResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured');
  }

  const userPrompt = buildUserPrompt(cloudData, incidentContext);

  logger.info('Starting AI analysis of cloud investigation', {
    provider: cloudData.provider,
    incidentNumber: incidentContext.incidentNumber,
    findingsCount: cloudData.findings.length,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: CLOUD_ARCHITECT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Could not extract JSON from Claude response', {
        response: textContent.text.substring(0, 500),
      });
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis: AIAnalysisResult = JSON.parse(jsonMatch[0]);

    logger.info('AI analysis completed', {
      provider: cloudData.provider,
      incidentNumber: incidentContext.incidentNumber,
      confidence: analysis.confidence,
      recommendationsCount: analysis.recommendations.length,
    });

    return analysis;
  } catch (error: any) {
    logger.error('AI analysis failed', {
      error: error.message,
      provider: cloudData.provider,
      incidentNumber: incidentContext.incidentNumber,
    });
    throw error;
  }
}

/**
 * Stream AI analysis for real-time updates
 */
export async function* streamAnalyzeWithAI(
  cloudData: CloudInvestigationData,
  incidentContext: IncidentContext
): AsyncGenerator<string | AIAnalysisResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured');
  }

  const userPrompt = buildUserPrompt(cloudData, incidentContext);

  logger.info('Starting streaming AI analysis', {
    provider: cloudData.provider,
    incidentNumber: incidentContext.incidentNumber,
  });

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: CLOUD_ARCHITECT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let fullText = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const text = event.delta.text;
      fullText += text;
      yield text; // Stream text chunks
    }
  }

  // Parse final JSON
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const analysis: AIAnalysisResult = JSON.parse(jsonMatch[0]);
    yield analysis; // Final parsed result
  }
}
