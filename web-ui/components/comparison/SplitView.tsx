'use client';

import { useState } from 'react';

interface SplitViewProps {
  sessionId: string;
  onImageClick?: (imageUrl: string, label: string) => void;
}

function ImagePane({
  url,
  label,
  onImageClick,
}: {
  url: string;
  label: string;
  onImageClick?: (url: string, label: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4">
      <span className="mb-2 text-[11px] font-medium text-[#5a5a72] uppercase tracking-wide">
        {label}
      </span>
      <div className="relative">
        {loading && !error && (
          <div className="animate-shimmer h-64 w-full rounded-lg" />
        )}
        {error ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.06)]">
            <svg className="mb-2 h-8 w-8 text-[#5a5a72]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[13px] text-[#5a5a72]">{label} not available</span>
            <span className="mt-1 text-[11px] text-[#3a3a4a]">Run comparison to generate</span>
          </div>
        ) : (
          <img
            src={url}
            alt={label}
            className={`w-full cursor-zoom-in rounded-lg border border-[rgba(255,255,255,0.06)] transition-shadow hover:shadow-lg hover:shadow-[rgba(129,140,248,0.1)] ${loading ? 'hidden' : ''}`}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onClick={() => onImageClick?.(url, label)}
          />
        )}
      </div>
    </div>
  );
}

export default function SplitView({ sessionId, onImageClick }: SplitViewProps) {
  return (
    <div className="flex h-full">
      <ImagePane
        url={`/api/sessions/${sessionId}/images/baseline`}
        label="Baseline"
        onImageClick={onImageClick}
      />
      <div className="w-px bg-[rgba(255,255,255,0.06)]" />
      <ImagePane
        url={`/api/sessions/${sessionId}/images/current`}
        label="Current"
        onImageClick={onImageClick}
      />
    </div>
  );
}
