/**
 * CDP Input domain — mouse, keyboard, and scroll simulation.
 * Forked from Spectra — extended with special key support.
 */

import type { CdpConnection } from './connection.js'

export class InputDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async click(x: number, y: number): Promise<void> {
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1,
    }, this.sessionId)
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
    }, this.sessionId)
  }

  async type(text: string): Promise<void> {
    for (const char of text) {
      const code = charToCode(char)
      await this.conn.send('Input.dispatchKeyEvent', {
        type: 'keyDown', text: char, key: char, code,
      }, this.sessionId)
      await this.conn.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: char, code,
      }, this.sessionId)
    }
  }

  /**
   * Press a special key (Enter, Tab, Escape, Backspace, etc.) or a modifier
   * chord ("Meta+k", "Cmd+K", "Ctrl+Shift+P", ...).
   */
  async pressKey(key: string): Promise<void> {
    const chord = parseChord(key)
    if (chord) {
      await this.dispatchChord(chord)
      return
    }
    const keyDef = SPECIAL_KEYS[key]
    if (!keyDef) {
      // Treat as single character
      await this.type(key)
      return
    }
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: keyDef.key,
      code: keyDef.code,
      text: keyDef.text,
    }, this.sessionId)
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: keyDef.key,
      code: keyDef.code,
    }, this.sessionId)
  }

  /**
   * Dispatch a real modifier chord: press each modifier down (in order,
   * accumulating the CDP `modifiers` bitmask), then keyDown/keyUp the target
   * key while the modifiers are held, then release the modifiers in reverse
   * order. No `text` is sent for the target key — a chord synthesizes a
   * shortcut, it must never insert literal characters into a focused field.
   */
  private async dispatchChord(chord: ParsedChord): Promise<void> {
    let modifiers = 0

    for (const mod of chord.modifiers) {
      modifiers |= MODIFIER_BITS[mod]
      const def = MODIFIER_KEY_DEFS[mod]
      await this.conn.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: def.key, code: def.code, modifiers,
      }, this.sessionId)
    }

    const mainDef = resolveChordKey(chord.mainKey)
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: mainDef.key, code: mainDef.code, modifiers,
    }, this.sessionId)
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: mainDef.key, code: mainDef.code, modifiers,
    }, this.sessionId)

    for (const mod of [...chord.modifiers].reverse()) {
      modifiers &= ~MODIFIER_BITS[mod]
      const def = MODIFIER_KEY_DEFS[mod]
      await this.conn.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: def.key, code: def.code, modifiers,
      }, this.sessionId)
    }
  }

  async hover(x: number, y: number): Promise<void> {
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y,
    }, this.sessionId)
  }

  async scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    await this.conn.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x, y, deltaX, deltaY,
    }, this.sessionId)
  }
}

// ─── Key mappings ──────────────────────────────────────────

interface KeyDef {
  key: string
  code: string
  text?: string
}

const SPECIAL_KEYS: Record<string, KeyDef> = {
  Enter: { key: 'Enter', code: 'Enter', text: '\r' },
  Tab: { key: 'Tab', code: 'Tab', text: '\t' },
  Escape: { key: 'Escape', code: 'Escape' },
  Backspace: { key: 'Backspace', code: 'Backspace' },
  Delete: { key: 'Delete', code: 'Delete' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown' },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight' },
  Home: { key: 'Home', code: 'Home' },
  End: { key: 'End', code: 'End' },
  PageUp: { key: 'PageUp', code: 'PageUp' },
  PageDown: { key: 'PageDown', code: 'PageDown' },
}

const SPECIAL_CODES: Record<string, string> = {
  ' ': 'Space', '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3',
  '4': 'Digit4', '5': 'Digit5', '6': 'Digit6', '7': 'Digit7', '8': 'Digit8',
  '9': 'Digit9', '`': 'Backquote', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft',
  ']': 'BracketRight', '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote',
  ',': 'Comma', '.': 'Period', '/': 'Slash', '~': 'Backquote', '!': 'Digit1',
  '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6',
  '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0', '_': 'Minus',
  '+': 'Equal', '{': 'BracketLeft', '}': 'BracketRight', '|': 'Backslash',
  ':': 'Semicolon', '"': 'Quote', '<': 'Comma', '>': 'Period', '?': 'Slash',
  '\t': 'Tab', '\n': 'Enter',
}

function charToCode(char: string): string {
  if (SPECIAL_CODES[char]) return SPECIAL_CODES[char]
  const upper = char.toUpperCase()
  if (upper >= 'A' && upper <= 'Z') return `Key${upper}`
  return ''
}

// ─── Modifier chords (e.g. "Meta+k", "Ctrl+Shift+P") ──────────────────────

type ModifierName = 'Alt' | 'Control' | 'Meta' | 'Shift'

/**
 * CDP `Input.dispatchKeyEvent` modifiers bitmask: Alt=1, Ctrl=2,
 * Meta/Command=4, Shift=8 (per the CDP Input domain spec).
 */
const MODIFIER_BITS: Record<ModifierName, number> = {
  Alt: 1,
  Control: 2,
  Meta: 4,
  Shift: 8,
}

const MODIFIER_ALIASES: Record<string, ModifierName> = {
  alt: 'Alt', option: 'Alt',
  ctrl: 'Control', control: 'Control',
  meta: 'Meta', cmd: 'Meta', command: 'Meta',
  shift: 'Shift',
}

const MODIFIER_KEY_DEFS: Record<ModifierName, KeyDef> = {
  Alt: { key: 'Alt', code: 'AltLeft' },
  Control: { key: 'Control', code: 'ControlLeft' },
  Meta: { key: 'Meta', code: 'MetaLeft' },
  Shift: { key: 'Shift', code: 'ShiftLeft' },
}

interface ParsedChord {
  modifiers: ModifierName[]
  mainKey: string
}

/**
 * Parse a modifier-chord key string such as "Meta+k", "Cmd+K", or
 * "Ctrl+Shift+P" into an ordered list of modifier names plus the target key.
 * Returns null if the string isn't a recognized chord (e.g. a plain special
 * key like "Enter" or a single character), so callers fall back to the
 * existing single-key handling unchanged.
 */
function parseChord(input: string): ParsedChord | null {
  if (input.length <= 1 || !input.includes('+')) return null

  const parts = input.split('+')
  const mainKey = parts[parts.length - 1]
  const modifierParts = parts.slice(0, -1)
  if (mainKey === '' || modifierParts.length === 0) return null

  const modifiers: ModifierName[] = []
  for (const part of modifierParts) {
    const normalized = MODIFIER_ALIASES[part.toLowerCase()]
    if (!normalized) return null // unrecognized modifier — not a chord
    modifiers.push(normalized)
  }
  return { modifiers, mainKey }
}

function resolveChordKey(mainKey: string): KeyDef {
  const special = SPECIAL_KEYS[mainKey]
  if (special) return { key: special.key, code: special.code }
  return { key: mainKey, code: charToCode(mainKey) }
}
