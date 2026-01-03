'use client';

import { useState } from 'react';

interface Session {
  id: string;
  name: string;
  url: string;
  status: 'match' | 'changed' | 'broken' | 'pending';
  diffPercent?: number;
  createdAt: string;
}

interface SessionCardProps {
  session: Session;
  selected: boolean;
  onClick: () => void;
}

export function SessionCard({ session, selected, onClick }: SessionCardProps) {
  const [imageError, setImageError] = useState(false);

  const statusColors = {
    match: 'bg-green-600',
    changed: 'bg-amber-600',
    broken: 'bg-red-600',
    pending: 'bg-gray-400',
  };

  const statusText = {
    match: 'Match',
    changed: `${session.diffPercent?.toFixed(1)}% changed`,
    broken: `${session.diffPercent?.toFixed(0)}% broken`,
    pending: 'Not compared',
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex gap-2.5 p-2 rounded-lg cursor-pointer mb-1 border-2 transition-colors
        ${selected
          ? 'bg-blue-50 border-blue-600'
          : 'border-transparent hover:bg-gray-50'
        }
      `}
    >
      {/* Thumbnail with status dot */}
      <div className="relative w-12 h-9 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
        {imageError ? (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <img
            src={`/api/sessions/${session.id}/images/baseline`}
            alt={session.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
        {/* Status dot positioned in top-right corner */}
        <div
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${statusColors[session.status]} ring-1 ring-white`}
        />
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {session.name}
        </div>
        <div className="text-xs text-gray-500">
          {statusText[session.status]}
        </div>
      </div>
    </div>
  );
}
