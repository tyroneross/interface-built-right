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
