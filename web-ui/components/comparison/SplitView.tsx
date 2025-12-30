'use client';

import { useState } from 'react';

interface SplitViewProps {
  sessionId: string;
}

export default function SplitView({ sessionId }: SplitViewProps) {
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [currentLoading, setCurrentLoading] = useState(true);

  const baselineUrl = `/api/sessions/${sessionId}/images/baseline`;
  const currentUrl = `/api/sessions/${sessionId}/images/current`;

  return (
    <div className="flex h-full">
      {/* Baseline pane */}
      <div className="flex flex-1 flex-col overflow-auto p-4">
        <span className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Baseline
        </span>
        <div className="relative">
          {baselineLoading && (
            <div className="skeleton h-96 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
          )}
          <img
            src={baselineUrl}
            alt="Baseline"
            className={`w-full rounded-lg border border-gray-200 ${baselineLoading ? 'hidden' : ''}`}
            onLoad={() => setBaselineLoading(false)}
            onError={() => setBaselineLoading(false)}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-100" />

      {/* Current pane */}
      <div className="flex flex-1 flex-col overflow-auto p-4">
        <span className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Current
        </span>
        <div className="relative">
          {currentLoading && (
            <div className="skeleton h-96 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
          )}
          <img
            src={currentUrl}
            alt="Current"
            className={`w-full rounded-lg border border-gray-200 ${currentLoading ? 'hidden' : ''}`}
            onLoad={() => setCurrentLoading(false)}
            onError={() => setCurrentLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
