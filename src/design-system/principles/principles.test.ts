import { describe, it, expect } from 'vitest';
import { gestaltRules } from './gestalt.js';
import { signalNoiseRules } from './signal-noise.js';
import { fittsRules } from './fitts.js';
import { hickRules } from './hick.js';
import { contentChromeRules } from './content-chrome.js';
import { cognitiveLoadRules } from './cognitive-load.js';
import { allCalmPrecisionRules, corePrincipleIds, stylisticPrincipleIds } from './calm-precision.js';
import type { EnhancedElement } from '../../schemas.js';
import type { RuleContext } from '../../rules/types.js';

// Helper to create mock element
function mockElement(overrides: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'div.test',
    tagName: 'div',
    bounds: { x: 0, y: 0, width: 200, height: 50 },
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
    ...overrides,
  } as EnhancedElement;
}

function mockContext(elements: EnhancedElement[] = []): RuleContext {
  return {
    isMobile: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    url: 'http://localhost:3000',
    allElements: elements,
  };
}

describe('Calm Precision Principles', () => {
  describe('allCalmPrecisionRules', () => {
    it('has 6 rules total', () => {
      expect(allCalmPrecisionRules.length).toBe(6);
    });

    it('all rules have calm-precision/ prefix', () => {
      for (const rule of allCalmPrecisionRules) {
        expect(rule.id).toMatch(/^calm-precision\//);
      }
    });

    it('core principles are correct', () => {
      expect(corePrincipleIds).toEqual(['gestalt', 'signal-noise', 'content-chrome', 'cognitive-load']);
    });

    it('stylistic principles are correct', () => {
      expect(stylisticPrincipleIds).toEqual(['fitts', 'hick']);
    });
  });

  describe('Gestalt: Border Grouping', () => {
    const rule = gestaltRules[0];

    // Fixture shape matters here. This used to pass `{ border: '1px solid black' }`
    // — the CSS shorthand — which `getComputedStyle` NEVER returns for
    // border-width and which no extractor ever captured. The test passed
    // against a rule that could not fire on a real page, because the fixture
    // was richer than production. Longhands are what Chrome actually computes.
    it('flags list items with borders', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: {
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      });
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe('calm-precision/gestalt-grouping');
    });

    // `border-style: none` paints nothing whatever the declared width says.
    // Without this arm, capturing `border` (which computes to
    // "0px none rgb(0,0,0)" on EVERY element) would have flipped the rule from
    // reporting nothing to reporting everything.
    it('does not flag a declared width that border-style hides', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: { borderTopWidth: '3px', borderStyle: 'none' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    // The defect this rule shipped with: it read properties nobody captured and
    // returned null, so "no border" and "could not see the border" were the
    // same answer. Silence is the failure mode — it must now SAY it could not
    // measure. An element with computedStyles absent entirely is that case.
    it('reports that it could not measure rather than passing silently', () => {
      const el = mockElement({ tagName: 'li' });
      delete (el as { computedStyles?: unknown }).computedStyles;
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe('calm-precision/gestalt-grouping-unmeasurable');
      expect(result!.message).toContain('NOT checked');
    });

    it('passes for list items without borders', () => {
      const el = mockElement({
        tagName: 'li',
        // What Chrome computes for an unbordered element.
        computedStyles: {
          borderTopWidth: '0px',
          borderRightWidth: '0px',
          borderBottomWidth: '0px',
          borderLeftWidth: '0px',
          borderStyle: 'none',
        },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    // Calm Precision PRESCRIBES a one-sided divider between items of a
    // single bordered group. It used to fire as an error.
    it('passes a list item carrying only a one-sided divider', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: {
          borderTopWidth: '1px',
          borderRightWidth: '0px',
          borderBottomWidth: '0px',
          borderLeftWidth: '0px',
          borderStyle: 'solid none none',
        },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('passes a list item with top and bottom dividers only', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: {
          borderTopWidth: '1px',
          borderRightWidth: '0px',
          borderBottomWidth: '1px',
          borderLeftWidth: '0px',
          borderStyle: 'solid none',
        },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('still flags a three-sided box', () => {
      const el = mockElement({
        tagName: 'li',
        computedStyles: {
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '0px',
          borderStyle: 'solid solid solid none',
        },
      });
      expect(rule.check(el, mockContext())?.ruleId).toBe('calm-precision/gestalt-grouping');
    });

    // The old test was `selector.includes('item')` over the ANCESTOR path.
    it('does not treat a filled button inside a .run-item row as a list item', () => {
      const el = mockElement({
        tagName: 'button',
        selector: 'main > ul > li.run-item > button',
        className: 'btn',
        computedStyles: {
          borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('does not treat a control whose own class is *-item as a list item', () => {
      const el = mockElement({
        tagName: 'button',
        selector: 'button.menu-item',
        className: 'menu-item',
        computedStyles: {
          borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('flags a boxed div whose OWN class token is an item class', () => {
      const el = mockElement({
        tagName: 'div',
        selector: 'div.card-item',
        className: 'card-item featured',
        computedStyles: {
          borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      });
      expect(rule.check(el, mockContext())?.ruleId).toBe('calm-precision/gestalt-grouping');
    });

    it('flags a boxed BEM list__item', () => {
      const el = mockElement({
        tagName: 'div',
        selector: 'div.list__item',
        className: 'list__item',
        computedStyles: {
          borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
          borderStyle: 'solid',
        },
      });
      expect(rule.check(el, mockContext())?.ruleId).toBe('calm-precision/gestalt-grouping');
    });

    it('passes for non-list elements with borders', () => {
      const el = mockElement({
        tagName: 'div',
        computedStyles: { border: '1px solid black' },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });
  });

  describe('Signal-to-Noise: Status Indication', () => {
    const rule = signalNoiseRules[0];
    const pill = (overrides: Partial<EnhancedElement> = {}, styles: Record<string, string> = {}) => mockElement({
      tagName: 'a',
      selector: 'a.pill',
      text: 'Failed',
      bounds: { x: 0, y: 0, width: 56, height: 20 },
      ...overrides,
      computedStyles: { backgroundColor: 'rgb(220, 38, 38)', borderRadius: '9999px', display: 'inline-block', ...styles },
    });

    it('flags a small saturated pill whose label is a status word', () => {
      const result = rule.check(pill(), mockContext());
      expect(result).not.toBeNull();
      expect(result!.fix).toContain('text color');
    });

    // bg-red-100 text-red-700 rounded-full: pale, but saturated. The
    // canonical Calm Precision violation.
    it('flags a pale tinted badge (bg-red-100)', () => {
      expect(rule.check(pill({}, { backgroundColor: 'rgb(254, 226, 226)' }), mockContext())).not.toBeNull();
    });

    it('flags a status word with a count ("Active 3")', () => {
      expect(rule.check(pill({ text: 'Active 3' }), mockContext())).not.toBeNull();
    });

    it('passes for status text without background', () => {
      expect(rule.check(pill({}, { backgroundColor: 'transparent' }), mockContext())).toBeNull();
    });

    it('allows subtle backgrounds (low opacity)', () => {
      expect(rule.check(pill({ text: 'Pending' }, { backgroundColor: 'rgba(0, 128, 0, 0.08)' }), mockContext())).toBeNull();
    });

    it('ignores non-status text', () => {
      expect(rule.check(pill({ text: 'Hello World' }), mockContext())).toBeNull();
    });

    // The false positives this rule shipped with.
    it('ignores a card surface whose body text mentions a status', () => {
      const card = pill(
        { tagName: 'details', text: 'Build 41 failed on the lint step', bounds: { x: 0, y: 0, width: 900, height: 120 } },
        { backgroundColor: 'rgb(254, 242, 242)', borderRadius: '8px', display: 'block' },
      );
      expect(rule.check(card, mockContext())).toBeNull();
    });

    it('ignores a large row even when its text is only a status word', () => {
      const row = pill({ bounds: { x: 0, y: 0, width: 900, height: 48 } }, { display: 'block', borderRadius: '0px' });
      expect(rule.check(row, mockContext())).toBeNull();
    });

    it('ignores an action label that merely mentions a status', () => {
      expect(rule.check(pill({ tagName: 'button', text: 'Retry failed' }), mockContext())).toBeNull();
    });

    it('ignores neutral grey fills', () => {
      expect(rule.check(pill({}, { backgroundColor: 'rgb(229, 231, 235)' }), mockContext())).toBeNull();
    });

    it('flags a square-cornered badge in a flex row (block display, 4px radius)', () => {
      const chip = pill({ bounds: { x: 0, y: 0, width: 60, height: 20 } }, { display: 'block', borderRadius: '4px' });
      expect(rule.check(chip, mockContext())).not.toBeNull();
    });
  });

  describe("Fitts' Law: Button Sizing", () => {
    const rule = fittsRules[0];

    it('flags small primary action buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 80, height: 36 },
      });
      const result = rule.check(el, mockContext());
      expect(result).not.toBeNull();
      expect(result!.message).toContain('submit');
    });

    it('passes for adequately sized primary buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 200, height: 44 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('ignores non-primary buttons', () => {
      const el = mockElement({
        tagName: 'button',
        text: 'Cancel',
        bounds: { x: 0, y: 0, width: 60, height: 30 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });

    it('ignores non-button elements', () => {
      const el = mockElement({
        tagName: 'div',
        text: 'Submit',
        bounds: { x: 0, y: 0, width: 50, height: 20 },
      });
      expect(rule.check(el, mockContext())).toBeNull();
    });
  });

  describe("Hick's Law: Choice Count", () => {
    const rule = hickRules[0];

    it('flags too many interactive elements in a row', () => {
      const elements: EnhancedElement[] = [];
      for (let i = 0; i < 9; i++) {
        elements.push(mockElement({
          selector: `button.btn-${i}`,
          tagName: 'button',
          bounds: { x: i * 100, y: 50, width: 80, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      // First element should trigger (it's the first in the group)
      const result = rule.check(elements[0], mockContext(elements));
      expect(result).not.toBeNull();
      expect(result!.message).toContain('9 interactive elements');
    });

    it('passes for 7 or fewer choices', () => {
      const elements: EnhancedElement[] = [];
      for (let i = 0; i < 5; i++) {
        elements.push(mockElement({
          selector: `button.btn-${i}`,
          bounds: { x: i * 100, y: 50, width: 80, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }
      expect(rule.check(elements[0], mockContext(elements))).toBeNull();
    });

    it('ignores hidden and zero-size controls in the same row', () => {
      const elements: EnhancedElement[] = [];
      for (let i = 0; i < 4; i++) {
        elements.push(mockElement({
          selector: `button.visible-${i}`,
          bounds: { x: i * 100, y: 50, width: 80, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }
      for (let i = 0; i < 8; i++) {
        const hiddenStyle: Record<string, string> | undefined = i < 2
          ? { display: 'none' }
          : i < 4
            ? { visibility: 'hidden' }
            : i < 6
              ? { opacity: '0' }
              : undefined;
        elements.push(mockElement({
          selector: `button.hidden-${i}`,
          bounds: i < 6
            ? { x: 400 + i * 90, y: 50, width: 80, height: 40 }
            : { x: 0, y: 50, width: 0, height: 0 },
          computedStyles: hiddenStyle,
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      expect(rule.check(elements[0], mockContext(elements))).toBeNull();
    });
  });

  describe('Content >= Chrome', () => {
    const rule = contentChromeRules[0];

    it('flags when chrome exceeds 30%', () => {
      const nav = mockElement({
        selector: 'nav.main',
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 400 }, // ~37% of viewport
      });
      const el = mockElement({ selector: 'div.first' });
      const ctx = mockContext([el, nav]);

      const result = rule.check(el, ctx);
      expect(result).not.toBeNull();
    });

    it('passes when chrome is under 30%', () => {
      const nav = mockElement({
        selector: 'nav.main',
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 60 }, // ~3%
      });
      const el = mockElement({ selector: 'div.first' });
      const ctx = mockContext([el, nav]);

      expect(rule.check(el, ctx)).toBeNull();
    });

    it('names every chrome element it counted, with its box', () => {
      const header = mockElement({ selector: 'header.site', tagName: 'header', bounds: { x: 0, y: 0, width: 1920, height: 300 } });
      const nav = mockElement({ selector: 'nav.side', tagName: 'nav', bounds: { x: 0, y: 300, width: 500, height: 780 } });
      const inner = mockElement({ selector: 'header.site > nav', tagName: 'nav', bounds: { x: 0, y: 0, width: 400, height: 60 } });
      const first = mockElement({ selector: 'div.first' });
      const result = rule.check(first, mockContext([first, header, nav, inner])) as
        (ReturnType<typeof rule.check> & { chromeElements?: Array<{ selector: string }> });
      expect(result).not.toBeNull();
      expect(result!.message).toContain('header.site (0,0 1920x300)');
      expect(result!.message).toContain('nav.side (0,300 500x780)');
      // Nested chrome adds no area and is not named separately.
      expect(result!.chromeElements!.map((c) => c.selector)).toEqual(['header.site', 'nav.side']);
    });

    it('caps the named list at 10 with "+N more"', () => {
      const els = [mockElement({ selector: 'div.first' })];
      for (let i = 0; i < 14; i++) {
        els.push(mockElement({ selector: `nav.n${i}`, tagName: 'nav', bounds: { x: i * 130, y: 0, width: 120, height: 1080 } }));
      }
      const result = rule.check(els[0]!, mockContext(els));
      expect(result!.message).toContain('+4 more');
    });

    // HTML-AAM: <header> scoped inside main/section/article is not a banner.
    it('does not count a <header> inside <main> (or its text) as chrome', () => {
      const hero = mockElement({ selector: 'main > header', tagName: 'header', bounds: { x: 0, y: 0, width: 1920, height: 600 } });
      const heroText = mockElement({ selector: 'main > header > p.eyebrow', tagName: 'p', bounds: { x: 0, y: 0, width: 1920, height: 40 } });
      const first = mockElement({ selector: 'div.first' });
      expect(rule.check(first, mockContext([first, hero, heroText]))).toBeNull();
    });

    it('scopes an id-rooted <header> by its box when the path cannot say', () => {
      const main = mockElement({ selector: 'main', tagName: 'main', bounds: { x: 0, y: 0, width: 1920, height: 3000 } });
      const hero = mockElement({ selector: '#top', tagName: 'header', bounds: { x: 16, y: 32, width: 1800, height: 600 } });
      const first = mockElement({ selector: 'div.first' });
      expect(rule.check(first, mockContext([first, main, hero]))).toBeNull();
    });

    it('does not count .card-header content as chrome', () => {
      const cardHeader = mockElement({ selector: 'main > div.card-header', tagName: 'div', className: 'card-header', bounds: { x: 0, y: 0, width: 1920, height: 600 } });
      const first = mockElement({ selector: 'div.first' });
      expect(rule.check(first, mockContext([first, cardHeader]))).toBeNull();
    });

    it('does not count form answer buttons as chrome, even under a chrome-classed wrapper', () => {
      const answers = [0, 1, 2, 3].map((i) => mockElement({
        selector: `div.toolbar > form > button:nth-of-type(${i + 1})`,
        tagName: 'button',
        bounds: { x: i * 480, y: 0, width: 470, height: 800 },
      }));
      const radio = mockElement({
        selector: 'div.menu > button.choice',
        tagName: 'button',
        a11y: { role: 'radio', ariaLabel: null, ariaDescribedBy: null },
        bounds: { x: 0, y: 800, width: 1920, height: 200 },
      });
      const first = mockElement({ selector: 'div.first' });
      expect(rule.check(first, mockContext([first, ...answers, radio]))).toBeNull();
    });

    it('only runs on first element', () => {
      const nav = mockElement({
        tagName: 'nav',
        bounds: { x: 0, y: 0, width: 1920, height: 400 },
      });
      const first = mockElement({ selector: 'div.first' });
      const second = mockElement({ selector: 'div.second' });

      // Second element should not trigger (not the first)
      expect(rule.check(second, mockContext([first, nav, second]))).toBeNull();
    });
  });

  describe('Cognitive Load: Element Count', () => {
    const rule = cognitiveLoadRules[0];

    it('flags containers with too many interactive children', () => {
      const container = mockElement({
        selector: 'div.container',
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
      });

      const children: EnhancedElement[] = [container];
      for (let i = 0; i < 12; i++) {
        children.push(mockElement({
          selector: `button.child-${i}`,
          bounds: { x: 10 + i * 60, y: 10, width: 50, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      const result = rule.check(container, mockContext(children));
      expect(result).not.toBeNull();
      expect(result!.message).toContain('12 visible controls');
    });

    it('passes for containers with few children', () => {
      const container = mockElement({
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      });

      const children: EnhancedElement[] = [container];
      for (let i = 0; i < 5; i++) {
        children.push(mockElement({
          selector: `button.child-${i}`,
          bounds: { x: 10, y: 10, width: 50, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      expect(rule.check(container, mockContext(children))).toBeNull();
    });

    const control = (selector: string, x: number, y: number) => mockElement({
      selector,
      tagName: 'button',
      bounds: { x, y, width: 50, height: 40 },
      interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
    });

    // <main> used to absorb every control of every nested <section>.
    it('does not count controls owned by nested sections against <main> (bounds fallback)', () => {
      const main = mockElement({ selector: 'main', tagName: 'main', bounds: { x: 0, y: 0, width: 1000, height: 900 } });
      const all: EnhancedElement[] = [main];
      for (let s = 0; s < 3; s++) {
        const section = mockElement({ selector: `main > section:nth-of-type(${s + 1})`, tagName: 'section', bounds: { x: 0, y: s * 300, width: 1000, height: 290 } });
        all.push(section);
        for (let i = 0; i < 6; i++) all.push(control(`main > section:nth-of-type(${s + 1}) > button:nth-of-type(${i + 1})`, 10 + i * 60, s * 300 + 10));
      }
      for (const el of all) {
        if (el.tagName === 'button') continue;
        expect(rule.check(el, mockContext(all))).toBeNull();
      }
    });

    it('counts role=group children against the group, not the section around it', () => {
      const section = mockElement({ selector: 'section', tagName: 'section', bounds: { x: 0, y: 0, width: 1000, height: 400 } });
      const group = mockElement({
        selector: 'section > div.filters', tagName: 'div', bounds: { x: 0, y: 0, width: 1000, height: 100 },
        a11y: { role: 'group', ariaLabel: 'Filters', ariaDescribedBy: null },
      });
      const all: EnhancedElement[] = [section, group];
      for (let i = 0; i < 12; i++) all.push(control(`section > div.filters > button:nth-of-type(${i + 1})`, i * 70, 10));
      expect(rule.check(section, mockContext(all))).toBeNull();
      expect(rule.check(group, mockContext(all))?.message).toContain('12 visible controls');
    });

    it('uses DOM ownership facts from the scan when attached', () => {
      const main = mockElement({ selector: 'main', tagName: 'main', bounds: { x: 0, y: 0, width: 1000, height: 900 } });
      const all: EnhancedElement[] = [main];
      for (let i = 0; i < 25; i++) all.push(control(`b${i}`, (i % 10) * 60, Math.floor(i / 10) * 50));
      // Bounds alone say 25; the DOM says main owns only 2 directly.
      const withFacts = { ...main, controlGroup: { ownedControls: 2, controlSelectors: ['b0', 'b1'] } };
      expect(rule.check(withFacts, mockContext(all))).toBeNull();
      const crowded = { ...main, controlGroup: { ownedControls: 12, controlSelectors: Array.from({ length: 10 }, (_, i) => `b${i}`) } };
      const result = rule.check(crowded, mockContext(all));
      expect(result?.message).toContain('12 visible controls');
      expect(result?.message).toContain('+7 more');
    });

    it('ignores controls retained in hidden panels', () => {
      const container = mockElement({
        selector: 'div.container',
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      });
      const children: EnhancedElement[] = [container];
      for (let i = 0; i < 5; i++) {
        children.push(mockElement({
          selector: `button.visible-${i}`,
          bounds: { x: 10 + i * 60, y: 10, width: 50, height: 40 },
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }
      for (let i = 0; i < 8; i++) {
        const hiddenStyle: Record<string, string> | undefined = i < 2
          ? { display: 'none' }
          : i < 4
            ? { visibility: 'hidden' }
            : i < 6
              ? { opacity: '0' }
              : undefined;
        children.push(mockElement({
          selector: `button.hidden-${i}`,
          bounds: i < 6
            ? { x: 320 + i * 60, y: 10, width: 50, height: 40 }
            : { x: 0, y: 0, width: 0, height: 0 },
          computedStyles: hiddenStyle,
          interactive: { hasOnClick: true, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
        }));
      }

      expect(rule.check(container, mockContext(children))).toBeNull();
    });
  });
});
