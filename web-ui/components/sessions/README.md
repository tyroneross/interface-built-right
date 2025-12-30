# Session Components

Design 3 dashboard components for the Interface Built Right web UI.

## Components

### SessionCard
Thumbnail card for displaying a session in the library panel.

**Features:**
- Small thumbnail image (48×36px)
- Status dot in top-right corner (green/amber/red/gray)
- Session name and metadata
- Selected state with blue border and background
- Hover state

**Props:**
```tsx
interface SessionCardProps {
  session: {
    id: string;
    name: string;
    url: string;
    status: 'match' | 'changed' | 'broken' | 'pending';
    diffPercent?: number;
    createdAt: string;
  };
  selected: boolean;
  onClick: () => void;
}
```

### SessionList
Scrollable list container for SessionCards with empty state.

**Props:**
```tsx
interface SessionListProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}
```

### SessionFilters
Filter buttons for All/Changed/Broken sessions.

**Props:**
```tsx
interface SessionFiltersProps {
  value: 'all' | 'changed' | 'broken';
  onChange: (value: 'all' | 'changed' | 'broken') => void;
}
```

### SessionSearch
Debounced search input (300ms) with search icon.

**Props:**
```tsx
interface SessionSearchProps {
  value: string;
  onChange: (value: string) => void;
}
```

### NewSessionModal
Modal form for creating new sessions.

**Features:**
- URL field (required)
- Session name field (optional)
- Viewport dropdown (Desktop/Tablet/Mobile)
- Loading state on submit
- Keyboard accessible (ESC to close)
- Click overlay to close

**Props:**
```tsx
interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { url: string; name: string; viewport: string }) => void | Promise<void>;
  isLoading?: boolean;
}
```

## Usage Example

```tsx
'use client';

import { useState } from 'react';
import {
  SessionList,
  SessionFilters,
  SessionSearch,
  NewSessionModal,
} from '@/components/sessions';

export default function LibraryPanel() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'changed' | 'broken'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async (data) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const newSession = await response.json();
      setSessions([...sessions, newSession]);
      setModalOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    // Apply filter
    if (filter === 'changed' && session.status !== 'changed') return false;
    if (filter === 'broken' && session.status !== 'broken') return false;

    // Apply search
    if (search && !session.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <>
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <SessionSearch value={search} onChange={setSearch} />
        <SessionFilters value={filter} onChange={setFilter} />
        <SessionList
          sessions={filteredSessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full h-10 bg-gray-900 text-white rounded-lg text-sm font-medium"
          >
            New Session
          </button>
        </div>
      </aside>

      <NewSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateSession}
        isLoading={isCreating}
      />
    </>
  );
}
```

## Design Compliance

All components follow **Calm Precision 6.1** guidelines:

- **Three-line hierarchy**: Title (13-15px, medium) → Description (11-12px) → Metadata (11px, muted)
- **Grouped containers**: Single border around list, dividers between items
- **Button sizing**: Full-width for core conversion (Capture Baseline), compact for quick actions (filters)
- **Progressive disclosure**: Empty state shows guidance, not just "no results"
- **Debounced search**: 300ms delay for performance
- **Touch targets**: Minimum 44px on mobile, 24px on desktop
- **Text color for status**: No background boxes, just colored dots
- **Natural language**: "Not compared" instead of "PENDING"
- **Loading states**: Spinner for 100ms-1s operations

## File Locations

```
/Users/tyroneross/Desktop/git-folder/interface-built-right/web-ui/components/sessions/
├── SessionCard.tsx         # Individual session thumbnail
├── SessionList.tsx         # Scrollable list with empty state
├── SessionFilters.tsx      # Filter buttons (All/Changed/Broken)
├── SessionSearch.tsx       # Debounced search input
├── NewSessionModal.tsx     # Create session modal form
├── index.ts               # Barrel export
└── README.md              # This file
```

## Image Paths

Session thumbnails use: `/api/sessions/[id]/images/baseline`

The image component includes error handling to gracefully hide broken images.
