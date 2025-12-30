'use client';

import { useState } from 'react';

interface DiffViewProps {
  sessionId: string;
}

export default function DiffView({ sessionId }: DiffViewProps) {
  const [loading, setLoading] = useState(true);

  const diffUrl = `/api/sessions/${sessionId}/images/diff`;

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <span className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Diff (red = changed)
      </span>
      <div className="relative">
        {loading && (
          <div className="skeleton h-96 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
        )}
        <img
          src={diffUrl}
          alt="Diff"
          className={`w-full rounded-lg border border-gray-200 ${loading ? 'hidden' : ''}`}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
