'use client';

import { useState } from 'react';

interface SplitViewProps {
  sessionId: string;
  onImageClick?: (imageUrl: string, label: string) => void;
}

export default function SplitView({ sessionId, onImageClick }: SplitViewProps) {
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineError, setBaselineError] = useState(false);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [currentError, setCurrentError] = useState(false);

  const baselineUrl = `/api/sessions/${sessionId}/images/baseline`;
  const currentUrl = `/api/sessions/${sessionId}/images/current`;

  const ImagePlaceholder = ({ label }: { label: string }) => (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
      <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-sm text-gray-500">{label} not available</span>
      <span className="mt-1 text-xs text-gray-400">Run comparison to generate</span>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Baseline pane */}
      <div className="flex flex-1 flex-col overflow-auto p-4">
        <span className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Baseline
        </span>
        <div className="relative">
          {baselineLoading && !baselineError && (
            <div className="skeleton h-64 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
          )}
          {baselineError ? (
            <ImagePlaceholder label="Baseline" />
          ) : (
            <img
              src={baselineUrl}
              alt="Baseline"
              className={`w-full cursor-pointer rounded-lg border border-gray-200 transition-shadow hover:shadow-lg ${baselineLoading ? 'hidden' : ''}`}
              onLoad={() => setBaselineLoading(false)}
              onError={() => { setBaselineLoading(false); setBaselineError(true); }}
              onClick={() => onImageClick?.(baselineUrl, 'Baseline')}
            />
          )}
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
          {currentLoading && !currentError && (
            <div className="skeleton h-64 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
          )}
          {currentError ? (
            <ImagePlaceholder label="Current" />
          ) : (
            <img
              src={currentUrl}
              alt="Current"
              className={`w-full cursor-pointer rounded-lg border border-gray-200 transition-shadow hover:shadow-lg ${currentLoading ? 'hidden' : ''}`}
              onLoad={() => setCurrentLoading(false)}
              onError={() => { setCurrentLoading(false); setCurrentError(true); }}
              onClick={() => onImageClick?.(currentUrl, 'Current')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
