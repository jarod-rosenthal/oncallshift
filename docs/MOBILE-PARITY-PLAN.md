# Mobile App Parity Implementation Plan

This document outlines the implementation plan to bring the OnCallShift mobile app (React Native + Expo) to feature parity with the web application.

**Exclusions:** PagerDuty/Opsgenie migration/import features are intentionally excluded.

---

## Executive Summary

The mobile app currently has ~70% feature coverage. The main gaps are:
1. **AI Assistant** - Web has streaming chat with cloud investigation; mobile has basic direct API calls
2. **Runbooks** - Web has full CRUD + automated execution; mobile has view/execute only
3. **Status Pages** - Missing entirely
4. **Postmortems** - Missing entirely
5. **Workflows** - Missing entirely

---

## Phase 1: AI Assistant Integration (Priority: HIGH)

**Goal:** Bring mobile AI chat to parity with web's unified AI assistant.

### Current State

| Feature | Web | Mobile |
|---------|-----|--------|
| Streaming responses | SSE streaming via backend | Direct Anthropic API (blocking) |
| Cloud credentials | Select AWS/Azure/GCP creds | Anthropic API key only |
| Tool calls display | Shows pending/success/error | None |
| Model selection | Haiku/Sonnet/Opus | Hardcoded Sonnet |
| Conversation persistence | Server-side via conversation_id | Local AsyncStorage |
| Cloud investigation | Queries CloudWatch, etc. | None |

### Implementation Tasks

#### 1.1 Backend Integration for Mobile AI Chat
- Update `mobile/src/screens/AIChatScreen.tsx` to use the backend `/api/v1/incidents/{id}/assistant/chat` endpoint instead of direct Anthropic API calls
- Implement SSE/streaming response handling in React Native using `fetch` with `ReadableStream` or `react-native-sse` library
- Add conversation ID tracking for multi-turn conversations

**Files to modify:**
- `mobile/src/screens/AIChatScreen.tsx`
- `mobile/src/services/apiService.ts` (add streaming chat method)

#### 1.2 Cloud Credentials Integration
- Add cloud credentials selection to AI chat (AWS/Azure/GCP)
- Fetch available credentials from `/api/v1/cloud-credentials`
- Pass selected credential IDs to chat API

**New components:**
- `mobile/src/components/CloudCredentialSelector.tsx`

#### 1.3 Model Selection
- Add model selector (Haiku/Sonnet/Opus) to chat interface
- Persist preference in AsyncStorage

#### 1.4 Tool Calls Display
- Show tool execution status during streaming (pending spinner, success check, error X)
- Display tool names (e.g., "Querying CloudWatch Logs")

#### 1.5 Inline AI Chat in Incident Detail
- Similar to web's RunbookPanel, add AI chat directly in AlertDetailScreen
- Allow starting analysis without navigating away

**Files to modify:**
- `mobile/src/screens/AlertDetailScreen.tsx`
- Create `mobile/src/components/AIAssistantPanel.tsx`

### Dependencies
- Backend `/api/v1/ai-assistant` routes (already exist)
- Backend cloud credentials service (already exists)

---

## Phase 2: Enhanced Runbook Features (Priority: HIGH)

**Goal:** Full runbook functionality including CRUD and automated execution.

### Current State

| Feature | Web | Mobile |
|---------|-----|--------|
| View runbooks | Yes | Yes |
| Manual step checkboxes | Yes | Yes |
| Webhook actions | Yes | Yes |
| Automated script execution | Yes (bash/python/AI) | No |
| Runbook CRUD | Yes (admin) | No |
| Execution monitoring | Yes (output, exit codes) | No |
| Approval workflows | Yes | No |

### Implementation Tasks

#### 2.1 Runbook CRUD (Admin)
- Create new screen `mobile/src/screens/AdminRunbooksScreen.tsx`
- List all runbooks with search/filter
- Create/edit runbook with:
  - Title, description
  - Service assignment
  - Severity filter
  - Steps (manual, webhook, automated)
  - External URL

**New screens:**
- `mobile/src/screens/AdminRunbooksScreen.tsx`
- `mobile/src/screens/RunbookEditorScreen.tsx`

**API endpoints to use:**
- `GET /api/v1/runbooks`
- `POST /api/v1/runbooks`
- `PUT /api/v1/runbooks/{id}`
- `DELETE /api/v1/runbooks/{id}`

#### 2.2 Automated Step Execution
- Add execution button for automated steps (type: 'automated')
- Show approval confirmation modal if `requiresApproval: true`
- Display execution output in expandable section
- Track execution state via backend

**API endpoints:**
- `POST /api/v1/runbooks/{id}/executions` - Start execution
- `POST /api/v1/runbooks/executions/{id}/steps/{index}/execute` - Execute step
- `GET /api/v1/runbooks/executions/{id}` - Get execution status

#### 2.3 Execution Monitoring Panel
- Show real-time execution progress
- Display output/logs for each step
- Show exit codes and error messages
- Allow retry on failure

**New component:**
- `mobile/src/components/RunbookExecutionMonitor.tsx`

#### 2.4 Navigation Integration
- Add "Runbooks" to More screen menu (admin only)
- Add runbook management to service settings

---

## Phase 3: Status Pages (Priority: MEDIUM)

**Goal:** View and manage status pages from mobile.

### Current State
Mobile has no status page functionality.

### Implementation Tasks

#### 3.1 Status Pages List Screen
- List organization's status pages
- Show visibility (public/internal), service count, subscriber count
- Filter by visibility

**New screen:**
- `mobile/src/screens/StatusPagesScreen.tsx`

#### 3.2 Status Page Detail Screen
- View status page details
- List services with current status
- View recent updates
- Quick publish update button

**New screen:**
- `mobile/src/screens/StatusPageDetailScreen.tsx`

#### 3.3 Publish Status Update
- Modal to create status update
- Select affected services
- Set status (operational, degraded, partial_outage, major_outage)
- Add message
- Link to incident (optional)

**New component:**
- `mobile/src/components/StatusUpdateModal.tsx`

#### 3.4 Status Page CRUD (Admin)
- Create/edit status pages
- Configure branding (color, logo)
- Manage services on page
- View subscribers

**New screen:**
- `mobile/src/screens/StatusPageEditorScreen.tsx`

**API endpoints:**
- `GET/POST /api/v1/status-pages`
- `GET/PUT/DELETE /api/v1/status-pages/{id}`
- `GET/POST /api/v1/status-pages/{id}/updates`
- `GET /api/v1/status-pages/{id}/subscribers`

---

## Phase 4: Postmortems (Priority: MEDIUM)

**Goal:** Create and manage incident postmortems from mobile.

### Current State
Mobile has no postmortem functionality.

### Implementation Tasks

#### 4.1 Postmortem Panel in Incident Detail
- Add "Postmortem" section to AlertDetailScreen
- Show if postmortem exists: link to view
- If resolved incident without postmortem: "Create Postmortem" button

**Files to modify:**
- `mobile/src/screens/AlertDetailScreen.tsx`

**New component:**
- `mobile/src/components/PostmortemPanel.tsx`

#### 4.2 Postmortem List Screen
- List all postmortems
- Filter by status (draft, in_review, published)
- Search by title/incident

**New screen:**
- `mobile/src/screens/PostmortemsScreen.tsx`

#### 4.3 Postmortem Detail/Editor Screen
- View/edit postmortem sections:
  - Summary
  - Timeline (auto-populated from incident)
  - Root cause analysis
  - Impact assessment
  - What went well
  - What needs improvement
  - Action items (with assignee, due date, status)
- Publish workflow

**New screen:**
- `mobile/src/screens/PostmortemDetailScreen.tsx`

**API endpoints:**
- `GET/POST /api/v1/postmortems`
- `GET/PUT/DELETE /api/v1/postmortems/{id}`
- `POST /api/v1/postmortems/{id}/publish`
- `GET /api/v1/incidents/{id}/postmortem`

---

## Phase 5: Incident Workflows (Priority: MEDIUM)

**Goal:** View and create automated incident workflows.

### Current State
Mobile has no workflow functionality.

### Implementation Tasks

#### 5.1 Workflows List Screen (Admin)
- List all workflows
- Show enabled/disabled status
- Show trigger type (manual/automatic)
- Enable/disable toggle

**New screen:**
- `mobile/src/screens/WorkflowsScreen.tsx`

#### 5.2 Workflow Detail Screen
- View workflow configuration:
  - Trigger conditions
  - Actions to execute
- Edit workflow

**New screen:**
- `mobile/src/screens/WorkflowDetailScreen.tsx`

#### 5.3 Workflow Editor
- Configure triggers:
  - Manual trigger
  - On incident create
  - On state change
  - On severity
- Configure conditions:
  - Service filter
  - Severity filter
- Configure actions:
  - Assign to user/schedule
  - Add responders
  - Set priority
  - Add note
  - Send notification
  - Run webhook

**New screen:**
- `mobile/src/screens/WorkflowEditorScreen.tsx`

#### 5.4 Manual Workflow Trigger
- In incident detail, add "Run Workflow" button
- List available manual workflows
- Execute selected workflow

**API endpoints:**
- `GET/POST /api/v1/workflows`
- `GET/PUT/DELETE /api/v1/workflows/{id}`
- `POST /api/v1/workflows/{id}/trigger`

---

## Phase 6: Incident Detail Enhancements (Priority: MEDIUM)

**Goal:** Add missing incident features from web.

### Implementation Tasks

#### 6.1 Conference Bridge
- Add "Conference Bridge" section to AlertDetailScreen
- Create bridge (Zoom/Teams/Google Meet/Manual)
- Show active bridge with join link
- End bridge functionality

**New component:**
- `mobile/src/components/ConferenceBridgePanel.tsx`

**API endpoints:**
- `GET/POST /api/v1/incidents/{id}/conference-bridge`
- `PUT /api/v1/incidents/{id}/conference-bridge/{id}/end`
- `GET /api/v1/conference-bridge/providers`

#### 6.2 Incident Responders (Enhanced)
- Current: View-only responders section
- Add: Request responder functionality
- Add: Respond to responder request (accept/decline)

**Files to modify:**
- `mobile/src/components/RespondersSection.tsx`

**API endpoints:**
- `POST /api/v1/incidents/{id}/responders`
- `PUT /api/v1/incidents/{id}/responders/{id}` (respond to request)

#### 6.3 Incident Subscribers
- Add "Subscribers" section
- List current subscribers
- Add subscriber (user selection)
- Remove subscriber

**New component:**
- `mobile/src/components/SubscribersPanel.tsx`

**API endpoints:**
- `GET /api/v1/incidents/{id}/subscribers`
- `POST /api/v1/incidents/{id}/subscribers`
- `DELETE /api/v1/incidents/{id}/subscribers/{id}`

#### 6.4 Snooze Improvements
- Ensure snooze functionality matches web
- Show snooze status prominently if snoozed
- Quick unsnooze button

---

## Phase 7: Additional Features (Priority: LOW)

### 7.1 Cloud Credentials Management
- View configured cloud credentials
- Add new credential (admin)
- Test credential connection
- View access logs

**New screen:**
- `mobile/src/screens/CloudCredentialsScreen.tsx`

### 7.2 Service Maintenance Windows
- View maintenance windows per service
- Create/edit maintenance windows
- Active maintenance indicator

### 7.3 Tags
- View tags on entities
- Add/remove tags from incidents
- Tag-based filtering

### 7.4 Business Services
- View business services
- See mapped technical services
- Impact visualization

### 7.5 Analytics Enhancements
- Team-level analytics
- User analytics with response times
- Top responders leaderboard
- SLA compliance tracking

---

## Technical Considerations

### Streaming in React Native
For AI chat streaming, options:
1. **react-native-sse** - Purpose-built SSE library
2. **fetch with ReadableStream** - Native but limited iOS support
3. **Polling fallback** - Less optimal but reliable

Recommended: Use `react-native-sse` with polling fallback.

### State Management
- Continue using React Query for server state
- AsyncStorage for local persistence
- Consider Zustand for complex UI state (workflow editor)

### Navigation Updates
Add to More screen menu:
- Runbooks (admin)
- Status Pages
- Postmortems
- Workflows (admin)
- Cloud Credentials (admin)

### New Navigation Stack Screens
```typescript
// Add to AppNavigator.tsx
<Stack.Screen name="AdminRunbooks" component={AdminRunbooksScreen} />
<Stack.Screen name="RunbookEditor" component={RunbookEditorScreen} />
<Stack.Screen name="StatusPages" component={StatusPagesScreen} />
<Stack.Screen name="StatusPageDetail" component={StatusPageDetailScreen} />
<Stack.Screen name="StatusPageEditor" component={StatusPageEditorScreen} />
<Stack.Screen name="Postmortems" component={PostmortemsScreen} />
<Stack.Screen name="PostmortemDetail" component={PostmortemDetailScreen} />
<Stack.Screen name="Workflows" component={WorkflowsScreen} />
<Stack.Screen name="WorkflowDetail" component={WorkflowDetailScreen} />
<Stack.Screen name="WorkflowEditor" component={WorkflowEditorScreen} />
<Stack.Screen name="CloudCredentials" component={CloudCredentialsScreen} />
```

---

## Implementation Order

### Sprint 1: AI Assistant
1. Backend streaming integration
2. Cloud credentials selection
3. Model selection
4. Tool calls display
5. Inline AI chat panel

### Sprint 2: Runbooks
1. Runbook CRUD screens
2. Automated step execution
3. Execution monitoring
4. Navigation integration

### Sprint 3: Status Pages & Postmortems
1. Status pages list/detail
2. Status update publishing
3. Status page CRUD
4. Postmortem panel
5. Postmortem list/editor

### Sprint 4: Workflows & Incident Enhancements
1. Workflows list/detail/editor
2. Conference bridge
3. Enhanced responders
4. Subscribers panel

### Sprint 5: Polish & Additional Features
1. Cloud credentials management
2. Analytics enhancements
3. Tags integration
4. Testing & bug fixes

---

## Files Summary

### New Screens (12)
- `AdminRunbooksScreen.tsx`
- `RunbookEditorScreen.tsx`
- `StatusPagesScreen.tsx`
- `StatusPageDetailScreen.tsx`
- `StatusPageEditorScreen.tsx`
- `PostmortemsScreen.tsx`
- `PostmortemDetailScreen.tsx`
- `WorkflowsScreen.tsx`
- `WorkflowDetailScreen.tsx`
- `WorkflowEditorScreen.tsx`
- `CloudCredentialsScreen.tsx`
- (AIChatScreen.tsx - major refactor)

### New Components (8)
- `AIAssistantPanel.tsx`
- `CloudCredentialSelector.tsx`
- `RunbookExecutionMonitor.tsx`
- `StatusUpdateModal.tsx`
- `PostmortemPanel.tsx`
- `ConferenceBridgePanel.tsx`
- `SubscribersPanel.tsx`
- (RespondersSection.tsx - enhancement)

### Modified Files
- `AlertDetailScreen.tsx` - Add AI panel, conference bridge, subscribers, postmortem
- `MoreScreen.tsx` - Add navigation links
- `AppNavigator.tsx` - Add new screens
- `apiService.ts` - Add streaming chat, new API methods

---

## Success Metrics

After implementation:
- Feature parity: ~95% (excluding import/export)
- AI chat: Full streaming with cloud investigation
- Runbooks: Full CRUD and execution
- Incident management: All web features available
- Status communication: Full status page support
- Learning from incidents: Postmortem workflow

---

*Document created: January 2026*
*Last updated: January 2026*
