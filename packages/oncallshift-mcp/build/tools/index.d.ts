/**
 * OnCallShift MCP Tool Definitions
 *
 * This module defines all the tools available through the MCP server
 * for interacting with the OnCallShift platform.
 */
import { z } from 'zod';
import type { OnCallShiftClient } from '../client.js';
export interface ToolContent {
    type: 'text';
    text: string;
}
export interface ToolResponse {
    isError?: boolean;
    content: ToolContent[];
}
export type ToolHandler = (client: OnCallShiftClient, args: Record<string, unknown>) => Promise<ToolResponse>;
export declare const GetOnCallNowSchema: z.ZodObject<{
    service_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    service_id?: string | undefined;
}, {
    service_id?: string | undefined;
}>;
export declare const ListIncidentsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["triggered", "acknowledged", "resolved"]>>;
    service_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "triggered" | "acknowledged" | "resolved" | undefined;
    service_id?: string | undefined;
}, {
    status?: "triggered" | "acknowledged" | "resolved" | undefined;
    service_id?: string | undefined;
    limit?: number | undefined;
}>;
export declare const ListServicesSchema: z.ZodObject<{
    team_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    team_id?: string | undefined;
}, {
    limit?: number | undefined;
    team_id?: string | undefined;
}>;
export declare const AcknowledgeIncidentSchema: z.ZodObject<{
    incident_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
}, {
    incident_id: string;
}>;
export declare const ResolveIncidentSchema: z.ZodObject<{
    incident_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
}, {
    incident_id: string;
}>;
export declare const CreateTeamSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const SetupScheduleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    team_id: z.ZodOptional<z.ZodString>;
    rotation_type: z.ZodDefault<z.ZodEnum<["daily", "weekly"]>>;
    user_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    timezone: string;
    rotation_type: "daily" | "weekly";
    team_id?: string | undefined;
    description?: string | undefined;
    user_ids?: string[] | undefined;
}, {
    name: string;
    team_id?: string | undefined;
    description?: string | undefined;
    timezone?: string | undefined;
    rotation_type?: "daily" | "weekly" | undefined;
    user_ids?: string[] | undefined;
}>;
export declare const GetIncidentSchema: z.ZodObject<{
    incident_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
}, {
    incident_id: string;
}>;
export declare const EscalateIncidentSchema: z.ZodObject<{
    incident_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
}, {
    incident_id: string;
}>;
export declare const AddIncidentNoteSchema: z.ZodObject<{
    incident_id: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
    content: string;
}, {
    incident_id: string;
    content: string;
}>;
export declare const ListTeamsSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
}, {
    limit?: number | undefined;
}>;
export declare const ListSchedulesSchema: z.ZodObject<{
    team_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    team_id?: string | undefined;
}, {
    limit?: number | undefined;
    team_id?: string | undefined;
}>;
export declare const CreateEscalationPolicySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    service_name: z.ZodOptional<z.ZodString>;
    steps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        delay_minutes: z.ZodNumber;
        target_type: z.ZodEnum<["user", "schedule"]>;
        target_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        delay_minutes: number;
        target_type: "user" | "schedule";
        target_id: string;
    }, {
        delay_minutes: number;
        target_type: "user" | "schedule";
        target_id: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    service_name?: string | undefined;
    steps?: {
        delay_minutes: number;
        target_type: "user" | "schedule";
        target_id: string;
    }[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    service_name?: string | undefined;
    steps?: {
        delay_minutes: number;
        target_type: "user" | "schedule";
        target_id: string;
    }[] | undefined;
}>;
export declare const CreateServiceSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    escalation_policy_id: z.ZodOptional<z.ZodString>;
    team_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    team_id?: string | undefined;
    description?: string | undefined;
    escalation_policy_id?: string | undefined;
}, {
    name: string;
    team_id?: string | undefined;
    description?: string | undefined;
    escalation_policy_id?: string | undefined;
}>;
export declare const InviteUserSchema: z.ZodObject<{
    email: z.ZodString;
    full_name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["admin", "user"]>>;
    team_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    email: string;
    full_name: string;
    role: "user" | "admin";
    team_ids?: string[] | undefined;
}, {
    email: string;
    full_name: string;
    role?: "user" | "admin" | undefined;
    team_ids?: string[] | undefined;
}>;
export declare const CreateRunbookSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    service_name: z.ZodOptional<z.ZodString>;
    steps: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    steps: string;
    description?: string | undefined;
    service_name?: string | undefined;
}, {
    name: string;
    steps: string;
    description?: string | undefined;
    service_name?: string | undefined;
}>;
export declare const ImportFromPlatformSchema: z.ZodObject<{
    platform: z.ZodEnum<["pagerduty", "opsgenie"]>;
    export_data: z.ZodUnknown;
    preserve_keys: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    dry_run: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    platform: "pagerduty" | "opsgenie";
    export_data?: unknown;
    preserve_keys?: boolean | undefined;
    dry_run?: boolean | undefined;
}, {
    platform: "pagerduty" | "opsgenie";
    export_data?: unknown;
    preserve_keys?: boolean | undefined;
    dry_run?: boolean | undefined;
}>;
export declare const ConnectIntegrationSchema: z.ZodObject<{
    integration_type: z.ZodEnum<["slack", "datadog", "cloudwatch", "prometheus", "jira", "github"]>;
    name: z.ZodString;
    configuration: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    integration_type: "slack" | "jira" | "datadog" | "cloudwatch" | "prometheus" | "github";
    configuration?: Record<string, unknown> | undefined;
}, {
    name: string;
    integration_type: "slack" | "jira" | "datadog" | "cloudwatch" | "prometheus" | "github";
    configuration?: Record<string, unknown> | undefined;
}>;
export declare const ListUsersSchema: z.ZodObject<{
    team_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    team_id?: string | undefined;
}, {
    limit?: number | undefined;
    team_id?: string | undefined;
}>;
export declare const GetUserSchema: z.ZodObject<{
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id: string;
}, {
    user_id: string;
}>;
export declare const ListEscalationPoliciesSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
}, {
    limit?: number | undefined;
}>;
export declare const GetEscalationPolicySchema: z.ZodObject<{
    escalation_policy_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    escalation_policy_id: string;
}, {
    escalation_policy_id: string;
}>;
export declare const AddTeamMemberSchema: z.ZodObject<{
    team_id: z.ZodString;
    user_id: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["manager", "member"]>>;
}, "strip", z.ZodTypeAny, {
    team_id: string;
    role: "manager" | "member";
    user_id: string;
}, {
    team_id: string;
    user_id: string;
    role?: "manager" | "member" | undefined;
}>;
export declare const RemoveTeamMemberSchema: z.ZodObject<{
    team_id: z.ZodString;
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    team_id: string;
    user_id: string;
}, {
    team_id: string;
    user_id: string;
}>;
export declare const CreateScheduleOverrideSchema: z.ZodObject<{
    schedule_id: z.ZodString;
    user_id: z.ZodString;
    start_time: z.ZodString;
    end_time: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    schedule_id: string;
    start_time: string;
    end_time: string;
}, {
    user_id: string;
    schedule_id: string;
    start_time: string;
    end_time: string;
}>;
export declare const CreateIncidentSchema: z.ZodObject<{
    title: z.ZodString;
    service_id: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["critical", "error", "warning", "info"]>>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    service_id: string;
    severity: "error" | "critical" | "warning" | "info";
    title: string;
    description?: string | undefined;
}, {
    service_id: string;
    title: string;
    severity?: "error" | "critical" | "warning" | "info" | undefined;
    description?: string | undefined;
}>;
export declare const AddRespondersSchema: z.ZodObject<{
    incident_id: z.ZodString;
    user_ids: z.ZodArray<z.ZodString, "many">;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    incident_id: string;
    user_ids: string[];
    message?: string | undefined;
}, {
    incident_id: string;
    user_ids: string[];
    message?: string | undefined;
}>;
export declare const TestPagerDutyConnectionSchema: z.ZodObject<{
    api_key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    api_key: string;
}, {
    api_key: string;
}>;
export declare const TestOpsgenieConnectionSchema: z.ZodObject<{
    api_key: z.ZodString;
    region: z.ZodDefault<z.ZodEnum<["us", "eu"]>>;
}, "strip", z.ZodTypeAny, {
    api_key: string;
    region: "us" | "eu";
}, {
    api_key: string;
    region?: "us" | "eu" | undefined;
}>;
export declare const FetchPagerDutyConfigSchema: z.ZodObject<{
    api_key: z.ZodString;
    include: z.ZodOptional<z.ZodArray<z.ZodEnum<["users", "teams", "schedules", "escalation_policies", "services"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    api_key: string;
    include?: ("teams" | "users" | "schedules" | "escalation_policies" | "services")[] | undefined;
}, {
    api_key: string;
    include?: ("teams" | "users" | "schedules" | "escalation_policies" | "services")[] | undefined;
}>;
export declare const FetchOpsgenieConfigSchema: z.ZodObject<{
    api_key: z.ZodString;
    region: z.ZodDefault<z.ZodEnum<["us", "eu"]>>;
}, "strip", z.ZodTypeAny, {
    api_key: string;
    region: "us" | "eu";
}, {
    api_key: string;
    region?: "us" | "eu" | undefined;
}>;
export declare const MigrateFromMcpSchema: z.ZodObject<{
    source: z.ZodEnum<["pagerduty", "opsgenie"]>;
    data: z.ZodObject<{
        users: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        teams: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        schedules: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        escalation_policies: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        services: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    }, "strip", z.ZodTypeAny, {
        teams?: unknown[] | undefined;
        users?: unknown[] | undefined;
        schedules?: unknown[] | undefined;
        escalation_policies?: unknown[] | undefined;
        services?: unknown[] | undefined;
    }, {
        teams?: unknown[] | undefined;
        users?: unknown[] | undefined;
        schedules?: unknown[] | undefined;
        escalation_policies?: unknown[] | undefined;
        services?: unknown[] | undefined;
    }>;
    options: z.ZodOptional<z.ZodObject<{
        dry_run: z.ZodDefault<z.ZodBoolean>;
        invite_users: z.ZodDefault<z.ZodBoolean>;
        preserve_ids: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        dry_run: boolean;
        invite_users: boolean;
        preserve_ids: boolean;
    }, {
        dry_run?: boolean | undefined;
        invite_users?: boolean | undefined;
        preserve_ids?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    data: {
        teams?: unknown[] | undefined;
        users?: unknown[] | undefined;
        schedules?: unknown[] | undefined;
        escalation_policies?: unknown[] | undefined;
        services?: unknown[] | undefined;
    };
    source: "pagerduty" | "opsgenie";
    options?: {
        dry_run: boolean;
        invite_users: boolean;
        preserve_ids: boolean;
    } | undefined;
}, {
    data: {
        teams?: unknown[] | undefined;
        users?: unknown[] | undefined;
        schedules?: unknown[] | undefined;
        escalation_policies?: unknown[] | undefined;
        services?: unknown[] | undefined;
    };
    source: "pagerduty" | "opsgenie";
    options?: {
        dry_run?: boolean | undefined;
        invite_users?: boolean | undefined;
        preserve_ids?: boolean | undefined;
    } | undefined;
}>;
export declare const TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            service_id: {
                type: string;
                description: string;
            };
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            service_id: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            incident_id: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            team_id: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            incident_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            incident_id: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            team_id?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            limit: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            timezone: {
                type: string;
                description: string;
            };
            team_id: {
                type: string;
                description: string;
            };
            rotation_type: {
                type: string;
                enum: string[];
                description: string;
            };
            user_ids: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            content?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            service_name: {
                type: string;
                description: string;
            };
            steps: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        delay_minutes: {
                            type: string;
                            description: string;
                        };
                        target_type: {
                            type: string;
                            enum: string[];
                        };
                        target_id: {
                            type: string;
                            description: string;
                        };
                    };
                };
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            escalation_policy_id: {
                type: string;
                description: string;
            };
            team_id: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            content?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            email: {
                type: string;
                description: string;
            };
            full_name: {
                type: string;
                description: string;
            };
            role: {
                type: string;
                enum: string[];
                description: string;
            };
            team_ids: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            service_name: {
                type: string;
                description: string;
            };
            steps: {
                type: string;
                description: string;
                items?: undefined;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            platform: {
                type: string;
                enum: string[];
                description: string;
            };
            export_data: {
                type: string;
                description: string;
            };
            preserve_keys: {
                type: string;
                description: string;
            };
            dry_run: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            integration_type: {
                type: string;
                enum: string[];
                description: string;
            };
            name: {
                type: string;
                description: string;
            };
            configuration: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            user_id: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            escalation_policy_id: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            team_id: {
                type: string;
                description: string;
            };
            user_id: {
                type: string;
                description: string;
            };
            role: {
                type: string;
                enum: string[];
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            team_id: {
                type: string;
                description: string;
            };
            user_id: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            schedule_id: {
                type: string;
                description: string;
            };
            user_id: {
                type: string;
                description: string;
            };
            start_time: {
                type: string;
                description: string;
            };
            end_time: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            title: {
                type: string;
                description: string;
            };
            service_id: {
                type: string;
                description: string;
            };
            severity: {
                type: string;
                enum: string[];
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            incident_id: {
                type: string;
                description: string;
            };
            user_ids: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            api_key: {
                type: string;
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            region?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            api_key: {
                type: string;
                description: string;
            };
            region: {
                type: string;
                enum: string[];
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            include?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            api_key: {
                type: string;
                description: string;
            };
            include: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
                description: string;
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            region?: undefined;
            source?: undefined;
            data?: undefined;
            options?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            source: {
                type: string;
                enum: string[];
                description: string;
            };
            data: {
                type: string;
                description: string;
                properties: {
                    users: {
                        type: string;
                        description: string;
                    };
                    teams: {
                        type: string;
                        description: string;
                    };
                    schedules: {
                        type: string;
                        description: string;
                    };
                    escalation_policies: {
                        type: string;
                        description: string;
                    };
                    services: {
                        type: string;
                        description: string;
                    };
                };
            };
            options: {
                type: string;
                properties: {
                    dry_run: {
                        type: string;
                        description: string;
                    };
                    invite_users: {
                        type: string;
                        description: string;
                    };
                    preserve_ids: {
                        type: string;
                        description: string;
                    };
                };
            };
            service_id?: undefined;
            status?: undefined;
            limit?: undefined;
            incident_id?: undefined;
            team_id?: undefined;
            content?: undefined;
            name?: undefined;
            description?: undefined;
            timezone?: undefined;
            rotation_type?: undefined;
            user_ids?: undefined;
            service_name?: undefined;
            steps?: undefined;
            escalation_policy_id?: undefined;
            email?: undefined;
            full_name?: undefined;
            role?: undefined;
            team_ids?: undefined;
            platform?: undefined;
            export_data?: undefined;
            preserve_keys?: undefined;
            dry_run?: undefined;
            integration_type?: undefined;
            configuration?: undefined;
            user_id?: undefined;
            schedule_id?: undefined;
            start_time?: undefined;
            end_time?: undefined;
            title?: undefined;
            severity?: undefined;
            message?: undefined;
            api_key?: undefined;
            region?: undefined;
            include?: undefined;
        };
        required: string[];
    };
})[];
export declare const TOOL_HANDLERS: Record<string, ToolHandler>;
//# sourceMappingURL=index.d.ts.map