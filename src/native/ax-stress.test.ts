import { describe, expect, it } from 'vitest';
import { buildAxStressArgs, formatAxStressReport, runAxStress, type AxStressReport } from './ax-stress.js';

const survived: AxStressReport = {
  pid: 42,
  survived: true,
  steps: [
    { index: 1, step: 'walk', walks: [{ nodes: 10, reads: 80, failedReads: 0, truncated: false }] },
    { index: 2, step: 'app.toggle', pressed: true, walks: [{ nodes: 12, reads: 96, failedReads: 1, truncated: false }] },
  ],
};

describe('buildAxStressArgs', () => {
  it('passes steps as JSON with defaults', () => {
    expect(buildAxStressArgs({ pid: 42, steps: ['walk', 'a.b'] })).toEqual([
      '--pid', '42', '--stress-steps', '["walk","a.b"]', '--stress-walks', '5',
      '--stress-max-nodes', '50000', '--stress-settle', '1',
    ]);
  });

  it.each([
    [{ pid: 0, steps: ['walk'] }, 'pid'],
    [{ pid: 1, steps: [] }, 'steps'],
    [{ pid: 1, steps: [' '] }, 'steps'],
    [{ pid: 1, steps: ['walk'], walksPerStep: 0 }, 'walks'],
    [{ pid: 1, steps: ['walk'], walksPerStep: 101 }, 'walks'],
    [{ pid: 1, steps: ['walk'], maxNodes: 0 }, 'max nodes'],
    [{ pid: 1, steps: ['walk'], settleSeconds: -1 }, 'settle'],
  ])('rejects %j', (opts, message) => {
    expect(() => buildAxStressArgs(opts)).toThrow(message);
  });
});

describe('runAxStress', () => {
  const ensure = async () => '/bin/extractor';

  it('returns the report on a clean exit', async () => {
    const report = await runAxStress({ pid: 42, steps: ['walk'] }, {
      ensure,
      run: async () => ({ stdout: JSON.stringify(survived) }),
    });
    expect(report.survived).toBe(true);
  });

  it('treats a crash exit that still printed a report as a result', async () => {
    const crashed = { ...survived, survived: false, crash: { step: 'app.toggle', index: 2, walk: 1, phase: 'walk' } };
    const report = await runAxStress({ pid: 42, steps: ['walk'] }, {
      ensure,
      run: async () => { throw Object.assign(new Error('exit 3'), { stdout: JSON.stringify(crashed) }); },
    });
    expect(report.survived).toBe(false);
    expect(report.crash?.step).toBe('app.toggle');
  });

  it('surfaces the tool error when no report was printed', async () => {
    await expect(runAxStress({ pid: 42, steps: ['walk'] }, {
      ensure,
      run: async () => { throw Object.assign(new Error('exit 1'), { stdout: '', stderr: '{"error":"Accessibility permission not granted"}' }); },
    })).rejects.toThrow('Accessibility permission not granted');
  });
});

describe('formatAxStressReport', () => {
  it('summarizes each step and the verdict', () => {
    expect(formatAxStressReport(survived)).toBe([
      '1. walk: 1 walks, nodes 10, failed reads 0',
      '2. app.toggle (pressed): 1 walks, nodes 12, failed reads 1',
      'SURVIVED: pid 42 is still running',
    ].join('\n'));
  });

  it('flags a step whose reads saw no windows', () => {
    const blind = { ...survived, steps: [{ index: 1, step: 'walk', walks: [{ nodes: 5, reads: 40, failedReads: 0, truncated: false, windows: 0, screenLocked: true }] }] };
    expect(formatAxStressReport(blind).split('\n')[0]).toBe('1. walk: 1 walks, nodes 5, failed reads 0 NO-WINDOWS (menus only; result proves nothing)');
  });

  it('counts failed whole-tree hierarchy reads', () => {
    const text = formatAxStressReport({
      pid: 42, survived: true,
      steps: [{ index: 1, step: 'walk', walks: [
        { nodes: 10, reads: 80, failedReads: 0, truncated: false, windows: 1, hierarchy: 'ok' },
        { nodes: 10, reads: 80, failedReads: 0, truncated: false, windows: 1, hierarchy: 'error -25204' },
      ] }],
    });
    expect(text.split('\n')[0]).toBe('1. walk: 2 walks, nodes 10,10, failed reads 0 hierarchy errors 1');
  });

  it('names where the target died', () => {
    const text = formatAxStressReport({ ...survived, survived: false, crash: { step: 'app.toggle', index: 2, walk: 3, phase: 'walk' } });
    expect(text.split('\n').pop()).toBe('CRASHED: pid 42 exited during step 2 (app.toggle), walk 3');
  });
});
