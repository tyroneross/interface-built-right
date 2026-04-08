'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';

interface SettingsData {
  server: {
    port: number;
    autoOpen: boolean;
  };
  comparison: {
    threshold: number;
    viewports: string[];
  };
  designSystem: {
    enabled: boolean;
    configPath: string;
    principles: {
      gestalt: boolean;
      signalNoise: boolean;
      contentChrome: boolean;
      cognitiveLoad: boolean;
      fitts: boolean;
      hick: boolean;
    };
  };
}

const defaultSettings: SettingsData = {
  server: { port: 4200, autoOpen: true },
  comparison: { threshold: 5, viewports: ['desktop', 'mobile'] },
  designSystem: {
    enabled: true,
    configPath: '.ibr/design-system.json',
    principles: {
      gestalt: true,
      signalNoise: true,
      contentChrome: true,
      cognitiveLoad: true,
      fitts: true,
      hick: true,
    },
  },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0
        ${checked ? 'bg-[#818cf8]' : 'bg-[rgba(255,255,255,0.1)]'}
      `}
    >
      <span
        className={`
          absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] p-5">
      <h3 className="text-[15px] font-medium text-[#f0f0f5] mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-[13px] text-[#9d9db5] shrink-0">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(() => {
        // API may not exist — use defaults
      });
  }, []);

  const update = useCallback(
    (path: string, value: unknown) => {
      setSettings((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        const parts = path.split('.');
        let obj = next;
        for (let i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        return next;
      });
      setDirty(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setDirty(false);
    } catch {
      // Graceful — settings may be local-only
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const { server, comparison, designSystem } = settings;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Server */}
      <Section title="Server">
        <Field label="Port">
          <input
            type="number"
            value={server.port}
            onChange={(e) => update('server.port', Number(e.target.value))}
            className="glass-input w-24 text-right"
            min={1024}
            max={65535}
          />
        </Field>
        <Field label="Auto-open browser">
          <Toggle
            checked={server.autoOpen}
            onChange={(v) => update('server.autoOpen', v)}
          />
        </Field>
      </Section>

      {/* Comparison */}
      <Section title="Comparison">
        <Field label="Threshold (%)">
          <input
            type="number"
            value={comparison.threshold}
            onChange={(e) => update('comparison.threshold', Number(e.target.value))}
            className="glass-input w-24 text-right"
            min={0}
            max={100}
          />
        </Field>
        <Field label="Viewports">
          <div className="flex gap-2">
            {['desktop', 'tablet', 'mobile'].map((vp) => {
              const active = comparison.viewports.includes(vp);
              return (
                <button
                  key={vp}
                  onClick={() => {
                    const next = active
                      ? comparison.viewports.filter((v) => v !== vp)
                      : [...comparison.viewports, vp];
                    update('comparison.viewports', next);
                  }}
                  className={`
                    px-3 h-8 rounded-lg text-[12px] font-medium transition-colors duration-200
                    ${active
                      ? 'bg-[rgba(129,140,248,0.12)] text-[#818cf8]'
                      : 'bg-[rgba(255,255,255,0.03)] text-[#5a5a72] hover:text-[#9d9db5]'
                    }
                  `}
                >
                  {vp}
                </button>
              );
            })}
          </div>
        </Field>
      </Section>

      {/* Design System */}
      <Section title="Design System">
        <Field label="Enable validation">
          <Toggle
            checked={designSystem.enabled}
            onChange={(v) => update('designSystem.enabled', v)}
          />
        </Field>
        <Field label="Config path">
          <input
            type="text"
            value={designSystem.configPath}
            onChange={(e) => update('designSystem.configPath', e.target.value)}
            className="glass-input flex-1 min-w-0 font-mono text-[12px]"
          />
        </Field>
        {designSystem.enabled && (
          <div className="pt-2 border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-[11px] text-[#5a5a72] uppercase font-medium mb-3">Principles</p>
            <div className="space-y-3">
              {(Object.entries(designSystem.principles) as [string, boolean][]).map(([key, val]) => (
                <Field key={key} label={key.replace(/([A-Z])/g, ' $1').toLowerCase()}>
                  <Toggle
                    checked={val}
                    onChange={(v) => update(`designSystem.principles.${key}`, v)}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* About */}
      <Section title="About">
        <Field label="Version">
          <span className="text-[13px] text-[#f0f0f5] font-mono">0.8.0</span>
        </Field>
        <Field label="Documentation">
          <a
            href="https://github.com/tyroneross/interface-built-right"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-[#818cf8] hover:underline"
          >
            GitHub
          </a>
        </Field>
      </Section>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!dirty}
          loading={saving}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}
