'use client';

import { useState } from 'react';
import ViewTabs, { type ViewMode } from './ViewTabs';
import SplitView from './SplitView';
import OverlayView from './OverlayView';
import DiffView from './DiffView';
import { ImageModal } from '../ui';

interface Session {
  id: string;
  name: string;
  url?: string;
  type?: 'capture' | 'reference' | 'interactive';
  status: string;
  createdAt: string;
  viewport: { name: string; width: number; height: number };
  comparison?: {
    match: boolean;
    diffPercent: number;
    diffPixels: number;
    totalPixels: number;
    threshold: number;
  };
  analysis?: { verdict: string; summary: string; recommendation: string | null };
  interactiveMetadata?: {
    sandbox: boolean;
    actions: Array<{ type: string; timestamp: string; params: Record<string, unknown>; success: boolean }>;
    active: boolean;
  };
}

interface ComparisonCanvasProps {
  session: Session;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ComparisonCanvas({
  session,
  viewMode,
  onViewModeChange,
}: ComparisonCanvasProps) {
  const [modalImage, setModalImage] = useState<{ url: string; label: string } | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      {/* Canvas header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#5a5a72]">
          Comparing baseline vs current
        </span>
        <ViewTabs value={viewMode} onChange={onViewModeChange} />
      </div>

      {/* Comparison container */}
      <div className="flex flex-1 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)]">
        {viewMode === 'split' && <SplitView sessionId={session.id} onImageClick={(url, label) => setModalImage({ url, label })} />}
        {viewMode === 'overlay' && <OverlayView sessionId={session.id} onImageClick={(url, label) => setModalImage({ url, label })} />}
        {viewMode === 'diff' && <DiffView sessionId={session.id} onImageClick={(url, label) => setModalImage({ url, label })} />}
      </div>

      {/* Lightbox */}
      <ImageModal
        imageUrl={modalImage?.url || ''}
        label={modalImage?.label || ''}
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
      />
    </div>
  );
}
