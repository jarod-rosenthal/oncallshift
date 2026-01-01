# Feature Parity Tracker: Mobile vs Web

This document tracks feature implementation status across platforms to ensure consistent UX.

## Phase 1: Quick Wins

| Feature | Mobile | Web | Notes |
|---------|--------|-----|-------|
| Toast notifications | ✅ | ✅ | Both have contextual messages |
| Confetti on resolve | ✅ | ✅ | Celebration effect |
| Sticky action bar | ✅ | ✅ | Quick actions at bottom |
| Empty states | ✅ | ✅ | Contextual empty views |
| Required Resolution Modal | ✅ | ⚠️ | Mobile has root cause dropdown + required summary |
| False Alarm button | ✅ | ⚠️ | One-click dismiss as false alarm |
| Service Health Badge | ✅ | ⚠️ | Shows incident count for service this week |
| State clarity (owner avatar + duration) | ✅ | ⚠️ | Enhanced header with owner ring + time in state |
| "Triggered" → "Active" terminology | ✅ | ⚠️ | User-facing text change |

**Legend:** ✅ = Implemented, ⚠️ = Needs implementation, ❌ = Not planned

## Phase 2: Smart Context

| Feature | Mobile | Web | Backend | Notes |
|---------|--------|-----|---------|-------|
| Similar Incident Hint | ✅ | ✅ | ✅ | Prominent display with resolution hint |
| Smart Runbook suggestions | ⚠️ | ⚠️ | ✅ | Backend ready, UI enhancement pending |
| Auto-suggested severity | ✅ | ✅ | ✅ | Backend infers on ingest, both UIs benefit |
| Incident title cleanup | ✅ | ✅ | ✅ | Backend cleans on ingest, both UIs benefit |
| On-Call awareness banner | ✅ | ⚠️ | ✅ | Mobile done, web pending (styling agent) |
| Shift Handoff Notes | ✅ | ⚠️ | ✅ | Backend + mobile done, web pending |

## Phase 3: Automation & Intelligence

| Feature | Mobile | Web | Backend | Notes |
|---------|--------|-----|---------|-------|
| Push notification acknowledge | ⚠️ | N/A | ⚠️ | Mobile-only |
| SMS reply acknowledgment | N/A | N/A | ⚠️ | Backend only |
| Slack interactive buttons | N/A | N/A | ⚠️ | Backend only |
| Alert grouping | ⚠️ | ⚠️ | ⚠️ | Parent/child incidents |
| Auto-generated postmortem | ⚠️ | ⚠️ | ⚠️ | Claude-powered drafts |
| Status update templates | ⚠️ | ⚠️ | ⚠️ | One-click Slack updates |

## Phase 4: Analytics & Learning

| Feature | Mobile | Web | Backend | Notes |
|---------|--------|-----|---------|-------|
| Metrics dashboard | ⚠️ | ⚠️ | ⚠️ | MTTA, MTTR, volume |
| Weekly email digest | N/A | N/A | ⚠️ | Backend only |
| Repeat incident detection | ⚠️ | ⚠️ | ⚠️ | Alert on patterns |
| On-call load report | ⚠️ | ⚠️ | ⚠️ | Fairness metrics |
| Service reliability scores | ⚠️ | ⚠️ | ⚠️ | Health scores |

---

## Action Items

### Immediate (Web needs to catch up on Phase 1):
1. Add ResolveIncidentModal with root cause dropdown
2. Add False Alarm button
3. Add ServiceHealthBadge component
4. Add state clarity improvements (owner avatar + duration)
5. Change "Triggered" to "Active" in UI

### Current (Phase 2 COMPLETE for backend + mobile):
1. ✅ Similar Incident matching (backend + mobile + web complete)
2. ✅ Smart Runbook suggestions (backend complete, UI pending)
3. ✅ Auto-suggested severity (backend infers on ingest)
4. ✅ Incident title cleanup (backend cleans on ingest)
5. ✅ On-Call awareness banner (mobile complete, web pending)
6. ✅ Shift Handoff Notes (backend + mobile complete, web pending)

### Deployment Status (2024-12-31):
- Backend: Deploying...
- Mobile: Pending EAS build
- Web: No changes required for Phase 2 backend features
