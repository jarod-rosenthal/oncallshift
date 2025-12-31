import { logger } from '../utils/logger';

/**
 * Opsgenie API response types
 */
interface OpsgeniePaginatedResponse<T> {
  data: T[];
  paging?: {
    next?: string;
    first?: string;
    last?: string;
  };
  totalCount?: number;
}

interface OpsgenieError {
  message: string;
  errors?: string[];
  requestId?: string;
}

interface FetchProgress {
  entity: string;
  fetched: number;
  total: number;
  status: 'fetching' | 'complete' | 'error';
  error?: string;
}

export interface OpsgenieExportOptions {
  apiKey: string;
  region?: 'us' | 'eu';
  includeUsers?: boolean;
  includeTeams?: boolean;
  includeSchedules?: boolean;
  includeEscalations?: boolean;
  includeServices?: boolean;
  includeHeartbeats?: boolean;
  includeMaintenanceWindows?: boolean;
  includeAlertPolicies?: boolean;
  includeAlerts?: boolean;
  alertDateRange?: {
    since?: string; // ISO date string
    until?: string; // ISO date string
  };
  onProgress?: (progress: FetchProgress) => void;
}

export interface OpsgenieExportResult {
  users?: any[];
  teams?: any[];
  schedules?: any[];
  escalations?: any[];
  services?: any[];
  heartbeats?: any[];
  maintenance_windows?: any[];
  alert_policies?: any[];
  alerts?: any[];
  errors: string[];
  fetchedAt: string;
}

/**
 * Service for fetching data from Opsgenie REST API
 */
export class OpsgenieExportService {
  private apiKey: string;
  private baseUrl: string;
  private rateLimitDelay: number = 100; // ms between requests
  private maxRetries: number = 3;

  constructor(options: { apiKey: string; region?: 'us' | 'eu' }) {
    this.apiKey = options.apiKey;
    // EU region uses different base URL
    this.baseUrl = options.region === 'eu'
      ? 'https://api.eu.opsgenie.com/v2'
      : 'https://api.opsgenie.com/v2';
  }

  /**
   * Fetch all data from Opsgenie account
   */
  async exportAll(options: OpsgenieExportOptions): Promise<OpsgenieExportResult> {
    const result: OpsgenieExportResult = {
      errors: [],
      fetchedAt: new Date().toISOString(),
    };

    const {
      includeUsers = true,
      includeTeams = true,
      includeSchedules = true,
      includeEscalations = true,
      includeServices = true,
      includeHeartbeats = true,
      includeMaintenanceWindows = true,
      includeAlertPolicies = false,
      includeAlerts = false,
      alertDateRange,
      onProgress,
    } = options;

    try {
      // Fetch users with contact methods
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

      // Fetch schedules with rotations
      if (includeSchedules) {
        onProgress?.({ entity: 'schedules', fetched: 0, total: 0, status: 'fetching' });
        const schedules = await this.fetchAllSchedules();
        result.schedules = schedules;
        onProgress?.({ entity: 'schedules', fetched: schedules.length, total: schedules.length, status: 'complete' });
      }

      // Fetch escalation policies
      if (includeEscalations) {
        onProgress?.({ entity: 'escalations', fetched: 0, total: 0, status: 'fetching' });
        const escalations = await this.fetchAllEscalations();
        result.escalations = escalations;
        onProgress?.({ entity: 'escalations', fetched: escalations.length, total: escalations.length, status: 'complete' });
      }

      // Fetch services (integrations)
      if (includeServices) {
        onProgress?.({ entity: 'services', fetched: 0, total: 0, status: 'fetching' });
        const services = await this.fetchAllServices();
        result.services = services;
        onProgress?.({ entity: 'services', fetched: services.length, total: services.length, status: 'complete' });
      }

      // Fetch heartbeats
      if (includeHeartbeats) {
        onProgress?.({ entity: 'heartbeats', fetched: 0, total: 0, status: 'fetching' });
        const heartbeats = await this.fetchAllHeartbeats();
        result.heartbeats = heartbeats;
        onProgress?.({ entity: 'heartbeats', fetched: heartbeats.length, total: heartbeats.length, status: 'complete' });
      }

      // Fetch maintenance windows
      if (includeMaintenanceWindows) {
        onProgress?.({ entity: 'maintenance_windows', fetched: 0, total: 0, status: 'fetching' });
        const windows = await this.fetchAllMaintenanceWindows();
        result.maintenance_windows = windows;
        onProgress?.({ entity: 'maintenance_windows', fetched: windows.length, total: windows.length, status: 'complete' });
      }

      // Fetch alert policies
      if (includeAlertPolicies) {
        onProgress?.({ entity: 'alert_policies', fetched: 0, total: 0, status: 'fetching' });
        const policies = await this.fetchAllAlertPolicies();
        result.alert_policies = policies;
        onProgress?.({ entity: 'alert_policies', fetched: policies.length, total: policies.length, status: 'complete' });
      }

      // Fetch historical alerts
      if (includeAlerts) {
        onProgress?.({ entity: 'alerts', fetched: 0, total: 0, status: 'fetching' });
        const alerts = await this.fetchAllAlerts(alertDateRange);
        result.alerts = alerts;
        onProgress?.({ entity: 'alerts', fetched: alerts.length, total: alerts.length, status: 'complete' });
      }

    } catch (error: any) {
      result.errors.push(`Export failed: ${error.message}`);
      logger.error('Opsgenie export failed:', error);
    }

    return result;
  }

  /**
   * Make an authenticated request to Opsgenie API with retry logic
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
          'Authorization': `GenieKey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('X-RateLimit-Period-In-Sec') || '5', 10);
          const delay = retryAfter * 1000 * Math.pow(2, retryCount);
          logger.warn(`Rate limited, retrying after ${delay}ms`);
          await this.delay(delay);
          return this.makeRequest<T>(endpoint, retryCount + 1);
        }
        throw new Error('Rate limit exceeded, max retries reached');
      }

      if (!response.ok) {
        const errorData = await response.json() as OpsgenieError;
        throw new Error(errorData.message || `HTTP ${response.status}`);
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
  private async fetchAllPaginated<T>(endpoint: string): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const paginatedEndpoint = `${endpoint}${separator}offset=${offset}&limit=${limit}`;

      const response = await this.makeRequest<OpsgeniePaginatedResponse<T>>(paginatedEndpoint);

      const items = response.data || [];
      allItems.push(...items);

      // Check if there are more pages
      hasMore = items.length === limit && (response.paging?.next !== undefined || items.length > 0);
      offset += limit;

      // Safety limit to prevent infinite loops
      if (offset > 10000) {
        logger.warn('Pagination limit reached, stopping fetch');
        break;
      }
    }

    return allItems;
  }

  /**
   * Fetch all users with contact methods and notification rules
   */
  async fetchAllUsers(): Promise<any[]> {
    const users = await this.fetchAllPaginated<any>('/users?expand=contact');

    // Fetch notification rules for each user
    for (const user of users) {
      try {
        const rulesResponse = await this.makeRequest<any>(
          `/users/${user.id}/notification-rules`
        );
        user.notificationRules = rulesResponse.data || [];
      } catch (error: any) {
        logger.warn(`Failed to fetch notification rules for user ${user.id}: ${error.message}`);
        user.notificationRules = [];
      }
    }

    logger.info(`Fetched ${users.length} users from Opsgenie`);
    return users;
  }

  /**
   * Fetch all teams with members
   */
  async fetchAllTeams(): Promise<any[]> {
    const teams = await this.fetchAllPaginated<any>('/teams');

    // Fetch members and details for each team
    for (const team of teams) {
      try {
        const detailResponse = await this.makeRequest<any>(`/teams/${team.id}?identifierType=id`);
        Object.assign(team, detailResponse.data);
      } catch (error: any) {
        logger.warn(`Failed to fetch details for team ${team.id}: ${error.message}`);
      }
    }

    logger.info(`Fetched ${teams.length} teams from Opsgenie`);
    return teams;
  }

  /**
   * Fetch all schedules with rotations
   */
  async fetchAllSchedules(): Promise<any[]> {
    const schedules = await this.fetchAllPaginated<any>('/schedules');

    // Fetch full schedule details including rotations
    for (const schedule of schedules) {
      try {
        const detailResponse = await this.makeRequest<any>(
          `/schedules/${schedule.id}?identifierType=id`
        );
        Object.assign(schedule, detailResponse.data);
      } catch (error: any) {
        logger.warn(`Failed to fetch schedule details for ${schedule.id}: ${error.message}`);
      }
    }

    logger.info(`Fetched ${schedules.length} schedules from Opsgenie`);
    return schedules;
  }

  /**
   * Fetch all escalation policies
   */
  async fetchAllEscalations(): Promise<any[]> {
    const escalations = await this.fetchAllPaginated<any>('/escalations');

    // Fetch full details for each escalation
    for (const escalation of escalations) {
      try {
        const detailResponse = await this.makeRequest<any>(
          `/escalations/${escalation.id}?identifierType=id`
        );
        Object.assign(escalation, detailResponse.data);
      } catch (error: any) {
        logger.warn(`Failed to fetch escalation details for ${escalation.id}: ${error.message}`);
      }
    }

    logger.info(`Fetched ${escalations.length} escalation policies from Opsgenie`);
    return escalations;
  }

  /**
   * Fetch all services (API integrations)
   */
  async fetchAllServices(): Promise<any[]> {
    try {
      const integrations = await this.fetchAllPaginated<any>('/integrations');

      // Map integrations to service-like structure
      const services = integrations.map((integration: any) => ({
        id: integration.id,
        name: integration.name,
        description: integration.type,
        teamId: integration.ownerTeam?.id,
        apiKey: integration.apiKey, // For zero-config migration
        enabled: integration.enabled,
        tags: integration.tags || [],
      }));

      logger.info(`Fetched ${services.length} services from Opsgenie`);
      return services;
    } catch (error: any) {
      logger.warn(`Failed to fetch integrations: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch all heartbeats
   */
  async fetchAllHeartbeats(): Promise<any[]> {
    try {
      const response = await this.makeRequest<any>('/heartbeats');
      const heartbeats = response.data || [];

      logger.info(`Fetched ${heartbeats.length} heartbeats from Opsgenie`);
      return heartbeats;
    } catch (error: any) {
      logger.warn(`Failed to fetch heartbeats: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch all maintenance windows
   */
  async fetchAllMaintenanceWindows(): Promise<any[]> {
    try {
      const response = await this.makeRequest<any>('/maintenance');
      const windows = response.data || [];

      logger.info(`Fetched ${windows.length} maintenance windows from Opsgenie`);
      return windows;
    } catch (error: any) {
      logger.warn(`Failed to fetch maintenance windows: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch all alert policies
   */
  async fetchAllAlertPolicies(): Promise<any[]> {
    try {
      const policies = await this.fetchAllPaginated<any>('/policies');

      logger.info(`Fetched ${policies.length} alert policies from Opsgenie`);
      return policies;
    } catch (error: any) {
      logger.warn(`Failed to fetch alert policies: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch all alerts with optional date range
   */
  async fetchAllAlerts(dateRange?: { since?: string; until?: string }): Promise<any[]> {
    try {
      // Build query with date range
      // Default to last 30 days if no range specified
      const until = dateRange?.until || new Date().toISOString();
      const since = dateRange?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Opsgenie uses createdAt for date filtering via query parameter
      const query = `createdAt >= ${new Date(since).getTime()} AND createdAt <= ${new Date(until).getTime()}`;
      const endpoint = `/alerts?query=${encodeURIComponent(query)}&order=desc&sort=createdAt`;

      const alerts = await this.fetchAllPaginated<any>(endpoint);

      // Fetch details for each alert including notes and logs
      for (const alert of alerts) {
        try {
          const detailResponse = await this.makeRequest<any>(`/alerts/${alert.id}?identifierType=id`);
          Object.assign(alert, detailResponse.data);

          // Fetch notes
          const notesResponse = await this.makeRequest<any>(`/alerts/${alert.id}/notes?identifierType=id`);
          alert.notes = notesResponse.data || [];

          // Fetch logs
          const logsResponse = await this.makeRequest<any>(`/alerts/${alert.id}/logs?identifierType=id`);
          alert.logs = logsResponse.data || [];
        } catch (error: any) {
          logger.warn(`Failed to fetch details for alert ${alert.id}: ${error.message}`);
          alert.notes = [];
          alert.logs = [];
        }
      }

      logger.info(`Fetched ${alerts.length} alerts from Opsgenie`);
      return alerts;
    } catch (error: any) {
      logger.warn(`Failed to fetch alerts: ${error.message}`);
      return [];
    }
  }

  /**
   * Test API connection and return account info
   */
  async testConnection(): Promise<{ success: boolean; account?: any; error?: string }> {
    try {
      const response = await this.makeRequest<any>('/account');
      return {
        success: true,
        account: response.data,
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
