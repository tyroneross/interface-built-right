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
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[11px] text-[#5a5a72]">Opacity</span>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1 h-1 appearance-none rounded-full bg-[rgba(255,255,255,0.06)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#818cf8] [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-[11px] text-[#5a5a72] w-8 text-right">{opacity}%</span>
      </div>

      {/* Overlaid images */}
      <div className="relative flex-1 overflow-auto">
        {isLoading && !hasError && (
          <div className="animate-shimmer h-64 w-full rounded-lg" />
        )}
        {hasError ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.06)]">
            <svg className="mb-2 h-8 w-8 text-[#5a5a72]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[13px] text-[#5a5a72]">Images not available</span>
          </div>
        ) : (
          <div
            className={`relative cursor-zoom-in ${isLoading ? 'hidden' : ''}`}
            onClick={() => onImageClick?.(baselineUrl, 'Overlay View')}
          >
            <img
              src={baselineUrl}
              alt="Baseline"
              className="w-full rounded-lg border border-[rgba(255,255,255,0.06)]"
              onLoad={() => setBaselineLoading(false)}
              onError={() => { setBaselineLoading(false); setBaselineError(true); }}
            />
            <img
              src={currentUrl}
              alt="Current"
              className="absolute left-0 top-0 w-full rounded-lg border border-[rgba(255,255,255,0.06)]"
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
