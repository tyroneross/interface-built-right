import React from 'react';

type FilterType = 'all' | 'changed' | 'broken';

type SessionStatus = 'match' | 'changed' | 'broken' | 'pending';

export interface Session {
  id: string;
  name: string;
  thumbnail?: string;
  status: SessionStatus;
  metadata: string;
}

interface LibraryPanelProps {
  open?: boolean;
  sessions: Session[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onCheckAll: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const statusColors: Record<SessionStatus, string> = {
  match: 'bg-green-600',
  changed: 'bg-amber-600',
  broken: 'bg-red-600',
  pending: 'bg-gray-400',
};

export function LibraryPanel({
  open = true,
  sessions,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  onCheckAll,
  searchQuery = '',
  onSearchChange,
}: LibraryPanelProps) {
  const panelClasses = [
    'w-60 bg-white border-r border-gray-200 flex flex-col shrink-0',
    'lg:relative lg:transform-none',
    'max-lg:fixed max-lg:left-0 max-lg:top-14 max-lg:bottom-0 max-lg:z-50',
    'max-lg:transition-transform max-lg:duration-200',
    open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
  ].join(' ');

  return (
    <aside className={panelClasses}>
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full h-9 px-3 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-gray-400"
          placeholder="Search pages..."
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-2 border-b border-gray-100">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-2.5 py-1 text-xs rounded-md border-0 cursor-pointer transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange('changed')}
          className={`px-2.5 py-1 text-xs rounded-md border-0 cursor-pointer transition-colors ${
            filter === 'changed'
              ? 'bg-gray-900 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          Changed
        </button>
        <button
          onClick={() => onFilterChange('broken')}
          className={`px-2.5 py-1 text-xs rounded-md border-0 cursor-pointer transition-colors ${
            filter === 'broken'
              ? 'bg-gray-900 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          Broken
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`flex gap-2.5 p-2 rounded-lg cursor-pointer mb-1 border-2 transition-colors ${
              selectedId === session.id
                ? 'bg-blue-50 border-blue-600'
                : 'border-transparent hover:bg-gray-50'
            }`}
          >
            {/* Thumbnail with status indicator */}
            <div className="w-12 h-9 bg-gray-200 rounded shrink-0 relative overflow-hidden">
              {session.thumbnail && (
                <img
                  src={session.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full ${statusColors[session.status]}`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {session.name}
              </div>
              <div className="text-[11px] text-gray-500">
                {session.metadata}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-100 flex flex-col gap-2">
        <button
          onClick={onCheckAll}
          className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 9l3-3 3 3M4 6v8" />
            <path d="M15 7l-3 3-3-3M12 10V2" />
          </svg>
          Check All ({sessions.length})
        </button>
      </div>
    </aside>
  );
}
