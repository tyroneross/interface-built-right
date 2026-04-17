import { describe, it, expect } from 'vitest';
import { collectInteractionMap } from './interaction-map.js';
import { makeElement, makeButton, makeLink, makeCtx } from './test-fixtures.js';

describe('collectInteractionMap', () => {
  it('returns zero counts for empty elements', () => {
    const result = collectInteractionMap(makeCtx([]));
    expect(result.total).toBe(0);
    expect(result.withHandlers).toBe(0);
    expect(result.withoutHandlers).toBe(0);
    expect(result.disabled).toBe(0);
    expect(result.formCount).toBe(0);
    expect(result.missingHandlers).toHaveLength(0);
  });

  it('counts buttons as interactive', () => {
    const els = [makeButton('Save'), makeButton('Cancel')];
    const result = collectInteractionMap(makeCtx(els));
    expect(result.total).toBe(2);
    expect(result.withHandlers).toBe(2);
  });

  it('counts links as interactive', () => {
    const els = [makeLink('Home'), makeLink('About')];
    const result = collectInteractionMap(makeCtx(els));
    expect(result.total).toBe(2);
    expect(result.withHandlers).toBe(2);
  });

  it('non-interactive text div is not counted', () => {
    const el = makeElement({ tagName: 'div', text: 'just text' });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.total).toBe(0);
  });

  it('missingHandlers flags interactive-looking elements without handlers', () => {
    const el = makeElement({
      tagName: 'button',
      selector: 'button.ghost',
      text: 'Ghost',
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
      },
    });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.withoutHandlers).toBe(1);
    expect(result.missingHandlers).toHaveLength(1);
    expect(result.missingHandlers[0].selector).toBe('button.ghost');
    expect(result.missingHandlers[0].tagName).toBe('button');
  });

  it('missingHandlers entry has tagName and optional role', () => {
    const el = makeElement({
      tagName: 'a',
      selector: 'a.navlink',
      text: 'Nav',
      a11y: { role: 'link', ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'default',
      },
    });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.missingHandlers[0].tagName).toBe('a');
    expect(result.missingHandlers[0].role).toBe('link');
  });

  it('disabled count works', () => {
    const el = makeButton('Submit', {
      interactive: {
        hasOnClick: true,
        hasHref: false,
        isDisabled: true,
        tabIndex: -1,
        cursor: 'not-allowed',
      },
    });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.disabled).toBe(1);
  });

  it('formCount counts form tags', () => {
    const form = makeElement({ tagName: 'form', text: '' });
    const result = collectInteractionMap(makeCtx([form]));
    expect(result.formCount).toBe(1);
  });

  it('formCount does not count form toward interactive total', () => {
    const form = makeElement({ tagName: 'form', text: '' });
    const result = collectInteractionMap(makeCtx([form]));
    // form is not button/a/role=button/link/cursor:pointer, so total stays 0
    expect(result.total).toBe(0);
    expect(result.formCount).toBe(1);
  });

  it('cursor:pointer element counted as interactive', () => {
    const el = makeElement({
      tagName: 'span',
      text: 'clickable',
      computedStyles: {
        color: 'rgb(0,0,0)',
        backgroundColor: 'rgb(255,255,255)',
        fontSize: '16',
        fontWeight: '400',
        cursor: 'pointer',
        borderRadius: '0',
        padding: '0',
        borderWidth: '0',
        borderColor: 'transparent',
      },
      interactive: {
        hasOnClick: true,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'pointer',
      },
    });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.total).toBe(1);
    expect(result.withHandlers).toBe(1);
  });

  it('role=link counts as interactive', () => {
    const el = makeElement({
      tagName: 'div',
      text: 'Link text',
      a11y: { role: 'link', ariaLabel: null, ariaDescribedBy: null },
      interactive: {
        hasOnClick: false,
        hasHref: false,
        isDisabled: false,
        tabIndex: 0,
        cursor: 'default',
      },
    });
    const result = collectInteractionMap(makeCtx([el]));
    expect(result.total).toBe(1);
  });
});
