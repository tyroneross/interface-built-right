'use client';

import { useState } from 'react';

interface OverlayViewProps {
  sessionId: string;
}

export default function OverlayView({ sessionId }: OverlayViewProps) {
  const [opacity, setOpacity] = useState(50);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [currentLoading, setCurrentLoading] = useState(true);

  const baselineUrl = `/api/sessions/${sessionId}/images/baseline`;
  const currentUrl = `/api/sessions/${sessionId}/images/current`;

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
        {(baselineLoading || currentLoading) && (
          <div className="skeleton h-96 w-full animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
        )}
        <div className={`relative ${baselineLoading || currentLoading ? 'hidden' : ''}`}>
          {/* Base image */}
          <img
            src={baselineUrl}
            alt="Baseline"
            className="w-full rounded-lg border border-gray-200"
            onLoad={() => setBaselineLoading(false)}
            onError={() => setBaselineLoading(false)}
          />

          {/* Overlay image */}
          <img
            src={currentUrl}
            alt="Current"
            className="absolute left-0 top-0 w-full rounded-lg border border-gray-200"
            style={{ opacity: opacity / 100 }}
            onLoad={() => setCurrentLoading(false)}
            onError={() => setCurrentLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
