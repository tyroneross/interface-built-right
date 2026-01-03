import React, { useState } from 'react';

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
  match: 'text-green-600',
  expected: 'text-blue-600',
  changed: 'text-amber-600',
  broken: 'text-red-600',
  pending: 'text-gray-500',
  active: 'text-blue-600',
  closed: 'text-gray-500',
};

const verdictLabels: Record<VerdictStatus, string> = {
  match: 'MATCH',
  expected: 'EXPECTED CHANGE',
  changed: 'CHANGED',
  broken: 'BROKEN',
  pending: 'PENDING',
  active: 'LIVE SESSION',
  closed: 'SESSION ENDED',
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

  const panelClasses = [
    'w-70 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto',
    'lg:relative lg:transform-none',
    'max-lg:fixed max-lg:right-0 max-lg:top-14 max-lg:bottom-0 max-lg:z-50',
    'max-lg:transition-transform max-lg:duration-200',
    open ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full',
  ].join(' ');

  const handleSendFeedback = () => {
    if (feedback.trim()) {
      onFeedbackSubmit?.(feedback);
      setFeedback('');
    }
  };

  if (!session) {
    return (
      <aside className={panelClasses}>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h10v10H3zM11 11h10v10H11z" />
            </svg>
          </div>
          <div className="text-[15px] font-medium text-gray-900 mb-1">
            No session selected
          </div>
          <div className="text-[13px] text-gray-500">
            Select a session from the library
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={panelClasses}>
      {/* Session */}
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
        Session
      </div>
      <div className="border-b border-gray-100">
        <div className="px-4 pb-4">
          <div className="text-[15px] font-medium text-gray-900">
            {session.name}
          </div>
          <div className="text-[13px] text-gray-600 break-all">
            {session.url}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {session.viewport} • {session.timestamp}
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
        Comparison
      </div>
      <div className="border-b border-gray-100">
        <div className="px-4 pb-4">
          <div className="flex justify-between py-2">
            <span className="text-[13px] text-gray-500">Verdict</span>
            <span className={`text-[13px] font-medium ${verdictColors[session.verdict]}`}>
              {verdictLabels[session.verdict]}
            </span>
          </div>
          <div className="flex justify-between py-2 border-t border-gray-50">
            <span className="text-[13px] text-gray-500">Difference</span>
            <span className="text-[13px] text-gray-900">{session.difference}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-gray-50">
            <span className="text-[13px] text-gray-500">Pixels</span>
            <span className="text-[13px] text-gray-900">{session.pixelsChanged}</span>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
        Analysis
      </div>
      <div className="border-b border-gray-100">
        <div className="px-4 pb-4">
          <p className="text-[13px] text-gray-700 leading-relaxed">
            {session.analysis}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
        Actions
      </div>
      <div className="border-b border-gray-100">
        <div className="px-4 pb-4">
          <div className="flex flex-col gap-2">
            <button
              onClick={onCheck}
              className="w-full h-10 inline-flex items-center justify-start gap-1.5 px-3 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 9l3-3 3 3M4 6v8" />
                <path d="M15 7l-3 3-3-3M12 10V2" />
              </svg>
              Compare Again
            </button>
            <button
              onClick={onAccept}
              className="w-full h-10 inline-flex items-center justify-start gap-1.5 px-3 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12l3 3 7-10" />
              </svg>
              Accept as Baseline
            </button>
            <button
              onClick={onDelete}
              className="w-full h-10 inline-flex items-center justify-start gap-1.5 px-3 text-[13px] font-medium rounded-lg bg-transparent text-red-600 hover:bg-red-50 transition-all duration-150"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h10M5 6V4a2 2 0 012-2h2a2 2 0 012 2v2M6 6v8M10 6v8" />
              </svg>
              Delete Session
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
        Feedback
      </div>
      <div className="flex-1 flex flex-col border-b border-gray-100">
        <div className="px-4 pb-4 flex flex-col flex-1">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="flex-1 min-h-20 p-3 border border-gray-200 rounded-lg text-[13px] resize-none focus:outline-none focus:border-gray-400"
            placeholder="Tell Claude what to change..."
          />
          <div className="mt-2">
            <button
              onClick={handleSendFeedback}
              disabled={!feedback.trim()}
              className="w-full h-11 inline-flex items-center justify-center gap-1.5 px-4 text-[13px] font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 1L8 8M15 1l-5 14-3-6-6-3 14-5z" />
              </svg>
              Send to Claude
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
