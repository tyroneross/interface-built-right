'use client';

import React, { useState, useCallback } from 'react';

type VerdictStatus = 'match' | 'expected' | 'changed' | 'broken' | 'pending' | 'active' | 'closed';

export interface SessionDetails {
  id: string;
  name: string;
  url?: string;
  viewport: string;
  timestamp: string;
  verdict: VerdictStatus;
  difference: string;
  pixelsChanged: string;
  analysis: string;
  type?: 'capture' | 'reference' | 'interactive';
  actionCount?: number;
}

interface DetailsPanelProps {
  open?: boolean;
  session?: SessionDetails;
  onCheck?: () => void;
  onAccept?: () => void;
  onDelete?: () => void;
  onFeedbackSubmit?: (feedback: string) => void;
}

const verdictColors: Record<VerdictStatus, string> = {
  match: 'text-[#34d399]',
  expected: 'text-[#818cf8]',
  changed: 'text-[#fbbf24]',
  broken: 'text-[#fb7185]',
  pending: 'text-[#5a5a72]',
  active: 'text-[#818cf8]',
  closed: 'text-[#5a5a72]',
};

const verdictLabels: Record<VerdictStatus, string> = {
  match: 'MATCH',
  expected: 'EXPECTED',
  changed: 'CHANGED',
  broken: 'BROKEN',
  pending: 'PENDING',
  active: 'LIVE',
  closed: 'ENDED',
};

export function DetailsPanel({
  open = true,
  session,
  onCheck,
  onAccept,
  onDelete,
  onFeedbackSubmit,
}: DetailsPanelProps) {
  const [feedback, setFeedback] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleSendFeedback = useCallback(() => {
    if (feedback.trim()) {
      onFeedbackSubmit?.(feedback);
      setFeedback('');
    }
  }, [feedback, onFeedbackSubmit]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      onDelete?.();
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
      // Auto-reset after 3s
      setTimeout(() => setDeleteConfirm(false), 3000);
    }
  }, [deleteConfirm, onDelete]);

  if (!open || !session) {
    return (
      <aside
        className="flex flex-col shrink-0 border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl"
        style={{ width: 240 }}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-full bg-[rgba(129,140,248,0.12)] flex items-center justify-center mb-4">
            <svg width="24" height="24" fill="none" stroke="#818cf8" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 12h18" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#f0f0f5] mb-1">No session selected</p>
          <p className="text-[13px] text-[#5a5a72]">Create a new one</p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col shrink-0 border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl overflow-y-auto"
      style={{ width: 240 }}
    >
      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Session name */}
        <h3 className="text-[15px] font-medium text-[#f0f0f5]">{session.name}</h3>

        {/* URL */}
        {session.url && (
          <p className="text-[13px] text-[#9d9db5] break-all leading-relaxed">{session.url}</p>
        )}

        {/* Verdict line */}
        <p className="text-[13px]">
          <span className={`font-medium ${verdictColors[session.verdict]}`}>
            {verdictLabels[session.verdict]}
          </span>
          {session.difference !== 'N/A' && (
            <span className="text-[#818cf8]"> · {session.difference}</span>
          )}
        </p>

        {/* Analysis */}
        <p className="text-[13px] text-[#9d9db5] leading-relaxed">{session.analysis}</p>

        {/* Action icons — horizontal row */}
        <div className="flex gap-2">
          {/* Compare */}
          <button
            onClick={onCheck}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[#9d9db5] hover:text-[#f0f0f5] hover:bg-[rgba(255,255,255,0.05)] transition-colors duration-200"
            title="Compare again"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
          </button>
          {/* Accept */}
          <button
            onClick={onAccept}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[#9d9db5] hover:text-[#34d399] hover:bg-[rgba(52,211,153,0.08)] transition-colors duration-200"
            title="Accept as baseline"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
          {/* Delete — two-click */}
          <button
            onClick={handleDelete}
            onBlur={() => setDeleteConfirm(false)}
            className={`flex items-center justify-center rounded-lg transition-colors duration-200 ${
              deleteConfirm
                ? 'px-3 h-9 text-[#fb7185] bg-[rgba(251,113,133,0.08)] text-[11px] font-medium'
                : 'w-9 h-9 text-[#9d9db5] hover:text-[#fb7185] hover:bg-[rgba(251,113,133,0.08)]'
            }`}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete session'}
          >
            {deleteConfirm ? (
              'Confirm?'
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
              </svg>
            )}
          </button>
        </div>

        {/* Feedback */}
        <div className="mt-auto flex flex-col gap-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="glass-input min-h-[64px] resize-y"
            placeholder="Tell Claude what to change..."
          />
          <button
            onClick={handleSendFeedback}
            disabled={!feedback.trim()}
            className={`self-end px-3 h-8 rounded-lg text-[12px] font-medium transition-all duration-200 ${
              feedback.trim()
                ? 'text-white bg-gradient-to-br from-[#818cf8] to-[#6366f1] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)]'
                : 'text-[#5a5a72] bg-[rgba(255,255,255,0.03)]'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
