import { describe, it, expect } from 'vitest'
import { rules, isLayoutCollapsed, hasPopupTrigger, isFormSubmitButton } from './minimal.js'
import type { EnhancedElement } from '../../schemas.js'
import type { RuleContext } from '../engine.js'

const baseElement = (overrides: Partial<EnhancedElement> = {}): EnhancedElement => ({
  selector: 'button.test',
  tagName: 'button',
  text: 'Click me',
  bounds: { x: 0, y: 0, width: 100, height: 40 },
  interactive: {
    hasOnClick: false,
    hasHref: false,
    isDisabled: false,
    cursor: 'pointer',
  },
  a11y: { role: 'button', ariaLabel: undefined, ariaDescribedBy: undefined },
  computedStyles: {},
  ...overrides,
})

const ctx: RuleContext = { isMobile: false }
const ctxMobile: RuleContext = { isMobile: true }

describe('isLayoutCollapsed', () => {
  it('flags a 0x0 box as collapsed', () => {
    expect(isLayoutCollapsed(baseElement({ bounds: { x: 0, y: 0, width: 0, height: 0 } }))).toBe(true)
  })

  it('does NOT flag a normal 100x40 box', () => {
    expect(isLayoutCollapsed(baseElement())).toBe(false)
  })

  it('does NOT flag a 0-width-but-positive-height box (still has layout)', () => {
    expect(isLayoutCollapsed(baseElement({ bounds: { x: 0, y: 0, width: 0, height: 20 } }))).toBe(false)
  })

  it('does NOT flag a positive-width-but-0-height box', () => {
    expect(isLayoutCollapsed(baseElement({ bounds: { x: 0, y: 0, width: 20, height: 0 } }))).toBe(false)
  })
})

describe('hasPopupTrigger', () => {
  it('flags buttons with aria-haspopup="menu" (Radix/Headless UI menu trigger)', () => {
    expect(hasPopupTrigger(baseElement({ a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null, ariaHaspopup: 'menu' } }))).toBe(true)
  })

  it('flags aria-haspopup="dialog", "listbox", "tree", "grid", "true"', () => {
    for (const v of ['dialog', 'listbox', 'tree', 'grid', 'true']) {
      expect(hasPopupTrigger(baseElement({ a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null, ariaHaspopup: v } }))).toBe(true)
    }
  })

  it('does NOT flag aria-haspopup="false" (spec-correct: no popup)', () => {
    expect(hasPopupTrigger(baseElement({ a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null, ariaHaspopup: 'false' } }))).toBe(false)
  })

  it('does NOT flag elements without aria-haspopup', () => {
    expect(hasPopupTrigger(baseElement())).toBe(false)
    expect(hasPopupTrigger(baseElement({ a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null, ariaHaspopup: null } }))).toBe(false)
    expect(hasPopupTrigger(baseElement({ a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null, ariaHaspopup: '' } }))).toBe(false)
  })
})

describe('isFormSubmitButton', () => {
  it('flags a <button> inside a form with no explicit type (defaults to submit)', () => {
    expect(isFormSubmitButton(baseElement({ tagName: 'button', inForm: true, buttonType: null }))).toBe(true)
  })

  it('flags a <button type="submit"> inside a form', () => {
    expect(isFormSubmitButton(baseElement({ tagName: 'button', inForm: true, buttonType: 'submit' }))).toBe(true)
  })

  it('does NOT flag a <button type="button"> inside a form (opted out of submit pipeline)', () => {
    expect(isFormSubmitButton(baseElement({ tagName: 'button', inForm: true, buttonType: 'button' }))).toBe(false)
  })

  it('does NOT flag a button outside a form', () => {
    expect(isFormSubmitButton(baseElement({ tagName: 'button', inForm: false, buttonType: 'submit' }))).toBe(false)
    expect(isFormSubmitButton(baseElement({ tagName: 'button', buttonType: 'submit' }))).toBe(false)
  })

  it('does NOT flag non-button tags (e.g. div role=button)', () => {
    expect(isFormSubmitButton(baseElement({ tagName: 'div', inForm: true, buttonType: null }))).toBe(false)
  })
})

describe('no-handler rule skips form-submit buttons', () => {
  it('returns null for a submit button inside a form (form.onSubmit is the wired path)', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        tagName: 'button',
        inForm: true,
        buttonType: 'submit',
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).toBeNull()
  })

  it('still fires on a <button type="button"> inside a form (opted out of submit pipeline)', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        tagName: 'button',
        inForm: true,
        buttonType: 'button',
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).not.toBeNull()
  })

  it('still fires on a submit button outside a form', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        tagName: 'button',
        inForm: false,
        buttonType: 'submit',
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).not.toBeNull()
  })
})

describe('no-handler rule skips popup triggers', () => {
  it('returns null for a button with aria-haspopup="menu" and no onClick (Radix-style)', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        a11y: { role: 'button', ariaLabel: 'Open menu', ariaDescribedBy: null, ariaHaspopup: 'menu' },
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).toBeNull()
  })

  it('still fires on a regular orphan button (no aria-haspopup)', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).not.toBeNull()
  })
})

describe('no-handler rule skips collapsed elements', () => {
  it('still fires on a real button with no handler', () => {
    const v = rules.noHandlerRule.check(
      baseElement({ interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' } }),
      ctx,
    )
    expect(v).not.toBeNull()
    expect(v?.ruleId).toBe('no-handler')
  })

  it('returns null for a 0x0 button (responsive display:none toggle)', () => {
    const v = rules.noHandlerRule.check(
      baseElement({
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).toBeNull()
  })
})

describe('touch-target-small rule skips collapsed elements', () => {
  it('still fires on a real interactive element below mobile minimum', () => {
    const v = rules.touchTargetRule.check(
      baseElement({
        bounds: { x: 0, y: 0, width: 32, height: 32 },
        interactive: { hasOnClick: true, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctxMobile,
    )
    expect(v).not.toBeNull()
    expect(v?.ruleId).toBe('touch-target-small')
  })

  it('returns null for a 0x0 element regardless of viewport', () => {
    const v = rules.touchTargetRule.check(
      baseElement({
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        interactive: { hasOnClick: true, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctxMobile,
    )
    expect(v).toBeNull()
  })
})

describe('placeholder-link rule skips collapsed elements', () => {
  it('still fires on a real anchor with no href and no handler', () => {
    const v = rules.placeholderLinkRule.check(
      baseElement({
        tagName: 'a',
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).not.toBeNull()
    expect(v?.ruleId).toBe('placeholder-link')
  })

  it('returns null for a 0x0 anchor', () => {
    const v = rules.placeholderLinkRule.check(
      baseElement({
        tagName: 'a',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        interactive: { hasOnClick: false, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).toBeNull()
  })
})

describe('missing-aria-label rule skips collapsed elements', () => {
  it('still fires on a real interactive element with no text and no aria-label', () => {
    const v = rules.missingAriaLabelRule.check(
      baseElement({
        text: '',
        a11y: { role: 'button', ariaLabel: undefined, ariaDescribedBy: undefined },
        interactive: { hasOnClick: true, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).not.toBeNull()
    expect(v?.ruleId).toBe('missing-aria-label')
  })

  it('returns null for a 0x0 element', () => {
    const v = rules.missingAriaLabelRule.check(
      baseElement({
        text: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        a11y: { role: 'button', ariaLabel: undefined, ariaDescribedBy: undefined },
        interactive: { hasOnClick: true, hasHref: false, isDisabled: false, cursor: 'pointer' },
      }),
      ctx,
    )
    expect(v).toBeNull()
  })
})
