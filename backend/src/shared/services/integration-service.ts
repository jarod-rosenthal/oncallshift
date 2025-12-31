import { DataSource, Repository } from 'typeorm';
import { Integration, IntegrationType, IntegrationStatus } from '../models/Integration';
import { IntegrationEvent, IntegrationEventType, IntegrationEventDirection, IntegrationEventStatus } from '../models/IntegrationEvent';
import { IntegrationOAuthToken } from '../models/IntegrationOAuthToken';
import { ServiceIntegration } from '../models/ServiceIntegration';
import { encryptCredential, decryptCredential } from './credential-encryption-service';
import { logger } from '../utils/logger';

export interface CreateIntegrationParams {
  orgId: string;
  type: IntegrationType;
  name: string;
  createdBy?: string;
  config?: Record<string, any>;
  features?: Record<string, boolean>;
}

export interface UpdateIntegrationParams {
  name?: string;
  config?: Record<string, any>;
  features?: Record<string, boolean>;
  status?: IntegrationStatus;
}

export class IntegrationService {
  private integrationRepo: Repository<Integration>;
  private eventRepo: Repository<IntegrationEvent>;
  private tokenRepo: Repository<IntegrationOAuthToken>;
  private serviceIntegrationRepo: Repository<ServiceIntegration>;

  constructor(dataSource: DataSource) {
    this.integrationRepo = dataSource.getRepository(Integration);
    this.eventRepo = dataSource.getRepository(IntegrationEvent);
    this.tokenRepo = dataSource.getRepository(IntegrationOAuthToken);
    this.serviceIntegrationRepo = dataSource.getRepository(ServiceIntegration);
  }

  // ==================== Integration CRUD ====================

  async createIntegration(params: CreateIntegrationParams): Promise<Integration> {
    const integration = this.integrationRepo.create({
      orgId: params.orgId,
      type: params.type,
      name: params.name,
      createdBy: params.createdBy,
      config: params.config || {},
      features: params.features || {},
      status: 'pending',
    });

    await this.integrationRepo.save(integration);
    logger.info(`Created integration ${integration.id} (${params.type}) for org ${params.orgId}`);

    return integration;
  }

  async getIntegration(id: string, orgId: string): Promise<Integration | null> {
    return this.integrationRepo.findOne({
      where: { id, orgId },
    });
  }

  async getIntegrationsByOrg(orgId: string, type?: IntegrationType): Promise<Integration[]> {
    const where: any = { orgId };
    if (type) {
      where.type = type;
    }
    return this.integrationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveIntegrationsByOrg(orgId: string, type?: IntegrationType): Promise<Integration[]> {
    const where: any = { orgId, status: 'active' };
    if (type) {
      where.type = type;
    }
    return this.integrationRepo.find({ where });
  }

  async updateIntegration(id: string, orgId: string, params: UpdateIntegrationParams): Promise<Integration | null> {
    const integration = await this.getIntegration(id, orgId);
    if (!integration) {
      return null;
    }

    if (params.name !== undefined) integration.name = params.name;
    if (params.config !== undefined) integration.config = { ...integration.config, ...params.config };
    if (params.features !== undefined) integration.features = { ...integration.features, ...params.features };
    if (params.status !== undefined) integration.status = params.status;

    await this.integrationRepo.save(integration);
    return integration;
  }

  async deleteIntegration(id: string, orgId: string): Promise<boolean> {
    const result = await this.integrationRepo.delete({ id, orgId });
    return (result.affected || 0) > 0;
  }

  async activateIntegration(id: string, orgId: string): Promise<Integration | null> {
    return this.updateIntegration(id, orgId, { status: 'active' });
  }

  async disableIntegration(id: string, orgId: string): Promise<Integration | null> {
    return this.updateIntegration(id, orgId, { status: 'disabled' });
  }

  // ==================== Token Management ====================

  async storeOAuthToken(
    integrationId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    scope?: string
  ): Promise<IntegrationOAuthToken> {
    // Encrypt tokens
    const accessTokenEncrypted = await encryptCredential(accessToken);
    const refreshTokenEncrypted = refreshToken ? await encryptCredential(refreshToken) : null;

    // Check if token exists
    let token = await this.tokenRepo.findOne({ where: { integrationId } });

    if (token) {
      token.accessTokenEncrypted = accessTokenEncrypted;
      token.refreshTokenEncrypted = refreshTokenEncrypted;
      token.expiresAt = expiresAt || null;
      token.scope = scope || null;
      token.lastRefreshedAt = new Date();
      token.refreshError = null;
    } else {
      token = this.tokenRepo.create({
        integrationId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt,
        scope,
      });
    }

    await this.tokenRepo.save(token);
    return token;
  }

  async getDecryptedAccessToken(integrationId: string): Promise<string | null> {
    const token = await this.tokenRepo.findOne({ where: { integrationId } });
    if (!token) return null;

    try {
      return await decryptCredential(token.accessTokenEncrypted);
    } catch (error) {
      logger.error(`Failed to decrypt token for integration ${integrationId}:`, error);
      return null;
    }
  }

  async getDecryptedRefreshToken(integrationId: string): Promise<string | null> {
    const token = await this.tokenRepo.findOne({ where: { integrationId } });
    if (!token?.refreshTokenEncrypted) return null;

    try {
      return await decryptCredential(token.refreshTokenEncrypted);
    } catch (error) {
      logger.error(`Failed to decrypt refresh token for integration ${integrationId}:`, error);
      return null;
    }
  }

  async deleteToken(integrationId: string): Promise<void> {
    await this.tokenRepo.delete({ integrationId });
  }

  // ==================== Slack-specific Methods ====================

  async setSlackBotToken(integrationId: string, orgId: string, botToken: string): Promise<Integration | null> {
    const integration = await this.getIntegration(integrationId, orgId);
    if (!integration || integration.type !== 'slack') {
      return null;
    }

    integration.slackBotTokenEncrypted = await encryptCredential(botToken);
    await this.integrationRepo.save(integration);
    return integration;
  }

  async getDecryptedSlackBotToken(integrationId: string): Promise<string | null> {
    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    if (!integration?.slackBotTokenEncrypted) return null;

    try {
      return await decryptCredential(integration.slackBotTokenEncrypted);
    } catch (error) {
      logger.error(`Failed to decrypt Slack bot token for integration ${integrationId}:`, error);
      return null;
    }
  }

  // ==================== Service Integration Mapping ====================

  async linkServiceToIntegration(
    serviceId: string,
    integrationId: string,
    configOverrides?: Record<string, any>
  ): Promise<ServiceIntegration> {
    let mapping = await this.serviceIntegrationRepo.findOne({
      where: { serviceId, integrationId },
    });

    if (mapping) {
      mapping.configOverrides = configOverrides || {};
      mapping.enabled = true;
    } else {
      mapping = this.serviceIntegrationRepo.create({
        serviceId,
        integrationId,
        configOverrides: configOverrides || {},
        enabled: true,
      });
    }

    await this.serviceIntegrationRepo.save(mapping);
    return mapping;
  }

  async unlinkServiceFromIntegration(serviceId: string, integrationId: string): Promise<boolean> {
    const result = await this.serviceIntegrationRepo.delete({ serviceId, integrationId });
    return (result.affected || 0) > 0;
  }

  async getServiceIntegrations(serviceId: string): Promise<ServiceIntegration[]> {
    return this.serviceIntegrationRepo.find({
      where: { serviceId, enabled: true },
      relations: ['integration'],
    });
  }

  async getIntegrationsForService(serviceId: string, type?: IntegrationType): Promise<Integration[]> {
    const query = this.serviceIntegrationRepo
      .createQueryBuilder('si')
      .innerJoinAndSelect('si.integration', 'i')
      .where('si.service_id = :serviceId', { serviceId })
      .andWhere('si.enabled = true')
      .andWhere('i.status = :status', { status: 'active' });

    if (type) {
      query.andWhere('i.type = :type', { type });
    }

    const mappings = await query.getMany();
    return mappings.map(m => m.integration);
  }

  // ==================== Event Logging ====================

  async logEvent(params: {
    integrationId: string;
    orgId: string;
    eventType: IntegrationEventType | string;
    direction?: IntegrationEventDirection;
    incidentId?: string;
    serviceId?: string;
    payload?: Record<string, any>;
    response?: Record<string, any>;
    status?: IntegrationEventStatus;
    errorMessage?: string;
    externalId?: string;
    externalUrl?: string;
  }): Promise<IntegrationEvent> {
    const event = this.eventRepo.create({
      integrationId: params.integrationId,
      orgId: params.orgId,
      eventType: params.eventType,
      direction: params.direction || 'outbound',
      incidentId: params.incidentId,
      serviceId: params.serviceId,
      payload: params.payload,
      response: params.response,
      status: params.status || 'success',
      errorMessage: params.errorMessage,
      externalId: params.externalId,
      externalUrl: params.externalUrl,
    });

    await this.eventRepo.save(event);
    return event;
  }

  async logError(
    integrationId: string,
    orgId: string,
    error: string,
    context?: Record<string, any>
  ): Promise<void> {
    // Log to events
    await this.logEvent({
      integrationId,
      orgId,
      eventType: 'error',
      status: 'failed',
      errorMessage: error,
      payload: context,
    });

    // Update integration error status
    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    if (integration) {
      integration.recordError(error);
      await this.integrationRepo.save(integration);
    }
  }

  async getRecentEvents(
    integrationId: string,
    limit: number = 50
  ): Promise<IntegrationEvent[]> {
    return this.eventRepo.find({
      where: { integrationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getEventsForIncident(incidentId: string): Promise<IntegrationEvent[]> {
    return this.eventRepo.find({
      where: { incidentId },
      order: { createdAt: 'DESC' },
      relations: ['integration'],
    });
  }

  // ==================== Helper Methods ====================

  async recordIntegrationSuccess(integrationId: string): Promise<void> {
    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    if (integration) {
      integration.clearError();
      await this.integrationRepo.save(integration);
    }
  }
}

// Singleton instance
let integrationServiceInstance: IntegrationService | null = null;

export function getIntegrationService(dataSource: DataSource): IntegrationService {
  if (!integrationServiceInstance) {
    integrationServiceInstance = new IntegrationService(dataSource);
  }
  return integrationServiceInstance;
}
