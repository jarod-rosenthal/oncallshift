# Migration Implementation Guide

## Overview

This document provides detailed implementation specifications for the client-side migration feature, enabling users to migrate from PagerDuty and Opsgenie to OnCallShift without server-side API calls.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Experience Flow](#user-experience-flow)
3. [API Key Creation Guide](#api-key-creation-guide)
4. [Browser-Based Fetch Client](#browser-based-fetch-client)
5. [Bookmarklet Implementation](#bookmarklet-implementation)
6. [File Upload Fallback](#file-upload-fallback)
7. [Entity Selection](#entity-selection)
8. [Error Handling](#error-handling)
9. [Security Considerations](#security-considerations)
10. [Testing Plan](#testing-plan)

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                  │
│                                                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐   │
│  │ Import       │───>│ PagerDuty       │───>│ PagerDuty API            │   │
│  │ Wizard UI    │    │ Browser Client  │    │ (api.pagerduty.com)      │   │
│  └──────────────┘    └─────────────────┘    └──────────────────────────┘   │
│         │                    │                                              │
│         │                    ▼                                              │
│         │            ┌─────────────────┐                                    │
│         │            │ Collected Data  │                                    │
│         │            │ (in memory)     │                                    │
│         │            └─────────────────┘                                    │
│         │                    │                                              │
│         ▼                    ▼                                              │
│  ┌──────────────────────────────────────┐                                   │
│  │ Preview & Confirmation               │                                   │
│  └──────────────────────────────────────┘                                   │
│                      │                                                       │
└──────────────────────┼───────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ OnCallShift API │
              │ POST /import    │
              └─────────────────┘
```

### Key Principles

1. **API keys never leave the browser** - stored in memory only, never sent to our backend
2. **All PagerDuty/Opsgenie API calls originate from user's IP** - impossible to block
3. **Data only sent to OnCallShift after user confirmation** - full transparency
4. **Multiple fallback options** - bookmarklet, file upload, CLI

---

## User Experience Flow

### Step 1: Platform Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 1 of 5: Select Source Platform                           │
│  ─────────────────────────────────────                          │
│                                                                 │
│  Choose the platform you're migrating from:                    │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │                         │  │                         │      │
│  │     📟 PagerDuty        │  │     🔔 Opsgenie         │      │
│  │                         │  │                         │      │
│  │  Industry standard for  │  │  Atlassian's incident   │      │
│  │  incident management    │  │  management solution    │      │
│  │                         │  │                         │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│                                              [Continue →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**
- Radio button selection (only one can be selected)
- Continue button disabled until selection made
- Store selection in component state: `source: 'pagerduty' | 'opsgenie'`

---

### Step 2: API Key Entry

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 2 of 5: Connect to PagerDuty                              │
│  ─────────────────────────────────────                          │
│                                                                 │
│  Do you have a PagerDuty API key?                               │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  ✓ Yes, I have one      │  │    No, help me create   │      │
│  │                         │  │    one (30 seconds)     │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ════════════════════════════════════════════════════════════  │
│                                                                 │
│  [If "Yes" selected:]                                          │
│                                                                 │
│  Enter your API key:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ••••••••••••••••••••••••••••••••••••                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  🔒 Your key stays in your browser and is never sent to us    │
│                                                                 │
│  [Test Connection]                                              │
│                                                                 │
│  ✓ Connected! Found: 12 users, 3 teams, 5 schedules            │
│                                                                 │
│                                    [← Back]  [Continue →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**If "No, help me create one" is selected:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 2 of 5: Create API Key                                    │
│  ─────────────────────────────────────                          │
│                                                                 │
│  Let's create a PagerDuty API key. This takes about 30 seconds. │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  1. Click the button below to open PagerDuty settings  │   │
│  │                                                         │   │
│  │     [Open PagerDuty API Settings ↗]                    │   │
│  │                                                         │   │
│  │  2. Click "Create New API Key"                         │   │
│  │                                                         │   │
│  │  3. Enter these settings:                              │   │
│  │     • Description: "OnCallShift Migration"             │   │
│  │     • Read-only access: Yes (recommended)              │   │
│  │                                                         │   │
│  │  4. Click "Create Key"                                 │   │
│  │                                                         │   │
│  │  5. Copy the key (you'll only see it once!)            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     [Screenshot/GIF here]               │   │
│  │                  Showing the exact steps                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Ready? Paste your API key here:                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Test Connection]                                              │
│                                                                 │
│                                    [← Back]  [Continue →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**

```typescript
interface Step2State {
  hasKey: boolean | null;
  apiKey: string;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
  connectionError: string | null;
  discoveredEntities: {
    users: number;
    teams: number;
    schedules: number;
    escalationPolicies: number;
    services: number;
  } | null;
}

// Deep links for API key creation
const API_KEY_URLS = {
  pagerduty: {
    // User token - works for any user
    userToken: 'https://YOUR_SUBDOMAIN.pagerduty.com/users/me',
    // Note: We need to ask for subdomain or detect it
    // Alternative: Generic URL that redirects
    generic: 'https://pagerduty.com/sign_in?redirect_to=/users/me'
  },
  opsgenie: {
    // Direct link to API key management
    apiKey: 'https://app.opsgenie.com/settings/api-key-management',
    // EU region
    apiKeyEU: 'https://app.eu.opsgenie.com/settings/api-key-management'
  }
};
```

**Test Connection Implementation:**

```typescript
async function testConnection(platform: 'pagerduty' | 'opsgenie', apiKey: string) {
  // This runs entirely in the browser - no backend call
  if (platform === 'pagerduty') {
    const client = new PagerDutyBrowserClient(apiKey);

    // Quick validation - just fetch first page of users
    const result = await client.testConnection();

    if (result.success) {
      // Get quick counts
      const counts = await client.getEntityCounts();
      return {
        success: true,
        entities: counts
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  }
  // Similar for Opsgenie...
}
```

---

### Step 3: Entity Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 3 of 5: Select Data to Import                            │
│  ─────────────────────────────────────                          │
│                                                                 │
│  Choose what to import from PagerDuty:                         │
│                                                                 │
│  [Select All]  [Deselect All]                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ☑ Users                                    12 found   │   │
│  │    Import user accounts and contact methods             │   │
│  │                                                         │   │
│  │  ☑ Teams                                     3 found   │   │
│  │    Import team structure and memberships               │   │
│  │                                                         │   │
│  │  ☑ Schedules                                 5 found   │   │
│  │    Import on-call schedules and rotations              │   │
│  │                                                         │   │
│  │  ☑ Escalation Policies                      4 found   │   │
│  │    Import escalation rules and steps                   │   │
│  │                                                         │   │
│  │  ☑ Services                                  8 found   │   │
│  │    Import services and integrations                    │   │
│  │                                                         │   │
│  │  ☐ Maintenance Windows                       2 found   │   │
│  │    Import scheduled maintenance periods                │   │
│  │                                                         │   │
│  │  ☐ Routing Rules                             0 found   │   │
│  │    Import event routing rules (advanced)               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ℹ️ Recommended: Import all core entities (Users,        │   │
│  │   Teams, Schedules, Escalation Policies, Services)      │   │
│  │   to ensure your on-call setup works correctly.         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚙️ Advanced Options                                    [▼]    │
│                                                                 │
│  [Collapsed by default, expands to show:]                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ☑ Preserve integration keys                            │   │
│  │    Keep original PagerDuty webhook keys so existing     │   │
│  │    monitoring tools continue working without changes    │   │
│  │                                                         │   │
│  │  ☐ Import historical incidents (last 30 days)          │   │
│  │    ⚠️ This may take several minutes for large accounts  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                    [← Back]  [Start Export →]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**

```typescript
interface EntitySelection {
  users: boolean;
  teams: boolean;
  schedules: boolean;
  escalationPolicies: boolean;
  services: boolean;
  maintenanceWindows: boolean;
  routingRules: boolean;
  incidents: boolean; // Historical
}

interface AdvancedOptions {
  preserveKeys: boolean;        // Keep original integration keys
  incidentDays: number;         // How many days of incidents (0 = none)
}

// Default selection
const DEFAULT_SELECTION: EntitySelection = {
  users: true,
  teams: true,
  schedules: true,
  escalationPolicies: true,
  services: true,
  maintenanceWindows: false,
  routingRules: false,
  incidents: false,
};

const DEFAULT_OPTIONS: AdvancedOptions = {
  preserveKeys: true,
  incidentDays: 0,
};
```

---

### Step 4: Export Progress

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 4 of 5: Exporting Data                                    │
│  ─────────────────────────────────────                          │
│                                                                 │
│  Fetching your data from PagerDuty...                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ✓ Users                              12/12 complete   │   │
│  │  ████████████████████████████████████████████ 100%     │   │
│  │                                                         │   │
│  │  ✓ Teams                                3/3 complete   │   │
│  │  ████████████████████████████████████████████ 100%     │   │
│  │                                                         │   │
│  │  ◐ Schedules                            3/5 fetching   │   │
│  │  ██████████████████████████░░░░░░░░░░░░░░░░░░  60%     │   │
│  │                                                         │   │
│  │  ○ Escalation Policies                     waiting...  │   │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%     │   │
│  │                                                         │   │
│  │  ○ Services                                waiting...  │   │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⏱️ Estimated time remaining: ~45 seconds                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔒 All data fetching happens in your browser.           │   │
│  │    Your API key is never sent to OnCallShift.           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                              [Cancel Export]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**

```typescript
interface ExportProgress {
  entity: string;
  status: 'waiting' | 'fetching' | 'complete' | 'error';
  fetched: number;
  total: number;
  error?: string;
}

interface ExportState {
  isExporting: boolean;
  progress: ExportProgress[];
  currentEntity: string;
  estimatedTimeRemaining: number | null;
  canCancel: boolean;
}

// Progress callback for browser client
const onProgress = (progress: ExportProgress) => {
  setExportState(prev => ({
    ...prev,
    progress: prev.progress.map(p =>
      p.entity === progress.entity ? progress : p
    ),
    currentEntity: progress.entity,
  }));
};

// Fetch with progress
async function exportData(
  client: PagerDutyBrowserClient,
  selection: EntitySelection,
  onProgress: (p: ExportProgress) => void
): Promise<ExportedData> {
  const data: ExportedData = {};

  if (selection.users) {
    onProgress({ entity: 'users', status: 'fetching', fetched: 0, total: 0 });
    data.users = await client.fetchUsers((fetched, total) => {
      onProgress({ entity: 'users', status: 'fetching', fetched, total });
    });
    onProgress({ entity: 'users', status: 'complete', fetched: data.users.length, total: data.users.length });
  }

  // Repeat for other entities...

  return data;
}
```

---

### Step 5: Preview & Confirm

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 5 of 5: Review & Import                                   │
│  ─────────────────────────────────────                          │
│                                                                 │
│  ✓ Export complete! Review your data before importing.         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SUMMARY                                                 │   │
│  │                                                         │   │
│  │ ┌─────────────┬─────────────┬─────────────────────────┐│   │
│  │ │ Entity      │ Count       │ Status                  ││   │
│  │ ├─────────────┼─────────────┼─────────────────────────┤│   │
│  │ │ Users       │ 12          │ ✓ Ready                 ││   │
│  │ │ Teams       │ 3           │ ✓ Ready                 ││   │
│  │ │ Schedules   │ 5           │ ✓ Ready                 ││   │
│  │ │ Escalation  │ 4           │ ⚠️ 1 warning            ││   │
│  │ │ Services    │ 8           │ ✓ Ready                 ││   │
│  │ └─────────────┴─────────────┴─────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠️ Warnings (1)                                        [▼]    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Escalation Policy "Exec Escalation" references        │   │
│  │   schedule "Executive On-Call" which was not exported.  │   │
│  │   This schedule will need to be created manually.       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📥 Download Export File                                        │
│  Save a backup of your exported data (JSON)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ I understand that importing will create new entities  │   │
│  │   in my OnCallShift organization                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                          [← Back]  [Import to OnCallShift →]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**After successful import:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         🎉                                      │
│                                                                 │
│              Import Complete!                                   │
│                                                                 │
│  Your PagerDuty data has been successfully imported.           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ✓ 12 users imported                                   │   │
│  │  ✓ 3 teams created                                     │   │
│  │  ✓ 5 schedules configured                              │   │
│  │  ✓ 4 escalation policies set up                        │   │
│  │  ✓ 8 services ready to receive alerts                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  What's next?                                                   │
│                                                                 │
│  1. Invite your team members to OnCallShift                    │
│  2. Update your monitoring tools to send alerts here           │
│  3. Review your schedules and make adjustments                 │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ View Services       │  │ View Schedules      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│                    [Go to Dashboard]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Key Creation Guide

### PagerDuty API Key Guide

**User API Token (Any User)**

Location: `My Profile → User Settings → API Access`

Steps:
1. Log in to PagerDuty
2. Click your profile icon (top right)
3. Select "My Profile"
4. Go to "User Settings" tab
5. Scroll to "API Access" section
6. Click "Create New API User Token"
7. Description: "OnCallShift Migration"
8. Click "Create Token"
9. Copy the token immediately (shown only once)

**Required Permissions:**
- Read access to Users, Teams, Schedules, Escalation Policies, Services
- No write access needed

**Deep Link:**
```
https://[SUBDOMAIN].pagerduty.com/users/me#user-settings-tab
```

### Opsgenie API Key Guide

**API Key (Admin Required)**

Location: `Settings → API Key Management`

Steps:
1. Log in to Opsgenie
2. Go to Settings (gear icon)
3. Select "API Key Management"
4. Click "Add New API Key"
5. Name: "OnCallShift Migration"
6. Access Rights: "Read"
7. Click "Add"
8. Copy the key

**Deep Links:**
```
US: https://app.opsgenie.com/settings/api-key-management
EU: https://app.eu.opsgenie.com/settings/api-key-management
```

---

## Browser-Based Fetch Client

### PagerDuty Browser Client

```typescript
// frontend/src/lib/pagerduty-browser-client.ts

interface PagerDutyClientConfig {
  apiKey: string;
  rateLimitMs?: number;      // Delay between requests (default: 200ms)
  maxRetries?: number;       // Retry failed requests (default: 3)
  onProgress?: (progress: FetchProgress) => void;
}

interface FetchProgress {
  entity: string;
  fetched: number;
  total: number;
  status: 'fetching' | 'complete' | 'error';
  error?: string;
}

export class PagerDutyBrowserClient {
  private apiKey: string;
  private baseUrl = 'https://api.pagerduty.com';
  private rateLimitMs: number;
  private maxRetries: number;
  private onProgress?: (progress: FetchProgress) => void;
  private abortController: AbortController | null = null;

  constructor(config: PagerDutyClientConfig) {
    this.apiKey = config.apiKey;
    this.rateLimitMs = config.rateLimitMs ?? 200;
    this.maxRetries = config.maxRetries ?? 3;
    this.onProgress = config.onProgress;
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetch('/users?limit=1');
      if (response.ok) {
        return { success: true };
      } else {
        const data = await response.json();
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Get quick counts of all entities (for preview)
   */
  async getEntityCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const endpoints = [
      { key: 'users', path: '/users?limit=1' },
      { key: 'teams', path: '/teams?limit=1' },
      { key: 'schedules', path: '/schedules?limit=1' },
      { key: 'escalationPolicies', path: '/escalation_policies?limit=1' },
      { key: 'services', path: '/services?limit=1' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.fetch(endpoint.path);
        const data = await response.json();
        counts[endpoint.key] = data.total ?? 0;
      } catch {
        counts[endpoint.key] = 0;
      }
    }

    return counts;
  }

  /**
   * Fetch all users with pagination
   */
  async fetchUsers(): Promise<any[]> {
    return this.fetchPaginated('/users', 'users', 'Users');
  }

  /**
   * Fetch all teams with pagination
   */
  async fetchTeams(): Promise<any[]> {
    return this.fetchPaginated('/teams', 'teams', 'Teams');
  }

  /**
   * Fetch all schedules with pagination
   */
  async fetchSchedules(): Promise<any[]> {
    return this.fetchPaginated('/schedules', 'schedules', 'Schedules');
  }

  /**
   * Fetch all escalation policies with pagination
   */
  async fetchEscalationPolicies(): Promise<any[]> {
    return this.fetchPaginated(
      '/escalation_policies',
      'escalation_policies',
      'Escalation Policies'
    );
  }

  /**
   * Fetch all services with pagination
   */
  async fetchServices(): Promise<any[]> {
    return this.fetchPaginated('/services', 'services', 'Services');
  }

  /**
   * Fetch all maintenance windows
   */
  async fetchMaintenanceWindows(): Promise<any[]> {
    return this.fetchPaginated(
      '/maintenance_windows',
      'maintenance_windows',
      'Maintenance Windows'
    );
  }

  /**
   * Cancel any in-progress fetch
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Core fetch with auth headers
   */
  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token token=${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: this.abortController?.signal,
    });
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  private async fetchPaginated(
    basePath: string,
    dataKey: string,
    entityName: string
  ): Promise<any[]> {
    const allItems: any[] = [];
    let offset = 0;
    const limit = 100;
    let total = 0;

    this.abortController = new AbortController();

    try {
      // First request to get total
      const firstPath = `${basePath}?limit=${limit}&offset=0`;
      const firstResponse = await this.fetchWithRetry(firstPath);
      const firstData = await firstResponse.json();

      total = firstData.total ?? firstData[dataKey]?.length ?? 0;
      allItems.push(...(firstData[dataKey] || []));

      this.onProgress?.({
        entity: entityName,
        fetched: allItems.length,
        total,
        status: 'fetching',
      });

      // Fetch remaining pages
      offset = limit;
      while (offset < total) {
        await this.delay(this.rateLimitMs);

        const path = `${basePath}?limit=${limit}&offset=${offset}`;
        const response = await this.fetchWithRetry(path);
        const data = await response.json();

        allItems.push(...(data[dataKey] || []));
        offset += limit;

        this.onProgress?.({
          entity: entityName,
          fetched: allItems.length,
          total,
          status: 'fetching',
        });
      }

      this.onProgress?.({
        entity: entityName,
        fetched: allItems.length,
        total: allItems.length,
        status: 'complete',
      });

      return allItems;
    } catch (error: any) {
      this.onProgress?.({
        entity: entityName,
        fetched: allItems.length,
        total,
        status: 'error',
        error: error.message,
      });
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    path: string,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await this.fetch(path);

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        await this.delay(retryAfter * 1000);
        return this.fetchWithRetry(path, attempt);
      }

      if (!response.ok && attempt < this.maxRetries) {
        await this.delay(1000 * attempt);
        return this.fetchWithRetry(path, attempt + 1);
      }

      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Export cancelled');
      }
      if (attempt < this.maxRetries) {
        await this.delay(1000 * attempt);
        return this.fetchWithRetry(path, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Opsgenie Browser Client

```typescript
// frontend/src/lib/opsgenie-browser-client.ts

interface OpsgenieClientConfig {
  apiKey: string;
  region: 'us' | 'eu';
  rateLimitMs?: number;
  maxRetries?: number;
  onProgress?: (progress: FetchProgress) => void;
}

export class OpsgenieBrowserClient {
  private apiKey: string;
  private baseUrl: string;
  private rateLimitMs: number;
  private maxRetries: number;
  private onProgress?: (progress: FetchProgress) => void;

  constructor(config: OpsgenieClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.region === 'eu'
      ? 'https://api.eu.opsgenie.com/v2'
      : 'https://api.opsgenie.com/v2';
    this.rateLimitMs = config.rateLimitMs ?? 200;
    this.maxRetries = config.maxRetries ?? 3;
    this.onProgress = config.onProgress;
  }

  // Similar implementation to PagerDutyBrowserClient
  // with Opsgenie-specific endpoints and data structures

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetch('/users?limit=1');
      if (response.ok) {
        return { success: true };
      } else {
        const data = await response.json();
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed'
      };
    }
  }

  async fetchUsers(): Promise<any[]> {
    return this.fetchPaginated('/users', 'data', 'Users');
  }

  async fetchTeams(): Promise<any[]> {
    return this.fetchPaginated('/teams', 'data', 'Teams');
  }

  async fetchSchedules(): Promise<any[]> {
    return this.fetchPaginated('/schedules', 'data', 'Schedules');
  }

  async fetchEscalations(): Promise<any[]> {
    return this.fetchPaginated('/escalations', 'data', 'Escalations');
  }

  async fetchServices(): Promise<any[]> {
    return this.fetchPaginated('/services', 'data', 'Services');
  }

  async fetchHeartbeats(): Promise<any[]> {
    return this.fetchPaginated('/heartbeats', 'data', 'Heartbeats');
  }

  private async fetch(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Authorization': `GenieKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async fetchPaginated(
    basePath: string,
    dataKey: string,
    entityName: string
  ): Promise<any[]> {
    // Similar pagination logic to PagerDutyBrowserClient
    // Opsgenie uses 'paging' object with 'next' URL
  }
}
```

---

## Bookmarklet Implementation

### Bookmarklet Code

```javascript
// Minified version for bookmarklet
javascript:(function(){
  const ONCALLSHIFT_URL='https://app.oncallshift.com/import/receive';
  const API_BASE='https://api.pagerduty.com';

  // Check if we're on PagerDuty
  if(!location.hostname.includes('pagerduty.com')){
    alert('Please run this bookmarklet while on PagerDuty');
    return;
  }

  // Get session token from page
  async function getToken(){
    // PagerDuty stores auth in localStorage or cookies
    // This varies by implementation
    const token=localStorage.getItem('pd_token');
    if(token)return token;

    // Alternative: Look for CSRF token in page
    const meta=document.querySelector('meta[name="csrf-token"]');
    if(meta)return meta.content;

    return null;
  }

  async function fetchAll(endpoint,key){
    const items=[];
    let offset=0;
    const limit=100;

    while(true){
      const res=await fetch(`${API_BASE}${endpoint}?limit=${limit}&offset=${offset}`,{
        credentials:'include'
      });
      const data=await res.json();
      items.push(...(data[key]||[]));
      if(!data.more)break;
      offset+=limit;
    }
    return items;
  }

  async function exportData(){
    const status=document.createElement('div');
    status.style.cssText='position:fixed;top:20px;right:20px;background:#1a1a2e;color:white;padding:20px;border-radius:8px;z-index:99999;font-family:system-ui;min-width:250px;';
    status.innerHTML='<strong>OnCallShift Export</strong><br><br>Starting export...';
    document.body.appendChild(status);

    try{
      const update=(msg)=>{status.innerHTML=`<strong>OnCallShift Export</strong><br><br>${msg}`;};

      update('Fetching users...');
      const users=await fetchAll('/users','users');

      update('Fetching teams...');
      const teams=await fetchAll('/teams','teams');

      update('Fetching schedules...');
      const schedules=await fetchAll('/schedules','schedules');

      update('Fetching escalation policies...');
      const escalation_policies=await fetchAll('/escalation_policies','escalation_policies');

      update('Fetching services...');
      const services=await fetchAll('/services','services');

      const exportData={
        source:'pagerduty',
        exportedAt:new Date().toISOString(),
        users,
        teams,
        schedules,
        escalation_policies,
        services
      };

      // Option 1: Download as file
      const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download='pagerduty-export.json';
      a.click();

      update(`Export complete!<br><br>
        ${users.length} users<br>
        ${teams.length} teams<br>
        ${schedules.length} schedules<br>
        ${escalation_policies.length} policies<br>
        ${services.length} services<br><br>
        <button onclick="this.parentElement.remove()" style="background:#4CAF50;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Close</button>
      `);

    }catch(e){
      status.innerHTML=`<strong>Export Failed</strong><br><br>${e.message}<br><br>
        <button onclick="this.parentElement.remove()" style="background:#f44336;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Close</button>`;
    }
  }

  exportData();
})();
```

### Bookmarklet Installation Page

Create a page at `/tools/bookmarklet` with:

```html
<h1>PagerDuty Export Bookmarklet</h1>

<p>This tool lets you export your PagerDuty data without creating an API key.</p>

<h2>Installation</h2>
<ol>
  <li>Drag this button to your bookmarks bar:</li>
</ol>

<a href="javascript:(function(){...})();" class="bookmarklet-button">
  Export to OnCallShift
</a>

<h2>Usage</h2>
<ol>
  <li>Log in to PagerDuty</li>
  <li>Click the bookmarklet in your bookmarks bar</li>
  <li>Wait for the export to complete</li>
  <li>A file will download automatically</li>
  <li>Upload that file to OnCallShift</li>
</ol>
```

---

## File Upload Fallback

### Supported File Formats

| Format | Source | Contents |
|--------|--------|----------|
| JSON (our format) | Bookmarklet, CLI | Full export |
| JSON (PagerDuty) | API response | Full export |
| CSV (Users) | PagerDuty UI export | Users only |
| XLSX (Template) | Manual entry | All entities |

### File Upload Component

```typescript
// frontend/src/components/ImportFileUpload.tsx

interface ImportFileUploadProps {
  source: 'pagerduty' | 'opsgenie';
  onDataParsed: (data: any) => void;
  onError: (error: string) => void;
}

export function ImportFileUpload({ source, onDataParsed, onError }: ImportFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File) => {
    setIsProcessing(true);

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate structure
        if (!isValidExportFormat(data, source)) {
          throw new Error('Invalid export file format');
        }

        onDataParsed(data);
      }
      else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const data = parseCSV(text, source);
        onDataParsed(data);
      }
      else if (file.name.endsWith('.xlsx')) {
        const data = await parseExcel(file, source);
        onDataParsed(data);
      }
      else {
        throw new Error('Unsupported file format. Please use JSON, CSV, or XLSX.');
      }
    } catch (error: any) {
      onError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      {isProcessing ? (
        <div>Processing file...</div>
      ) : (
        <>
          <div className="text-4xl mb-4">📁</div>
          <div className="mb-2">
            Drag and drop your export file here, or
          </div>
          <label className="cursor-pointer text-blue-600 hover:underline">
            click to browse
            <input
              type="file"
              className="hidden"
              accept=".json,.csv,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <div className="text-sm text-gray-500 mt-4">
            Supports: JSON, CSV, XLSX
          </div>
        </>
      )}
    </div>
  );
}
```

### Excel Template Structure

Create a downloadable template at `/templates/oncallshift-import-template.xlsx`:

**Sheet 1: Instructions**
- Overview of how to fill out each sheet
- Link to documentation
- Support contact

**Sheet 2: Users**
| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| email | Yes | User's email address | john@example.com |
| full_name | Yes | Display name | John Doe |
| role | Yes | admin or member | member |
| phone | No | Phone number with country code | +1-555-0100 |
| time_zone | No | IANA timezone | America/New_York |

**Sheet 3: Teams**
| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| name | Yes | Team name | Platform |
| description | No | Team description | Platform engineering |
| members | No | Comma-separated emails | john@example.com, jane@example.com |

**Sheet 4: Schedules**
| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| name | Yes | Schedule name | Primary On-Call |
| time_zone | Yes | IANA timezone | America/New_York |
| rotation_days | Yes | Days per rotation | 7 |
| members | Yes | Emails in rotation order | john@example.com, jane@example.com |
| handoff_time | No | Time of day for handoff | 09:00 |
| handoff_day | No | Day of week (0=Sun) | 1 |

**Sheet 5: Escalation Policies**
| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| name | Yes | Policy name | Default |
| step_1_target | Yes | Schedule name or email | Primary On-Call |
| step_1_delay_minutes | Yes | Minutes before escalating | 5 |
| step_2_target | No | Next target | jane@example.com |
| step_2_delay_minutes | No | Minutes before escalating | 10 |
| step_3_target | No | Final target | manager@example.com |
| step_3_delay_minutes | No | Final delay | 15 |

**Sheet 6: Services**
| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| name | Yes | Service name | Payment API |
| description | No | Description | Handles payments |
| escalation_policy | Yes | Policy name | Default |
| team | No | Team name | Platform |

---

## Error Handling

### Connection Errors

| Error | Message to User | Recovery Action |
|-------|-----------------|-----------------|
| Invalid API key | "API key is invalid. Please check and try again." | Re-enter key |
| Expired token | "Your API key has expired. Please create a new one." | Link to create new key |
| Insufficient permissions | "Your API key doesn't have read access. Please create a key with read permissions." | Instructions |
| Rate limited | "PagerDuty is rate limiting requests. Waiting..." | Auto-retry with backoff |
| Network error | "Network connection failed. Please check your internet." | Retry button |
| CORS error | "Browser security blocked the request. Try the file upload method instead." | Show file upload option |

### Data Validation Errors

| Error | Message to User | Recovery Action |
|-------|-----------------|-----------------|
| Missing required field | "User 'john@example.com' is missing required field 'name'" | Show in preview |
| Invalid email format | "Invalid email format: 'john@'" | Allow correction |
| Duplicate entity | "Team 'Platform' already exists in OnCallShift" | Offer skip or merge |
| Reference not found | "Escalation policy references schedule 'Night Shift' which doesn't exist" | Warning in preview |

### Error Display Component

```typescript
interface ImportError {
  type: 'warning' | 'error';
  entity: string;
  entityName: string;
  field?: string;
  message: string;
  canContinue: boolean;
}

function ErrorList({ errors }: { errors: ImportError[] }) {
  const warnings = errors.filter(e => e.type === 'warning');
  const critical = errors.filter(e => e.type === 'error');

  return (
    <div className="space-y-4">
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">
            Errors ({critical.length})
          </h4>
          <ul className="list-disc list-inside text-red-700">
            {critical.map((error, i) => (
              <li key={i}>
                <strong>{error.entityName}</strong>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">
            Warnings ({warnings.length})
          </h4>
          <ul className="list-disc list-inside text-yellow-700">
            {warnings.map((warning, i) => (
              <li key={i}>
                <strong>{warning.entityName}</strong>: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Security Considerations

### API Key Handling

```typescript
// NEVER do this:
localStorage.setItem('pagerduty_api_key', apiKey); // ❌
sessionStorage.setItem('pagerduty_api_key', apiKey); // ❌
document.cookie = `pd_key=${apiKey}`; // ❌

// DO this:
// Keep API key only in component state
const [apiKey, setApiKey] = useState<string>('');

// Clear immediately after use
const handleExportComplete = () => {
  setApiKey(''); // Clear from memory
};

// Never log the key
console.log('API Key:', apiKey); // ❌
console.log('API Key:', '***'); // ✓
```

### Data Handling

```typescript
// Validate before sending to backend
function sanitizeExportData(data: ExportedData): ExportedData {
  // Remove any sensitive fields that shouldn't be imported
  return {
    ...data,
    users: data.users.map(user => ({
      ...user,
      // Don't import password hashes or tokens
      password: undefined,
      session_token: undefined,
      api_key: undefined,
    })),
  };
}
```

### Upload Security

- Maximum file size: 50MB
- Validate JSON schema before processing
- Rate limit uploads: 5 per minute per user
- Sign uploads with short-lived token (5 minutes)

---

## Testing Plan

### Unit Tests

```typescript
describe('PagerDutyBrowserClient', () => {
  it('should validate API key format', () => {
    expect(() => new PagerDutyBrowserClient({ apiKey: '' }))
      .toThrow('API key is required');
  });

  it('should handle pagination correctly', async () => {
    // Mock fetch to return paginated data
    const client = new PagerDutyBrowserClient({ apiKey: 'test' });
    const users = await client.fetchUsers();
    expect(users.length).toBe(150); // 2 pages of 100 + 50
  });

  it('should retry on rate limit', async () => {
    // Mock 429 response then success
    const client = new PagerDutyBrowserClient({ apiKey: 'test' });
    const users = await client.fetchUsers();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should cancel in-progress fetch', async () => {
    const client = new PagerDutyBrowserClient({ apiKey: 'test' });
    const promise = client.fetchUsers();
    client.cancel();
    await expect(promise).rejects.toThrow('Export cancelled');
  });
});
```

### Integration Tests

```typescript
describe('Import Wizard E2E', () => {
  it('should complete full import flow', async () => {
    // Start wizard
    await page.goto('/import');

    // Select PagerDuty
    await page.click('[data-testid="source-pagerduty"]');
    await page.click('[data-testid="continue"]');

    // Enter API key
    await page.fill('[data-testid="api-key-input"]', process.env.TEST_PD_KEY);
    await page.click('[data-testid="test-connection"]');
    await expect(page.locator('[data-testid="connection-success"]')).toBeVisible();

    // Select entities
    await page.click('[data-testid="continue"]');
    await expect(page.locator('[data-testid="entity-users"]')).toBeChecked();

    // Start export
    await page.click('[data-testid="start-export"]');
    await expect(page.locator('[data-testid="export-complete"]')).toBeVisible({ timeout: 60000 });

    // Confirm import
    await page.click('[data-testid="confirm-import"]');
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
  });
});
```

### Manual Test Checklist

- [ ] Test with read-only API key
- [ ] Test with full-access API key
- [ ] Test with invalid API key
- [ ] Test with expired API key
- [ ] Test export cancellation
- [ ] Test network disconnect during export
- [ ] Test with large account (1000+ users)
- [ ] Test with small account (< 10 users)
- [ ] Test file upload with JSON
- [ ] Test file upload with CSV
- [ ] Test file upload with Excel template
- [ ] Test bookmarklet in Chrome
- [ ] Test bookmarklet in Firefox
- [ ] Test bookmarklet in Safari
- [ ] Verify API key is not in browser storage after import
- [ ] Verify API key is not in network requests to our backend

---

## File Structure

```
frontend/src/
├── lib/
│   ├── pagerduty-browser-client.ts    # Browser-based PD client
│   ├── opsgenie-browser-client.ts     # Browser-based OG client
│   ├── import-file-parser.ts          # CSV/Excel parsing
│   └── import-validation.ts           # Data validation
├── pages/
│   └── ImportWizard.tsx               # Main wizard component (update)
├── components/
│   ├── import/
│   │   ├── SourceSelector.tsx         # Step 1
│   │   ├── ApiKeyEntry.tsx            # Step 2
│   │   ├── ApiKeyGuide.tsx            # Help create key
│   │   ├── EntitySelector.tsx         # Step 3
│   │   ├── ExportProgress.tsx         # Step 4
│   │   ├── ImportPreview.tsx          # Step 5
│   │   ├── ImportSuccess.tsx          # Complete
│   │   ├── FileUpload.tsx             # Alternative method
│   │   └── ErrorDisplay.tsx           # Error handling
│   └── ...

public/
├── templates/
│   └── oncallshift-import-template.xlsx
└── tools/
    └── bookmarklet.html               # Bookmarklet installation page

docs/
├── MIGRATION-ARCHITECTURE-ANALYSIS.md
└── MIGRATION-IMPLEMENTATION-GUIDE.md  # This file
```

---

## Implementation Timeline

### Phase 1: Browser Client (Week 1-2)
- [ ] Create PagerDutyBrowserClient
- [ ] Create OpsgenieBrowserClient
- [ ] Add connection testing
- [ ] Add progress callbacks
- [ ] Unit tests

### Phase 2: Wizard Updates (Week 2-3)
- [ ] Update ImportWizard to use browser clients
- [ ] Add API key guidance flow
- [ ] Add entity selection with counts
- [ ] Add export progress UI
- [ ] Add preview with validation

### Phase 3: Fallback Options (Week 3-4)
- [ ] Create bookmarklet
- [ ] Add file upload component
- [ ] Create Excel template
- [ ] Add CSV parsing

### Phase 4: Polish & Testing (Week 4)
- [ ] Error handling refinement
- [ ] E2E tests
- [ ] Documentation
- [ ] Performance optimization for large accounts

---

## Conclusion

This implementation guide provides a complete specification for migrating to a client-side import architecture. The key benefits are:

1. **No IP blocking risk** - all requests come from user's browser
2. **User trust** - credentials never leave their browser
3. **Multiple fallback options** - API, bookmarklet, file upload
4. **Great UX** - guided API key creation, real-time progress

Following this guide will result in a robust, secure, and user-friendly migration experience that protects OnCallShift's ability to acquire customers from competitors.
