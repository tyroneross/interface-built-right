'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

import { LibraryPanel } from '@/components/layout/LibraryPanel';
import type { Session as LibrarySession } from '@/components/layout/LibraryPanel';
import { DetailsPanel } from '@/components/layout/DetailsPanel';
import type { SessionDetails } from '@/components/layout/DetailsPanel';
import { ComparisonCanvas } from '@/components/comparison';
import type { ViewMode } from '@/components/comparison';
import { NewSessionModal, UploadReferenceModal } from '@/components/sessions';
import { Button } from '@/components/ui';

import { useSessions, useSessionActions } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import { formatDate, formatDiffPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { sessions, loading, error, refetch } = useSessions();
  const { create, check, accept, remove, creating } = useSessionActions();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Auto-select first session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Transform for library panel
  const librarySessions: LibrarySession[] = useMemo(() => {
    return sessions.map((s) => ({
      id: s.id,
      name: s.name,
      status: getSessionStatus(s),
      metadata: getSessionMetadata(s),
      type: s.type,
    }));
  }, [sessions]);

  // Filter by search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return librarySessions;
    const q = searchQuery.toLowerCase();
    return librarySessions.filter((s) => s.name.toLowerCase().includes(q));
  }, [librarySessions, searchQuery]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const sessionDetails: SessionDetails | undefined = useMemo(() => {
    if (!selectedSession) return undefined;

    if (selectedSession.type === 'interactive') {
      const actions = selectedSession.interactiveMetadata?.actions || [];
      return {
        id: selectedSession.id,
        name: selectedSession.name,
        url: selectedSession.url,
        viewport: `${selectedSession.viewport.name} (${selectedSession.viewport.width}x${selectedSession.viewport.height})`,
        timestamp: formatDate(selectedSession.createdAt),
        verdict: getVerdictStatus(selectedSession),
        difference: `${actions.length} actions`,
        pixelsChanged: selectedSession.interactiveMetadata?.sandbox ? 'Sandbox mode' : 'Headless',
        analysis: actions.length > 0
          ? `Last action: ${actions[actions.length - 1].type}`
          : 'No actions recorded',
        type: 'interactive',
        actionCount: actions.length,
      };
    }

    return {
      id: selectedSession.id,
      name: selectedSession.name,
      url: selectedSession.url,
      viewport: `${selectedSession.viewport.name} (${selectedSession.viewport.width}x${selectedSession.viewport.height})`,
      timestamp: formatDate(selectedSession.createdAt),
      verdict: getVerdictStatus(selectedSession),
      difference: selectedSession.comparison
        ? formatDiffPercent(selectedSession.comparison.diffPercent)
        : 'N/A',
      pixelsChanged: selectedSession.comparison
        ? `${selectedSession.comparison.diffPixels.toLocaleString()} changed`
        : 'N/A',
      analysis: selectedSession.analysis?.summary || 'No analysis available yet.',
      type: selectedSession.type,
    };
  }, [selectedSession]);

  // Handlers
  const handleCreateSession = useCallback(
    async (data: { url?: string; name: string }) => {
      const session = await create({ url: data.url || undefined, name: data.name });
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
    if (report) await refetch();
  }, [selectedSessionId, check, refetch]);

  const handleAcceptBaseline = useCallback(async () => {
    if (!selectedSessionId) return;
    const session = await accept(selectedSessionId);
    if (session) await refetch();
  }, [selectedSessionId, accept, refetch]);

  const handleDeleteSession = useCallback(async () => {
    if (!selectedSessionId) return;
    const success = await remove(selectedSessionId);
    if (success) {
      setSelectedSessionId(null);
      await refetch();
    }
  }, [selectedSessionId, remove, refetch]);

  const handleFeedbackSubmit = useCallback(
    async (feedback: string) => {
      if (!selectedSessionId) return;
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: selectedSessionId, feedback }),
        });
      } catch (err) {
        console.error('Failed to submit feedback:', err);
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
          response = await fetch('/api/sessions/upload', { method: 'POST', body: data });
        } else {
          response = await fetch('/api/sessions/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: data.url, metadata: data.metadata }),
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
      } catch (err) {
        console.error('Upload error:', err);
      } finally {
        setUploading(false);
      }
    },
    [refetch]
  );

  // Error state
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="mb-4 w-12 h-12 rounded-full bg-[rgba(251,113,133,0.12)] flex items-center justify-center">
          <svg className="h-6 w-6 text-[#fb7185]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p className="mb-1 text-[15px] font-medium text-[#f0f0f5]">Failed to load sessions</p>
        <p className="mb-4 text-[13px] text-[#5a5a72]">{error}</p>
        <Button variant="primary" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar — minimal, just action buttons */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 shrink-0">
        <Button variant="glass" size="sm" onClick={() => setIsUploadOpen(true)}>
          Upload Reference
        </Button>
        <Button variant="primary" size="sm" onClick={() => setIsNewSessionOpen(true)}
          icon={
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 3v8M3 7h8" />
            </svg>
          }
        >
          New Session
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Library */}
        <LibraryPanel
          sessions={filteredSessions}
          selectedId={selectedSessionId ?? undefined}
          onSelect={setSelectedSessionId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Canvas */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <ComparisonCanvas
              session={selectedSession}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <div className="mb-4 w-12 h-12 rounded-full bg-[rgba(129,140,248,0.12)] flex items-center justify-center">
                <svg width="24" height="24" fill="none" stroke="#818cf8" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 12h18" />
                </svg>
              </div>
              <p className="mb-1 text-[15px] font-medium text-[#f0f0f5]">
                {loading ? 'Loading sessions...' : 'No session selected'}
              </p>
              <p className="mb-4 text-[13px] text-[#5a5a72]">
                {loading
                  ? 'Please wait'
                  : sessions.length === 0
                    ? 'Create your first session to get started'
                    : 'Select a session from the library'}
              </p>
              {!loading && sessions.length === 0 && (
                <Button
                  variant="primary"
                  onClick={() => setIsNewSessionOpen(true)}
                  icon={
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 3v8M3 7h8" />
                    </svg>
                  }
                >
                  Create First Session
                </Button>
              )}
            </div>
          )}
        </main>

        {/* Details */}
        <DetailsPanel
          open={Boolean(selectedSession)}
          session={sessionDetails}
          onCheck={handleCheckSession}
          onAccept={handleAcceptBaseline}
          onDelete={handleDeleteSession}
          onFeedbackSubmit={handleFeedbackSubmit}
        />
      </div>

      {/* Modals */}
      <NewSessionModal
        open={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSubmit={handleCreateSession}
        isLoading={creating}
      />
      <UploadReferenceModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSubmit={handleUploadReference}
        isLoading={uploading}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function getSessionStatus(session: Session): 'match' | 'changed' | 'broken' | 'pending' | 'active' | 'closed' {
  if (session.type === 'interactive') {
    return session.status === 'active' ? 'active' : 'closed';
  }
  if (!session.analysis) return 'pending';
  switch (session.analysis.verdict) {
    case 'MATCH': return 'match';
    case 'LAYOUT_BROKEN': return 'broken';
    case 'EXPECTED_CHANGE':
    case 'UNEXPECTED_CHANGE': return 'changed';
    default: return 'pending';
  }
}

function getSessionMetadata(session: Session): string {
  if (session.type === 'interactive') {
    const n = session.interactiveMetadata?.actions?.length || 0;
    return `${n} action${n !== 1 ? 's' : ''}`;
  }
  if (session.type === 'reference') {
    return session.referenceMetadata?.originalUrl ? 'From URL' : 'Uploaded';
  }
  if (!session.comparison) return 'Not compared';
  if (session.comparison.match) return 'Match';
  return `${session.comparison.diffPercent.toFixed(1)}%`;
}

function getVerdictStatus(
  session: Session
): 'match' | 'expected' | 'changed' | 'broken' | 'pending' | 'active' | 'closed' {
  if (session.type === 'interactive') {
    return session.status === 'active' ? 'active' : 'closed';
  }
  if (!session.analysis) return 'pending';
  switch (session.analysis.verdict) {
    case 'MATCH': return 'match';
    case 'EXPECTED_CHANGE': return 'expected';
    case 'UNEXPECTED_CHANGE': return 'changed';
    case 'LAYOUT_BROKEN': return 'broken';
    default: return 'pending';
  }
}
