'use client';

import { useState } from 'react';

interface ActionButtonsProps {
  sessionId: string;
  onCheck?: () => void;
  onAccept?: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

type ActionStatus = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function ActionButtons({
  sessionId,
  onCheck,
  onAccept,
  onDelete,
  isLoading = false,
}: ActionButtonsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus>(null);

  const handleCheck = async () => {
    if (onCheck) {
      onCheck();
      return;
    }

    setActionLoading('check');
    setStatus(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/check`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Comparison complete.' });
        // Reload after a brief delay so user sees feedback
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatus({ type: 'error', message: data.error || 'Check failed.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Network error. Could not reach server.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async () => {
    if (onAccept) {
      onAccept();
      return;
    }

    setActionLoading('accept');
    setStatus(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Baseline updated.' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatus({ type: 'error', message: data.error || 'Accept failed.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Network error. Could not reach server.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    if (onDelete) {
      onDelete();
      return;
    }

    setActionLoading('delete');
    setStatus(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: 'Session deleted.' });
        setTimeout(() => { window.location.href = '/'; }, 800);
      } else {
        setStatus({ type: 'error', message: data.error || 'Delete failed.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Network error. Could not reach server.' });
    } finally {
      setActionLoading(null);
    }
  };

  const loading = isLoading || actionLoading !== null;

  return (
    <div className="flex flex-col gap-2">
      {/* Status feedback */}
      {status && (
        <div
          className={`px-3 py-2 rounded-lg text-[13px] ${
            status.type === 'success'
              ? 'text-green-700 bg-green-50'
              : 'text-red-700 bg-red-50'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Compare Again button */}
      <button
        onClick={handleCheck}
        disabled={loading}
        className="flex h-10 w-full items-center justify-start gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 9l3-3 3 3M4 6v8" />
          <path d="M15 7l-3 3-3-3M12 10V2" />
        </svg>
        {actionLoading === 'check' ? 'Checking...' : 'Compare Again'}
      </button>

      {/* Accept as Baseline button */}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="flex h-10 w-full items-center justify-start gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12l3 3 7-10" />
        </svg>
        {actionLoading === 'accept' ? 'Accepting...' : 'Accept as Baseline'}
      </button>

      {/* Delete Session button (danger) */}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="flex h-10 w-full items-center justify-start gap-1.5 rounded-lg bg-transparent px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h10M5 6V4a2 2 0 012-2h2a2 2 0 012 2v2M6 6v8M10 6v8" />
        </svg>
        {actionLoading === 'delete' ? 'Deleting...' : 'Delete Session'}
      </button>
    </div>
  );
}
