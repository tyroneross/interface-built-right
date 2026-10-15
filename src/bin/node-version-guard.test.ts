import { describe, it, expect } from 'vitest';
import { checkNodeVersion } from './node-version-guard.js';

describe('checkNodeVersion', () => {
  it('rejects Node below 20 with a hint', () => {
    expect(checkNodeVersion('18.19.0')).toMatch(/^ibr needs Node 20\+ \(found v18\.19\.0\); run with .+/);
  });
  it('accepts Node 20 and newer', () => {
    expect(checkNodeVersion('20.0.0')).toBeNull();
    expect(checkNodeVersion('22.22.0')).toBeNull();
  });
});
