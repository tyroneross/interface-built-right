'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';

interface Violation {
  id: string;
  severity: 'error' | 'warn';
  principle: string;
  description: string;
}

interface DesignSystemData {
  complianceScore: number;
  violations: Violation[];
  lastValidated?: string;
}

export default function DesignSystemPage() {
  const [data, setData] = useState<DesignSystemData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/design-system/validate', { method: 'POST' });
      if (!res.ok) {
        // API may not exist yet — show empty state gracefully
        throw new Error('Validation endpoint not available');
      }
      const result = await res.json();
      setData({
        complianceScore: result.complianceScore ?? 0,
        violations: (result.violations ?? []).map((v: Violation, i: number) => ({
          ...v,
          id: v.id || `v-${i}`,
        })),
        lastValidated: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const formatRelativeTime = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Score */}
      <div className="text-center mb-8">
        {data ? (
          <>
            <p
              className="text-5xl font-bold text-[#818cf8] mb-2"
              style={{ fontSize: '48px' }}
            >
              {data.complianceScore}%
            </p>
            <p className="text-[13px] text-[#9d9db5]">
              {data.violations.length} violation{data.violations.length !== 1 ? 's' : ''} found
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold text-[#5a5a72] mb-2" style={{ fontSize: '48px' }}>
              --
            </p>
            <p className="text-[13px] text-[#5a5a72]">
              Run validation to check design system compliance
            </p>
          </>
        )}
      </div>

      {/* Violations list */}
      {data && data.violations.length > 0 && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden mb-8">
          {data.violations.map((v, i) => (
            <div
              key={v.id}
              className={`
                flex items-center gap-3 px-4 py-3
                ${i > 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''}
              `}
            >
              {/* Severity dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  v.severity === 'error' ? 'bg-[#fb7185]' : 'bg-[#fbbf24]'
                }`}
              />
              {/* Principle */}
              <span className="text-[13px] font-medium text-[#f0f0f5] shrink-0">
                {v.principle}
              </span>
              {/* Description */}
              <span className="text-[13px] text-[#9d9db5] truncate">
                {v.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty violations */}
      {data && data.violations.length === 0 && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] p-8 text-center mb-8">
          <p className="text-[13px] text-[#34d399]">No violations found</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[rgba(251,113,133,0.2)] bg-[rgba(251,113,133,0.05)] p-4 mb-8 text-center">
          <p className="text-[13px] text-[#fb7185]">{error}</p>
        </div>
      )}

      {/* Validate button + timestamp */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="primary" onClick={handleValidate} loading={loading}>
          Validate Now
        </Button>
        {data?.lastValidated && (
          <span className="text-[11px] text-[#5a5a72]">
            Last validated: {formatRelativeTime(data.lastValidated)}
          </span>
        )}
      </div>
    </div>
  );
}
