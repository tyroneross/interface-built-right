# Design 3 Implementation Plan

## Overview
Convert `designs/design-3-updated.html` into production React components with full API integration.

## Architecture

```
app/
├── page.tsx                          # Main dashboard (Library + Canvas + Details)
├── layout.tsx                        # Root layout
├── api/
│   └── sessions/                     # API routes (mostly done)
│       ├── route.ts                  # GET list, POST create
│       ├── [id]/route.ts             # GET detail, DELETE
│       ├── [id]/check/route.ts       # POST re-check
│       ├── [id]/accept/route.ts      # POST accept baseline
│       └── batch-check/route.ts      # POST batch check
│
components/
├── layout/
│   ├── Header.tsx                    # Top header with actions
│   ├── LibraryPanel.tsx              # Left sidebar with session list
│   └── DetailsPanel.tsx              # Right sidebar with session details
│
├── sessions/
│   ├── SessionCard.tsx               # Thumbnail card in library
│   ├── SessionList.tsx               # List of session cards
│   ├── SessionFilters.tsx            # Filter buttons (All/Changed/Broken)
│   ├── SessionSearch.tsx             # Search input
│   └── NewSessionModal.tsx           # Modal form for new session
│
├── comparison/
│   ├── ComparisonCanvas.tsx          # Main image comparison area
│   ├── ViewTabs.tsx                  # Split/Overlay/Diff tabs
│   ├── SplitView.tsx                 # Side-by-side comparison
│   ├── OverlayView.tsx               # Overlay with slider
│   └── DiffView.tsx                  # Diff image view
│
├── details/
│   ├── SessionInfo.tsx               # Session metadata
│   ├── ComparisonStats.tsx           # Diff stats
│   ├── AnalysisBlock.tsx             # Analysis text
│   ├── ActionButtons.tsx             # Compare/Accept/Delete buttons
│   └── FeedbackPanel.tsx             # Feedback textarea + send
│
└── ui/
    ├── Button.tsx                    # Reusable button component
    ├── Modal.tsx                     # Reusable modal
    ├── Badge.tsx                     # Status badge
    └── Skeleton.tsx                  # Loading skeleton

lib/
├── api.ts                            # API client functions
├── types.ts                          # TypeScript types
└── hooks/
    ├── useSessions.ts                # Sessions data hook
    ├── useSession.ts                 # Single session hook
    └── useSessionActions.ts          # Mutation hooks
```

## Phases

### Phase 1: Core Types & API Client ✅
- [x] Create `lib/types.ts` with Session, Comparison, Analysis types
- [x] Create `lib/api.ts` with fetch wrappers for all endpoints
- [x] Create data hooks in `lib/hooks/`

### Phase 2: UI Components ✅
- [x] Create base UI components (Button, Modal, Badge, Skeleton)
- [x] Create layout components (Header, LibraryPanel, DetailsPanel)
- [x] Create session components (SessionCard, SessionList, filters, search)
- [x] Create comparison components (Canvas, views)
- [x] Create details components (info, stats, actions, feedback)

### Phase 3: Page Integration ✅
- [x] Update `app/dashboard/page.tsx` to use new components
- [x] Wire up state management (selected session, view mode, filters)
- [x] Connect all API calls
- [x] Handle loading/error states

### Phase 4: Polish
- [x] Add skeleton loading states
- [x] Add empty states with CTAs
- [ ] Add keyboard navigation
- [x] Add responsive mobile layout (LibraryPanel slides from left on mobile)
- [ ] Test all interactions end-to-end

## API Contract

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/sessions` | GET | - | `{ sessions: Session[] }` |
| `/api/sessions` | POST | `{ url, name?, viewport? }` | `{ session, sessionId }` |
| `/api/sessions/[id]` | GET | - | `{ session }` |
| `/api/sessions/[id]` | DELETE | - | `{ success, deleted }` |
| `/api/sessions/[id]/check` | POST | - | `{ session, report }` |
| `/api/sessions/[id]/accept` | POST | - | `{ success, session }` |
| `/api/sessions/[id]/images/[type]` | GET | - | PNG image |
| `/api/sessions/batch-check` | POST | `{ sessionIds: string[] }` | `{ results, summary }` |
| `/api/feedback` | POST | `{ sessionId, feedback }` | `{ success, path }` |
| `/api/feedback` | GET | - | `{ feedback }` |

## State Management

```typescript
// Main page state
interface DashboardState {
  sessions: Session[];
  selectedSessionId: string | null;
  viewMode: 'split' | 'overlay' | 'diff';
  filter: 'all' | 'changed' | 'broken';
  searchQuery: string;
  isLoading: boolean;
  isNewSessionOpen: boolean;
}
```

## Validation Checkpoints

1. After Phase 1: All API calls work from browser console
2. After Phase 2: All components render with mock data
3. After Phase 3: Full integration works end-to-end
4. After Phase 4: Responsive, accessible, polished

## Success Criteria

- [x] Can create new session from UI (NewSessionModal → POST /api/sessions)
- [x] Can view all sessions in library panel (LibraryPanel + useSessions hook)
- [x] Can select session and see comparison (ComparisonCanvas)
- [x] Can switch between Split/Overlay/Diff views (ViewTabs + view components)
- [x] Can re-check comparison from UI (ActionButtons → POST /api/sessions/[id]/check)
- [x] Can accept current as new baseline (ActionButtons → POST /api/sessions/[id]/accept)
- [x] Can delete session (ActionButtons → DELETE /api/sessions/[id])
- [x] Can filter by status (SessionFilters in LibraryPanel)
- [x] Can search sessions (SessionSearch in LibraryPanel with 300ms debounce)
- [x] Can submit feedback (FeedbackPanel → POST /api/feedback)
- [x] Loading states show skeletons (SplitView, OverlayView, DiffView)
- [x] Empty states show CTAs (dashboard empty state, LibraryPanel empty state)
- [x] Mobile responsive (LibraryPanel/DetailsPanel slide from edges)
