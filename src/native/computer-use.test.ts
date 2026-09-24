import { describe, it, expect } from 'vitest';
import { normalizeAction, SCROLL_STEP_PX } from './computer-use.js';

describe('normalizeAction', () => {
  it('maps Anthropic actions', () => {
    expect(normalizeAction({ action: 'left_click', coordinate: [10, 20] })).toEqual({ kind: 'click', x: 10, y: 20, count: 1 });
    expect(normalizeAction({ action: 'key', text: 'Return' })).toEqual({ kind: 'key', key: 'Return' });
    expect(normalizeAction({ action: 'scroll', coordinate: [5, 5], scroll_direction: 'down', scroll_amount: 2 }))
      .toEqual({ kind: 'scroll', x: 5, y: 5, dx: 0, dy: 2 * SCROLL_STEP_PX });
    expect(normalizeAction({ action: 'left_click_drag', start_coordinate: [1, 2], coordinate: [3, 4] }))
      .toEqual({ kind: 'drag', x1: 1, y1: 2, x2: 3, y2: 4 });
  });

  it('maps OpenAI actions', () => {
    expect(normalizeAction({ type: 'click', x: 7, y: 8, button: 'left' })).toEqual({ kind: 'click', x: 7, y: 8, count: 1 });
    expect(normalizeAction({ type: 'keypress', keys: ['ENTER'] })).toEqual({ kind: 'key', key: 'ENTER' });
    expect(normalizeAction({ type: 'drag', path: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 9, y: 9 }] }))
      .toEqual({ kind: 'drag', x1: 0, y1: 0, x2: 9, y2: 9 });
    expect(normalizeAction({ type: 'screenshot' })).toEqual({ kind: 'screenshot' });
  });

  it('rejects unsupported or malformed input', () => {
    expect(() => normalizeAction({ action: 'hold_key' })).toThrow(/unsupported/);
    expect(() => normalizeAction({ action: 'left_click', coordinate: [1] })).toThrow(/\[x, y\]/);
    expect(() => normalizeAction({ type: 'keypress', keys: ['CTRL', 'C'] })).toThrow(/exactly one key/);
  });
});
