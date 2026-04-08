'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui';

interface Session {
  id: string;
  name: string;
  url: string;
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
  analysis?: {
    verdict: string;
    summary: string;
    recommendation: string | null;
  };
}

type ViewMode = 'split' | 'overlay' | 'diff';

const verdictColors: Record<string, string> = {
  MATCH: 'text-[#34d399]',
  EXPECTED_CHANGE: 'text-[#818cf8]',
  UNEXPECTED_CHANGE: 'text-[#fbbf24]',
  LAYOUT_BROKEN: 'text-[#fb7185]',
};

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => { setSession(data.session); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[#5a5a72]">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-[rgba(251,113,133,0.2)] bg-[rgba(251,113,133,0.05)] p-4">
          <p className="text-[#fb7185]">Error: {error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  const imagePath = `/api/sessions/${sessionId}/images`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium text-[#f0f0f5]">{session.name}</h2>
          <p className="text-[13px] text-[#9d9db5]">{session.url}</p>
          <p className="text-[11px] text-[#5a5a72]">
            {session.viewport.name} ({session.viewport.width}x{session.viewport.height})
          </p>
        </div>
        <a href="/dashboard" className="text-[13px] text-[#5a5a72] hover:text-[#9d9db5]">
          Back to sessions
        </a>
      </div>

      {/* Stats */}
      {session.comparison && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4 flex items-center justify-between">
          <div>
            <span className={`text-[13px] font-medium ${verdictColors[session.analysis?.verdict || ''] || 'text-[#5a5a72]'}`}>
              {session.analysis?.verdict || 'PENDING'}
            </span>
            {session.analysis?.summary && (
              <p className="text-[13px] text-[#9d9db5] mt-1">{session.analysis.summary}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-medium text-[#818cf8]">
              {session.comparison.diffPercent.toFixed(1)}%
            </p>
            <p className="text-[11px] text-[#5a5a72]">
              {session.comparison.diffPixels.toLocaleString()} px changed
            </p>
          </div>
        </div>
      )}

      {/* View tabs — underline style */}
      <div className="flex gap-4">
        {(['split', 'overlay', 'diff'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`pb-1 text-[13px] font-medium border-b-2 transition-colors duration-200 ${
              viewMode === mode
                ? 'text-[#818cf8] border-[#818cf8]'
                : 'text-[#5a5a72] border-transparent hover:text-[#9d9db5]'
            }`}
          >
            {mode === 'split' ? 'Split' : mode === 'overlay' ? 'Overlay' : 'Diff'}
          </button>
        ))}
      </div>

      {/* Comparison viewer */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4">
        {viewMode === 'split' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-[#5a5a72] uppercase mb-2 block">Baseline</span>
              <img src={`${imagePath}/baseline`} alt="Baseline" className="w-full rounded-lg border border-[rgba(255,255,255,0.06)]" />
            </div>
            <div>
              <span className="text-[11px] text-[#5a5a72] uppercase mb-2 block">Current</span>
              <img src={`${imagePath}/current`} alt="Current" className="w-full rounded-lg border border-[rgba(255,255,255,0.06)]" />
            </div>
          </div>
        )}
        {viewMode === 'overlay' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#5a5a72]">Opacity</span>
              <input
                type="range" min="0" max="100" value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="flex-1 h-1 appearance-none rounded-full bg-[rgba(255,255,255,0.06)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#818cf8] [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-[11px] text-[#5a5a72] w-8 text-right">{overlayOpacity}%</span>
            </div>
            <div className="relative">
              <img src={`${imagePath}/baseline`} alt="Baseline" className="w-full rounded-lg border border-[rgba(255,255,255,0.06)]" />
              <img src={`${imagePath}/current`} alt="Current" className="absolute inset-0 w-full rounded-lg border border-[rgba(255,255,255,0.06)]" style={{ opacity: overlayOpacity / 100 }} />
            </div>
          </div>
        )}
        {viewMode === 'diff' && (
          <div>
            <span className="text-[11px] text-[#5a5a72] uppercase mb-2 block">Diff (red = changed)</span>
            <img src={`${imagePath}/diff`} alt="Diff" className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0a1a]" />
          </div>
        )}
      </div>

      {/* Feedback */}
      <FeedbackPanel sessionId={sessionId} />
    </div>
  );
}

function FeedbackPanel({ sessionId }: { sessionId: string }) {
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSend = async () => {
    if (!feedback.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, feedback }),
      });
      if (res.ok) {
        setStatus('sent');
        setTimeout(() => { setStatus('idle'); setFeedback(''); }, 3000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 space-y-4">
      <div>
        <h3 className="text-[15px] font-medium text-[#f0f0f5]">Feedback for Claude</h3>
        <p className="text-[13px] text-[#5a5a72] mt-1">
          Write instructions and Claude will read them automatically.
        </p>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="e.g., The header looks good but the sidebar spacing is off..."
        className="glass-input w-full min-h-24 resize-none"
      />
      <Button
        variant="primary"
        className="w-full"
        onClick={handleSend}
        disabled={!feedback.trim() || status === 'sending'}
        loading={status === 'sending'}
      >
        {status === 'sent' ? 'Sent to Claude' : status === 'error' ? 'Error - Try Again' : 'Send to Claude'}
      </Button>
      {status === 'sent' && (
        <p className="text-[11px] text-[#34d399] text-center">
          Claude can now read your feedback
        </p>
      )}
    </div>
  );
}
