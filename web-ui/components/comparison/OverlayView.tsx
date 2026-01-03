'use client';

import { useState } from 'react';

interface OverlayViewProps {
  sessionId: string;
  onImageClick?: (imageUrl: string, label: string) => void;
}

export default function OverlayView({ sessionId, onImageClick }: OverlayViewProps) {
  const [opacity, setOpacity] = useState(50);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineError, setBaselineError] = useState(false);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [currentError, setCurrentError] = useState(false);

  const baselineUrl = `/api/sessions/${sessionId}/images/baseline`;
  const currentUrl = `/api/sessions/${sessionId}/images/current`;

  const hasError = baselineError || currentError;
  const isLoading = baselineLoading || currentLoading;

  return (
    <div className="flex h-full flex-col p-4">
      {/* Opacity slider */}
      <div className="mb-4">
        <label className="mb-2 block text-sm text-gray-600">
          Opacity: {opacity}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full cursor-pointer accent-gray-900"
        />
      </div>

      {/* Overlaid images */}
      <div className="relative flex-1 overflow-auto">
        {isLoading && !hasError && (
          <div className="skeleton h-64 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
        )}
        {hasError ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
            <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-500">Images not available</span>
            <span className="mt-1 text-xs text-gray-400">Run comparison to generate</span>
          </div>
        ) : (
          <div
            className={`relative cursor-pointer ${isLoading ? 'hidden' : ''}`}
            onClick={() => onImageClick?.(baselineUrl, 'Overlay View')}
          >
            {/* Base image */}
            <img
              src={baselineUrl}
              alt="Baseline"
              className="w-full rounded-lg border border-gray-200"
              onLoad={() => setBaselineLoading(false)}
              onError={() => { setBaselineLoading(false); setBaselineError(true); }}
            />

            {/* Overlay image */}
            <img
              src={currentUrl}
              alt="Current"
              className="absolute left-0 top-0 w-full rounded-lg border border-gray-200"
              style={{ opacity: opacity / 100 }}
              onLoad={() => setCurrentLoading(false)}
              onError={() => { setCurrentLoading(false); setCurrentError(true); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
