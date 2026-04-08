'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui';

interface WorkflowItem {
  id: string;
  name: string;
  url: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: string;
  completedAt?: string;
  verdict?: 'MATCH' | 'EXPECTED_CHANGE' | 'UNEXPECTED_CHANGE' | 'LAYOUT_BROKEN';
  diffPercent?: number;
}

const verdictLabels: Record<string, string> = {
  MATCH: 'MATCH',
  EXPECTED_CHANGE: 'EXPECTED',
  UNEXPECTED_CHANGE: 'CHANGED',
  LAYOUT_BROKEN: 'BROKEN',
};

const verdictColors: Record<string, string> = {
  MATCH: 'text-[#34d399]',
  EXPECTED_CHANGE: 'text-[#818cf8]',
  UNEXPECTED_CHANGE: 'text-[#fbbf24]',
  LAYOUT_BROKEN: 'text-[#fb7185]',
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatElapsed(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  const handleRunScan = useCallback(async () => {
    const url = prompt('Enter URL to scan (e.g., http://localhost:3000)');
    if (!url) return;
    try {
      await fetch('/api/workflows/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      fetchWorkflows();
    } catch (err) {
      console.error('Scan failed:', err);
    }
  }, [fetchWorkflows]);

  // Sort: running first, then by time descending
  const sorted = [...workflows].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Top-right scan button */}
      <div className="flex justify-end mb-6">
        <Button variant="primary" size="sm" onClick={handleRunScan}>
          Run Scan
        </Button>
      </div>

      {/* Unified list */}
      {loading ? (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] p-8 text-center">
          <div className="animate-shimmer h-4 w-48 mx-auto rounded" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] p-12 text-center">
          <p className="text-[15px] text-[#9d9db5] mb-1">No workflows yet</p>
          <p className="text-[13px] text-[#5a5a72]">
            Run a scan or use <code className="text-[#818cf8]">npx ibr check</code> to start
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
          {sorted.map((w, i) => (
            <div
              key={w.id}
              className={`
                flex items-center gap-3 px-4 h-11 transition-colors duration-200
                ${i > 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''}
                ${w.status === 'completed' ? 'cursor-pointer hover:bg-[rgba(255,255,255,0.025)]' : ''}
              `}
              onClick={() => {
                if (w.status === 'completed') {
                  window.location.href = `/sessions/${w.id}`;
                }
              }}
            >
              {/* Status indicator */}
              {w.status === 'running' ? (
                <span className="w-2 h-2 rounded-full bg-[#818cf8] animate-pulse-dot shrink-0" />
              ) : w.status === 'failed' ? (
                <span className="w-2 h-2 rounded-full bg-[#fb7185] shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#5a5a72] shrink-0" />
              )}

              {/* Name */}
              <span className="text-[13px] font-medium text-[#f0f0f5] truncate min-w-0 shrink">
                {w.name || w.id}
              </span>

              {/* URL */}
              <span className="text-[11px] text-[#5a5a72] truncate min-w-0 flex-1">
                {w.url}
              </span>

              {/* Verdict / running */}
              {w.status === 'running' ? (
                <span className="text-[11px] text-[#818cf8] shrink-0">
                  running {formatElapsed(w.startedAt)}
                </span>
              ) : w.verdict ? (
                <>
                  <span className={`text-[11px] font-medium shrink-0 ${verdictColors[w.verdict] || 'text-[#5a5a72]'}`}>
                    {verdictLabels[w.verdict] || w.verdict}
                  </span>
                  {w.diffPercent !== undefined && (
                    <span className="text-[11px] text-[#818cf8] shrink-0">
                      {w.diffPercent.toFixed(1)}%
                    </span>
                  )}
                </>
              ) : null}

              {/* Timestamp */}
              <span className="text-[11px] text-[#5a5a72] shrink-0 w-16 text-right">
                {formatTime(w.startedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
