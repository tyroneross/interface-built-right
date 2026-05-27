import { describe, it, expect } from 'vitest';
import { collectInteractionStates } from './interaction-states.js';
import { makeCtx, makeStyleRule, makeMediaRule, makeButton, makeLink } from './test-fixtures.js';

describe('collectInteractionStates', () => {
  it('.btn:hover { background:blue } → states entry with base ".btn", state "hover", properties', () => {
    const rules = [makeStyleRule('.btn:hover', { background: 'blue' })];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.states).toHaveLength(1);
    expect(result.states[0]).toMatchObject({
      selector: '.btn',
      state: 'hover',
      properties: { background: 'blue' },
    });
  });

  it('button with :hover but no :focus or :focus-visible → finding flags missing focus_indicator', () => {
    const rules = [makeStyleRule('.btn:hover', { background: 'blue' })];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.findings).toContainEqual({ selector: '.btn', missing: 'focus_indicator' });
  });

  it('all three states (:active, :disabled, :focus-visible) defined → all returned', () => {
    const rules = [
      makeStyleRule('.btn:active', { transform: 'scale(0.97)' }),
      makeStyleRule('.btn:disabled', { opacity: '0.5' }),
      makeStyleRule('.btn:focus-visible', { outline: '2px solid blue' }),
    ];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    const observedStates = result.states.map((s) => s.state).sort();
    expect(observedStates).toEqual(['active', 'disabled', 'focus-visible']);
  });

  it('anchor with .link:hover but no .link:focus → finding flags missing focus_indicator', () => {
    const rules = [makeStyleRule('.link:hover', { color: 'red' })];
    const els = [makeLink('More', { selector: '.link' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.findings).toContainEqual({ selector: '.link', missing: 'focus_indicator' });
  });

  it('page with no :hover styles anywhere → empty arrays (NOT an error)', () => {
    const rules = [
      makeStyleRule('.btn', { background: 'gray' }),
      makeStyleRule('p', { color: 'black' }),
    ];
    const result = collectInteractionStates(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.states).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('@media (hover: hover) { .btn:hover { ... } } → state entry carries conditional_hover:true', () => {
    const rules = [
      makeMediaRule('(hover: hover)', [
        makeStyleRule('.btn:hover', { background: 'blue' }),
      ]),
    ];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.states).toHaveLength(1);
    expect(result.states[0].conditional_hover).toBe(true);
  });
});
