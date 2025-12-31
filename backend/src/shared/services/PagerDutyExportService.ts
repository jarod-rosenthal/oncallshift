import { logger } from '../utils/logger';

/**
 * PagerDuty API response types
 */
interface PagerDutyPaginatedResponse<T> {
  data?: T[];
  users?: T[];
  teams?: T[];
  schedules?: T[];
  escalation_policies?: T[];
  services?: T[];
  maintenance_windows?: T[];
  rulesets?: T[];
  more?: boolean;
  offset?: number;
  limit?: number;
  total?: number;
}

interface PagerDutyError {
  error: {
    message: string;
    code?: number;
  };
}

interface FetchProgress {
  entity: string;
  fetched: number;
  total: number;
  status: 'fetching' | 'complete' | 'error';
  error?: string;
}

export interface PagerDutyExportOptions {
  apiKey: string;
  subdomain?: string;
  includeUsers?: boolean;
  includeTeams?: boolean;
  includeSchedules?: boolean;
  includeEscalationPolicies?: boolean;
  includeServices?: boolean;
  includeMaintenanceWindows?: boolean;
  includeRoutingRules?: boolean;
  includeServiceDependencies?: boolean;
  includeIncidents?: boolean;
  incidentDateRange?: {
    since?: string; // ISO date string
    until?: string; // ISO date string
  };
  onProgress?: (progress: FetchProgress) => void;
}

export interface PagerDutyExportResult {
  users?: any[];
  teams?: any[];
  schedules?: any[];
  escalation_policies?: any[];
  services?: any[];
  maintenance_windows?: any[];
  routing_rules?: any[];
  service_dependencies?: any[];
  incidents?: any[];
  errors: string[];
  fetchedAt: string;
}

/**
 * Service for fetching data from PagerDuty REST API
 */
export class PagerDutyExportService {
  private apiKey: string;
  private baseUrl: string = 'https://api.pagerduty.com';
  private rateLimitDelay: number = 100; // ms between requests
  private maxRetries: number = 3;

  constructor(options: { apiKey: string; subdomain?: string }) {
    this.apiKey = options.apiKey;
  }

  /**
   * Fetch all data from PagerDuty account
   */
  async exportAll(options: PagerDutyExportOptions): Promise<PagerDutyExportResult> {
    const result: PagerDutyExportResult = {
      errors: [],
      fetchedAt: new Date().toISOString(),
    };

    const {
      includeUsers = true,
      includeTeams = true,
      includeSchedules = true,
      includeEscalationPolicies = true,
      includeServices = true,
      includeMaintenanceWindows = true,
      includeRoutingRules = false,
      includeServiceDependencies = false,
      includeIncidents = false,
      incidentDateRange,
      onProgress,
    } = options;

    try {
      // Fetch users with contact methods and notification rules
      if (includeUsers) {
        onProgress?.({ entity: 'users', fetched: 0, total: 0, status: 'fetching' });
        const users = await this.fetchAllUsers();
        result.users = users;
        onProgress?.({ entity: 'users', fetched: users.length, total: users.length, status: 'complete' });
      }

      // Fetch teams with members
      if (includeTeams) {
        onProgress?.({ entity: 'teams', fetched: 0, total: 0, status: 'fetching' });
        const teams = await this.fetchAllTeams();
        result.teams = teams;
        onProgress?.({ entity: 'teams', fetched: teams.length, total: teams.length, status: 'complete' });
      }

      // Fetch schedules with layers
      if (includeSchedules) {
        onProgress?.({ entity: 'schedules', fetched: 0, total: 0, status: 'fetching' });
        const schedules = await this.fetchAllSchedules();
        result.schedules = schedules;
        onProgress?.({ entity: 'schedules', fetched: schedules.length, total: schedules.length, status: 'complete' });
      }

      // Fetch escalation policies with rules
      if (includeEscalationPolicies) {
        onProgress?.({ entity: 'escalation_policies', fetched: 0, total: 0, status: 'fetching' });
        const policies = await this.fetchAllEscalationPolicies();
        result.escalation_policies = policies;
        onProgress?.({ entity: 'escalation_policies', fetched: policies.length, total: policies.length, status: 'complete' });
      }

      // Fetch services with integrations
      if (includeServices) {
        onProgress?.({ entity: 'services', fetched: 0, total: 0, status: 'fetching' });
        const services = await this.fetchAllServices();
        result.services = services;
        onProgress?.({ entity: 'services', fetched: services.length, total: services.length, status: 'complete' });
      }

      // Fetch maintenance windows
      if (includeMaintenanceWindows) {
        onProgress?.({ entity: 'maintenance_windows', fetched: 0, total: 0, status: 'fetching' });
        const windows = await this.fetchAllMaintenanceWindows();
        result.maintenance_windows = windows;
        onProgress?.({ entity: 'maintenance_windows', fetched: windows.length, total: windows.length, status: 'complete' });
      }

      // Fetch global event routing rules
      if (includeRoutingRules) {
        onProgress?.({ entity: 'routing_rules', fetched: 0, total: 0, status: 'fetching' });
        const rules = await this.fetchAllRoutingRules();
        result.routing_rules = rules;
        onProgress?.({ entity: 'routing_rules', fetched: rules.length, total: rules.length, status: 'complete' });
      }

      // Fetch service dependencies
      if (includeServiceDependencies && result.services) {
        onProgress?.({ entity: 'service_dependencies', fetched: 0, total: 0, status: 'fetching' });
        const dependencies = await this.fetchServiceDependencies(result.services);
        result.service_dependencies = dependencies;
        onProgress?.({ entity: 'service_dependencies', fetched: dependencies.length, total: dependencies.length, status: 'complete' });
      }

      // Fetch historical incidents
      if (includeIncidents) {
        onProgress?.({ entity: 'incidents', fetched: 0, total: 0, status: 'fetching' });
        const incidents = await this.fetchAllIncidents(incidentDateRange);
        result.incidents = incidents;
        onProgress?.({ entity: 'incidents', fetched: incidents.length, total: incidents.length, status: 'complete' });
      }

    } catch (error: any) {
      result.errors.push(`Export failed: ${error.message}`);
      logger.error('PagerDuty export failed:', error);
    }

    return result;
  }

  /**
   * Make an authenticated request to PagerDuty API with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pagerduty+json;version=2',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          const delay = retryAfter * 1000 * Math.pow(2, retryCount);
          logger.warn(`Rate limited, retrying after ${delay}ms`);
          await this.delay(delay);
          return this.makeRequest<T>(endpoint, retryCount + 1);
        }
        throw new Error('Rate limit exceeded, max retries reached');
      }

      if (!response.ok) {
        const errorData = await response.json() as PagerDutyError;
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      // Add small delay to avoid rate limiting
      await this.delay(this.rateLimitDelay);

      return response.json() as Promise<T>;
    } catch (error: any) {
      if (retryCount < this.maxRetries && error.code === 'ECONNRESET') {
        const delay = 1000 * Math.pow(2, retryCount);
        await this.delay(delay);
        return this.makeRequest<T>(endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Fetch all pages of a paginated resource
   */
  private async fetchAllPaginated<T>(
    endpoint: string,
    resourceKey: string
  ): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const paginatedEndpoint = `${endpoint}${separator}offset=${offset}&limit=${limit}`;

      const response = await this.makeRequest<PagerDutyPaginatedResponse<T>>(paginatedEndpoint);

      const items = (response as any)[resourceKey] || response.data || [];
      allItems.push(...items);

      hasMore = response.more === true;
      offset += limit;
    }

    return allItems;
  }

  /**
   * Fetch all users with contact methods and notification rules
   */
  async fetchAllUsers(): Promise<any[]> {
    const users = await this.fetchAllPaginated<any>(
      '/users?include[]=contact_methods&include[]=notification_rules',
      'users'
    );

    logger.info(`Fetched ${users.length} users from PagerDuty`);
    return users;
  }

  /**
   * Fetch all teams with members
   */
  async fetchAllTeams(): Promise<any[]> {
    const teams = await this.fetchAllPaginated<any>('/teams', 'teams');

    // Fetch members for each team
    for (const team of teams) {
      try {
        const membersResponse = await this.makeRequest<any>(`/teams/${team.id}/members`);
        team.members = membersResponse.members || [];
      } catch (error: any) {
        logger.warn(`Failed to fetch members for team ${team.id}: ${error.message}`);
        team.members = [];
      }
    }

    logger.info(`Fetched ${teams.length} teams from PagerDuty`);
    return teams;
  }

  /**
   * Fetch all schedules with layers
   */
  async fetchAllSchedules(): Promise<any[]> {
    const schedules = await this.fetchAllPaginated<any>('/schedules', 'schedules');

    // Fetch full schedule details including layers
    const detailedSchedules = [];
    for (const schedule of schedules) {
      try {
        const detailResponse = await this.makeRequest<any>(`/schedules/${schedule.id}`);
        detailedSchedules.push(detailResponse.schedule);
      } catch (error: any) {
        logger.warn(`Failed to fetch schedule details for ${schedule.id}: ${error.message}`);
        detailedSchedules.push(schedule);
      }
    }

    logger.info(`Fetched ${detailedSchedules.length} schedules from PagerDuty`);
    return detailedSchedules;
  }

  /**
   * Fetch all escalation policies with rules
   */
  async fetchAllEscalationPolicies(): Promise<any[]> {
    const policies = await this.fetchAllPaginated<any>(
      '/escalation_policies?include[]=targets',
      'escalation_policies'
    );

    logger.info(`Fetched ${policies.length} escalation policies from PagerDuty`);
    return policies;
  }

  /**
   * Fetch all services with integrations and tags
   */
  async fetchAllServices(): Promise<any[]> {
    const services = await this.fetchAllPaginated<any>(
      '/services?include[]=integrations&include[]=teams',
      'services'
    );

    // Fetch tags for each service
    for (const service of services) {
      try {
        const tagsResponse = await this.makeRequest<any>(`/services/${service.id}/tags`);
        service.tags = tagsResponse.tags || [];
      } catch (error: any) {
        // Tags API may not be available on all plans
        service.tags = [];
      }

      // Extract integration keys
      if (service.integrations) {
        for (const integration of service.integrations) {
          if (integration.integration_key) {
            service.integration_key = integration.integration_key;
            break;
          }
        }
      }
    }

    logger.info(`Fetched ${services.length} services from PagerDuty`);
    return services;
  }

  /**
   * Fetch all maintenance windows
   */
  async fetchAllMaintenanceWindows(): Promise<any[]> {
    // Fetch ongoing and future maintenance windows
    const windows = await this.fetchAllPaginated<any>(
      `/maintenance_windows?filter=ongoing_or_future`,
      'maintenance_windows'
    );

    logger.info(`Fetched ${windows.length} maintenance windows from PagerDuty`);
    return windows;
  }

  /**
   * Fetch global event routing rules (Event Orchestration)
   */
  async fetchAllRoutingRules(): Promise<any[]> {
    try {
      // Try to fetch Event Orchestration rules first
      const orchestrations = await this.fetchAllPaginated<any>(
        '/event_orchestrations',
        'orchestrations'
      );

      const allRules: any[] = [];
      for (const orch of orchestrations) {
        try {
          const rulesResponse = await this.makeRequest<any>(
            `/event_orchestrations/${orch.id}/router`
          );
          if (rulesResponse.orchestration_path?.sets) {
            for (const set of rulesResponse.orchestration_path.sets) {
              allRules.push(...(set.rules || []));
            }
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch rules for orchestration ${orch.id}: ${error.message}`);
        }
      }

      logger.info(`Fetched ${allRules.length} routing rules from PagerDuty`);
      return allRules;
    } catch (error: any) {
      // Event Orchestration may not be available, try legacy rulesets
      logger.warn('Event Orchestration not available, trying legacy rulesets');
      try {
        const rulesets = await this.fetchAllPaginated<any>('/rulesets', 'rulesets');
        const allRules: any[] = [];

        for (const ruleset of rulesets) {
          try {
            const rulesResponse = await this.makeRequest<any>(`/rulesets/${ruleset.id}/rules`);
            allRules.push(...(rulesResponse.rules || []));
          } catch (err: any) {
            logger.warn(`Failed to fetch rules for ruleset ${ruleset.id}: ${err.message}`);
          }
        }

        return allRules;
      } catch (rulesetError: any) {
        logger.warn('Legacy rulesets also not available');
        return [];
      }
    }
  }

  /**
   * Fetch service dependencies
   */
  async fetchServiceDependencies(services: any[]): Promise<any[]> {
    const allDependencies: any[] = [];

    for (const service of services) {
      try {
        const response = await this.makeRequest<any>(
          `/service_dependencies/technical_services/${service.id}`
        );
        allDependencies.push(...(response.relationships || []));
      } catch (error: any) {
        // Service dependencies API may not be available on all plans
        logger.debug(`No dependencies for service ${service.id}`);
      }
    }

    logger.info(`Fetched ${allDependencies.length} service dependencies from PagerDuty`);
    return allDependencies;
  }

  /**
   * Fetch all incidents with optional date range
   */
  async fetchAllIncidents(dateRange?: { since?: string; until?: string }): Promise<any[]> {
    // Build query parameters
    let endpoint = '/incidents?include[]=alerts&include[]=first_trigger_log_entries';

    // Default to last 30 days if no range specified
    const until = dateRange?.until || new Date().toISOString();
    const since = dateRange?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    endpoint += `&since=${since}&until=${until}`;

    const incidents = await this.fetchAllPaginated<any>(endpoint, 'incidents');

    // Fetch log entries (notes/events) for each incident
    for (const incident of incidents) {
      try {
        const logResponse = await this.makeRequest<any>(`/incidents/${incident.id}/log_entries`);
        incident.log_entries = logResponse.log_entries || [];

        // Also fetch notes
        const notesResponse = await this.makeRequest<any>(`/incidents/${incident.id}/notes`);
        incident.notes = notesResponse.notes || [];
      } catch (error: any) {
        logger.warn(`Failed to fetch details for incident ${incident.id}: ${error.message}`);
        incident.log_entries = [];
        incident.notes = [];
      }
    }

    logger.info(`Fetched ${incidents.length} incidents from PagerDuty`);
    return incidents;
  }

  /**
   * Test API connection and return account info
   */
  async testConnection(): Promise<{ success: boolean; account?: any; error?: string }> {
    try {
      const response = await this.makeRequest<any>('/abilities');
      return {
        success: true,
        account: {
          abilities: response.abilities,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
