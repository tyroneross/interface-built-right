'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';
import { ScanSummary } from '@/components/scan/ScanSummary';
import type { ScanResponse } from '@/lib/types';

// Lightweight viewer: enter a URL, run the IBR scan, render design-system
// principle/token violations + sensor summaries READ-ONLY. The web-ui does
// not produce any of this data — it shows what the IBR CLI/library emits.
export default function DesignSystemPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ScanResponse['result'] | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [lastValidated, setLastValidated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter a URL to validate');
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setError('Invalid URL — must include scheme (http:// or https://)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = (await res.json()) as ScanResponse | { error?: string };
      if (!res.ok || 'error' in json) {
        throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
      }
      const r = (json as ScanResponse).result;
      setResult(r);
      setScannedUrl((json as ScanResponse).url);
      setLastValidated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const formatRelativeTime = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const ds = result?.designSystem;
  const sensors = result?.sensors;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* URL + validate */}
      <div className="flex gap-2 mb-6">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
          className="flex-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-[13px] text-[#f0f0f5] placeholder:text-[#5a5a72] focus:outline-none focus:border-[rgba(255,255,255,0.18)]"
          onKeyDown={e => {
            if (e.key === 'Enter') handleValidate();
          }}
        />
        <Button variant="primary" onClick={handleValidate} loading={loading}>
          Validate
        </Button>
      </div>

      {/* Compliance headline */}
      <div className="text-center mb-8">
        {ds ? (
          <>
            <p
              className="text-5xl font-bold text-[#818cf8] mb-2"
              style={{ fontSize: '48px' }}
            >
              {ds.complianceScore}%
            </p>
            <p className="text-[13px] text-[#9d9db5]">
              {ds.principleViolations.length + ds.customViolations.length} principle violation
              {ds.principleViolations.length + ds.customViolations.length !== 1 ? 's' : ''}
              {' · '}
              {ds.tokenViolations.length} token violation
              {ds.tokenViolations.length !== 1 ? 's' : ''}
            </p>
            {scannedUrl && (
              <p className="text-[11px] text-[#5a5a72] mt-1 truncate max-w-full">
                {scannedUrl}
              </p>
            )}
          </>
        ) : result && !ds ? (
          <>
            <p className="text-5xl font-bold text-[#5a5a72] mb-2" style={{ fontSize: '48px' }}>
              n/a
            </p>
            <p className="text-[13px] text-[#9d9db5]">
              No design system configured for this scan.
            </p>
            <p className="text-[11px] text-[#5a5a72] mt-1">
              Add <code className="text-[#818cf8]">.ibr/design-system.json</code> at the project
              root and re-run.
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold text-[#5a5a72] mb-2" style={{ fontSize: '48px' }}>
              --
            </p>
            <p className="text-[13px] text-[#5a5a72]">
              Enter a URL and click Validate to scan
            </p>
          </>
        )}
      </div>

      {/* Read-only scan view: design-system + sensors */}
      {result && (ds || sensors) && (
        <div className="mb-8">
          <ScanSummary sensors={sensors} designSystem={ds} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[rgba(251,113,133,0.2)] bg-[rgba(251,113,133,0.05)] p-4 mb-8 text-center">
          <p className="text-[13px] text-[#fb7185]">{error}</p>
        </div>
      )}

      {/* Timestamp */}
      {lastValidated && (
        <div className="flex items-center justify-center">
          <span className="text-[11px] text-[#5a5a72]">
            Last validated: {formatRelativeTime(lastValidated)}
          </span>
        </div>
      )}
    </div>
  );
}
