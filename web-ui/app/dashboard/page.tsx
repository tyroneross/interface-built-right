'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

// Layout components
import { Header } from '@/components/layout/Header';
import { LibraryPanel } from '@/components/layout/LibraryPanel';
import type { Session as LibrarySession } from '@/components/layout/LibraryPanel';
import { DetailsPanel } from '@/components/layout/DetailsPanel';
import type { SessionDetails } from '@/components/layout/DetailsPanel';

// Comparison components
import { ComparisonCanvas } from '@/components/comparison';
import type { ViewMode } from '@/components/comparison';

// Session components
import { NewSessionModal, UploadReferenceModal } from '@/components/sessions';

// Hooks and types
import { useSessions, useSessionActions } from '@/lib/hooks';
import type { Session, FilterType } from '@/lib/types';
import { formatDate, formatDiffPercent } from '@/lib/utils';

export default function DashboardPage() {
  // Data fetching
  const { sessions, loading, error, refetch } = useSessions();
  const { create, check, accept, remove, creating, checking, accepting, deleting } = useSessionActions();

  // UI state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  // Auto-select first session when loaded
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Transform sessions for LibraryPanel
  const librarySessions: LibrarySession[] = useMemo(() => {
    return sessions.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: `/api/sessions/${s.id}/images/baseline`,
      status: getSessionStatus(s),
      metadata: getSessionMetadata(s),
    }));
  }, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = librarySessions;

    // Apply filter
    if (filter === 'changed') {
      result = result.filter((s) => s.status === 'changed');
    } else if (filter === 'broken') {
      result = result.filter((s) => s.status === 'broken');
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    return result;
  }, [librarySessions, filter, searchQuery]);

  // Get selected session data
  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  // Transform selected session for DetailsPanel
  const sessionDetails: SessionDetails | undefined = useMemo(() => {
    if (!selectedSession) return undefined;

    return {
      id: selectedSession.id,
      name: selectedSession.name,
      url: selectedSession.url,
      viewport: `${selectedSession.viewport.name} (${selectedSession.viewport.width}×${selectedSession.viewport.height})`,
      timestamp: formatDate(selectedSession.createdAt),
      verdict: getVerdictStatus(selectedSession),
      difference: selectedSession.comparison
        ? formatDiffPercent(selectedSession.comparison.diffPercent)
        : 'N/A',
      pixelsChanged: selectedSession.comparison
        ? `${selectedSession.comparison.diffPixels.toLocaleString()} changed`
        : 'N/A',
      analysis: selectedSession.analysis?.summary || 'No analysis available yet.',
    };
  }, [selectedSession]);

  // Action handlers
  const handleCreateSession = useCallback(
    async (data: { url: string; name: string; viewport: string }) => {
      const session = await create({
        url: data.url,
        name: data.name || undefined,
      });
      if (session) {
        await refetch();
        setSelectedSessionId(session.id);
        setIsNewSessionOpen(false);
      }
    },
    [create, refetch]
  );

  const handleCheckSession = useCallback(async () => {
    if (!selectedSessionId) return;
    const report = await check(selectedSessionId);
    if (report) {
      await refetch();
    }
  }, [selectedSessionId, check, refetch]);

  const handleAcceptBaseline = useCallback(async () => {
    if (!selectedSessionId) return;
    const session = await accept(selectedSessionId);
    if (session) {
      await refetch();
    }
  }, [selectedSessionId, accept, refetch]);

  const handleDeleteSession = useCallback(async () => {
    if (!selectedSessionId) return;
    if (!confirm('Are you sure you want to delete this session?')) return;

    const success = await remove(selectedSessionId);
    if (success) {
      setSelectedSessionId(null);
      await refetch();
    }
  }, [selectedSessionId, remove, refetch]);

  const handleCheckAll = useCallback(async () => {
    // Check all filtered sessions sequentially
    for (const session of filteredSessions) {
      await check(session.id);
    }
    await refetch();
  }, [filteredSessions, check, refetch]);

  const handleFeedbackSubmit = useCallback(
    async (feedback: string) => {
      if (!selectedSessionId) return;
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: selectedSessionId, feedback }),
        });
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    },
    [selectedSessionId]
  );

  const handleUploadReference = useCallback(
    async (data: FormData | { type: 'url'; url: string; metadata: Record<string, string> }) => {
      try {
        setUploading(true);

        let response: Response;

        if (data instanceof FormData) {
          // Static image upload
          response = await fetch('/api/sessions/upload', {
            method: 'POST',
            body: data,
          });
        } else {
          // URL extraction
          response = await fetch('/api/sessions/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: data.url,
              metadata: data.metadata,
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        await refetch();
        setSelectedSessionId(result.sessionId);
        setIsUploadOpen(false);
      } catch (error) {
        console.error('Upload error:', error);
        alert(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [refetch]
  );

  // Error state
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-100">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="10" cy="10" r="9" />
            <path d="M10 6v5M10 14h0" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-medium text-gray-900">Failed to load sessions</p>
        <p className="mb-4 text-sm text-gray-500">{error}</p>
        <button
          onClick={() => refetch()}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Header */}
      <Header
        onToggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
        onNewSession={() => setIsNewSessionOpen(true)}
        onUploadReference={() => setIsUploadOpen(true)}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Library Panel - Left */}
        <LibraryPanel
          open={isLibraryOpen}
          sessions={filteredSessions}
          selectedId={selectedSessionId ?? undefined}
          onSelect={setSelectedSessionId}
          filter={filter}
          onFilterChange={setFilter}
          onCheckAll={handleCheckAll}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Canvas - Center */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <ComparisonCanvas
              session={selectedSession}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="3" y="3" width="14" height="14" rx="2" />
                  <path d="M3 10h14" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-gray-900">
                {loading ? 'Loading sessions...' : 'No session selected'}
              </p>
              <p className="mb-4 text-sm text-gray-500">
                {loading
                  ? 'Please wait while we load your sessions'
                  : sessions.length === 0
                    ? 'Create your first session to get started'
                    : 'Select a session from the library'}
              </p>
              {!loading && sessions.length === 0 && (
                <button
                  onClick={() => setIsNewSessionOpen(true)}
                  className="flex h-10 items-center gap-1.5 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M8 4v8M4 8h8" />
                  </svg>
                  Create First Session
                </button>
              )}
            </div>
          )}
        </main>

        {/* Details Panel - Right */}
        <DetailsPanel
          open={Boolean(selectedSession)}
          session={sessionDetails}
          onCheck={handleCheckSession}
          onAccept={handleAcceptBaseline}
          onDelete={handleDeleteSession}
          onFeedbackSubmit={handleFeedbackSubmit}
        />
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        open={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSubmit={handleCreateSession}
        isLoading={creating}
      />

      {/* Upload Reference Modal */}
      <UploadReferenceModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSubmit={handleUploadReference}
        isLoading={uploading}
      />
    </div>
  );
}

// Helper functions
function getSessionStatus(session: Session): 'match' | 'changed' | 'broken' | 'pending' {
  if (!session.analysis) return 'pending';
  switch (session.analysis.verdict) {
    case 'MATCH':
      return 'match';
    case 'LAYOUT_BROKEN':
      return 'broken';
    case 'EXPECTED_CHANGE':
    case 'UNEXPECTED_CHANGE':
      return 'changed';
    default:
      return 'pending';
  }
}

function getSessionMetadata(session: Session): string {
  if (!session.comparison) return 'Not compared';
  if (session.comparison.match) return 'Match';
  return `${session.comparison.diffPercent.toFixed(1)}% changed`;
}

function getVerdictStatus(
  session: Session
): 'match' | 'expected' | 'changed' | 'broken' | 'pending' {
  if (!session.analysis) return 'pending';
  switch (session.analysis.verdict) {
    case 'MATCH':
      return 'match';
    case 'EXPECTED_CHANGE':
      return 'expected';
    case 'UNEXPECTED_CHANGE':
      return 'changed';
    case 'LAYOUT_BROKEN':
      return 'broken';
    default:
      return 'pending';
  }
}
