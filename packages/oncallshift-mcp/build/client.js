/**
 * OnCallShift API Client
 *
 * A wrapper around the OnCallShift REST API for use by the MCP server.
 */
export class OnCallShiftClient {
    apiKey;
    baseUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://oncallshift.com/api/v1';
    }
    /**
     * Make an authenticated request to the OnCallShift API
     */
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}`;
                }
                catch {
                    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                }
                return {
                    success: false,
                    error: errorMessage,
                };
            }
            const data = await response.json();
            return {
                success: true,
                data,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    // ============================================
    // Incidents
    // ============================================
    /**
     * List incidents with optional filters
     */
    async listIncidents(params) {
        const queryParams = new URLSearchParams();
        // API uses 'state' parameter
        if (params?.status)
            queryParams.set('state', params.status);
        if (params?.service_id)
            queryParams.set('service_id', params.service_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/incidents${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single incident by ID
     */
    async getIncident(incidentId) {
        return this.request('GET', `/incidents/${incidentId}`);
    }
    /**
     * Acknowledge an incident
     */
    async acknowledgeIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/acknowledge`);
    }
    /**
     * Resolve an incident
     */
    async resolveIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/resolve`);
    }
    /**
     * Reassign an incident to different users
     */
    async reassignIncident(incidentId, userIds) {
        return this.request('POST', `/incidents/${incidentId}/reassign`, {
            user_ids: userIds,
        });
    }
    /**
     * Escalate an incident to the next level
     */
    async escalateIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/escalate`);
    }
    /**
     * Add a note to an incident
     */
    async addIncidentNote(incidentId, content) {
        return this.request('POST', `/incidents/${incidentId}/notes`, { content });
    }
    // ============================================
    // Services
    // ============================================
    /**
     * List all services
     */
    async listServices(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/services${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single service by ID
     */
    async getService(serviceId) {
        return this.request('GET', `/services/${serviceId}`);
    }
    /**
     * Create a new service
     */
    async createService(service) {
        return this.request('POST', '/services', service);
    }
    // ============================================
    // Teams
    // ============================================
    /**
     * List all teams
     */
    async listTeams(params) {
        const queryParams = new URLSearchParams();
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/teams${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single team by ID
     */
    async getTeam(teamId) {
        return this.request('GET', `/teams/${teamId}`);
    }
    /**
     * Create a new team
     */
    async createTeam(team) {
        return this.request('POST', '/teams', team);
    }
    // ============================================
    // Schedules
    // ============================================
    /**
     * List all schedules
     */
    async listSchedules(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/schedules${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single schedule by ID
     */
    async getSchedule(scheduleId) {
        return this.request('GET', `/schedules/${scheduleId}`);
    }
    /**
     * Create a new schedule
     */
    async createSchedule(schedule) {
        return this.request('POST', '/schedules', schedule);
    }
    /**
     * Get current on-call users for a schedule
     */
    async getOnCallForSchedule(scheduleId) {
        return this.request('GET', `/schedules/${scheduleId}/oncall`);
    }
    // ============================================
    // On-Call
    // ============================================
    /**
     * Get all currently on-call users across all schedules/services
     */
    async getOnCallNow() {
        return this.request('GET', '/schedules/oncall');
    }
    // ============================================
    // Users
    // ============================================
    /**
     * List all users
     */
    async listUsers(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/users${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get current authenticated user
     */
    async getCurrentUser() {
        return this.request('GET', '/users/me');
    }
    // ============================================
    // Escalation Policies
    // ============================================
    /**
     * List all escalation policies
     */
    async listEscalationPolicies(params) {
        const queryParams = new URLSearchParams();
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/escalation-policies${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Create a new escalation policy
     */
    async createEscalationPolicy(policy) {
        return this.request('POST', '/escalation-policies', policy);
    }
    /**
     * Get a single escalation policy by ID
     */
    async getEscalationPolicy(policyId) {
        return this.request('GET', `/escalation-policies/${policyId}`);
    }
    // ============================================
    // User Management
    // ============================================
    /**
     * Invite a new user to the organization
     */
    async inviteUser(invitation) {
        return this.request('POST', '/users/invite', invitation);
    }
    /**
     * Add user to teams
     */
    async addUserToTeams(userId, teamIds) {
        return this.request('POST', `/users/${userId}/teams`, { team_ids: teamIds });
    }
    // ============================================
    // Runbooks
    // ============================================
    /**
     * List all runbooks
     */
    async listRunbooks(params) {
        const queryParams = new URLSearchParams();
        if (params?.service_id)
            queryParams.set('service_id', params.service_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/runbooks${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Create a new runbook
     */
    async createRunbook(runbook) {
        return this.request('POST', '/runbooks', runbook);
    }
    /**
     * Get a single runbook by ID
     */
    async getRunbook(runbookId) {
        return this.request('GET', `/runbooks/${runbookId}`);
    }
    // ============================================
    // Import/Export
    // ============================================
    /**
     * Import data from another platform (PagerDuty, Opsgenie)
     */
    async importFromPlatform(platform, data, options) {
        const endpoint = platform === 'pagerduty' ? '/import/pagerduty' : '/import/opsgenie';
        return this.request('POST', endpoint, {
            data,
            ...options,
        });
    }
    /**
     * Validate import data before importing (dry-run)
     */
    async validateImport(platform, data) {
        const endpoint = platform === 'pagerduty' ? '/import/pagerduty/validate' : '/import/opsgenie/validate';
        return this.request('POST', endpoint, { data });
    }
    // ============================================
    // Integrations
    // ============================================
    /**
     * List all integrations
     */
    async listIntegrations(params) {
        const queryParams = new URLSearchParams();
        if (params?.type)
            queryParams.set('type', params.type);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/integrations${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Create a new integration
     */
    async createIntegration(integration) {
        return this.request('POST', '/integrations', integration);
    }
    /**
     * Get a single integration by ID
     */
    async getIntegration(integrationId) {
        return this.request('GET', `/integrations/${integrationId}`);
    }
    /**
     * Link a service to an integration
     */
    async linkServiceToIntegration(integrationId, serviceId, configOverrides) {
        return this.request('POST', `/integrations/${integrationId}/services/${serviceId}`, {
            config_overrides: configOverrides,
        });
    }
    // ============================================
    // Analytics
    // ============================================
    /**
     * Get analytics overview with incident metrics
     */
    async getAnalyticsOverview(params) {
        const queryParams = new URLSearchParams();
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        const query = queryParams.toString();
        const endpoint = `/analytics/overview${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get analytics for a specific team
     */
    async getTeamAnalytics(teamId, params) {
        const queryParams = new URLSearchParams();
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        const query = queryParams.toString();
        const endpoint = `/analytics/teams/${teamId}${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get analytics for a specific user
     */
    async getUserAnalytics(userId, params) {
        const queryParams = new URLSearchParams();
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        const query = queryParams.toString();
        const endpoint = `/analytics/users/${userId}${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get top responders analytics
     */
    async getTopResponders(params) {
        const queryParams = new URLSearchParams();
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/analytics/top-responders${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get SLA compliance analytics
     */
    async getSlaAnalytics(params) {
        const queryParams = new URLSearchParams();
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        if (params?.ackTargetMinutes)
            queryParams.set('ackTargetMinutes', params.ackTargetMinutes.toString());
        if (params?.resolveTargetMinutes)
            queryParams.set('resolveTargetMinutes', params.resolveTargetMinutes.toString());
        const query = queryParams.toString();
        const endpoint = `/analytics/sla${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get incident metrics (alias for getAnalyticsOverview with grouping support)
     */
    async getIncidentMetrics(params) {
        // For now, use analytics overview and transform on client side
        // The backend could be extended to support groupBy in the future
        return this.getAnalyticsOverview({
            startDate: params?.startDate,
            endDate: params?.endDate,
        });
    }
}
//# sourceMappingURL=client.js.map