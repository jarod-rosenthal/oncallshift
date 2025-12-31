import { DataSource } from 'typeorm';
import { Integration, SlackConfig } from '../models/Integration';
import { Incident } from '../models/Incident';
import { Service } from '../models/Service';
import { IntegrationService, getIntegrationService } from './integration-service';
import { logger } from '../utils/logger';

// Slack API response types
interface SlackApiResponse {
  ok: boolean;
  error?: string;
  channel?: { id: string; name: string };
  ts?: string;
  message?: any;
}

interface SlackChannel {
  id: string;
  name: string;
}

// Slack Block Kit message building
interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: any[];
  accessory?: any;
  block_id?: string;
  fields?: { type: string; text: string }[];
}

export class SlackIntegration {
  private integrationService: IntegrationService;
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.integrationService = getIntegrationService(dataSource);
  }

  // ==================== OAuth Flow ====================

  getOAuthUrl(integrationId: string, redirectUri: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      throw new Error('SLACK_CLIENT_ID not configured');
    }

    // Scopes needed for incident management
    const scopes = [
      'channels:read',
      'channels:join',
      'channels:manage',
      'chat:write',
      'chat:write.public',
      'users:read',
      'users:read.email',
      'reactions:write',
    ].join(',');

    const state = Buffer.from(JSON.stringify({ integrationId })).toString('base64');

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }

  async handleOAuthCallback(code: string, integrationId: string, redirectUri: string): Promise<Integration | null> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth not configured');
    }

    try {
      // Exchange code for token
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json() as any;

      if (!data.ok) {
        logger.error('Slack OAuth error:', data.error);
        throw new Error(`Slack OAuth failed: ${data.error}`);
      }

      // Get integration
      const integration = await this.dataSource.getRepository(Integration).findOne({
        where: { id: integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Store token and workspace info
      integration.slackWorkspaceId = data.team.id;
      integration.slackWorkspaceName = data.team.name;
      await this.integrationService.setSlackBotToken(integrationId, integration.orgId, data.access_token);

      // Activate integration
      integration.status = 'active';
      await this.dataSource.getRepository(Integration).save(integration);

      logger.info(`Slack integration ${integrationId} connected to workspace ${data.team.name}`);

      return integration;
    } catch (error) {
      logger.error('Slack OAuth callback error:', error);
      throw error;
    }
  }

  // ==================== API Calls ====================

  private async callSlackApi(
    integration: Integration,
    method: string,
    body: Record<string, any>
  ): Promise<SlackApiResponse> {
    const token = await this.integrationService.getDecryptedSlackBotToken(integration.id);
    if (!token) {
      throw new Error('No Slack bot token available');
    }

    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as SlackApiResponse;

    if (!data.ok) {
      logger.error(`Slack API error (${method}):`, data.error);
      await this.integrationService.logError(
        integration.id,
        integration.orgId,
        `Slack API error: ${data.error}`,
        { method, body }
      );
    }

    return data;
  }

  // ==================== Incident Notifications ====================

  async sendIncidentNotification(
    integration: Integration,
    incident: Incident,
    service: Service,
    channelId?: string
  ): Promise<{ success: boolean; messageTs?: string; channelId?: string }> {
    try {
      const config = integration.config as SlackConfig;
      const targetChannel = channelId || config.default_channel_id || integration.slackDefaultChannelId;

      if (!targetChannel) {
        logger.warn(`No Slack channel configured for integration ${integration.id}`);
        return { success: false };
      }

      const blocks = this.buildIncidentBlocks(incident, service);

      const response = await this.callSlackApi(integration, 'chat.postMessage', {
        channel: targetChannel,
        text: `🚨 Incident: ${incident.summary}`,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });

      if (response.ok) {
        await this.integrationService.logEvent({
          integrationId: integration.id,
          orgId: integration.orgId,
          eventType: 'message.sent',
          incidentId: incident.id,
          serviceId: incident.serviceId,
          payload: { channel: targetChannel, blocks },
          response: { ts: response.ts, channel: response.channel?.id },
          externalId: response.ts,
        });

        await this.integrationService.recordIntegrationSuccess(integration.id);

        return { success: true, messageTs: response.ts, channelId: targetChannel };
      }

      return { success: false };
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      await this.integrationService.logError(
        integration.id,
        integration.orgId,
        `Failed to send notification: ${error}`,
        { incidentId: incident.id }
      );
      return { success: false };
    }
  }

  async sendIncidentUpdate(
    integration: Integration,
    incident: Incident,
    service: Service,
    channelId: string,
    messageTs: string,
    updateType: 'acknowledged' | 'resolved' | 'escalated'
  ): Promise<boolean> {
    try {
      const blocks = this.buildIncidentBlocks(incident, service, updateType);

      const response = await this.callSlackApi(integration, 'chat.update', {
        channel: channelId,
        ts: messageTs,
        text: `🚨 Incident: ${incident.summary}`,
        blocks,
      });

      if (response.ok) {
        await this.integrationService.logEvent({
          integrationId: integration.id,
          orgId: integration.orgId,
          eventType: 'incident.updated',
          incidentId: incident.id,
          serviceId: incident.serviceId,
          payload: { updateType },
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to update Slack message:', error);
      return false;
    }
  }

  // ==================== Message Building ====================

  private buildIncidentBlocks(
    incident: Incident,
    service: Service,
    _status?: 'acknowledged' | 'resolved' | 'escalated'
  ): SlackBlock[] {
    const severityEmoji = this.getSeverityEmoji(incident.severity);
    const stateEmoji = this.getStateEmoji(incident.state);
    const dashboardUrl = `${process.env.FRONTEND_URL || 'https://oncallshift.com'}/incidents/${incident.id}`;

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} ${incident.summary}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service:*\n${service.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${incident.severity.toUpperCase()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${stateEmoji} ${incident.state.charAt(0).toUpperCase() + incident.state.slice(1)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Incident #:*\n${incident.incidentNumber}`,
          },
        ],
      },
    ];

    // Add details if present
    if (incident.details && Object.keys(incident.details).length > 0) {
      const detailText = Object.entries(incident.details)
        .slice(0, 5) // Limit to 5 fields
        .map(([k, v]) => `• *${k}:* ${String(v).substring(0, 100)}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n${detailText}`,
        },
      });
    }

    // Add action buttons for triggered incidents
    if (incident.state === 'triggered') {
      blocks.push({
        type: 'actions',
        block_id: `incident_actions_${incident.id}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Acknowledge', emoji: true },
            style: 'primary',
            action_id: 'acknowledge_incident',
            value: incident.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✓ Resolve', emoji: true },
            action_id: 'resolve_incident',
            value: incident.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔗 View', emoji: true },
            url: dashboardUrl,
            action_id: 'view_incident',
          },
        ],
      } as any);
    } else if (incident.state === 'acknowledged') {
      blocks.push({
        type: 'actions',
        block_id: `incident_actions_${incident.id}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✓ Resolve', emoji: true },
            style: 'primary',
            action_id: 'resolve_incident',
            value: incident.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔗 View', emoji: true },
            url: dashboardUrl,
            action_id: 'view_incident',
          },
        ],
      } as any);
    } else {
      // Resolved - just show view button
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔗 View Details', emoji: true },
            url: dashboardUrl,
            action_id: 'view_incident',
          },
        ],
      } as any);
    }

    // Add context with timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered at <!date^${Math.floor(new Date(incident.triggeredAt).getTime() / 1000)}^{date_short_pretty} at {time}|${incident.triggeredAt}>`,
        },
      ],
    } as any);

    return blocks;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'error': return '🟠';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  }

  private getStateEmoji(state: string): string {
    switch (state) {
      case 'triggered': return '🚨';
      case 'acknowledged': return '👀';
      case 'resolved': return '✅';
      default: return '❓';
    }
  }

  // ==================== Interactive Actions ====================

  async handleInteraction(payload: any): Promise<{ text?: string; replace_original?: boolean }> {
    try {
      const action = payload.actions?.[0];
      if (!action) {
        return { text: 'No action found' };
      }

      const incidentId = action.value;
      const actionId = action.action_id;

      // Find the incident
      const incidentRepo = this.dataSource.getRepository(Incident);
      const incident = await incidentRepo.findOne({
        where: { id: incidentId },
        relations: ['service'],
      });

      if (!incident) {
        return { text: 'Incident not found' };
      }

      // Find the integration from the team ID
      const integrationRepo = this.dataSource.getRepository(Integration);
      const integration = await integrationRepo.findOne({
        where: { slackWorkspaceId: payload.team?.id, type: 'slack', status: 'active' },
      });

      if (!integration) {
        return { text: 'Integration not configured' };
      }

      // Get the Slack user making the action
      const slackUserName = payload.user?.name || 'Unknown';

      if (actionId === 'acknowledge_incident' && incident.canAcknowledge()) {
        incident.state = 'acknowledged';
        incident.acknowledgedAt = new Date();
        // Note: We don't have user mapping yet, so we'll log the Slack user
        await incidentRepo.save(incident);

        await this.integrationService.logEvent({
          integrationId: integration.id,
          orgId: integration.orgId,
          eventType: 'incident.updated',
          direction: 'inbound',
          incidentId: incident.id,
          payload: { action: 'acknowledge', slackUser: slackUserName, slackUserId: payload.user?.id },
        });

        // Update the message
        if (incident.service) {
          await this.sendIncidentUpdate(
            integration,
            incident,
            incident.service,
            payload.channel?.id,
            payload.message?.ts,
            'acknowledged'
          );
        }

        return { text: `Incident acknowledged by ${slackUserName}`, replace_original: false };
      }

      if (actionId === 'resolve_incident' && incident.canResolve()) {
        incident.state = 'resolved';
        incident.resolvedAt = new Date();
        await incidentRepo.save(incident);

        await this.integrationService.logEvent({
          integrationId: integration.id,
          orgId: integration.orgId,
          eventType: 'incident.resolved',
          direction: 'inbound',
          incidentId: incident.id,
          payload: { action: 'resolve', slackUser: slackUserName },
        });

        // Update the message
        if (incident.service) {
          await this.sendIncidentUpdate(
            integration,
            incident,
            incident.service,
            payload.channel?.id,
            payload.message?.ts,
            'resolved'
          );
        }

        return { text: `Incident resolved by ${slackUserName}`, replace_original: false };
      }

      return { text: 'Action not available' };
    } catch (error) {
      logger.error('Slack interaction error:', error);
      return { text: 'Error processing action' };
    }
  }

  // ==================== Channel Management ====================

  async listChannels(integration: Integration): Promise<SlackChannel[]> {
    const response = await this.callSlackApi(integration, 'conversations.list', {
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
    }) as any;

    if (response.ok && response.channels) {
      return response.channels.map((c: any) => ({
        id: c.id,
        name: c.name,
      }));
    }

    return [];
  }

  async createIncidentChannel(
    integration: Integration,
    incident: Incident
  ): Promise<{ channelId: string; channelName: string } | null> {
    const channelName = `incident-${incident.incidentNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const response = await this.callSlackApi(integration, 'conversations.create', {
      name: channelName,
      is_private: false,
    }) as any;

    if (response.ok && response.channel) {
      await this.integrationService.logEvent({
        integrationId: integration.id,
        orgId: integration.orgId,
        eventType: 'channel.created',
        incidentId: incident.id,
        externalId: response.channel.id,
        payload: { channelName },
      });

      return {
        channelId: response.channel.id,
        channelName: response.channel.name,
      };
    }

    return null;
  }
}

// Factory function
export function createSlackIntegration(dataSource: DataSource): SlackIntegration {
  return new SlackIntegration(dataSource);
}
