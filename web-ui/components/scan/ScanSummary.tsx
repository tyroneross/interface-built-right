// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0
'use client';

import type {
  SensorReport,
  DesignSystemResult,
  DesignSystemViolation,
  DesignSystemTokenViolation,
} from '@/lib/types';

// Read-only renderer for the v1.2.0 scan output additions:
// scan.sensors (10 sensors) + scan.designSystem (principle/token violations).
// The web-ui does NOT produce this data; it renders what the CLI emits.

interface Props {
  sensors?: SensorReport;
  designSystem?: DesignSystemResult;
}

export function ScanSummary({ sensors, designSystem }: Props) {
  if (!sensors && !designSystem) return null;

  return (
    <div className="space-y-6">
      {designSystem && <DesignSystemBlock ds={designSystem} />}
      {sensors && <SensorsBlock sensors={sensors} />}
    </div>
  );
}

// ── Design system block ─────────────────────────────────────────────

function DesignSystemBlock({ ds }: { ds: DesignSystemResult }) {
  const errorCount =
    ds.principleViolations.filter(v => v.severity === 'error').length +
    ds.customViolations.filter(v => v.severity === 'error').length;
  const warnCount =
    ds.principleViolations.filter(v => v.severity === 'warn').length +
    ds.customViolations.filter(v => v.severity === 'warn').length;
  const tokenErrors = ds.tokenViolations.filter(v => v.severity === 'error').length;
  const tokenWarns = ds.tokenViolations.filter(v => v.severity === 'warning').length;

  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
      <header className="flex items-baseline gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
        <h3 className="text-[13px] font-medium text-[#f0f0f5]">Design System</h3>
        <span className="text-[11px] text-[#5a5a72]">{ds.configName}</span>
        <span className="ml-auto text-[13px] font-medium text-[#818cf8]">
          {ds.complianceScore}% compliance
        </span>
      </header>

      <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,0.04)]">
        <Cell label="Principle violations">
          <Counts errors={errorCount} warns={warnCount} />
        </Cell>
        <Cell label="Token violations">
          <Counts errors={tokenErrors} warns={tokenWarns} />
        </Cell>
      </div>

      {ds.principleViolations.length > 0 && (
        <ViolationList
          title={`Principles (${ds.principleViolations.length})`}
          items={ds.principleViolations}
          render={v => (
            <>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  v.severity === 'error' ? 'bg-[#fb7185]' : 'bg-[#fbbf24]'
                }`}
              />
              <span className="text-[12px] font-medium text-[#f0f0f5] shrink-0">
                {v.principleName}
              </span>
              <span className="text-[12px] text-[#9d9db5] truncate">{v.message}</span>
              {v.element && (
                <code className="text-[10px] text-[#5a5a72] truncate ml-auto max-w-[40%]">
                  {v.element}
                </code>
              )}
            </>
          )}
        />
      )}

      {ds.tokenViolations.length > 0 && (
        <ViolationList
          title={`Tokens (${ds.tokenViolations.length})`}
          items={ds.tokenViolations}
          render={v => (
            <>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  v.severity === 'error' ? 'bg-[#fb7185]' : 'bg-[#fbbf24]'
                }`}
              />
              <span className="text-[12px] text-[#f0f0f5] shrink-0">{v.property}</span>
              <span className="text-[12px] text-[#9d9db5] truncate">
                expected <code className="text-[#34d399]">{String(v.expected)}</code>, got{' '}
                <code className="text-[#fb7185]">{String(v.actual)}</code>
              </span>
              <code className="text-[10px] text-[#5a5a72] truncate ml-auto max-w-[40%]">
                {v.element}
              </code>
            </>
          )}
        />
      )}

      {ds.customViolations.length > 0 && (
        <ViolationList
          title={`Custom (${ds.customViolations.length})`}
          items={ds.customViolations}
          render={v => (
            <>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  v.severity === 'error' ? 'bg-[#fb7185]' : 'bg-[#fbbf24]'
                }`}
              />
              <span className="text-[12px] font-medium text-[#f0f0f5] shrink-0">
                {v.principleName}
              </span>
              <span className="text-[12px] text-[#9d9db5] truncate">{v.message}</span>
            </>
          )}
        />
      )}
    </section>
  );
}

// ── Sensors block ───────────────────────────────────────────────────

function SensorsBlock({ sensors }: { sensors: SensorReport }) {
  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
      <header className="flex items-baseline gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
        <h3 className="text-[13px] font-medium text-[#f0f0f5]">Sensors</h3>
        <span className="text-[11px] text-[#5a5a72]">v1.2.0 scan output</span>
      </header>

      {sensors.oneLiners.length > 0 && (
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] space-y-1">
          {sensors.oneLiners.map((line, i) => (
            <p key={i} className="text-[12px] text-[#9d9db5]">
              {line}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,0.04)]">
        {sensors.visualPatterns.length > 0 && (
          <Cell label="Visual patterns">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.visualPatterns.length} categor
              {sensors.visualPatterns.length === 1 ? 'y' : 'ies'}
            </div>
            <div className="text-[11px] text-[#9d9db5] mt-1">
              {sensors.visualPatterns
                .map(vp => `${vp.category}: ${vp.distinctPatterns}/${vp.totalElements}`)
                .join(' · ')}
            </div>
          </Cell>
        )}

        <Cell label="Components">
          <div className="text-[12px] text-[#f0f0f5]">
            {sensors.componentCensus.topComponents.length} top components
          </div>
          <div className="text-[11px] text-[#9d9db5] mt-1">
            {sensors.componentCensus.withHandlers}/
            {sensors.componentCensus.withHandlers + sensors.componentCensus.withoutHandlers} with
            handlers
            {sensors.componentCensus.orphanInteractive.length > 0 && (
              <>
                {' '}· {sensors.componentCensus.orphanInteractive.length} orphan-interactive
              </>
            )}
          </div>
        </Cell>

        <Cell label="Interaction map">
          <div className="text-[12px] text-[#f0f0f5]">
            {sensors.interactionMap.withHandlers}/{sensors.interactionMap.total} wired
          </div>
          <div className="text-[11px] text-[#9d9db5] mt-1">
            {sensors.interactionMap.formCount} form
            {sensors.interactionMap.formCount === 1 ? '' : 's'} ·{' '}
            {sensors.interactionMap.disabled} disabled
            {sensors.interactionMap.missingHandlers.length > 0 && (
              <>
                {' '}· {sensors.interactionMap.missingHandlers.length} missing
              </>
            )}
          </div>
        </Cell>

        <Cell label="Contrast (WCAG)">
          <div className="text-[12px] text-[#f0f0f5]">
            {sensors.contrast.pass}/{sensors.contrast.totalChecked} pass AA
          </div>
          <div className="text-[11px] text-[#9d9db5] mt-1">
            {sensors.contrast.passAAA} pass AAA
            {sensors.contrast.fail > 0 && (
              <>
                {' '}· <span className="text-[#fb7185]">{sensors.contrast.fail} fail</span>
              </>
            )}
            {sensors.contrast.minRatio && (
              <>
                {' '}· min {sensors.contrast.minRatio.ratio.toFixed(2)}
              </>
            )}
          </div>
        </Cell>

        {sensors.navigation && (
          <Cell label="Navigation">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.navigation.navs.length} region
              {sensors.navigation.navs.length === 1 ? '' : 's'}, depth {sensors.navigation.depth}
            </div>
            <div className="text-[11px] text-[#9d9db5] mt-1">
              {sensors.navigation.totalLinks} links
            </div>
          </Cell>
        )}

        {sensors.typography && (
          <Cell label="Typography">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.typography.rows.length} fingerprint
              {sensors.typography.rows.length === 1 ? '' : 's'}
            </div>
            {sensors.typography.font_loading_pending && (
              <div className="text-[11px] text-[#fbbf24] mt-1">font loading pending</div>
            )}
            {sensors.typography.data_unavailable && (
              <div className="text-[11px] text-[#5a5a72] mt-1">data unavailable</div>
            )}
          </Cell>
        )}

        {sensors.breakpoints && sensors.breakpoints.length > 0 && (
          <Cell label="Breakpoints">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.breakpoints.length} declared
            </div>
            <div className="text-[11px] text-[#9d9db5] mt-1 truncate">
              {sensors.breakpoints
                .slice(0, 4)
                .map(bp =>
                  bp.value_px
                    ? `${bp.type}: ${bp.value_px}px`
                    : bp.min && bp.max
                      ? `${bp.min}–${bp.max}px`
                      : bp.type
                )
                .join(' · ')}
            </div>
          </Cell>
        )}

        {sensors.motion && (
          <Cell label="Motion">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.motion.transitions.length} transition
              {sensors.motion.transitions.length === 1 ? '' : 's'} ·{' '}
              {sensors.motion.keyframes.length} keyframe
              {sensors.motion.keyframes.length === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] text-[#9d9db5] mt-1">
              {sensors.motion.reduced_motion_overrides.length} reduced-motion override
              {sensors.motion.reduced_motion_overrides.length === 1 ? '' : 's'}
            </div>
          </Cell>
        )}

        {sensors.hierarchy && (
          <Cell label="Hierarchy">
            <div className="text-[12px] text-[#f0f0f5]">
              h1×{sensors.hierarchy.h1.count} h2×{sensors.hierarchy.h2.count} h3×
              {sensors.hierarchy.h3.count}
            </div>
            <div className="text-[11px] text-[#9d9db5] mt-1">
              landmarks: main×{sensors.hierarchy.landmarks.main} nav×
              {sensors.hierarchy.landmarks.nav} footer×{sensors.hierarchy.landmarks.footer}
              {sensors.hierarchy.h1.finding && (
                <>
                  {' '}·{' '}
                  <span className="text-[#fb7185]">{sensors.hierarchy.h1.finding}</span>
                </>
              )}
              {sensors.hierarchy.level_skips.length > 0 && (
                <>
                  {' '}·{' '}
                  <span className="text-[#fbbf24]">
                    {sensors.hierarchy.level_skips.length} level skip
                    {sensors.hierarchy.level_skips.length === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </div>
          </Cell>
        )}

        {sensors.interactionStates && (
          <Cell label="Interaction states">
            <div className="text-[12px] text-[#f0f0f5]">
              {sensors.interactionStates.states.length} rule
              {sensors.interactionStates.states.length === 1 ? '' : 's'}
            </div>
            {sensors.interactionStates.findings.length > 0 && (
              <div className="text-[11px] text-[#fbbf24] mt-1">
                {sensors.interactionStates.findings.length} missing focus indicator
                {sensors.interactionStates.findings.length === 1 ? '' : 's'}
              </div>
            )}
          </Cell>
        )}
      </div>
    </section>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131d] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#5a5a72] mb-1">{label}</div>
      {children}
    </div>
  );
}

function Counts({ errors, warns }: { errors: number; warns: number }) {
  if (errors === 0 && warns === 0) {
    return <span className="text-[13px] text-[#34d399]">None</span>;
  }
  return (
    <div className="text-[13px]">
      {errors > 0 && (
        <span className="text-[#fb7185] mr-2">
          {errors} error{errors === 1 ? '' : 's'}
        </span>
      )}
      {warns > 0 && (
        <span className="text-[#fbbf24]">
          {warns} warn{warns === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

function ViolationList<T extends DesignSystemViolation | DesignSystemTokenViolation>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  const top = items.slice(0, 10);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[#5a5a72] px-4 pt-3 pb-2">
        {title}
      </div>
      <div>
        {top.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2 ${
              i > 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''
            }`}
          >
            {render(item)}
          </div>
        ))}
      </div>
      {items.length > top.length && (
        <div className="px-4 py-2 text-[11px] text-[#5a5a72] border-t border-[rgba(255,255,255,0.04)]">
          + {items.length - top.length} more
        </div>
      )}
    </div>
  );
}
