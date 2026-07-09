import { describe, expect, it } from 'vitest';
import { isExtractorAvailable } from './extract.js';

describe('native extractor source resolution', () => {
  it('locates the bundled Swift package from the source module', () => {
    expect(isExtractorAvailable()).toBe(true);
  });
});
