/**
 * Semantic Import Prompts for Claude Vision
 *
 * Specialized prompts for extracting configuration data from screenshots
 * of PagerDuty, Opsgenie, and other incident management platforms.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ImportSourcePlatform = 'pagerduty' | 'opsgenie' | 'unknown';
export type ImportContentType = 'schedule' | 'escalation_policy' | 'team' | 'service' | 'user_list' | 'user' | 'integration' | 'auto_detect' | 'unknown';

// Alias for backward compatibility with vision-import-service
export type ImportSourceType = ImportSourcePlatform | 'victorops' | 'datadog' | 'splunk_oncall' | 'grafana_oncall';

export interface ExtractedUser {
  name: string;
  email?: string;
  role?: string;
  phone?: string;
}

export interface ExtractedScheduleShift {
  userName: string;
  userEmail?: string;
  startTime?: string;
  endTime?: string;
  day?: string;
  layerName?: string;
}

export interface ExtractedSchedule {
  name: string;
  description?: string;
  timezone?: string;
  rotationType?: 'daily' | 'weekly' | 'custom';
  handoffTime?: string;
  handoffDay?: number;
  shifts: ExtractedScheduleShift[];
  layers?: Array<{
    name: string;
    rotationType: 'daily' | 'weekly' | 'custom';
    rotationLength?: number;
    handoffTime?: string;
    handoffDay?: number;
    members: string[];
  }>;
}

export interface ExtractedEscalationStep {
  stepNumber: number;
  timeoutMinutes?: number;
  targets: Array<{
    type: 'user' | 'schedule' | 'team';
    name: string;
    email?: string;
  }>;
  notifyAll?: boolean;
}

export interface ExtractedEscalationPolicy {
  name: string;
  description?: string;
  repeatEnabled?: boolean;
  repeatCount?: number;
  steps: ExtractedEscalationStep[];
}

export interface ExtractedTeam {
  name: string;
  description?: string;
  members: Array<{
    name: string;
    email?: string;
    role?: 'manager' | 'member' | 'responder';
  }>;
}

export interface ExtractedService {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  escalationPolicyName?: string;
  teamName?: string;
  urgency?: 'high' | 'low' | 'dynamic';
  autoResolveTimeoutMinutes?: number;
  integrations?: string[];
}

// =============================================================================
// BASE EXTRACTION SCHEMA
// =============================================================================

/**
 * Base schema that all extraction responses must follow.
 * This ensures consistent structure for downstream processing.
 */
export const IMPORT_EXTRACTION_SCHEMA = `{
  "confidence": <number between 0.0 and 1.0>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "schedule" | "escalation_policy" | "team" | "service" | "user_list" | "unknown",
  "data": { ... content-specific data ... },
  "warnings": [<array of warning strings about ambiguous or missing data>],
  "suggestions": [<array of suggested follow-up actions or additional screenshots needed>],
  "rawTextExtracted": <optional string of raw text seen in the screenshot for debugging>
}`;

// =============================================================================
// UI PATTERN DETECTION HELPERS
// =============================================================================

const PAGERDUTY_UI_PATTERNS = `
PagerDuty UI Identification Patterns:
- Color scheme: Green primary color (#06AC38), dark navigation bar
- Logo: "PagerDuty" text or green P icon
- Navigation: "Services", "Incidents", "People", "Automation" in top nav
- Schedule view: Timeline with colored bars, "Final Schedule" section
- Escalation policies: "Level 1", "Level 2" numbering, "After X minutes" text
- User profiles: Circular avatars, role badges
- URLs containing: pagerduty.com, app.pagerduty.com
`;

const OPSGENIE_UI_PATTERNS = `
Opsgenie UI Identification Patterns:
- Color scheme: Blue primary color (#0052CC), Atlassian design system
- Logo: "Opsgenie" text or stylized alarm bell icon
- Navigation: Left sidebar with icons, "Teams", "Services", "Schedules"
- Schedule view: Calendar grid, "On-call Schedule" header, rotation timeline
- Escalation policies: "Step 1", "Step 2" numbering, "Wait X min" text
- User profiles: Square avatars with Atlassian styling
- URLs containing: app.opsgenie.com, atlassian.net
`;

const PLATFORM_DETECTION_INSTRUCTIONS = `
${PAGERDUTY_UI_PATTERNS}

${OPSGENIE_UI_PATTERNS}

If you cannot confidently identify the platform, set sourceDetected to "unknown" but still extract the data.
`;

// =============================================================================
// SCHEDULE EXTRACTION PROMPT
// =============================================================================

/**
 * Prompt for extracting on-call schedule data from screenshots.
 * Handles both calendar views and rotation configuration screens.
 */
export function getScheduleExtractionPrompt(): string {
  return `You are an expert at analyzing screenshots of on-call schedule interfaces from incident management platforms (PagerDuty, Opsgenie, etc.).

TASK: Extract all schedule configuration data visible in this screenshot.

${PLATFORM_DETECTION_INSTRUCTIONS}

WHAT TO EXTRACT:

1. Schedule Metadata:
   - Schedule name (look for headers, breadcrumbs, or titles)
   - Description (if visible)
   - Timezone (often shown near dates or in settings)

2. Rotation Configuration:
   - Rotation type: daily, weekly, or custom
   - Handoff time (when shifts change, e.g., "9:00 AM")
   - Handoff day (for weekly rotations, e.g., "Monday")
   - Rotation length (for custom rotations, e.g., "every 3 days")

3. Layer Information (if multi-layer schedule):
   - Layer names (e.g., "Primary", "Secondary", "Weekends")
   - Layer order/priority
   - Each layer's rotation settings

4. Schedule Members/Shifts:
   - For each visible shift or rotation slot:
     - User name
     - User email (if visible)
     - Start time/date
     - End time/date
     - Which layer they belong to (if applicable)

5. Override Information:
   - Any visible schedule overrides
   - Override user and time period

DATA HANDLING RULES:
- If a user name is partially visible, extract what you can and note it in warnings
- If dates are shown, preserve the format seen (we'll parse it later)
- If only a calendar view is shown (not configuration), extract the visible shift assignments
- For timeline views, extract user assignments per time slot
- If member list is truncated with "and X more", note the count in warnings

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on data clarity>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "schedule",
  "data": {
    "name": "<schedule name or null>",
    "description": "<description or null>",
    "timezone": "<timezone string or null>",
    "rotationType": "daily" | "weekly" | "custom" | null,
    "handoffTime": "<HH:mm format or null>",
    "handoffDay": <0-6 where 0=Sunday, or null>,
    "rotationLength": <number of days for custom, or null>,
    "shifts": [
      {
        "userName": "<name>",
        "userEmail": "<email or null>",
        "startTime": "<datetime string or null>",
        "endTime": "<datetime string or null>",
        "day": "<day name or null>",
        "layerName": "<layer name or null>"
      }
    ],
    "layers": [
      {
        "name": "<layer name>",
        "rotationType": "daily" | "weekly" | "custom",
        "rotationLength": <number or null>,
        "handoffTime": "<HH:mm or null>",
        "handoffDay": <0-6 or null>,
        "members": ["<user name 1>", "<user name 2>"]
      }
    ] | null
  },
  "warnings": ["<any data quality warnings>"],
  "suggestions": ["<suggestions for additional screenshots needed>"],
  "rawTextExtracted": "<optional: key text visible in screenshot>"
}

CONFIDENCE SCORING:
- 0.9-1.0: Clear schedule view with all configuration visible
- 0.7-0.9: Most data visible but some inference required
- 0.5-0.7: Partial data, significant inference needed
- Below 0.5: Very limited data, mostly guessing

Analyze the screenshot and extract all schedule data now.`;
}

// =============================================================================
// ESCALATION POLICY EXTRACTION PROMPT
// =============================================================================

/**
 * Prompt for extracting escalation policy configuration from screenshots.
 * Handles multi-step escalation rules with various target types.
 */
export function getEscalationExtractionPrompt(): string {
  return `You are an expert at analyzing screenshots of escalation policy interfaces from incident management platforms (PagerDuty, Opsgenie, etc.).

TASK: Extract all escalation policy configuration data visible in this screenshot.

${PLATFORM_DETECTION_INSTRUCTIONS}

WHAT TO EXTRACT:

1. Policy Metadata:
   - Policy name (look for headers, breadcrumbs)
   - Description (if visible)
   - Associated service(s) (if shown)

2. Escalation Steps (for each step/level):
   - Step/Level number (1, 2, 3, etc.)
   - Timeout before escalating to next step (in minutes)
   - Targets to notify:
     - Users (names and emails if visible)
     - Schedules (schedule names)
     - Teams (team names)
   - Whether to notify all targets simultaneously or round-robin

3. Repeat Settings:
   - Whether policy repeats after all levels exhausted
   - Number of repeat cycles (if limited)

PLATFORM-SPECIFIC PATTERNS:

PagerDuty:
- "Level 1", "Level 2" labels
- "Notify the following users or schedules"
- "If still unacknowledged after X minutes, escalate to Level N"
- "Repeat this policy X time(s)"

Opsgenie:
- "Step 1", "Step 2" labels
- "Notify" followed by user/schedule chips
- "Wait X min then" between steps
- "Repeat" toggle with count

DATA HANDLING RULES:
- Extract the timeout value and convert to minutes if needed
- If multiple users are shown, list all of them
- If a schedule is referenced by name, capture the name exactly
- If the policy references "on-call user", note this as a schedule reference
- Pay attention to "notify all" vs "round robin" indicators

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on data clarity>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "escalation_policy",
  "data": {
    "name": "<policy name or null>",
    "description": "<description or null>",
    "repeatEnabled": <true/false or null>,
    "repeatCount": <number or null, 0 means infinite>,
    "steps": [
      {
        "stepNumber": <1, 2, 3, etc.>,
        "timeoutMinutes": <number or null>,
        "targets": [
          {
            "type": "user" | "schedule" | "team",
            "name": "<name of user, schedule, or team>",
            "email": "<email if visible and type is user, else null>"
          }
        ],
        "notifyAll": <true if all targets notified simultaneously, false for round-robin, null if unknown>
      }
    ]
  },
  "warnings": ["<any data quality warnings>"],
  "suggestions": ["<suggestions for additional screenshots needed>"],
  "rawTextExtracted": "<optional: key text visible in screenshot>"
}

CONFIDENCE SCORING:
- 0.9-1.0: Clear policy view with all steps and targets visible
- 0.7-0.9: Most steps visible but some details unclear
- 0.5-0.7: Partial policy visible, some inference needed
- Below 0.5: Very limited data, mostly guessing

Analyze the screenshot and extract all escalation policy data now.`;
}

// =============================================================================
// TEAM EXTRACTION PROMPT
// =============================================================================

/**
 * Prompt for extracting team configuration and membership from screenshots.
 * Handles team lists, member views, and team settings pages.
 */
export function getTeamExtractionPrompt(): string {
  return `You are an expert at analyzing screenshots of team and user list interfaces from incident management platforms (PagerDuty, Opsgenie, etc.).

TASK: Extract all team configuration and membership data visible in this screenshot.

${PLATFORM_DETECTION_INSTRUCTIONS}

WHAT TO EXTRACT:

1. Team Metadata:
   - Team name
   - Description (if visible)
   - Parent team or hierarchy (if shown)

2. Team Members:
   - For each visible member:
     - Full name
     - Email address (if visible)
     - Role within team (manager, responder, member, observer)
     - Job title (if shown)

3. Team Settings (if visible):
   - Default escalation policy
   - Default schedule
   - Notification preferences

PLATFORM-SPECIFIC PATTERNS:

PagerDuty Teams:
- Team page shows "Members" tab with role badges
- Roles: "Team Manager", "Team Member", "Observer"
- Manager icon (star or crown) next to manager names
- "People" section in navigation

Opsgenie Teams:
- Team page shows member list with roles
- Roles shown as chips or badges
- "Team Manager" and "Member" designations
- May show on-call status next to names

DATA HANDLING RULES:
- Capture all visible team members
- If members list is paginated or truncated, note the total count if visible
- If emails are partially shown (e.g., j***@example.com), extract what's visible
- Distinguish between team roles and base roles
- If viewing a user list (not team view), set team name as null

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on data clarity>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "team",
  "data": {
    "name": "<team name or null if viewing user list>",
    "description": "<description or null>",
    "members": [
      {
        "name": "<full name>",
        "email": "<email or null>",
        "role": "manager" | "member" | "responder" | "observer" | null,
        "title": "<job title or null>"
      }
    ],
    "settings": {
      "defaultEscalationPolicyName": "<name or null>",
      "defaultScheduleName": "<name or null>"
    } | null
  },
  "warnings": ["<any data quality warnings>"],
  "suggestions": ["<suggestions for additional screenshots needed>"],
  "rawTextExtracted": "<optional: key text visible in screenshot>"
}

CONFIDENCE SCORING:
- 0.9-1.0: Clear team view with all members and roles visible
- 0.7-0.9: Most members visible but some details unclear
- 0.5-0.7: Partial member list, some roles not visible
- Below 0.5: Very limited data, mostly guessing

Analyze the screenshot and extract all team/member data now.`;
}

// =============================================================================
// SERVICE EXTRACTION PROMPT
// =============================================================================

/**
 * Prompt for extracting service configuration from screenshots.
 * Handles service lists, settings pages, and integration views.
 */
export function getServiceExtractionPrompt(): string {
  return `You are an expert at analyzing screenshots of service configuration interfaces from incident management platforms (PagerDuty, Opsgenie, etc.).

TASK: Extract all service configuration data visible in this screenshot.

${PLATFORM_DETECTION_INSTRUCTIONS}

WHAT TO EXTRACT:

1. Service Metadata:
   - Service name
   - Description
   - Status (active, inactive, disabled, maintenance mode)

2. Service Configuration:
   - Escalation policy name (linked policy)
   - Team owner/assignment
   - Urgency settings (high, low, dynamic/severity-based)
   - Support hours (if configured)
   - Auto-resolve timeout (if configured)

3. Integrations (if visible):
   - Integration types (email, webhook, API, specific tools)
   - Integration names
   - Integration URLs or keys (if shown and safe to extract)

PLATFORM-SPECIFIC PATTERNS:

PagerDuty Services:
- Service Directory page with status indicators
- Service details show "Escalation Policy" link
- "Integrations" tab with integration cards
- Status: green (active), yellow (warning), grey (disabled)
- "Service Settings" section with urgency rules

Opsgenie Services:
- Service list with health indicators
- "Service Details" page with configuration
- "Integrations" section in left nav
- Alert policies and routing rules

DATA HANDLING RULES:
- Extract service status from visual indicators (icons, colors)
- Capture the exact escalation policy name as shown
- For integration keys/URLs, only extract if they appear to be safe (not secrets)
- If viewing a service list, extract all visible services
- If viewing single service details, extract all configuration

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on data clarity>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "service",
  "data": {
    "services": [
      {
        "name": "<service name>",
        "description": "<description or null>",
        "status": "active" | "inactive" | "maintenance" | null,
        "escalationPolicyName": "<linked policy name or null>",
        "teamName": "<owning team name or null>",
        "urgency": "high" | "low" | "dynamic" | null,
        "autoResolveTimeoutMinutes": <number or null>,
        "integrations": ["<integration name 1>", "<integration name 2>"] | null
      }
    ]
  },
  "warnings": ["<any data quality warnings>"],
  "suggestions": ["<suggestions for additional screenshots needed>"],
  "rawTextExtracted": "<optional: key text visible in screenshot>"
}

CONFIDENCE SCORING:
- 0.9-1.0: Clear service view with all configuration visible
- 0.7-0.9: Most config visible but some settings unclear
- 0.5-0.7: Partial configuration, some inference needed
- Below 0.5: Very limited data, mostly guessing

Analyze the screenshot and extract all service data now.`;
}

// =============================================================================
// AUTO-DETECT PROMPT
// =============================================================================

/**
 * Prompt for auto-detecting content type and extracting relevant data.
 * Use when the content type is unknown or for generic screenshots.
 */
export function getAutoDetectPrompt(): string {
  return `You are an expert at analyzing screenshots of incident management platform interfaces (PagerDuty, Opsgenie, etc.).

TASK: Analyze this screenshot to determine what type of content it shows, identify the source platform, and extract all relevant configuration data.

${PLATFORM_DETECTION_INSTRUCTIONS}

STEP 1 - CONTENT TYPE DETECTION:
Determine what type of content is shown:

- SCHEDULE: On-call calendar, rotation timeline, schedule configuration
  Look for: Calendar grids, timeline bars, user rotation, "On-Call", "Schedule" text

- ESCALATION_POLICY: Escalation rules, notification steps
  Look for: "Level 1", "Step 1", timeout values, escalation chains

- TEAM: Team page, member list, team configuration
  Look for: "Team", member cards, role badges, user avatars in a list

- SERVICE: Service configuration, integration setup
  Look for: "Service", status indicators, escalation policy links, integration cards

- USER_LIST: General user directory (not team-specific)
  Look for: User listing page, global user search, people directory

STEP 2 - DATA EXTRACTION:
Based on the detected content type, extract all relevant data following the schemas below.

For SCHEDULE:
{
  "name": "<schedule name>",
  "timezone": "<timezone>",
  "rotationType": "daily" | "weekly" | "custom",
  "shifts": [{ "userName": "", "startTime": "", "endTime": "" }]
}

For ESCALATION_POLICY:
{
  "name": "<policy name>",
  "steps": [{ "stepNumber": 1, "timeoutMinutes": 5, "targets": [{ "type": "user", "name": "" }] }]
}

For TEAM:
{
  "name": "<team name>",
  "members": [{ "name": "", "email": "", "role": "" }]
}

For SERVICE:
{
  "services": [{ "name": "", "escalationPolicyName": "", "status": "" }]
}

For USER_LIST:
{
  "users": [{ "name": "", "email": "", "role": "" }]
}

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on detection and extraction clarity>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "contentType": "schedule" | "escalation_policy" | "team" | "service" | "user_list" | "unknown",
  "data": { <content-type-specific data as shown above> },
  "warnings": [
    "<warnings about unclear data>",
    "<warnings about content type ambiguity>"
  ],
  "suggestions": [
    "<suggestions for better screenshots>",
    "<suggestions for additional content to capture>"
  ],
  "rawTextExtracted": "<key text visible in screenshot for debugging>"
}

SPECIAL CASES:
- If the screenshot shows a navigation menu or login page, set contentType to "unknown" and describe what you see in warnings
- If multiple content types are visible (e.g., service list with escalation policy preview), extract the primary content and note the secondary in suggestions
- If the screenshot is blurry or partially cut off, extract what you can and explain limitations in warnings

Analyze the screenshot now.`;
}

// =============================================================================
// NATURAL LANGUAGE PROMPT
// =============================================================================

/**
 * Prompt for converting natural language descriptions into structured configuration.
 * Use when users describe their setup in plain text instead of providing screenshots.
 */
export function getNaturalLanguagePrompt(): string {
  return `You are an expert at converting natural language descriptions of incident management configurations into structured data.

TASK: Parse the user's description and extract structured configuration for:
- Schedules (on-call rotations)
- Escalation policies (notification chains)
- Teams (member groups)
- Services (monitored systems)

USER INPUT WILL BE TEXT DESCRIBING THEIR SETUP, such as:
- "We have a weekly rotation with John, Jane, and Bob. Shifts change on Mondays at 9 AM."
- "Our escalation policy first notifies the on-call person, then after 5 minutes pages the team lead, then after 10 more minutes pages the engineering manager."
- "The API team has 5 members: Alice (manager), Bob, Carol, Dave, and Eve."

INTERPRETATION GUIDELINES:

1. Schedule Descriptions:
   - "weekly rotation" -> rotationType: "weekly"
   - "daily rotation" -> rotationType: "daily"
   - "every N days" -> rotationType: "custom", rotationLength: N
   - "shifts change at X" -> handoffTime: X
   - "shifts change on Monday" -> handoffDay: 1
   - List of names -> members array

2. Escalation Policy Descriptions:
   - "first notify X" -> step 1 target
   - "after N minutes" -> previous step timeout
   - "then page Y" -> next step target
   - "on-call person" or "whoever is on-call" -> schedule reference
   - "team lead", "manager" -> user reference (note the role)

3. Team Descriptions:
   - "X team has Y members" -> team name and member count
   - "(manager)" or "who is the manager" -> role: manager
   - List of names -> members array

4. Service Descriptions:
   - Service name and description
   - "uses escalation policy X" -> escalationPolicyName
   - "owned by X team" -> teamName

DATA OUTPUT RULES:
- Create a separate entry for each distinct configuration item mentioned
- If information is ambiguous, make reasonable assumptions and note them in warnings
- Convert informal time references ("9 AM", "morning") to 24-hour format
- Convert day names to numbers (Sunday=0, Monday=1, etc.)
- If emails are not provided, leave them null (they can be matched later)

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "confidence": <0.0-1.0 based on clarity of description>,
  "sourceDetected": "unknown",
  "contentType": "natural_language_import",
  "data": {
    "schedules": [
      {
        "name": "<inferred or provided name>",
        "rotationType": "daily" | "weekly" | "custom",
        "rotationLength": <number or null>,
        "handoffTime": "<HH:mm>",
        "handoffDay": <0-6 or null>,
        "members": ["<name1>", "<name2>"]
      }
    ],
    "escalationPolicies": [
      {
        "name": "<inferred or provided name>",
        "steps": [
          {
            "stepNumber": 1,
            "timeoutMinutes": <number>,
            "targets": [{ "type": "user" | "schedule", "name": "<name>" }]
          }
        ]
      }
    ],
    "teams": [
      {
        "name": "<team name>",
        "members": [{ "name": "<name>", "role": "manager" | "member" | null }]
      }
    ],
    "services": [
      {
        "name": "<service name>",
        "escalationPolicyName": "<referenced policy or null>",
        "teamName": "<owning team or null>"
      }
    ]
  },
  "warnings": [
    "<assumptions made>",
    "<ambiguities that need clarification>"
  ],
  "suggestions": [
    "<additional information that would help>",
    "<clarifying questions>"
  ],
  "rawTextExtracted": "<the original description for reference>"
}

CONFIDENCE SCORING:
- 0.9-1.0: Clear, detailed description with all necessary information
- 0.7-0.9: Good description but some details need inference
- 0.5-0.7: Vague description, significant assumptions needed
- Below 0.5: Very unclear, mostly guessing

Parse the user's description and extract configuration data now.`;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the appropriate prompt based on content type.
 */
export function getPromptForContentType(contentType: ImportContentType | 'auto' | 'natural_language'): string {
  switch (contentType) {
    case 'schedule':
      return getScheduleExtractionPrompt();
    case 'escalation_policy':
      return getEscalationExtractionPrompt();
    case 'team':
    case 'user_list':
    case 'user':
      return getTeamExtractionPrompt();
    case 'service':
      return getServiceExtractionPrompt();
    case 'integration':
      return getServiceExtractionPrompt(); // Integrations are extracted alongside services
    case 'natural_language':
      return getNaturalLanguagePrompt();
    case 'auto':
    case 'auto_detect':
    case 'unknown':
    default:
      return getAutoDetectPrompt();
  }
}

/**
 * Alias for getPromptForContentType for backward compatibility.
 * Used by vision-import-service.ts
 */
export function getImportPrompt(contentType: ImportContentType): string {
  return getPromptForContentType(contentType);
}

/**
 * Exported natural language prompt constant for backward compatibility.
 * Used by vision-import-service.ts
 */
export const NATURAL_LANGUAGE_PROMPT = getNaturalLanguagePrompt();

/**
 * System prompt prefix for all import extraction calls.
 * Sets the context and behavior for the AI.
 */
export const IMPORT_SYSTEM_PREFIX = `You are a precise data extraction assistant for OnCallShift, an incident management platform.
Your job is to analyze screenshots or descriptions from other platforms (PagerDuty, Opsgenie, etc.) and extract configuration data.

Key behaviors:
1. Be precise - only extract data you can clearly see or confidently infer
2. Be thorough - capture all visible information, even partial data
3. Be honest - use confidence scores and warnings to communicate uncertainty
4. Be helpful - provide suggestions for additional information needed

Always respond with valid JSON matching the specified schema.
Never fabricate data - if something is unclear, set it to null and add a warning.
`;

/**
 * Validation prompt to verify extracted data makes sense.
 * Can be used as a second pass for quality assurance.
 */
export function getValidationPrompt(extractedData: Record<string, unknown>): string {
  return `Review this extracted configuration data for logical consistency and completeness:

\`\`\`json
${JSON.stringify(extractedData, null, 2)}
\`\`\`

Check for:
1. Logical inconsistencies (e.g., escalation step 3 but only 2 steps defined)
2. Missing required data (e.g., schedule with no members)
3. Implausible values (e.g., timeout of 0 minutes)
4. Potential data quality issues

Respond with:
{
  "isValid": true | false,
  "issues": ["<issue 1>", "<issue 2>"],
  "suggestedFixes": ["<fix 1>", "<fix 2>"],
  "confidenceAdjustment": <-0.2 to +0.1, adjustment to original confidence>
}`;
}

// =============================================================================
// BATCH PROCESSING PROMPTS
// =============================================================================

/**
 * Prompt for processing multiple screenshots as a batch.
 * Helps correlate data across multiple related screenshots.
 */
export function getBatchProcessingPrompt(screenshotCount: number): string {
  return `You are analyzing ${screenshotCount} related screenshots from an incident management platform.
These screenshots should be processed together to build a complete picture of the configuration.

For each screenshot, identify:
1. What type of content it shows
2. How it relates to the other screenshots
3. What unique data it provides

Then synthesize all the data into a unified import structure.

After processing all screenshots, provide:
{
  "overallConfidence": <0.0-1.0>,
  "sourceDetected": "pagerduty" | "opsgenie" | "unknown",
  "screenshotAnalysis": [
    {
      "screenshotIndex": <0-based index>,
      "contentType": "<detected type>",
      "relationship": "<how it relates to others>"
    }
  ],
  "unifiedData": {
    "schedules": [...],
    "escalationPolicies": [...],
    "teams": [...],
    "services": [...]
  },
  "crossReferences": [
    {
      "type": "escalation_policy_references_schedule",
      "source": "<policy name>",
      "target": "<schedule name>"
    }
  ],
  "warnings": [...],
  "suggestions": [...]
}

Process all screenshots and provide the unified import data.`;
}
