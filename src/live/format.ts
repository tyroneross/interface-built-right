/**
 * Human-readable rendering of live-pane measurements. `--json` bypasses this
 * entirely; nothing here is truncated in the JSON path.
 */

import type { LiveTarget } from './attach.js';
import type { LiveElementMeasurement, LiveMeasureResult } from './measure.js';

function label(el: LiveElementMeasurement): string {
  const cls = el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
  const id = el.id ? `#${el.id}` : '';
  return `${el.tagName}${id}${cls}`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export function formatLiveTargets(targets: LiveTarget[]): string {
  if (targets.length === 0) return 'No targets exposed by this browser.';
  const lines = [`${targets.length} target(s):`, ''];
  for (const t of targets) {
    lines.push(`  [${pad(t.type, 7)}] ${t.title || '(no title)'}`);
    lines.push(`            url: ${t.url || '(none)'}`);
    lines.push(`            id:  ${t.targetId}${t.attached ? '  (already attached)' : ''}`);
  }
  return lines.join('\n');
}

export function formatLiveMeasureResult(result: LiveMeasureResult): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`  LIVE MEASURE — ${result.matched} element(s) for "${result.selector}"`);
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`Target:   ${result.target.title || '(no title)'}`);
  lines.push(`URL:      ${result.page.url}`);
  lines.push(`Viewport: ${result.page.innerWidth}x${result.page.innerHeight} @${result.page.devicePixelRatio}x`);
  lines.push(`Scroll:   x=${result.page.scrollX} y=${result.page.scrollY}`);
  lines.push('');

  if (result.matched === 0) {
    lines.push('No element matched the selector in the live page.');
    return lines.join('\n');
  }

  for (const el of result.elements) {
    const b = el.bounds;
    lines.push(`[${el.index}] ${label(el)}`);
    if (el.textContent) lines.push(`     text:      "${el.textContent}"`);
    if (el.disabled !== null) lines.push(`     disabled:  ${el.disabled}`);
    lines.push(
      `     bounds:    ${b.width}x${b.height} at (${b.x}, ${b.y})`
      + `  [t${b.top} r${b.right} b${b.bottom} l${b.left}]`,
    );
    lines.push(
      `     box:       height=${el.box.height} min-height=${el.box.minHeight}`
      + ` box-sizing=${el.box.boxSizing}`,
    );
    lines.push(
      `     padding:   ${el.box.paddingTop} ${el.box.paddingRight} ${el.box.paddingBottom} ${el.box.paddingLeft}`,
    );
    lines.push(
      `     margin:    ${el.box.marginTop} ${el.box.marginRight} ${el.box.marginBottom} ${el.box.marginLeft}`,
    );
    lines.push(
      `     border:    ${el.box.borderTopWidth} ${el.box.borderRightWidth} ${el.box.borderBottomWidth} ${el.box.borderLeftWidth}`,
    );
    lines.push(
      `     type:      ${el.typography.fontSize}/${el.typography.lineHeight}`
      + ` weight=${el.typography.fontWeight} spacing=${el.typography.letterSpacing}`
      + ` white-space=${el.typography.whiteSpace}`,
    );
    lines.push(`     font:      ${el.typography.fontFamily}`);
    lines.push(
      `     layout:    display=${el.layout.display} align-items=${el.layout.alignItems}`
      + ` align-self=${el.layout.alignSelf} flex=${el.layout.flexGrow} ${el.layout.flexShrink} ${el.layout.flexBasis}`
      + ` gap=${el.layout.gap}`,
    );
    lines.push(`     color:     ${el.color.color} on ${el.color.effectiveBackgroundColor}`
      + `${el.color.effectiveBackgroundResolved ? '' : ' (assumed white — no opaque ancestor)'}`);
    const ratio = el.color.contrastRatio;
    lines.push(
      `     contrast:  ${ratio === null ? 'unavailable' : `${ratio}:1`}`
      + ` (AA needs ${el.color.aaThreshold}:1${el.color.largeText ? ', large text' : ''})`
      + ` ${el.color.passesAA === null ? '' : el.color.passesAA ? 'PASS' : 'FAIL'}`,
    );
    lines.push(
      `     baseline:  ${el.firstLineBaselineY === null ? 'not determinable' : `y=${el.firstLineBaselineY}`}`,
    );
    lines.push('');
  }

  const baselines = result.elements
    .map((e) => e.firstLineBaselineY)
    .filter((y): y is number => y !== null);
  if (baselines.length > 1) {
    const min = Math.min(...baselines);
    const max = Math.max(...baselines);
    const spread = Math.round((max - min) * 100) / 100;
    lines.push(
      spread === 0
        ? `Baselines: all ${baselines.length} share y=${min}.`
        : `Baselines: spread ${spread}px across ${baselines.length} elements (${min} … ${max}).`,
    );
  }

  return lines.join('\n');
}
