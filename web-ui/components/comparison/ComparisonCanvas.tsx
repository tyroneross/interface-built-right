'use client';

import ViewTabs, { type ViewMode } from './ViewTabs';
import SplitView from './SplitView';
import OverlayView from './OverlayView';
import DiffView from './DiffView';

interface Session {
  id: string;
  name: string;
  url?: string;  // Optional for reference sessions
  type?: 'capture' | 'reference' | 'interactive';
  status: string;
  createdAt: string;
  viewport: {
    name: string;
    width: number;
    height: number;
  };
  comparison?: {
    match: boolean;
    diffPercent: number;
    diffPixels: number;
    totalPixels: number;
    threshold: number;
  };
  analysis?: {
    verdict: string;
    summary: string;
    recommendation: string | null;
  };
  interactiveMetadata?: {
    sandbox: boolean;
    actions: Array<{
      type: string;
      timestamp: string;
      params: Record<string, unknown>;
      success: boolean;
    }>;
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
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      {/* Canvas header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Comparing baseline vs current
        </span>
        <ViewTabs value={viewMode} onChange={onViewModeChange} />
      </div>

      {/* Image container */}
      <div className="flex flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {viewMode === 'split' && <SplitView sessionId={session.id} />}
        {viewMode === 'overlay' && <OverlayView sessionId={session.id} />}
        {viewMode === 'diff' && <DiffView sessionId={session.id} />}
      </div>
    </div>
  );
}
