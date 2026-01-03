# Semantic Import Feature - Implementation Progress

**Last Updated:** 2026-01-02
**Status:** Backend Complete, Frontend Mostly Complete (needs routing integration)

---

## Overview

Implement a Semantic Import feature that allows users to configure OnCallShift by:
1. Uploading screenshots of their existing PagerDuty/Opsgenie setup
2. Describing their desired configuration in natural language

The system uses Claude Vision to analyze screenshots and extract configuration data.

---

## Phase 1: Backend Implementation - COMPLETE

### Files Created

| File | Description | Status |
|------|-------------|--------|
| `backend/src/shared/db/migrations/042_add_import_history.sql` | Database migration for import history tracking | Done |
| `backend/src/shared/models/ImportHistory.ts` | TypeORM entity with extraction/execution result types | Done |
| `backend/src/shared/prompts/import-prompts.ts` | Claude Vision prompts for different screenshot types | Done |
| `backend/src/shared/services/vision-import-service.ts` | Claude Vision API integration for screenshot analysis | Done |
| `backend/src/shared/services/import-executor-service.ts` | Preview/execute logic with transaction support | Done |
| `backend/src/api/routes/semantic-import.ts` | REST API endpoints | Done |

### Files Modified

| File | Change | Status |
|------|--------|--------|
| `backend/src/api/app.ts` | Added semantic-import routes | Done |
| `backend/src/shared/db/data-source.ts` | Added ImportHistory entity | Done |
| `backend/src/shared/models/index.ts` | Exported ImportHistory | Done |

### API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/v1/semantic-import/analyze` | POST | Analyze screenshot with Claude Vision | Done |
| `/api/v1/semantic-import/preview` | POST | Preview what will be created (dry-run) | Done |
| `/api/v1/semantic-import/execute` | POST | Execute the import | Done |
| `/api/v1/semantic-import/natural-language` | POST | Import from text description | Done |
| `/api/v1/semantic-import/templates` | GET | Get example descriptions | Done |
| `/api/v1/semantic-import/history` | GET | Get import history | Done |
| `/api/v1/semantic-import/:importId` | GET | Get import details | Done |

### Backend Features

- [x] Claude Vision: Analyzes PagerDuty/Opsgenie screenshots
- [x] Natural Language: Parse text descriptions
- [x] Preview Mode: Dry-run showing what will be created/skipped
- [x] Transaction Support: All-or-nothing import with rollback
- [x] Rate Limiting: 10 requests/minute per user
- [x] Security: Image validation (10MB max, PNG/JPEG/WebP only)
- [x] TypeScript compilation passes

---

## Phase 2: Frontend Implementation - MOSTLY COMPLETE

### File Structure (Implemented)

```
frontend/src/features/semanticImport/
├── api/
│   └── semanticImportApi.ts          # ✅ Type-safe API client
├── hooks/                             # (Optional - API used directly in components)
├── components/
│   ├── ScreenshotImportPanel.tsx     # ✅ Drag & drop upload + analysis
│   ├── NaturalLanguageImportPanel.tsx # ✅ Text input + templates
│   ├── ImportPreviewPanel.tsx        # ✅ Preview diff view + execution
│   ├── ImportHistoryTable.tsx        # ✅ Paginated history table
│   └── ImportHistoryDetail.tsx       # ✅ Single import detail view
├── types/
│   └── index.ts                      # ✅ All TypeScript interfaces
├── SemanticImportPage.tsx            # ✅ Main page with tabs + wizard flow
└── index.ts                          # ✅ Feature exports
```

### Frontend Components Status

| Component | Description | Status |
|-----------|-------------|--------|
| `semanticImportApi.ts` | Type-safe API wrapper with RateLimitError handling | ✅ Done |
| `SemanticImportPage.tsx` | Main page with tab navigation and wizard flow | ✅ Done |
| `ScreenshotImportPanel.tsx` | Drag & drop screenshot upload with validation | ✅ Done |
| `NaturalLanguageImportPanel.tsx` | Text input + template selector | ✅ Done |
| `ImportPreviewPanel.tsx` | Diff-like preview of changes + execution | ✅ Done |
| `ImportHistoryTable.tsx` | Paginated history table with filters | ✅ Done |
| `ImportHistoryDetail.tsx` | Detail view for single import | ✅ Done |
| `types/index.ts` | TypeScript interfaces | ✅ Done |

### UX Flows Implemented

#### A. Screenshot Import (Claude Vision) ✅
- [x] Drag & drop + file picker UI
- [x] Client-side validation (10MB max, PNG/JPEG/WebP)
- [x] Error messages for invalid files
- [x] Loading state during analysis
- [x] Rate-limit error handling
- [x] Parsed entities display (collapsible panels)

#### B. Natural Language Import ✅
- [x] Text area for descriptions
- [x] Template dropdown from GET /templates
- [x] Click-to-populate templates
- [x] Submit and display parsed result

#### C. Preview & Execute ✅
- [x] "Preview import" button -> POST /preview
- [x] Diff-like preview (created/updated/skipped)
- [x] Warnings and conflicts display
- [x] "Execute import" button with confirmation dialog
- [x] Success/failure/rollback messaging

#### D. Import History & Details ✅
- [x] History table with pagination
- [x] Columns: timestamp, type, status, entities, user
- [x] Filters by status, type, date range
- [x] Click row -> detail view
- [x] Detail: metadata, input, results, errors

---

## TypeScript Interfaces (Reference)

```typescript
// Extraction result from Claude Vision
interface ImportExtraction {
  confidence: number; // 0-1
  sourceDetected: 'pagerduty' | 'opsgenie' | 'unknown';

  teams: Array<{
    name: string;
    members: Array<{ name: string; email?: string; role?: string }>;
  }>;

  schedules: Array<{
    name: string;
    teamName?: string;
    timezone?: string;
    rotationType: 'daily' | 'weekly' | 'custom';
    handoffTime?: string;
    handoffDay?: string;
    participants: Array<{ name: string; email?: string }>;
    layers?: Array<{
      name: string;
      rotationType: string;
      participants: string[];
    }>;
  }>;

  escalationPolicies: Array<{
    name: string;
    steps: Array<{
      delayMinutes: number;
      targets: Array<{ type: 'user' | 'schedule'; name: string }>;
    }>;
  }>;

  services: Array<{
    name: string;
    description?: string;
    escalationPolicyName?: string;
    teamName?: string;
  }>;

  warnings: string[];
  suggestions: string[];
}

// Import history entry
interface ImportHistoryEntry {
  id: string;
  orgId: string;
  userId: string;
  sourceType: 'pagerduty' | 'opsgenie' | 'screenshot' | 'natural_language';
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  extractionResult: ImportExtraction;
  executionResult: {
    created: { type: string; name: string; id: string }[];
    skipped: { type: string; name: string; reason: string }[];
    failed: { type: string; name: string; error: string }[];
  };
  createdAt: string;
  completedAt?: string;
}
```

---

## Route Integration

Add to frontend router:
```tsx
<Route path="/semantic-import" element={<SemanticImportPage />} />
```

Add to sidebar navigation (Settings or Import section).

---

## Security Constraints

- [x] Backend: Image validation (10MB max, PNG/JPEG/WebP only)
- [x] Backend: No raw images stored in database
- [x] Frontend: Client-side file validation before upload
- [x] Frontend: Clear messaging that images are not persisted
- [x] Frontend: Don't log image data to console

---

## Testing Considerations

- Handle blurry/low-quality images gracefully
- Handle partial screenshots (only part of config visible)
- Handle non-English screenshots if possible
- Rate limit prevents abuse (10 req/min)

---

## Deployment Notes

After frontend implementation:
1. Run `npm run build` in frontend
2. Run `./deploy.sh` to deploy both frontend and backend
3. Migration 042 will run automatically

---

## Related Files

- Backend patterns: `backend/src/shared/services/ai-assistant-service.ts`
- Existing AI routes: `backend/src/api/routes/ai-assistant.ts`
- Models: `backend/src/shared/models/` (Team, User, Schedule, EscalationPolicy, Service)

---

## Integration Complete

- [x] **Route added to frontend router** - `frontend/src/App.tsx:333-340`
  - Route: `/settings/semantic-import`
  - Admin-only access via `AdminWithLayout` wrapper

- [x] **Sidebar navigation added** - `frontend/src/components/Sidebar.tsx:263`
  - Label: "AI Import"
  - Location: Settings section

## Ready to Deploy

Run `./deploy.sh` to deploy both frontend and backend changes

## Verification Commands

```bash
# Backend TypeScript check
cd backend && npx tsc --noEmit

# Frontend TypeScript check
cd frontend && npx tsc -b

# Check migration exists
ls -la backend/src/shared/db/migrations/042*

# Check frontend components
ls -la frontend/src/features/semanticImport/
```
