'use client';

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
      <div className="relative w-12 h-9 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
        <img
          src={`/api/sessions/${session.id}/images/baseline`}
          alt={session.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Status dot positioned in top-right corner */}
        <div
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${statusColors[session.status]}`}
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
