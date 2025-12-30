# Interface-Built-Right Web UI Library

Core types, API client, and React hooks for the Design 3 dashboard.

## Structure

```
lib/
├── types.ts              # TypeScript type definitions
├── api.ts                # API client functions
├── utils.ts              # Utility functions and helpers
├── index.ts              # Barrel export
└── hooks/
    ├── useSessions.ts       # Fetch sessions list
    ├── useSession.ts        # Fetch single session
    ├── useSessionActions.ts # Mutation hooks
    └── index.ts             # Barrel export
```

## Usage

### Import from main barrel export

```typescript
import {
  // Types
  type Session,
  type Viewport,
  type ComparisonReport,

  // API functions
  getSessions,
  createSession,

  // Hooks
  useSessions,
  useSessionActions,

  // Utils
  formatRelativeTime,
  getVerdictColor,
} from '@/lib';
```

### Hooks

#### useSessions - Fetch all sessions

```typescript
'use client';

import { useSessions } from '@/lib/hooks';

export default function SessionsList() {
  const { sessions, loading, error, refetch } = useSessions();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id}>{session.name}</div>
      ))}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

#### useSession - Fetch single session

```typescript
'use client';

import { useSession } from '@/lib/hooks';

export default function SessionDetail({ id }: { id: string }) {
  const { session, loading, error, refetch } = useSession(id);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!session) return <div>Not found</div>;

  return <div>{session.name}</div>;
}
```

#### useSessionActions - Mutations

```typescript
'use client';

import { useSessionActions } from '@/lib/hooks';

export default function SessionActions() {
  const {
    creating,
    deleting,
    checking,
    accepting,
    error,
    create,
    remove,
    check,
    accept,
    checkMultiple,
  } = useSessionActions();

  const handleCreate = async () => {
    const session = await create({
      url: 'https://example.com',
      name: 'Example',
    });
    if (session) {
      console.log('Created:', session);
    }
  };

  const handleCheck = async (id: string) => {
    const report = await check(id);
    if (report) {
      console.log('Comparison:', report);
    }
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={creating}>
        {creating ? 'Creating...' : 'Create Session'}
      </button>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
```

### API Client

Direct API calls without hooks:

```typescript
import {
  getSessions,
  getSession,
  createSession,
  deleteSession,
  checkSession,
  acceptSession,
  batchCheck,
} from '@/lib/api';

// Get all sessions
const sessions = await getSessions();

// Get single session
const session = await getSession('session-id');

// Create new session
const newSession = await createSession({
  url: 'https://example.com',
  name: 'My Test',
  viewport: { name: 'desktop', width: 1920, height: 1080 },
});

// Delete session
await deleteSession('session-id');

// Run comparison check
const report = await checkSession('session-id');

// Accept current as new baseline
const updatedSession = await acceptSession('session-id');

// Batch check multiple sessions
const results = await batchCheck(['id1', 'id2', 'id3']);
```

### Utilities

```typescript
import {
  DEFAULT_VIEWPORTS,
  formatRelativeTime,
  formatDate,
  filterSessions,
  getVerdictColor,
  getStatusColor,
  formatDiffPercent,
  generateSessionName,
  isValidUrl,
  sortSessionsByDate,
} from '@/lib/utils';

// Default viewport configurations
const desktop = DEFAULT_VIEWPORTS.desktop;
// { name: 'desktop', width: 1920, height: 1080 }

// Format dates
formatRelativeTime('2025-12-29T10:00:00Z'); // "2h ago"
formatDate('2025-12-29T10:00:00Z'); // "Dec 29, 2025, 10:00 AM"

// Filter sessions
const changedSessions = filterSessions(sessions, 'changed');
const brokenSessions = filterSessions(sessions, 'broken');

// Get CSS color classes
getVerdictColor('LAYOUT_BROKEN'); // "text-red-600"
getStatusColor('compared'); // "text-green-600"

// Format diff percentage
formatDiffPercent(0.005); // "<0.01%"
formatDiffPercent(2.456); // "2.46%"

// Generate session name from URL
generateSessionName('https://example.com/about'); // "example.com/about"

// Validate URL
isValidUrl('https://example.com'); // true
isValidUrl('not-a-url'); // false

// Sort sessions by date (newest first)
const sorted = sortSessionsByDate(sessions);
```

## Types

### Core Types

```typescript
interface Viewport {
  name: 'desktop' | 'mobile' | 'tablet';
  width: number;
  height: number;
}

interface Session {
  id: string;
  name: string;
  url: string;
  viewport: Viewport;
  status: 'baseline' | 'compared' | 'pending';
  createdAt: string;
  updatedAt: string;
  comparison?: ComparisonResult;
  analysis?: Analysis;
}

interface ComparisonResult {
  match: boolean;
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
}

interface Analysis {
  verdict: 'MATCH' | 'EXPECTED_CHANGE' | 'UNEXPECTED_CHANGE' | 'LAYOUT_BROKEN';
  summary: string;
  recommendation: string | null;
}

interface ComparisonReport {
  sessionId: string;
  comparison: ComparisonResult;
  analysis: Analysis;
  files: {
    baseline: string;
    current: string;
    diff: string;
  };
}
```

### View Types

```typescript
type ViewMode = 'split' | 'overlay' | 'diff';
type FilterType = 'all' | 'changed' | 'broken';
```

## API Endpoints

All API functions communicate with these endpoints:

- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/[id]` - Get session details
- `DELETE /api/sessions/[id]` - Delete session
- `POST /api/sessions/[id]/check` - Run comparison check
- `POST /api/sessions/[id]/accept` - Accept current as baseline
- `POST /api/sessions/batch-check` - Check multiple sessions
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback` - Get all feedback

## Error Handling

All API functions and hooks handle errors gracefully:

```typescript
// Hooks expose error state
const { sessions, error } = useSessions();
if (error) {
  console.error('Failed to load sessions:', error);
}

// API functions throw errors
try {
  const session = await createSession({ url: 'invalid' });
} catch (error) {
  console.error('API error:', error.message);
}

// Action hooks return null on error
const { create, error } = useSessionActions();
const session = await create({ url: 'test' });
if (!session) {
  console.error('Creation failed:', error);
}
```

## Best Practices

1. **Use hooks in client components** - All hooks require `'use client'` directive
2. **Handle loading states** - Always show loading UI while fetching
3. **Handle errors gracefully** - Display user-friendly error messages
4. **Refetch after mutations** - Call `refetch()` after create/delete/update operations
5. **Validate URLs** - Use `isValidUrl()` before creating sessions
6. **Format user-facing data** - Use utility functions for dates, percentages, etc.
7. **Type everything** - Leverage TypeScript for type safety

## Example: Complete Session Management

```typescript
'use client';

import { useSessions, useSessionActions } from '@/lib/hooks';
import { formatRelativeTime, getVerdictColor } from '@/lib/utils';

export default function SessionManager() {
  const { sessions, loading, error, refetch } = useSessions();
  const { create, remove, check, creating } = useSessionActions();

  const handleCreateSession = async (url: string) => {
    const session = await create({ url });
    if (session) {
      await refetch(); // Refresh list
    }
  };

  const handleCheckSession = async (id: string) => {
    const report = await check(id);
    if (report) {
      await refetch(); // Refresh to show new comparison
    }
  };

  const handleDeleteSession = async (id: string) => {
    const success = await remove(id);
    if (success) {
      await refetch(); // Refresh list
    }
  };

  if (loading) return <div>Loading sessions...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id} className="border rounded p-4">
          <h3 className="font-medium">{session.name}</h3>
          <p className="text-gray-600 text-sm">{session.url}</p>
          <p className="text-gray-500 text-xs">
            {formatRelativeTime(session.updatedAt)}
          </p>
          {session.analysis && (
            <p className={getVerdictColor(session.analysis.verdict)}>
              {session.analysis.verdict}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleCheckSession(session.id)}>
              Check
            </button>
            <button onClick={() => handleDeleteSession(session.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```
