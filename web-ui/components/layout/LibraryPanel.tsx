'use client';

import React, { useState, useCallback } from 'react';

type SessionStatus = 'match' | 'changed' | 'broken' | 'pending' | 'active' | 'closed';

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  metadata: string;
  type?: 'capture' | 'reference' | 'interactive';
}

interface LibraryPanelProps {
  sessions: Session[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const statusDotColors: Record<SessionStatus, string> = {
  match: 'bg-[#34d399]',
  changed: 'bg-[#fbbf24]',
  broken: 'bg-[#fb7185]',
  pending: 'bg-[#5a5a72]',
  active: 'bg-[#818cf8]',
  closed: 'bg-[#5a5a72]',
};

export function LibraryPanel({
  sessions,
  selectedId,
  onSelect,
  searchQuery = '',
  onSearchChange,
}: LibraryPanelProps) {
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        onSearchChange?.(value);
      }, 300);
      setDebounceTimer(timer);
      // Immediate visual update
      onSearchChange?.(value);
    },
    [debounceTimer, onSearchChange]
  );

  return (
    <aside
      className="flex flex-col shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl"
      style={{ width: 220 }}
    >
      {/* Search */}
      <div className="p-3">
        <input
          type="search"
          defaultValue={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="glass-input w-full h-10"
          placeholder="Search..."
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[#5a5a72]">No sessions found</p>
            </div>
          ) : (
            sessions.map((session, i) => (
              <div
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors duration-200
                  ${i > 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''}
                  ${selectedId === session.id
                    ? 'bg-[rgba(255,255,255,0.05)] border-l-2 border-l-[#818cf8]'
                    : 'hover:bg-[rgba(255,255,255,0.025)]'
                  }
                `}
              >
                {/* Name + status dot */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColors[session.status]}`}
                  />
                  <span className="text-[13px] font-medium text-[#f0f0f5] truncate">
                    {session.name}
                  </span>
                </div>
                {/* Diff percentage */}
                <span className="text-[11px] text-[#5a5a72] shrink-0">
                  {session.metadata}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
