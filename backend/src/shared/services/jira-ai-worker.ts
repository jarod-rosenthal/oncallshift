import { DataSource } from 'typeorm';
import { AIWorkerTask, AIWorkerPersona, AIWorkerTaskStatus } from '../models/AIWorkerTask';
import { AIWorkerTaskLog } from '../models/AIWorkerTaskLog';
import { logger } from '../utils/logger';

// Jira API types
interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;  // Atlassian Document Format
    issuetype: { name: string; id: string };
    project: { key: string; id: string; projectTypeKey?: string };
    priority?: { name: string; id: string };
    status: { name: string; id: string };
    labels?: string[];
    assignee?: { accountId: string; displayName: string };
    reporter?: { accountId: string; displayName: string };
    parent?: { key: string };
    [key: string]: any;
  };
}

interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; id: string };
}

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  defaultGithubRepo: string;
}

// Issue type to persona mapping
const DEFAULT_PERSONA_MAPPING: Record<string, AIWorkerPersona> = {
  // Software development (backend by default)
  'Story': 'backend_developer',
  'Bug': 'backend_developer',
  'Task': 'backend_developer',
  'Sub-task': 'backend_developer',
  'Technical Debt': 'backend_developer',
  'Spike': 'backend_developer',

  // Frontend specific
  'UI': 'frontend_developer',
  'Frontend': 'frontend_developer',
  'Design': 'frontend_developer',

  // QA
  'Test': 'qa_engineer',
  'Test Task': 'qa_engineer',
  'QA Task': 'qa_engineer',

  // DevOps
  'Infrastructure': 'devops_engineer',
  'CI/CD': 'devops_engineer',
  'Deployment': 'devops_engineer',

  // Security
  'Security': 'security_engineer',
  'Vulnerability': 'security_engineer',

  // Documentation
  'Documentation': 'tech_writer',
  'Docs': 'tech_writer',

  // Project Management
  'Epic': 'project_manager',
  'Initiative': 'project_manager',
  'Planning': 'project_manager',
};

// Priority mapping (Jira priority to our 1-5 scale)
const PRIORITY_MAPPING: Record<string, number> = {
  'Highest': 1,
  'High': 2,
  'Medium': 3,
  'Low': 4,
  'Lowest': 5,
};

export class JiraAIWorkerService {
  private dataSource: DataSource;
  private config: JiraConfig;
  private personaMapping: Record<string, AIWorkerPersona>;

  constructor(
    dataSource: DataSource,
    config: JiraConfig,
    personaMapping?: Record<string, AIWorkerPersona>
  ) {
    this.dataSource = dataSource;
    this.config = config;
    this.personaMapping = personaMapping || DEFAULT_PERSONA_MAPPING;
  }

  // ==================== API Helpers ====================

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async jiraRequest<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Jira API error', { status: response.status, error, endpoint });
      throw new Error(`Jira API error ${response.status}: ${error}`);
    }

    // Some endpoints return empty body
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  // ==================== Issue Sync ====================

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.jiraRequest<JiraIssue>('GET', `/rest/api/3/issue/${issueKey}`);
  }

  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    const response = await this.jiraRequest<{ issues: JiraIssue[] }>(
      'POST',
      '/rest/api/3/search/jql',
      { jql, maxResults }
    );
    return response.issues;
  }

  async getReadyIssues(): Promise<JiraIssue[]> {
    // Get issues in "To Do" status that aren't already being processed
    const jql = `project = ${this.config.projectKey} AND status = "To Do" ORDER BY priority ASC, created ASC`;
    return this.searchIssues(jql);
  }

  // ==================== Task Creation ====================

  async syncJiraIssue(
    issue: JiraIssue,
    orgId: string
  ): Promise<AIWorkerTask | null> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    // Check if task already exists for this issue
    const existing = await taskRepo.findOne({
      where: {
        orgId,
        jiraIssueKey: issue.key,
        status: 'queued' as AIWorkerTaskStatus,
      },
    });

    if (existing) {
      logger.info('Task already exists for Jira issue', { issueKey: issue.key, taskId: existing.id });
      return existing;
    }

    // Map issue type to persona
    const persona = this.getPersonaForIssueType(issue.fields.issuetype.name);
    if (!persona) {
      logger.info('Issue type not mapped to persona, skipping', {
        issueKey: issue.key,
        issueType: issue.fields.issuetype.name,
      });
      return null;
    }

    // Create task
    const task = taskRepo.create({
      orgId,
      jiraIssueKey: issue.key,
      jiraIssueId: issue.id,
      jiraProjectKey: issue.fields.project.key,
      jiraProjectType: issue.fields.project.projectTypeKey || 'software',
      jiraIssueType: issue.fields.issuetype.name,
      summary: issue.fields.summary,
      description: this.extractDescription(issue.fields.description),
      jiraFields: issue.fields,
      workerPersona: persona,
      priority: this.mapPriority(issue.fields.priority?.name),
      githubRepo: this.config.defaultGithubRepo,
      status: 'queued' as AIWorkerTaskStatus,
    });

    await taskRepo.save(task);
    logger.info('Created AI worker task from Jira issue', {
      taskId: task.id,
      issueKey: issue.key,
      persona,
    });

    return task;
  }

  private getPersonaForIssueType(issueType: string): AIWorkerPersona | null {
    return this.personaMapping[issueType] || null;
  }

  private mapPriority(priority?: string): number {
    if (!priority) return 3;
    return PRIORITY_MAPPING[priority] || 3;
  }

  private extractDescription(description: any): string | null {
    if (!description) return null;

    // Atlassian Document Format - extract plain text
    if (description.type === 'doc' && description.content) {
      return this.extractTextFromADF(description.content);
    }

    // Plain text
    if (typeof description === 'string') {
      return description;
    }

    return JSON.stringify(description);
  }

  private extractTextFromADF(content: any[]): string {
    const parts: string[] = [];

    for (const node of content) {
      if (node.type === 'paragraph' && node.content) {
        for (const child of node.content) {
          if (child.type === 'text') {
            parts.push(child.text);
          }
        }
        parts.push('\n');
      } else if (node.type === 'bulletList' && node.content) {
        for (const item of node.content) {
          if (item.type === 'listItem' && item.content) {
            parts.push('• ' + this.extractTextFromADF(item.content).trim());
            parts.push('\n');
          }
        }
      } else if (node.type === 'orderedList' && node.content) {
        let i = 1;
        for (const item of node.content) {
          if (item.type === 'listItem' && item.content) {
            parts.push(`${i}. ` + this.extractTextFromADF(item.content).trim());
            parts.push('\n');
            i++;
          }
        }
      } else if (node.type === 'codeBlock' && node.content) {
        parts.push('```\n');
        for (const child of node.content) {
          if (child.type === 'text') {
            parts.push(child.text);
          }
        }
        parts.push('\n```\n');
      } else if (node.type === 'heading' && node.content) {
        const level = node.attrs?.level || 1;
        parts.push('#'.repeat(level) + ' ');
        for (const child of node.content) {
          if (child.type === 'text') {
            parts.push(child.text);
          }
        }
        parts.push('\n\n');
      }
    }

    return parts.join('').trim();
  }

  // ==================== Status Updates ====================

  async updateJiraFromTask(task: AIWorkerTask): Promise<void> {
    // Add comment with task progress
    await this.addComment(task.jiraIssueKey, this.formatTaskUpdate(task));

    // Transition status if needed
    if (task.status === 'executing' || task.status === 'claimed') {
      await this.transitionToInProgress(task.jiraIssueKey);
    } else if (task.status === 'completed' || task.status === 'review_approved') {
      await this.transitionToDone(task.jiraIssueKey);
    } else if (task.status === 'blocked') {
      // Keep in progress but add blocked label
      await this.addLabels(task.jiraIssueKey, ['ai-blocked']);
    }

    // Add PR link if available
    if (task.githubPrUrl) {
      await this.addRemoteLink(task.jiraIssueKey, {
        url: task.githubPrUrl,
        title: `Pull Request #${task.githubPrNumber}`,
        icon: 'https://github.githubassets.com/favicons/favicon.svg',
      });
    }
  }

  private getPersonaDisplayName(persona: AIWorkerPersona): string {
    const displayNames: Record<AIWorkerPersona, string> = {
      backend_developer: 'Backend Developer',
      frontend_developer: 'Frontend Developer',
      qa_engineer: 'QA Engineer',
      devops_engineer: 'DevOps Engineer',
      security_engineer: 'Security Engineer',
      tech_writer: 'Technical Writer',
      project_manager: 'Project Manager',
    };
    return displayNames[persona] || persona.replace(/_/g, ' ');
  }

  private formatTaskUpdate(task: AIWorkerTask): string {
    const statusEmoji: Record<string, string> = {
      queued: '⏳',
      claimed: '🤖',
      environment_setup: '🔧',
      executing: '⚡',
      pr_created: '🔀',
      review_pending: '👀',
      review_approved: '✅',
      review_rejected: '❌',
      completed: '🎉',
      failed: '💥',
      blocked: '🚧',
      cancelled: '🛑',
    };

    // Identity signature - clearly identifies this as an AI Worker
    const personaName = this.getPersonaDisplayName(task.workerPersona);
    const signature = `🤖 *AI Worker (${personaName})* - Automated Update`;

    const emoji = statusEmoji[task.status] || '📌';
    let message = `${signature}\n\n`;
    message += `${emoji} *Status Update*\n\n`;
    message += `Status: *${task.status.replace(/_/g, ' ').toUpperCase()}*\n`;

    if (task.githubBranch) {
      message += `Branch: \`${task.githubBranch}\`\n`;
    }

    if (task.githubPrUrl) {
      message += `PR: [#${task.githubPrNumber}|${task.githubPrUrl}]\n`;
    }

    if (task.errorMessage) {
      message += `\nError: ${task.errorMessage}\n`;
    }

    const cost = task.calculateCost();
    if (cost > 0) {
      message += `\nCost: $${cost.toFixed(4)}\n`;
    }

    return message;
  }

  // ==================== Jira Actions ====================

  async addComment(issueKey: string, body: string): Promise<void> {
    await this.jiraRequest('POST', `/rest/api/3/issue/${issueKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: body }],
          },
        ],
      },
    });
    logger.info('Added Jira comment', { issueKey });
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await this.jiraRequest<{ transitions: JiraTransition[] }>(
      'GET',
      `/rest/api/3/issue/${issueKey}/transitions`
    );
    return response.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.jiraRequest('POST', `/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
    logger.info('Transitioned Jira issue', { issueKey, transitionId });
  }

  async transitionToInProgress(issueKey: string): Promise<void> {
    const transitions = await this.getTransitions(issueKey);
    const inProgress = transitions.find(t =>
      t.name.toLowerCase().includes('progress') ||
      t.to.name.toLowerCase().includes('progress')
    );

    if (inProgress) {
      await this.transitionIssue(issueKey, inProgress.id);
    }
  }

  async transitionToDone(issueKey: string): Promise<void> {
    const transitions = await this.getTransitions(issueKey);
    const done = transitions.find(t =>
      t.name.toLowerCase() === 'done' ||
      t.to.name.toLowerCase() === 'done'
    );

    if (done) {
      await this.transitionIssue(issueKey, done.id);
    }
  }

  async addLabels(issueKey: string, labels: string[]): Promise<void> {
    await this.jiraRequest('PUT', `/rest/api/3/issue/${issueKey}`, {
      update: {
        labels: labels.map(label => ({ add: label })),
      },
    });
    logger.info('Added Jira labels', { issueKey, labels });
  }

  async addRemoteLink(
    issueKey: string,
    link: { url: string; title: string; icon?: string }
  ): Promise<void> {
    await this.jiraRequest('POST', `/rest/api/3/issue/${issueKey}/remotelink`, {
      object: {
        url: link.url,
        title: link.title,
        icon: link.icon ? { url16x16: link.icon } : undefined,
      },
    });
    logger.info('Added Jira remote link', { issueKey, url: link.url });
  }

  // ==================== Task Logging ====================

  async logTaskEvent(
    task: AIWorkerTask,
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logRepo = this.dataSource.getRepository(AIWorkerTaskLog);
    const log = logRepo.create({
      taskId: task.id,
      type: type as any,
      message,
      metadata,
      severity: 'info',
    });
    await logRepo.save(log);
  }
}

// Factory function
let jiraService: JiraAIWorkerService | null = null;

export function getJiraAIWorkerService(
  dataSource: DataSource,
  config?: JiraConfig
): JiraAIWorkerService {
  if (!jiraService && config) {
    jiraService = new JiraAIWorkerService(dataSource, config);
  }
  if (!jiraService) {
    throw new Error('JiraAIWorkerService not initialized - provide config on first call');
  }
  return jiraService;
}

export function initJiraAIWorkerService(
  dataSource: DataSource,
  config: JiraConfig
): JiraAIWorkerService {
  jiraService = new JiraAIWorkerService(dataSource, config);
  return jiraService;
}
