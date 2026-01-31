import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../db/data-source';
import { getAnthropicApiKey } from './ai-assistant-service';
import { logger } from '../utils/logger';
import { Incident } from '../models/Incident';
import { Service } from '../models/Service';
import { IncidentEvent } from '../models/IncidentEvent';
import { RunbookStep, StepType, AutomationMode, ScriptLanguage } from '../models/Runbook';
import { v4 as uuidv4 } from 'uuid';

/**
 * Summary of an incident for runbook generation
 */
export interface IncidentSummary {
  incidentNumber: number;
  summary: string;
  severity: string;
  state: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
  resolutionTimeMinutes: number | null;
  events: Array<{
    type: string;
    message: string | null;
    createdAt: Date;
  }>;
  details: Record<string, any> | null;
}

/**
 * Generated runbook structure
 */
export interface GeneratedRunbook {
  title: string;
  description: string;
  steps: RunbookStep[];
  estimatedTimeMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

/**
 * System prompt for runbook generation
 */
const RUNBOOK_GENERATOR_PROMPT = `You are an SRE expert that creates runbooks for incident response.
Your job is to analyze past incident patterns and create actionable runbooks.

When given incident history data, generate a structured runbook that will help responders
handle similar incidents quickly and effectively.

Output ONLY valid JSON with this structure:
{
  "title": "Short descriptive title for the runbook",
  "description": "Overview of when to use this runbook and what it addresses",
  "steps": [
    {
      "order": 1,
      "title": "Step title",
      "description": "Detailed instructions for this step",
      "isOptional": false,
      "estimatedMinutes": 5,
      "type": "manual" | "automated",
      "automation": {
        "mode": "server_sandbox",
        "script": {
          "language": "bash" | "python" | "javascript" | "natural_language",
          "code": "The script or natural language description",
          "version": 1
        },
        "timeout": 60,
        "requiresApproval": true
      }
    }
  ],
  "estimatedTimeMinutes": 30,
  "confidence": "low" | "medium" | "high",
  "rationale": "Why this runbook was generated with these steps"
}

Guidelines:
1. Steps should be in logical order - investigation first, then remediation
2. Include verification steps after remediation
3. Mark risky operations (restarts, data changes) as requiring approval
4. Use natural_language for complex operations that need human judgment
5. Include rollback steps for any destructive operations
6. Estimate time accurately based on incident resolution times
7. Set confidence based on:
   - high: Many similar incidents with clear patterns
   - medium: Some patterns but variations exist
   - low: Limited data or inconsistent patterns

Common step patterns:
- Check service health and logs
- Verify downstream dependencies
- Scale resources if needed
- Restart affected services
- Clear caches
- Rollback recent deployments
- Notify stakeholders`;

/**
 * Service for generating runbooks from incident history using AI
 */
export class RunbookGeneratorService {
  /**
   * Analyze incident history for a service
   */
  async analyzeIncidentHistory(
    serviceId: string,
    orgId: string,
    limit: number = 50
  ): Promise<IncidentSummary[]> {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    // Get recent incidents for this service
    const incidents = await incidentRepo.find({
      where: { serviceId, orgId },
      order: { triggeredAt: 'DESC' },
      take: limit,
    });

    const summaries: IncidentSummary[] = [];

    for (const incident of incidents) {
      // Get events for this incident
      const events = await eventRepo.find({
        where: { incidentId: incident.id },
        order: { createdAt: 'ASC' },
        take: 20, // Limit events per incident
      });

      // Calculate resolution time
      let resolutionTimeMinutes: number | null = null;
      if (incident.resolvedAt) {
        resolutionTimeMinutes = Math.round(
          (incident.resolvedAt.getTime() - incident.triggeredAt.getTime()) / (1000 * 60)
        );
      }

      summaries.push({
        incidentNumber: incident.incidentNumber,
        summary: incident.summary,
        severity: incident.severity,
        state: incident.state,
        triggeredAt: incident.triggeredAt,
        resolvedAt: incident.resolvedAt,
        resolutionTimeMinutes,
        events: events.map(e => ({
          type: e.type,
          message: e.message,
          createdAt: e.createdAt,
        })),
        details: incident.details,
      });
    }

    logger.info('Analyzed incident history', {
      serviceId,
      incidentCount: summaries.length,
      resolvedCount: summaries.filter(s => s.resolvedAt).length,
    });

    return summaries;
  }

  /**
   * Generate a runbook from incident history using Claude
   */
  async generateRunbook(
    serviceId: string,
    orgId: string,
    userId: string
  ): Promise<GeneratedRunbook | null> {
    logger.info('Generating runbook from incident history', { serviceId, orgId, userId });

    // Get service info
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const service = await serviceRepo.findOne({
      where: { id: serviceId, orgId },
    });

    if (!service) {
      logger.error('Service not found for runbook generation', { serviceId, orgId });
      return null;
    }

    // Analyze incident history
    const incidentSummaries = await this.analyzeIncidentHistory(serviceId, orgId);

    if (incidentSummaries.length === 0) {
      logger.warn('No incidents found for runbook generation', { serviceId });
      // Generate a basic runbook template
      return this.generateBasicRunbook(service);
    }

    // Get API key
    const apiKey = await getAnthropicApiKey(orgId);
    if (!apiKey) {
      logger.error('No Anthropic API key configured', { orgId });
      return null;
    }

    const anthropic = new Anthropic({ apiKey });

    // Build the prompt with incident data
    const userPrompt = this.buildUserPrompt(service, incidentSummaries);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: RUNBOOK_GENERATOR_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Extract text content
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        logger.error('No text response from Claude');
        return null;
      }

      // Parse JSON response
      const parsed = JSON.parse(textContent.text) as {
        title: string;
        description: string;
        steps: Array<{
          order: number;
          title: string;
          description: string;
          isOptional: boolean;
          estimatedMinutes?: number;
          type: StepType;
          automation?: {
            mode: AutomationMode;
            script?: {
              language: ScriptLanguage;
              code: string;
              version: number;
            };
            timeout: number;
            requiresApproval: boolean;
          };
        }>;
        estimatedTimeMinutes: number;
        confidence: 'low' | 'medium' | 'high';
        rationale: string;
      };

      // Transform to proper RunbookStep format with UUIDs
      const steps: RunbookStep[] = parsed.steps.map(s => ({
        id: uuidv4(),
        order: s.order,
        title: s.title,
        description: s.description,
        isOptional: s.isOptional,
        estimatedMinutes: s.estimatedMinutes,
        type: s.type,
        automation: s.automation ? {
          mode: s.automation.mode,
          script: s.automation.script,
          timeout: s.automation.timeout,
          requiresApproval: s.automation.requiresApproval,
        } : undefined,
      }));

      logger.info('Generated runbook from incident history', {
        serviceId,
        title: parsed.title,
        stepCount: steps.length,
        confidence: parsed.confidence,
      });

      return {
        title: parsed.title,
        description: parsed.description,
        steps,
        estimatedTimeMinutes: parsed.estimatedTimeMinutes,
        confidence: parsed.confidence,
        rationale: parsed.rationale,
      };
    } catch (error: any) {
      logger.error('Failed to generate runbook', {
        serviceId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Build the user prompt with incident data
   */
  private buildUserPrompt(service: Service, incidents: IncidentSummary[]): string {
    const parts: string[] = [];

    parts.push(`Service: ${service.name}`);
    if (service.description) {
      parts.push(`Description: ${service.description}`);
    }
    parts.push('');
    parts.push(`Total incidents analyzed: ${incidents.length}`);
    parts.push(`Resolved incidents: ${incidents.filter(i => i.resolvedAt).length}`);

    // Calculate average resolution time
    const resolvedWithTime = incidents.filter(i => i.resolutionTimeMinutes);
    if (resolvedWithTime.length > 0) {
      const avgTime = resolvedWithTime.reduce(
        (sum, i) => sum + (i.resolutionTimeMinutes || 0), 0
      ) / resolvedWithTime.length;
      parts.push(`Average resolution time: ${Math.round(avgTime)} minutes`);
    }

    // Severity distribution
    const severityCounts: Record<string, number> = {};
    for (const incident of incidents) {
      severityCounts[incident.severity] = (severityCounts[incident.severity] || 0) + 1;
    }
    parts.push(`Severity distribution: ${JSON.stringify(severityCounts)}`);

    parts.push('');
    parts.push('--- Recent Incidents ---');
    parts.push('');

    // Include details of recent incidents (limit to prevent token overflow)
    for (const incident of incidents.slice(0, 15)) {
      parts.push(`Incident #${incident.incidentNumber}: ${incident.summary}`);
      parts.push(`  Severity: ${incident.severity}, State: ${incident.state}`);
      parts.push(`  Triggered: ${incident.triggeredAt.toISOString()}`);
      if (incident.resolvedAt) {
        parts.push(`  Resolved: ${incident.resolvedAt.toISOString()} (${incident.resolutionTimeMinutes} min)`);
      }
      if (incident.details && Object.keys(incident.details).length > 0) {
        parts.push(`  Details: ${JSON.stringify(incident.details).substring(0, 200)}`);
      }
      if (incident.events.length > 0) {
        parts.push('  Key events:');
        for (const event of incident.events.slice(0, 5)) {
          parts.push(`    - ${event.type}: ${event.message || 'No message'}`);
        }
      }
      parts.push('');
    }

    parts.push('');
    parts.push('Based on this incident history, generate a comprehensive runbook that will help responders handle similar incidents efficiently.');

    return parts.join('\n');
  }

  /**
   * Generate a basic runbook when no incident history is available
   */
  private generateBasicRunbook(service: Service): GeneratedRunbook {
    return {
      title: `${service.name} Incident Response`,
      description: `Standard incident response runbook for ${service.name}. This is a template runbook - customize based on your service's specific needs.`,
      steps: [
        {
          id: uuidv4(),
          order: 1,
          title: 'Initial Assessment',
          description: 'Check the incident details and determine scope of impact. Review recent alerts and logs.',
          isOptional: false,
          estimatedMinutes: 5,
          type: 'manual',
        },
        {
          id: uuidv4(),
          order: 2,
          title: 'Check Service Health',
          description: 'Verify the current health status of the service. Check metrics, dashboards, and monitoring tools.',
          isOptional: false,
          estimatedMinutes: 5,
          type: 'manual',
        },
        {
          id: uuidv4(),
          order: 3,
          title: 'Review Recent Changes',
          description: 'Check for recent deployments, configuration changes, or infrastructure updates that may have caused the issue.',
          isOptional: false,
          estimatedMinutes: 5,
          type: 'manual',
        },
        {
          id: uuidv4(),
          order: 4,
          title: 'Implement Fix',
          description: 'Based on your investigation, implement the appropriate fix. This may include rollback, restart, scaling, or configuration changes.',
          isOptional: false,
          estimatedMinutes: 15,
          type: 'manual',
        },
        {
          id: uuidv4(),
          order: 5,
          title: 'Verify Resolution',
          description: 'Confirm that the service is healthy and the incident is resolved. Monitor for a few minutes to ensure stability.',
          isOptional: false,
          estimatedMinutes: 5,
          type: 'manual',
        },
        {
          id: uuidv4(),
          order: 6,
          title: 'Update Stakeholders',
          description: 'Notify relevant stakeholders of the incident resolution. Update status page if applicable.',
          isOptional: true,
          estimatedMinutes: 5,
          type: 'manual',
        },
      ],
      estimatedTimeMinutes: 40,
      confidence: 'low',
      rationale: 'This is a basic template runbook created due to insufficient incident history. Customize it based on your service\'s specific requirements and common failure patterns.',
    };
  }

  /**
   * Analyze incidents to identify common patterns
   */
  async identifyPatterns(
    serviceId: string,
    orgId: string
  ): Promise<{
    commonErrors: string[];
    peakHours: number[];
    avgResolutionTime: number | null;
    severityTrend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const incidents = await this.analyzeIncidentHistory(serviceId, orgId, 100);

    // Extract common error patterns from summaries
    const errorPatterns: Record<string, number> = {};
    for (const incident of incidents) {
      const words = incident.summary.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4 && !['error', 'issue', 'problem', 'incident'].includes(word)) {
          errorPatterns[word] = (errorPatterns[word] || 0) + 1;
        }
      }
    }
    const commonErrors = Object.entries(errorPatterns)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Identify peak hours
    const hourCounts: Record<number, number> = {};
    for (const incident of incidents) {
      const hour = incident.triggeredAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
    const avgCount = incidents.length / 24;
    const peakHours = Object.entries(hourCounts)
      .filter(([, count]) => count > avgCount * 1.5)
      .map(([hour]) => parseInt(hour, 10))
      .sort((a, b) => a - b);

    // Calculate average resolution time
    const resolvedWithTime = incidents.filter(i => i.resolutionTimeMinutes);
    const avgResolutionTime = resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce((sum, i) => sum + (i.resolutionTimeMinutes || 0), 0) /
          resolvedWithTime.length
        )
      : null;

    // Analyze severity trend (compare first half vs second half)
    const severityValues: Record<string, number> = {
      info: 1,
      warning: 2,
      error: 3,
      critical: 4,
    };

    if (incidents.length >= 10) {
      const half = Math.floor(incidents.length / 2);
      const recentAvg = incidents.slice(0, half).reduce(
        (sum, i) => sum + (severityValues[i.severity] || 2), 0
      ) / half;
      const olderAvg = incidents.slice(half).reduce(
        (sum, i) => sum + (severityValues[i.severity] || 2), 0
      ) / (incidents.length - half);

      const diff = recentAvg - olderAvg;
      const severityTrend = diff > 0.3 ? 'increasing' : diff < -0.3 ? 'decreasing' : 'stable';

      return {
        commonErrors,
        peakHours,
        avgResolutionTime,
        severityTrend,
      };
    }

    return {
      commonErrors,
      peakHours,
      avgResolutionTime,
      severityTrend: 'stable',
    };
  }
}

// Export singleton instance
export const runbookGeneratorService = new RunbookGeneratorService();
