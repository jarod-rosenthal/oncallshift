/**
 * Report Delivery Service
 *
 * Handles formatting and delivering incident reports via multiple channels:
 * - Email (via SES)
 * - Slack (via Slack API)
 * - Microsoft Teams (via Teams webhook)
 * - Custom webhooks (HTTP POST)
 */

import { DataSource } from 'typeorm';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { IncidentReport, ReportExecution, ReportData } from '../models';
import { logger } from '../utils/logger';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface DeliveryStatus {
  channel: string;
  sent: boolean;
  sentAt?: string;
  error?: string;
}

export class ReportDeliveryService {
  constructor(private dataSource: DataSource) {}

  /**
   * Deliver a report execution to all configured channels
   */
  async deliverReport(
    report: IncidentReport,
    execution: ReportExecution
  ): Promise<Record<string, DeliveryStatus>> {
    const deliveryStatus: Record<string, DeliveryStatus> = {};
    const config = report.deliveryConfig as any || {};

    logger.info('Starting report delivery', {
      reportId: report.id,
      executionId: execution.id,
      channels: Object.keys(config),
    });

    // Deliver to email
    if (config.email?.enabled && config.email.recipients?.length > 0) {
      deliveryStatus.email = await this.deliverViaEmail(
        report,
        execution,
        config.email.recipients
      );
    }

    // Deliver to Slack
    if (config.slack?.enabled && config.slack.webhookUrl) {
      deliveryStatus.slack = await this.deliverViaSlack(
        report,
        execution,
        config.slack.webhookUrl
      );
    }

    // Deliver to Microsoft Teams
    if (config.teams?.enabled && config.teams.webhookUrl) {
      deliveryStatus.teams = await this.deliverViaTeams(
        report,
        execution,
        config.teams.webhookUrl
      );
    }

    // Deliver to custom webhook
    if (config.webhook?.enabled && config.webhook.url) {
      deliveryStatus.webhook = await this.deliverViaWebhook(
        report,
        execution,
        config.webhook.url,
        config.webhook.headers
      );
    }

    // Update execution with delivery status
    const executionRepo = this.dataSource.getRepository(ReportExecution);
    execution.deliveryStatus = deliveryStatus;
    await executionRepo.save(execution);

    logger.info('Report delivery completed', {
      reportId: report.id,
      executionId: execution.id,
      deliveryStatus,
    });

    return deliveryStatus;
  }

  /**
   * Deliver report via email
   */
  private async deliverViaEmail(
    report: IncidentReport,
    execution: ReportExecution,
    recipients: string[]
  ): Promise<DeliveryStatus> {
    try {
      const subject = `[OnCallShift] ${report.name} - ${execution.periodStart.toLocaleDateString()} to ${execution.periodEnd.toLocaleDateString()}`;
      const htmlBody = this.formatReportAsHtml(report, execution);
      const textBody = this.formatReportAsText(report, execution);

      const fromEmail = process.env.FROM_EMAIL || 'noreply@oncallshift.com';

      const command = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await sesClient.send(command);

      logger.info('Report delivered via email', {
        reportId: report.id,
        executionId: execution.id,
        recipients: recipients.length,
      });

      return {
        channel: 'email',
        sent: true,
        sentAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to deliver report via email', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });

      return {
        channel: 'email',
        sent: false,
        error: error.message,
      };
    }
  }

  /**
   * Deliver report via Slack webhook
   */
  private async deliverViaSlack(
    report: IncidentReport,
    execution: ReportExecution,
    webhookUrl: string
  ): Promise<DeliveryStatus> {
    try {
      const payload = this.formatReportAsSlack(report, execution);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`);
      }

      logger.info('Report delivered via Slack', {
        reportId: report.id,
        executionId: execution.id,
      });

      return {
        channel: 'slack',
        sent: true,
        sentAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to deliver report via Slack', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });

      return {
        channel: 'slack',
        sent: false,
        error: error.message,
      };
    }
  }

  /**
   * Deliver report via Microsoft Teams webhook
   */
  private async deliverViaTeams(
    report: IncidentReport,
    execution: ReportExecution,
    webhookUrl: string
  ): Promise<DeliveryStatus> {
    try {
      const payload = this.formatReportAsTeams(report, execution);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Teams webhook returned ${response.status}: ${await response.text()}`);
      }

      logger.info('Report delivered via Microsoft Teams', {
        reportId: report.id,
        executionId: execution.id,
      });

      return {
        channel: 'teams',
        sent: true,
        sentAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to deliver report via Teams', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });

      return {
        channel: 'teams',
        sent: false,
        error: error.message,
      };
    }
  }

  /**
   * Deliver report via custom webhook
   */
  private async deliverViaWebhook(
    report: IncidentReport,
    execution: ReportExecution,
    webhookUrl: string,
    customHeaders?: Record<string, string>
  ): Promise<DeliveryStatus> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'OnCallShift-Reports/1.0',
        ...customHeaders,
      };

      const payload = {
        report: {
          id: report.id,
          name: report.name,
          schedule: report.schedule,
        },
        execution: {
          id: execution.id,
          status: execution.status,
          periodStart: execution.periodStart.toISOString(),
          periodEnd: execution.periodEnd.toISOString(),
        },
        data: execution.data,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
      }

      logger.info('Report delivered via webhook', {
        reportId: report.id,
        executionId: execution.id,
        webhookUrl,
      });

      return {
        channel: 'webhook',
        sent: true,
        sentAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to deliver report via webhook', {
        reportId: report.id,
        executionId: execution.id,
        error: error.message,
      });

      return {
        channel: 'webhook',
        sent: false,
        error: error.message,
      };
    }
  }

  /**
   * Format report as HTML email
   */
  private formatReportAsHtml(report: IncidentReport, execution: ReportExecution): string {
    const data = execution.data as ReportData;

    let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>${report.name}</h1>
  <p><strong>Period:</strong> ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()} (${data.period.durationDays} days)</p>

  <h2>Summary</h2>
  <div>
    <div class="metric">
      <div class="metric-value">${data.summary.totalIncidents}</div>
      <div class="metric-label">Total Incidents</div>
    </div>
    <div class="metric">
      <div class="metric-value">${Math.floor(data.summary.avgTimeToAcknowledge / 60)}m</div>
      <div class="metric-label">Avg Time to Ack</div>
    </div>
    <div class="metric">
      <div class="metric-value">${Math.floor(data.summary.avgTimeToResolve / 60)}m</div>
      <div class="metric-label">Avg Time to Resolve</div>
    </div>
  </div>

  <h3>By State</h3>
  <table>
    <tr>
      <th>State</th>
      <th>Count</th>
    </tr>
    ${Object.entries(data.summary.byState).map(([state, count]) => `
      <tr>
        <td style="text-transform: capitalize;">${state}</td>
        <td>${count}</td>
      </tr>
    `).join('')}
  </table>

  <h3>By Severity</h3>
  <table>
    <tr>
      <th>Severity</th>
      <th>Count</th>
    </tr>
    ${Object.entries(data.summary.bySeverity).map(([severity, count]) => `
      <tr>
        <td style="text-transform: capitalize;">${severity}</td>
        <td>${count}</td>
      </tr>
    `).join('')}
  </table>
`;

    // Add service breakdown if present
    if (data.services && data.services.length > 0) {
      html += `
  <h2>Service Breakdown</h2>
  <table>
    <tr>
      <th>Service</th>
      <th>Incidents</th>
      <th>Avg Resolution Time</th>
    </tr>
    ${data.services.map(service => `
      <tr>
        <td>${service.name}</td>
        <td>${service.incidentCount}</td>
        <td>${Math.floor(service.avgResolutionTime / 60)}m</td>
      </tr>
    `).join('')}
  </table>
`;
    }

    // Add responder metrics if present
    if (data.responders && data.responders.length > 0) {
      html += `
  <h2>Top Responders</h2>
  <table>
    <tr>
      <th>Responder</th>
      <th>Incidents Handled</th>
      <th>Avg Ack Time</th>
      <th>Avg Resolve Time</th>
    </tr>
    ${data.responders.slice(0, 10).map(responder => `
      <tr>
        <td>${responder.name}</td>
        <td>${responder.incidentsHandled}</td>
        <td>${Math.floor(responder.avgAcknowledgeTime / 60)}m</td>
        <td>${Math.floor(responder.avgResolveTime / 60)}m</td>
      </tr>
    `).join('')}
  </table>
`;
    }

    // Add RCAs if present
    if (data.rcas && data.rcas.length > 0) {
      html += `
  <h2>Root Cause Analyses</h2>
`;
      data.rcas.forEach(rca => {
        html += `
  <div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #2563eb;">
    <h3 style="margin-top: 0;">Incident #${rca.incidentNumber}: ${rca.summary}</h3>
    <p><strong>Severity:</strong> ${rca.severity.toUpperCase()}</p>
    <p><strong>Resolved:</strong> ${new Date(rca.resolvedAt).toLocaleString()}</p>
    <p><strong>Root Cause:</strong> ${rca.rca}</p>
    ${rca.preventiveMeasures ? `<p><strong>Preventive Measures:</strong> ${rca.preventiveMeasures}</p>` : ''}
  </div>
`;
      });
    }

    html += `
</body>
</html>
`;

    return html;
  }

  /**
   * Format report as plain text
   */
  private formatReportAsText(report: IncidentReport, execution: ReportExecution): string {
    const data = execution.data as ReportData;

    let text = `${report.name}\n`;
    text += `${'='.repeat(report.name.length)}\n\n`;
    text += `Period: ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()} (${data.period.durationDays} days)\n\n`;

    text += `SUMMARY\n`;
    text += `-------\n`;
    text += `Total Incidents: ${data.summary.totalIncidents}\n`;
    text += `Avg Time to Acknowledge: ${Math.floor(data.summary.avgTimeToAcknowledge / 60)} minutes\n`;
    text += `Avg Time to Resolve: ${Math.floor(data.summary.avgTimeToResolve / 60)} minutes\n\n`;

    text += `By State:\n`;
    Object.entries(data.summary.byState).forEach(([state, count]) => {
      text += `  ${state}: ${count}\n`;
    });

    text += `\nBy Severity:\n`;
    Object.entries(data.summary.bySeverity).forEach(([severity, count]) => {
      text += `  ${severity}: ${count}\n`;
    });

    if (data.services && data.services.length > 0) {
      text += `\n\nSERVICE BREAKDOWN\n`;
      text += `-----------------\n`;
      data.services.forEach(service => {
        text += `${service.name}: ${service.incidentCount} incidents, ${Math.floor(service.avgResolutionTime / 60)}m avg resolution\n`;
      });
    }

    if (data.rcas && data.rcas.length > 0) {
      text += `\n\nROOT CAUSE ANALYSES\n`;
      text += `-------------------\n`;
      data.rcas.forEach(rca => {
        text += `\nIncident #${rca.incidentNumber}: ${rca.summary}\n`;
        text += `Severity: ${rca.severity.toUpperCase()}\n`;
        text += `Resolved: ${new Date(rca.resolvedAt).toLocaleString()}\n`;
        text += `Root Cause: ${rca.rca}\n`;
        if (rca.preventiveMeasures) {
          text += `Preventive Measures: ${rca.preventiveMeasures}\n`;
        }
      });
    }

    return text;
  }

  /**
   * Format report as Slack message
   */
  private formatReportAsSlack(report: IncidentReport, execution: ReportExecution): any {
    const data = execution.data as ReportData;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: report.name,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Period:* ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()} (${data.period.durationDays} days)`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Incidents*\n${data.summary.totalIncidents}`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg Time to Ack*\n${Math.floor(data.summary.avgTimeToAcknowledge / 60)}m`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg Time to Resolve*\n${Math.floor(data.summary.avgTimeToResolve / 60)}m`,
          },
        ],
      },
    ];

    if (data.services && data.services.length > 0) {
      blocks.push({
        type: 'divider',
      } as any);
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Services*\n${data.services.slice(0, 5).map(s => `• ${s.name}: ${s.incidentCount} incidents`).join('\n')}`,
        },
      } as any);
    }

    return { blocks };
  }

  /**
   * Format report as Microsoft Teams message
   */
  private formatReportAsTeams(report: IncidentReport, execution: ReportExecution): any {
    const data = execution.data as ReportData;

    const facts = [
      {
        name: 'Total Incidents',
        value: data.summary.totalIncidents.toString(),
      },
      {
        name: 'Avg Time to Acknowledge',
        value: `${Math.floor(data.summary.avgTimeToAcknowledge / 60)} minutes`,
      },
      {
        name: 'Avg Time to Resolve',
        value: `${Math.floor(data.summary.avgTimeToResolve / 60)} minutes`,
      },
    ];

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: report.name,
      themeColor: '2563eb',
      title: report.name,
      text: `Period: ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()}`,
      sections: [
        {
          facts,
        },
      ],
    };
  }
}
