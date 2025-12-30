'use client';

import { SessionCard } from './SessionCard';

interface Session {
  id: string;
  name: string;
  url: string;
  status: 'match' | 'changed' | 'broken' | 'pending';
  diffPercent?: number;
  createdAt: string;
}

interface SessionListProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M3 9h18" />
          </svg>
        </div>
        <div className="text-sm font-medium text-gray-900 mb-1">
          No sessions yet
        </div>
        <div className="text-xs text-gray-500 mb-4">
          Create your first session to start tracking visual changes
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          selected={selectedId === session.id}
          onClick={() => onSelect(session.id)}
        />
      ))}
    </div>
  );
}
