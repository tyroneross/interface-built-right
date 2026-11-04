import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { assignRefs, diffRefs, formatDiff, formatRefLine, loadRefs, saveRefs } from './compact-refs.js';

const frame = { x: 1.4, y: 2, width: 30, height: 10 };

describe('compact refs', () => {
  it('assigns sequential refs and collapses identical nodes', () => {
    const refs = assignRefs([
      { role: 'AXMenuBar', frame },
      { role: 'AXMenuBar', frame },
      { role: 'AXButton', label: 'Save', identifier: 'saveBtn', frame },
    ]);
    expect(refs.map((r) => r.ref)).toEqual(['e1', 'e2']);
    expect(formatRefLine(refs[1])).toBe('e2 Button "Save" #saveBtn @1,2 30x10');
  });

  it('diffs by identity, not ref number', () => {
    const before = assignRefs([{ role: 'AXButton', label: 'A' }, { role: 'AXButton', label: 'B' }]);
    const after = assignRefs([{ role: 'AXButton', label: 'B' }, { role: 'AXStaticText', label: 'Done' }]);
    const d = diffRefs(before, after);
    expect(d.added.map((e) => e.label)).toEqual(['Done']);
    expect(d.removed.map((e) => e.label)).toEqual(['A']);
    expect(formatDiff(d)).toContain('+ e2 StaticText "Done"');
    expect(formatDiff(diffRefs(after, after))).toBe('no AX change (2 unchanged)');
  });

  it('round-trips refs on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-refs-'));
    const refs = assignRefs([{ role: 'AXButton', label: 'Go' }]);
    saveRefs(dir, 's1', refs);
    expect(loadRefs(dir, 's1')).toEqual(refs);
    expect(loadRefs(dir, 'missing')).toBeNull();
  });
});

describe('assignRefs with prior refs', () => {
  it('keeps existing numbers stable when an element is inserted above them', async () => {
    const { assignRefs } = await import('./compact-refs.js');
    const a = { role: 'AXButton', label: 'A', frame: { x: 0, y: 10, width: 5, height: 5 } };
    const b = { role: 'AXButton', label: 'B', frame: { x: 0, y: 20, width: 5, height: 5 } };
    const n = { role: 'AXButton', label: 'New', frame: { x: 0, y: 0, width: 5, height: 5 } };
    const before = assignRefs([a, b]);
    const after = assignRefs([n, a, b], before);
    expect(after.map((r) => `${r.ref}:${r.label}`)).toEqual(['e3:New', 'e1:A', 'e2:B']);
  });
});

describe('state and identity regressions', () => {
  it('keeps a unique ref while reporting value, enabled, label, and geometry changes', () => {
    const before = assignRefs([{ role: 'AXCheckBox', identifier: 'approve', label: 'Approve', value: '0', enabled: true, frame }]);
    const after = assignRefs([{ role: 'AXCheckBox', identifier: 'approve', label: 'Approved', value: '1', enabled: false, frame: { ...frame, x: 90 } }], before);
    expect(after[0].ref).toBe(before[0].ref);
    expect(diffRefs(before, after)).toMatchObject({ added: [], removed: [], updated: [after[0]], unchanged: 0 });
    expect(formatDiff(diffRefs(before, after))).toContain('value="1" disabled');
  });
  it('never reuses retired refs, including after an empty persisted snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-refs-empty-'));
    const before = assignRefs([{ role: 'AXButton', label: 'Delete' }]);
    saveRefs(dir, 's', assignRefs([], before), 'generation1');
    const after = assignRefs([{ role: 'AXButton', label: 'Other' }], loadRefs(dir, 's', 'generation1'));
    expect(after[0].ref).toBe('e2');
    saveRefs(dir, 's', after, 'generation1');
    const generation2 = loadRefs(dir, 's', 'generation2');
    expect(generation2).toHaveLength(0);
    expect(assignRefs([{ role: 'AXButton', label: 'Other' }], generation2)[0].ref).toBe('e3');
  });
  it('retires ambiguous twins instead of transferring a cached ref', () => {
    const before = assignRefs([{ role: 'AXButton', label: 'Delete', frame }]);
    const after = assignRefs([{ role: 'AXButton', label: 'Delete', frame }, { role: 'AXButton', label: 'Delete', frame: { ...frame, y: 80 } }], before);
    expect(after.map(e => e.ref)).not.toContain('e1');
  });
});

it('retires refs when the window identity changes and reports selection-only changes', () => {
  const before = assignRefs([{ role: 'AXButton', identifier: 'tab', selected: false, windowId: 1 }]);
  const selected = assignRefs([{ role: 'AXButton', identifier: 'tab', selected: true, windowId: 1 }], before);
  expect(selected[0].ref).toBe('e1');
  expect(diffRefs(before, selected).updated).toHaveLength(1);
  const otherWindow = assignRefs([{ role: 'AXButton', identifier: 'tab', selected: true, windowId: 2 }], selected);
  expect(otherWindow[0].ref).toBe('e2');
});
