# Layout Components

Layout components for the Interface Built Right Dashboard (Design 3).

## Components

### Header
Fixed header at the top of the page (56px height).

**Props:**
- `onToggleLibrary: () => void` - Callback when hamburger menu is clicked
- `onNewSession: () => void` - Callback when "New Session" button is clicked

**Features:**
- Hamburger menu button (left side)
- "Interface Built Right" branding
- "New Session" primary button
- Settings button

### LibraryPanel
Left sidebar for browsing sessions (240px width).

**Props:**
- `open?: boolean` - Whether panel is visible (for mobile)
- `sessions: Session[]` - Array of session objects
- `selectedId?: string` - Currently selected session ID
- `onSelect: (id: string) => void` - Callback when session is selected
- `filter: FilterType` - Current filter ('all' | 'changed' | 'broken')
- `onFilterChange: (filter: FilterType) => void` - Callback when filter changes
- `onCheckAll: () => void` - Callback when "Check All" button is clicked
- `searchQuery?: string` - Current search query
- `onSearchChange?: (query: string) => void` - Callback when search changes

**Session Object:**
```typescript
{
  id: string;
  name: string;
  thumbnail?: string;
  status: 'match' | 'changed' | 'broken' | 'pending';
  metadata: string; // e.g., "8.2% changed" or "Match"
}
```

**Features:**
- Search input
- Filter buttons (All, Changed, Broken)
- Scrollable session list with thumbnails
- Status indicators (colored dots)
- "Check All" action button
- Responsive (slides from left on mobile)

### DetailsPanel
Right sidebar for session details (280px width).

**Props:**
- `open?: boolean` - Whether panel is visible (for mobile)
- `session?: SessionDetails` - Session details object
- `onCheck?: () => void` - Callback for "Compare Again" button
- `onAccept?: () => void` - Callback for "Accept as Baseline" button
- `onDelete?: () => void` - Callback for "Delete Session" button
- `onFeedbackSubmit?: (feedback: string) => void` - Callback when feedback is submitted

**SessionDetails Object:**
```typescript
{
  id: string;
  name: string;
  url: string;
  viewport: string; // e.g., "Desktop (1920×1080)"
  timestamp: string; // e.g., "Dec 29, 10:30 AM"
  verdict: 'match' | 'expected' | 'changed' | 'broken' | 'pending';
  difference: string; // e.g., "8.2%"
  pixelsChanged: string; // e.g., "6,560 changed"
  analysis: string; // AI-generated analysis text
}
```

**Features:**
- Session info section
- Comparison statistics
- AI analysis text
- Action buttons (Compare Again, Accept, Delete)
- Feedback textarea with submit
- Empty state when no session selected
- Responsive (slides from right on mobile)

## Usage Example

```tsx
'use client';

import { useState } from 'react';
import { Header, LibraryPanel, DetailsPanel } from '@/components/layout';
import type { Session, SessionDetails } from '@/components/layout';

export default function DashboardPage() {
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [filter, setFilter] = useState<'all' | 'changed' | 'broken'>('all');
  const [selectedId, setSelectedId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');

  const sessions: Session[] = [
    {
      id: '1',
      name: 'Dashboard',
      thumbnail: 'https://placehold.co/96x72/1a1a1a/fff?text=D',
      status: 'changed',
      metadata: '8.2% changed',
    },
    {
      id: '2',
      name: 'Settings',
      thumbnail: 'https://placehold.co/96x72/f5f5f5/333?text=S',
      status: 'match',
      metadata: 'Match',
    },
    // ... more sessions
  ];

  const sessionDetails: SessionDetails = {
    id: '1',
    name: 'Dashboard',
    url: 'http://localhost:3000/dashboard',
    viewport: 'Desktop (1920×1080)',
    timestamp: 'Dec 29, 10:30 AM',
    verdict: 'expected',
    difference: '8.2%',
    pixelsChanged: '6,560 changed',
    analysis: 'Header background changed from light (#f5f5f5) to dark (#1a1a1a). Layout structure unchanged.',
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        onToggleLibrary={() => setLibraryOpen(!libraryOpen)}
        onNewSession={() => console.log('New session')}
      />

      <div className="flex flex-1 overflow-hidden">
        <LibraryPanel
          open={libraryOpen}
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filter={filter}
          onFilterChange={setFilter}
          onCheckAll={() => console.log('Check all')}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Your main canvas/content area */}
        <main className="flex-1 bg-gray-100 p-4">
          {/* Canvas content */}
        </main>

        <DetailsPanel
          open={detailsOpen}
          session={sessionDetails}
          onCheck={() => console.log('Compare again')}
          onAccept={() => console.log('Accept baseline')}
          onDelete={() => console.log('Delete session')}
          onFeedbackSubmit={(feedback) => console.log('Feedback:', feedback)}
        />
      </div>
    </div>
  );
}
```

## Styling

All components use Tailwind CSS classes based on Design 3 specifications:

- **Colors:** Gray scale (50-900), status colors (green-600, amber-600, red-600, blue-600)
- **Typography:** Three-line hierarchy (15px title, 13px description, 11px metadata)
- **Spacing:** Consistent padding and gaps following 8pt grid
- **Borders:** border-gray-200 for main borders, border-gray-100 for subtle dividers
- **Section Headers:** 11px uppercase, gray-500, tracking-wide

## Responsive Behavior

- **Desktop (>1024px):** All panels visible, fixed widths
- **Mobile (≤1024px):** Panels slide from sides, controlled by `open` prop
  - Library panel slides from left
  - Details panel slides from right
  - Header remains fixed at top
