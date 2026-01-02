/**
 * OnCallShift MCP Tool Definitions
 *
 * This module defines all the tools available through the MCP server
 * for interacting with the OnCallShift platform.
 */
import { z } from 'zod';
import { OnCallShiftClient } from '../client.js';
/**
 * Tool definition structure for MCP
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Tool handler function type
 */
export type ToolHandler = (client: OnCallShiftClient, args: Record<string, unknown>) => Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}>;
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
    user_ids?: string[] | undefined;
    team_id?: string | undefined;
    description?: string | undefined;
}, {
    name: string;
    user_ids?: string[] | undefined;
    team_id?: string | undefined;
    description?: string | undefined;
    timezone?: string | undefined;
    rotation_type?: "daily" | "weekly" | undefined;
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
    content: string;
    incident_id: string;
}, {
    content: string;
    incident_id: string;
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
export declare const TOOL_DEFINITIONS: ToolDefinition[];
export declare const TOOL_HANDLERS: Record<string, ToolHandler>;
//# sourceMappingURL=index.d.ts.map