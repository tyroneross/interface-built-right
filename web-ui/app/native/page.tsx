'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';

interface Device {
  id: string;
  name: string;
  platform: 'iOS' | 'watchOS' | 'macOS';
  osVersion: string;
  status: 'booted' | 'off';
}

interface ScanIssue {
  id: string;
  severity: 'error' | 'warn';
  element: string;
  description: string;
  details?: {
    screenshot?: string;
    bounds?: { x: number; y: number; w: number; h: number };
    styles?: Record<string, string>;
    a11y?: { role?: string; label?: string; describedBy?: string };
    sourceFile?: string;
    sourceLine?: number;
  };
}

interface ScanResult {
  deviceName: string;
  score: number;
  issues: ScanIssue[];
}

export default function NativeTestingPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch devices on first interaction
  const loadDevices = useCallback(async () => {
    if (devices.length > 0) return;
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/native/devices');
      if (!res.ok) throw new Error('Device list not available');
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoadingDevices(false);
    }
  }, [devices.length]);

  const handleScan = useCallback(async () => {
    if (!selectedDeviceId) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    try {
      const res = await fetch('/api/native/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: selectedDeviceId }),
      });
      if (!res.ok) throw new Error('Scan endpoint not available');
      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [selectedDeviceId]);

  // Group devices by platform
  const grouped = devices.reduce<Record<string, Device[]>>((acc, d) => {
    (acc[d.platform] = acc[d.platform] || []).push(d);
    return acc;
  }, {});

  return (
    <div className="flex h-screen">
      {/* Devices panel */}
      <div
        className="flex flex-col shrink-0 border-r border-[rgba(255,255,255,0.06)]"
        style={{ width: 240 }}
      >
        <div className="flex-1 overflow-y-auto p-3">
          {devices.length === 0 && !loadingDevices ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-[#5a5a72] mb-3">No devices loaded</p>
              <Button variant="glass" size="sm" onClick={loadDevices}>
                Load Devices
              </Button>
            </div>
          ) : loadingDevices ? (
            <div className="py-8 text-center">
              <div className="animate-shimmer h-4 w-24 mx-auto rounded" />
            </div>
          ) : (
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
              {Object.entries(grouped).map(([platform, devs]) => (
                <div key={platform}>
                  {/* Platform label */}
                  <div className="px-3 py-1.5 text-[11px] font-medium text-[#5a5a72] uppercase">
                    {platform}
                  </div>
                  {devs.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDeviceId(d.id)}
                      className={`
                        flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors duration-200
                        border-t border-[rgba(255,255,255,0.04)]
                        ${selectedDeviceId === d.id
                          ? 'bg-[rgba(255,255,255,0.05)] border-l-2 border-l-[#818cf8]'
                          : 'hover:bg-[rgba(255,255,255,0.025)]'
                        }
                      `}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          d.status === 'booted' ? 'bg-[#34d399]' : 'bg-[#5a5a72]'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-[#f0f0f5] truncate block">
                          {d.name}
                        </span>
                        <span className="text-[11px] text-[#5a5a72]">{d.osVersion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan button */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.06)]">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleScan}
            disabled={!selectedDeviceId || scanning}
            loading={scanning}
          >
            Scan
          </Button>
        </div>
      </div>

      {/* Results panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-[rgba(251,113,133,0.2)] bg-[rgba(251,113,133,0.05)] p-4 mb-6 text-center">
            <p className="text-[13px] text-[#fb7185]">{error}</p>
          </div>
        )}

        {!scanResult && !scanning && (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[15px] text-[#5a5a72]">Select a device and scan</p>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-shimmer h-4 w-32 rounded mb-2" />
            <p className="text-[13px] text-[#5a5a72]">Scanning device...</p>
          </div>
        )}

        {scanResult && !scanning && (
          <>
            {/* Headline */}
            <h2 className="text-[18px] font-semibold text-[#f0f0f5] mb-6">
              {scanResult.deviceName}
              <span className="ml-2 text-[#34d399]">{scanResult.score}/100</span>
            </h2>

            {/* Issues list */}
            {scanResult.issues.length === 0 ? (
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] p-8 text-center">
                <p className="text-[13px] text-[#34d399]">No issues found</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
                {scanResult.issues.map((issue, i) => (
                  <div
                    key={issue.id}
                    className={i > 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''}
                  >
                    {/* Issue row */}
                    <div
                      onClick={() =>
                        setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)
                      }
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(255,255,255,0.025)] transition-colors duration-200"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          issue.severity === 'error' ? 'bg-[#fb7185]' : 'bg-[#fbbf24]'
                        }`}
                      />
                      <span className="text-[13px] font-medium text-[#f0f0f5] shrink-0">
                        {issue.element}
                      </span>
                      <span className="text-[13px] text-[#9d9db5] truncate">
                        {issue.description}
                      </span>
                      <svg
                        className={`w-4 h-4 text-[#5a5a72] shrink-0 ml-auto transition-transform duration-200 ${
                          expandedIssueId === issue.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>

                    {/* Drill-down */}
                    {expandedIssueId === issue.id && issue.details && (
                      <div className="px-4 pb-4 pt-1 bg-[rgba(255,255,255,0.015)]">
                        <div className="grid grid-cols-2 gap-4 text-[12px]">
                          {/* Computed styles */}
                          {issue.details.styles && (
                            <div>
                              <p className="text-[11px] font-medium text-[#5a5a72] uppercase mb-2">
                                Computed CSS
                              </p>
                              <div className="space-y-1">
                                {Object.entries(issue.details.styles).map(([prop, val]) => (
                                  <div key={prop} className="flex justify-between">
                                    <span className="text-[#9d9db5]">{prop}</span>
                                    <span className="text-[#f0f0f5] font-mono">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Accessibility */}
                          {issue.details.a11y && (
                            <div>
                              <p className="text-[11px] font-medium text-[#5a5a72] uppercase mb-2">
                                Accessibility
                              </p>
                              <div className="space-y-1">
                                {issue.details.a11y.role && (
                                  <div className="flex justify-between">
                                    <span className="text-[#9d9db5]">role</span>
                                    <span className="text-[#f0f0f5] font-mono">{issue.details.a11y.role}</span>
                                  </div>
                                )}
                                {issue.details.a11y.label && (
                                  <div className="flex justify-between">
                                    <span className="text-[#9d9db5]">label</span>
                                    <span className="text-[#f0f0f5] font-mono">{issue.details.a11y.label}</span>
                                  </div>
                                )}
                                {issue.details.a11y.describedBy && (
                                  <div className="flex justify-between">
                                    <span className="text-[#9d9db5]">describedBy</span>
                                    <span className="text-[#f0f0f5] font-mono">{issue.details.a11y.describedBy}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Source */}
                        {issue.details.sourceFile && (
                          <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                            <span className="text-[11px] text-[#818cf8] font-mono">
                              {issue.details.sourceFile}
                              {issue.details.sourceLine ? `:${issue.details.sourceLine}` : ''}
                            </span>
                          </div>
                        )}

                        {/* Bounds */}
                        {issue.details.bounds && (
                          <div className="mt-2 text-[11px] text-[#5a5a72]">
                            Bounds: {issue.details.bounds.x},{issue.details.bounds.y} {issue.details.bounds.w}x{issue.details.bounds.h}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
