'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Session {
  id: string;
  name: string;
  url: string;
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
}

type ViewMode = 'side-by-side' | 'overlay' | 'diff';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-700">
          Error loading session: {error || 'Session not found'}
        </p>
      </div>
    );
  }

  const imagePath = `/api/sessions/${sessionId}/images`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{session.name}</h2>
          <p className="text-sm text-gray-600">{session.url}</p>
          <p className="text-xs text-gray-500">
            {session.viewport.name} ({session.viewport.width}x
            {session.viewport.height}) •{' '}
            {new Date(session.createdAt).toLocaleString()}
          </p>
        </div>
        <a
          href="/"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to sessions
        </a>
      </div>

      {/* Comparison Stats */}
      {session.comparison && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <VerdictBadge verdict={session.analysis?.verdict || 'PENDING'} />
              <p className="mt-2 text-sm text-gray-600">
                {session.analysis?.summary}
              </p>
              {session.analysis?.recommendation && (
                <p className="mt-1 text-sm text-amber-600">
                  {session.analysis.recommendation}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-medium text-gray-900">
                {session.comparison.diffPercent}%
              </p>
              <p className="text-xs text-gray-500">
                {session.comparison.diffPixels.toLocaleString()} pixels changed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-2">
        {(['side-by-side', 'overlay', 'diff'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              viewMode === mode
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode === 'side-by-side'
              ? 'Side by Side'
              : mode === 'overlay'
                ? 'Overlay'
                : 'Diff'}
          </button>
        ))}
      </div>

      {/* Comparison Viewer */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Baseline
              </h3>
              <img
                src={`${imagePath}/baseline`}
                alt="Baseline"
                className="w-full rounded border border-gray-200"
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Current
              </h3>
              <img
                src={`${imagePath}/current`}
                alt="Current"
                className="w-full rounded border border-gray-200"
              />
            </div>
          </div>
        )}

        {viewMode === 'overlay' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">
                Opacity: {overlayOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="relative">
              <img
                src={`${imagePath}/baseline`}
                alt="Baseline"
                className="w-full rounded border border-gray-200"
              />
              <img
                src={`${imagePath}/current`}
                alt="Current"
                className="absolute inset-0 w-full rounded border border-gray-200"
                style={{ opacity: overlayOpacity / 100 }}
              />
            </div>
          </div>
        )}

        {viewMode === 'diff' && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Diff (red = changed)
            </h3>
            <img
              src={`${imagePath}/diff`}
              alt="Diff"
              className="w-full rounded border border-gray-200"
            />
          </div>
        )}
      </div>

      {/* Feedback Panel */}
      <FeedbackPanel sessionId={sessionId} />
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const colors = {
    MATCH: 'bg-green-100 text-green-700',
    EXPECTED_CHANGE: 'bg-blue-100 text-blue-700',
    UNEXPECTED_CHANGE: 'bg-amber-100 text-amber-700',
    LAYOUT_BROKEN: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${
        colors[verdict as keyof typeof colors] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {verdict}
    </span>
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
        setTimeout(() => {
          setStatus('idle');
          setFeedback('');
        }, 3000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-base font-medium text-gray-900">
          Feedback for Claude
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Write instructions and Claude will read them automatically.
        </p>
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="e.g., The header looks good but the sidebar spacing is off. Please increase padding..."
        className="w-full h-28 rounded-xl border border-gray-200 p-4 text-base resize-none focus:border-gray-400 focus:outline-none"
      />

      <button
        onClick={handleSend}
        disabled={!feedback.trim() || status === 'sending'}
        className={`w-full h-12 rounded-xl text-sm font-medium transition-colors ${
          status === 'sent'
            ? 'bg-green-600 text-white'
            : status === 'error'
              ? 'bg-red-600 text-white'
              : feedback.trim()
                ? 'bg-gray-900 text-white active:bg-gray-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {status === 'sending' ? 'Sending...' :
         status === 'sent' ? 'Sent to Claude!' :
         status === 'error' ? 'Error - Try Again' :
         'Send to Claude'}
      </button>

      {status === 'sent' && (
        <p className="text-xs text-green-600 text-center">
          Claude can now read your feedback at .ibr/feedback/pending.md
        </p>
      )}
    </div>
  );
}
