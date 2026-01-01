# Migration Architecture Analysis: PagerDuty & Opsgenie Import

## Executive Summary

This document analyzes the risks of our current server-side migration approach and proposes a more robust, client-side architecture that eliminates the risk of IP blocking while improving user trust and data sovereignty.

---

## Current Architecture (Server-Side)

### How It Works Today

```
User Browser                    OnCallShift Backend              PagerDuty API
     |                                 |                              |
     |---(1) API Key + Options-------->|                              |
     |                                 |---(2) Fetch Users----------->|
     |                                 |<------ User Data-------------|
     |                                 |---(3) Fetch Teams----------->|
     |                                 |<------ Team Data-------------|
     |                                 |      ... (many requests)     |
     |<--(4) Consolidated Data---------|                              |
```

**Files Involved:**
- `backend/src/shared/services/PagerDutyExportService.ts` - Makes direct API calls
- `backend/src/shared/services/OpsgenieExportService.ts` - Makes direct API calls
- `backend/src/api/routes/import.ts` - Orchestrates the import

### Identified Risks

| Risk | Severity | Likelihood | Impact |
|------|----------|------------|--------|
| **IP Blocking** | Critical | Medium-High | Entire migration feature becomes unusable |
| **Rate Limiting** | High | High | Slow migrations, timeouts, frustrated users |
| **API Key Exposure** | Medium | Low | Customer credentials transit through our servers |
| **Competitor Detection** | High | Medium | PagerDuty can identify bulk extraction patterns |
| **Legal/ToS Concerns** | Medium | Unknown | Server-side scraping may violate ToS |

### Why PagerDuty Would Block Us

1. **Pattern Detection**: Our server IP(s) making thousands of requests across different PagerDuty accounts signals automated extraction
2. **Competitive Threat**: We are a direct competitor - they have business incentive to block
3. **Precedent**: Other SaaS companies (LinkedIn, etc.) actively block competitor data extraction
4. **Easy to Detect**: Same IP, predictable request patterns, User-Agent analysis

---

## Proposed Architecture: Client-Side Migration

### Approach A: Browser-Based Direct Fetch (Recommended Primary)

```
User Browser                                          PagerDuty API
     |                                                      |
     |---(1) Fetch Users (with user's API key)------------->|
     |<------ User Data-------------------------------------|
     |---(2) Fetch Teams----------------------------------->|
     |<------ Team Data-------------------------------------|
     |      ... (many requests from user's browser)         |
     |                                                      |
     |                                                      |
     |---------(3) Upload consolidated JSON---------------->|  OnCallShift API
     |<-------- Import confirmation-------------------------|
```

**Benefits:**
- Requests come from user's IP, not our servers
- No pattern for PagerDuty to detect across customers
- User maintains full control of their credentials
- Impossible to block without blocking the customer's own access
- GDPR-friendly: user-initiated data export

**Technical Implementation:**
```typescript
// Runs entirely in user's browser
async function fetchFromPagerDuty(apiKey: string): Promise<ExportData> {
  const client = new PagerDutyBrowserClient(apiKey);

  // All requests originate from user's browser
  const users = await client.fetchUsers();
  const teams = await client.fetchTeams();
  const schedules = await client.fetchSchedules();
  // ...

  return { users, teams, schedules, ... };
}
```

### Approach B: User-Initiated Export + File Upload

```
User in PagerDuty                   User Browser                 OnCallShift
     |                                    |                           |
     |---(1) Export to CSV/JSON---------->|                           |
     |                                    |                           |
     |<---(Download files)----------------|                           |
     |                                    |                           |
     |                    (2) Upload files|-------------------------->|
     |                                    |<---Import confirmation----|
```

**Benefits:**
- Zero API calls to PagerDuty from any OnCallShift infrastructure
- Uses PagerDuty's official export functionality
- Maximum legal safety
- Works even if PagerDuty disables API for competitors

**Supported PagerDuty Native Exports:**
- Users: Settings > Users > Export
- Services: Services > Export
- Incidents: Incidents > Export (CSV)
- Schedules: Must use API (no native export)

**Limitation:** Not all entities are exportable via UI.

### Approach C: Hybrid - Browser Fetch with Fallback

Combine both approaches:

1. **Primary**: Browser-based API fetch (Approach A)
2. **Fallback**: If CORS issues occur, guide user through manual export (Approach B)
3. **Alternative**: Provide a downloadable CLI tool that runs on user's machine

---

## Industry Best Practices Research

### How Competitors Handle Migration

| Company | Migration Approach | Notes |
|---------|-------------------|-------|
| **Notion** | File import (CSV, Markdown) | No direct API fetch from competitors |
| **Asana** | CSV import + direct API with user token | Token stays in browser |
| **Linear** | Direct API from browser | Client-side only |
| **Slack** | Official export + file upload | Uses platform's native export |
| **Trello** | JSON export + import | User downloads, then uploads |
| **Airtable** | CSV/JSON file upload | No server-side competitor API calls |

### Data Portability Regulations

**GDPR Article 20 - Right to Data Portability:**
- Users have the right to export their data
- Must be in machine-readable format
- Platforms cannot block legitimate export requests
- This is the user's right, not our extraction

**Key Insight:** Frame migration as helping users exercise their data portability rights, not as us extracting competitor data.

---

## Recommended Implementation Plan

### Phase 1: Browser-Based Fetch (2-3 weeks)

**Goal:** Move all PagerDuty/Opsgenie API calls to run in user's browser.

**Technical Requirements:**
1. Create `PagerDutyBrowserClient` TypeScript module for frontend
2. Handle CORS (PagerDuty allows CORS with proper API key)
3. Implement progress UI with real-time status
4. Chunked upload of collected data to our backend
5. Robust error handling and retry logic

**UI Flow:**
1. User enters API key (stored only in browser memory)
2. "Start Export" button initiates browser-based fetch
3. Progress bar shows entities being fetched
4. Data displayed for preview (all in browser)
5. "Import to OnCallShift" sends data to our API
6. Credentials never touch our servers

### Phase 2: File-Based Import (1-2 weeks)

**Goal:** Support manual CSV/JSON file uploads as alternative.

**Supported Formats:**
1. **PagerDuty Native Exports:**
   - Users CSV export
   - Services JSON export
   - Incidents CSV export

2. **Custom Export Format:**
   - Provide downloadable CLI tool (Go binary)
   - User runs on their machine: `oncallshift export --platform pagerduty`
   - Generates `pagerduty-export.json`
   - User uploads file to our import wizard

3. **Spreadsheet Template:**
   - Excel/Google Sheets template with tabs for each entity
   - User fills in manually or pastes from PagerDuty
   - Upload .xlsx file

### Phase 3: Downloadable CLI Tool (1 week)

**Goal:** Provide ultimate flexibility with local execution.

```bash
# Download
curl -LO https://oncallshift.com/tools/ocs-export

# Export from PagerDuty (runs on user's machine)
./ocs-export pagerduty --api-key $PD_API_KEY -o export.json

# Import to OnCallShift
./ocs-export import --file export.json --org $ORG_ID
```

**Benefits:**
- Runs entirely on customer's machine
- No CORS concerns
- Can be containerized
- Works in air-gapped environments
- Appeals to technical users

---

## Technical Considerations

### CORS Handling

**PagerDuty API CORS Policy:**
- Allows CORS when proper `Authorization` header is set
- Must use API token, not OAuth

**If CORS fails:**
- Provide CLI tool alternative
- Or: minimal proxy that only forwards requests (user's IP is origin)

### Rate Limiting

**Browser-based approach handles this better:**
- Each customer is rate-limited independently
- No aggregate rate limiting across customers
- Natural throttling (user's browser)

**Recommended client-side settings:**
```typescript
const config = {
  requestDelay: 200,      // 200ms between requests
  maxConcurrent: 2,       // Max 2 parallel requests
  retryAttempts: 3,
  retryBackoff: 'exponential'
};
```

### Data Validation

Data validation should happen on our backend regardless of source:
- Schema validation
- Reference integrity checks
- Conflict detection with existing data
- Duplicate detection

### Security Considerations

**API Key Handling:**
- Never persist API key (localStorage, cookies, etc.)
- Clear from memory after use
- Show key in masked format
- Allow paste but not copy

**Upload Security:**
- Sign upload with short-lived token
- Validate file size limits
- Scan for malicious content
- Rate limit uploads per user

---

## Migration Flow Comparison

### Current (Risky)
```
[User] --> [API Key] --> [OUR SERVER] --> [PagerDuty API]
                              ^
                              |
                    Risk: IP blocking
```

### Proposed (Safe)
```
[User] --> [API Key] --> [USER'S BROWSER] --> [PagerDuty API]
                              |
                              v
                         [Export JSON]
                              |
                              v
                       [OUR SERVER]
                       (import only)
```

---

## Implementation Checklist

### Immediate Actions

- [ ] Create `PagerDutyBrowserClient.ts` in frontend
- [ ] Create `OpsgenieBrowserClient.ts` in frontend
- [ ] Update ImportWizard to use browser clients
- [ ] Add file upload alternative to wizard
- [ ] Create CSV/JSON template documentation

### Backend Changes

- [ ] Keep existing import endpoints (they receive data, not fetch)
- [ ] Add file upload endpoints for CSV/Excel
- [ ] Add schema for spreadsheet import format
- [ ] Deprecate (but don't remove) server-side fetch

### Documentation

- [ ] User guide: "How to migrate from PagerDuty"
- [ ] User guide: "How to migrate from Opsgenie"
- [ ] Spreadsheet template with instructions
- [ ] CLI tool documentation

### Testing

- [ ] Test browser client with real PagerDuty account
- [ ] Test CORS from various browsers
- [ ] Test file upload with various formats
- [ ] Load test import endpoint

---

## Risk Mitigation Summary

| Risk | Mitigation |
|------|------------|
| IP Blocking | All fetches happen in user's browser |
| Rate Limiting | Per-customer limits, not aggregate |
| ToS Violation | User exercises their own data rights |
| API Key Exposure | Key never leaves browser |
| CORS Issues | CLI tool fallback |
| Incomplete Export | Multiple import methods supported |

---

## Conclusion

Moving to a client-side migration architecture:

1. **Eliminates** the risk of IP blocking
2. **Improves** user trust (their credentials, their control)
3. **Reduces** legal/ToS risk
4. **Aligns** with data portability best practices
5. **Provides** multiple fallback options

The investment of 4-6 weeks to implement this properly will protect a critical customer acquisition channel and differentiate us as a trustworthy migration partner.

---

## Appendix: Spreadsheet Template Design

### Proposed Excel Template Structure

**Tab 1: Users**
| Email | Full Name | Role | Phone | Time Zone |
|-------|-----------|------|-------|-----------|
| john@example.com | John Doe | admin | +1-555-0100 | America/New_York |

**Tab 2: Teams**
| Team Name | Description | Members (emails, comma-separated) |
|-----------|-------------|-----------------------------------|
| Platform | Platform engineering team | john@example.com, jane@example.com |

**Tab 3: Schedules**
| Schedule Name | Time Zone | Rotation (days) | Members (emails, in order) |
|---------------|-----------|-----------------|---------------------------|
| Primary On-Call | America/New_York | 7 | john@example.com, jane@example.com |

**Tab 4: Escalation Policies**
| Policy Name | Step 1 (schedule or emails) | Step 1 Delay | Step 2 | Step 2 Delay |
|-------------|----------------------------|--------------|--------|--------------|
| Default | Primary On-Call | 5 | jane@example.com | 10 |

**Tab 5: Services**
| Service Name | Description | Escalation Policy | Team |
|--------------|-------------|-------------------|------|
| Payment API | Payment processing service | Default | Platform |

This template approach:
- Works without any API access
- Can be filled manually or via copy-paste
- Validates easily on import
- Serves as documentation of expected format
