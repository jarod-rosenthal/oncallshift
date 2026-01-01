# Web App Phase 1 Improvements - Agent Prompt

You are implementing Phase 1 "Quick Wins" improvements for the OnCallShift web application. The mobile app has already implemented these features - use the patterns below as reference.

## Project Context
- **Stack**: React + Vite + TypeScript + TanStack Query
- **Frontend Location**: `frontend/src/`
- **API Backend**: `backend/src/api/routes/`
- **Key Pages**: `frontend/src/pages/`
- **Components**: `frontend/src/components/`

## Tasks to Implement

---

### 1. Required Resolution Summary Modal

**Goal**: When resolving an incident, require users to provide root cause and resolution details.

**Backend Changes** (if not already done):
The resolve endpoint should accept extended data. Check `backend/src/api/routes/incidents.ts` for the resolve endpoint and ensure it accepts:

```typescript
interface ResolutionData {
  rootCause?: string;        // e.g., 'configuration', 'deployment', 'capacity', 'false_alarm', etc.
  resolutionSummary?: string; // Required text describing the fix
  followUpRequired?: boolean;
  followUpUrl?: string;      // Optional Jira/ticket link
  note?: string;             // Legacy support
}
```

**Frontend Changes**:

1. Create `frontend/src/components/ResolveIncidentModal.tsx`:

```tsx
// Root cause options
const ROOT_CAUSE_OPTIONS = [
  { id: 'configuration', label: 'Configuration Change', icon: 'Settings' },
  { id: 'deployment', label: 'Deployment/Release', icon: 'Rocket' },
  { id: 'capacity', label: 'Capacity/Scaling', icon: 'TrendingUp' },
  { id: 'external_dependency', label: 'External Dependency', icon: 'Cloud' },
  { id: 'infrastructure', label: 'Infrastructure Issue', icon: 'Server' },
  { id: 'code_bug', label: 'Code Bug', icon: 'Bug' },
  { id: 'false_alarm', label: 'False Alarm', icon: 'ShieldCheck' },
  { id: 'transient', label: 'Transient/Self-Resolved', icon: 'Zap' },
  { id: 'unknown', label: 'Unknown/Under Investigation', icon: 'HelpCircle' },
];

interface ResolutionData {
  rootCause: string;
  resolutionSummary: string;
  followUpRequired: boolean;
  followUpUrl?: string;
}

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (data: ResolutionData) => Promise<void>;
  incidentTitle?: string;
  isLoading?: boolean;
}
```

**Modal Flow**:
- Step 1: Select root cause (radio buttons with icons)
- Step 2: Enter resolution summary (required, min 10 chars) + follow-up toggle
- Validate before allowing submit

2. Update `frontend/src/pages/IncidentDetail.tsx`:
- Import and use the new `ResolveIncidentModal`
- Replace direct resolve with modal flow
- Update the API call to include resolution data:

```typescript
const handleResolve = async (data: ResolutionData) => {
  await resolveIncident(incidentId, {
    ...data,
    // Format note for backend compatibility
    note: `[${data.rootCause.toUpperCase().replace(/_/g, ' ')}] ${data.resolutionSummary}${
      data.followUpRequired ? ` (Follow-up required${data.followUpUrl ? `: ${data.followUpUrl}` : ''})` : ''
    }`
  });
};
```

---

### 2. False Alarm Dismissal Button

**Goal**: One-click "False Alarm" button that quickly resolves incidents marked as false positives.

**Frontend Changes**:

1. Add to incident detail action buttons (next to Acknowledge/Resolve):

```tsx
<Button
  variant="outline"
  onClick={handleFalseAlarm}
  disabled={isLoading}
>
  <ShieldCheck className="w-4 h-4 mr-2" />
  False Alarm
</Button>
```

2. Handler function:

```typescript
const handleFalseAlarm = async () => {
  try {
    await resolveIncident(incidentId, {
      rootCause: 'false_alarm',
      resolutionSummary: 'Alert triggered incorrectly. No actual issue detected.',
      followUpRequired: false,
    });
    toast.success('Dismissed as false alarm');
    refetch();
  } catch (error) {
    toast.error('Failed to dismiss incident');
  }
};
```

3. Show for `triggered` and `acknowledged` states.

---

### 3. Service Health Context Badge

**Goal**: Show incident frequency for the affected service on the incident detail page.

**Backend Changes**:
Add endpoint or modify service endpoint to return incident counts:

```typescript
// GET /api/v1/services/:id/health
interface ServiceHealth {
  incidentsLast7Days: number;
  incidentsPrevious7Days: number;
  trend: 'up' | 'down' | 'stable';
  lastIncidentAt?: string;
}
```

Or compute client-side by querying recent incidents for the service.

**Frontend Changes**:

1. Create `frontend/src/components/ServiceHealthBadge.tsx`:

```tsx
interface ServiceHealthBadgeProps {
  serviceId: string;
  serviceName: string;
}

export function ServiceHealthBadge({ serviceId, serviceName }: ServiceHealthBadgeProps) {
  const { data } = useQuery(['service-health', serviceId], () =>
    fetchServiceIncidentCount(serviceId, 7) // last 7 days
  );

  if (!data || data.count === 0) return null;

  const trend = data.count > data.previousCount ? '↑' :
                data.count < data.previousCount ? '↓' : '';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
      <Activity className="w-4 h-4 text-gray-500" />
      <span className="text-sm">
        {serviceName}: {data.count} incidents this week {trend && `(${trend})`}
      </span>
    </div>
  );
}
```

2. Add to incident detail page header area, near the service name.

---

### 4. State Clarity Improvements

**Goal**: Make incident ownership and status immediately visible.

**Changes to Incident Detail Header**:

1. **Owner Avatar with Status**:
```tsx
<div className="flex items-center gap-3">
  {/* Owner info */}
  {incident.acknowledgedBy ? (
    <div className="flex items-center gap-2">
      <Avatar
        src={incident.acknowledgedBy.avatarUrl}
        fallback={incident.acknowledgedBy.fullName?.charAt(0)}
        className="w-8 h-8 ring-2 ring-yellow-400" // Yellow = acknowledged
      />
      <div>
        <span className="text-sm font-medium">{incident.acknowledgedBy.fullName}</span>
        <span className="text-xs text-gray-500 block">Owner</span>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2 text-red-500">
      <AlertCircle className="w-5 h-5" />
      <span className="text-sm font-medium">Unassigned</span>
    </div>
  )}
</div>
```

2. **Status Badge with Duration**:
```tsx
function getStatusBadge(incident: Incident) {
  const duration = formatDuration(
    incident.state === 'resolved'
      ? incident.resolvedAt
      : incident.acknowledgedAt || incident.triggeredAt
  );

  const configs = {
    triggered: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: AlertCircle,
      label: 'Active'
    },
    acknowledged: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: Clock,
      label: 'Acknowledged'
    },
    resolved: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: CheckCircle,
      label: 'Resolved'
    }
  };

  const config = configs[incident.state];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.color}`}>
      <Icon className="w-4 h-4" />
      <span className="font-medium">{config.label}</span>
      <span className="text-xs opacity-75">({duration})</span>
    </div>
  );
}
```

3. **Escalation Preview** (if triggered/acknowledged):
```tsx
{incident.state !== 'resolved' && incident.escalationPolicy && (
  <div className="flex items-center gap-2 text-sm">
    <Clock className="w-4 h-4 text-gray-400" />
    <span>
      Next escalation in <strong>{formatTimeRemaining(nextEscalationAt)}</strong>
      {' → '}{nextEscalationTarget?.fullName || 'Manager'}
    </span>
  </div>
)}
```

---

### 5. Terminology Change: "Triggered" → "Active"

**Goal**: Replace all user-facing instances of "Triggered" with "Active".

**Files to Update** (search for "triggered" or "Triggered"):
- `frontend/src/pages/Dashboard.tsx` - Status breakdown labels
- `frontend/src/pages/Incidents.tsx` - Filter chips, status displays
- `frontend/src/pages/IncidentDetail.tsx` - Status badges, event labels
- `frontend/src/components/IncidentCard.tsx` - Status badge text
- `frontend/src/components/FilterPanel.tsx` - Status filter options
- Any analytics/stats components

**Pattern**:
```tsx
// Display text only - keep internal state as 'triggered'
{incident.state === 'triggered' ? 'Active' : incident.state}
```

**DO NOT change**:
- API values (`state: 'triggered'`)
- Variable names (`triggeredAt`, etc.)
- Internal logic checks

---

## File Structure Reference

```
frontend/src/
├── components/
│   ├── ResolveIncidentModal.tsx    # NEW - Required resolution modal
│   ├── ServiceHealthBadge.tsx      # NEW - Service health context
│   ├── IncidentCard.tsx            # UPDATE - terminology
│   └── FilterPanel.tsx             # UPDATE - terminology
├── pages/
│   ├── Dashboard.tsx               # UPDATE - terminology
│   ├── Incidents.tsx               # UPDATE - terminology
│   └── IncidentDetail.tsx          # UPDATE - resolve flow, false alarm, state clarity
└── services/
    └── api.ts                      # UPDATE - resolve endpoint params
```

---

## Testing Checklist

- [ ] Resolve modal requires root cause selection
- [ ] Resolve modal requires resolution summary (min 10 chars)
- [ ] Follow-up toggle works with optional URL field
- [ ] False Alarm button resolves with correct root cause
- [ ] Service health badge shows incident count when > 0
- [ ] Owner avatar shows with status ring color
- [ ] Status badge shows duration
- [ ] "Active" displays instead of "Triggered" throughout
- [ ] All existing functionality still works

---

## Notes

- Match the existing design system (Tailwind classes, shadcn/ui components)
- Use TanStack Query for data fetching
- Follow existing patterns in the codebase
- Test with both light and dark themes
