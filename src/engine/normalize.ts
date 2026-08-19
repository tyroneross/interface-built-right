/**
 * Normalize raw accessibility roles to canonical names.
 * Forked from Spectra.
 */

import type { Platform } from './types.js'

const WEB_ROLES: Record<string, string> = {
  button: 'button', textbox: 'textfield', TextField: 'textfield',
  link: 'link', checkbox: 'checkbox', switch: 'switch', slider: 'slider',
  tab: 'tab', combobox: 'select', listbox: 'select',
  heading: 'heading', img: 'image', image: 'image', StaticText: 'text',
  group: 'group', generic: 'group', navigation: 'group', main: 'group',
  contentinfo: 'group', banner: 'group', form: 'group', search: 'group',
  region: 'group', article: 'group', section: 'group', complementary: 'group',

  // ── Interactive ARIA widget/composite roles (bug: every one of these
  //    fell through to the `?? 'group'` default before this fix, which
  //    strips them of both role identity and actions — see inferActions()
  //    in cdp/accessibility.ts and driver.ts's inferFrameActions(), which
  //    must stay in sync with this table). Confirmed against real Chrome
  //    (Accessibility.getFullAXTree) via a repro fixture, not assumed from
  //    the ARIA spec alone — see engine.test.ts for the exact raw role
  //    strings Chrome emits for each native control.
  radio: 'radio',
  // menuitemcheckbox/menuitemradio fold into the existing checkbox/radio
  // concepts — same toggle interaction, same action set, distinguishing
  // them would add a canonical name with no behavioral payoff.
  menuitemcheckbox: 'checkbox',
  menuitemradio: 'radio',
  menuitem: 'menuitem',
  option: 'option',
  treeitem: 'treeitem',
  // spinbutton/searchbox are text-entry controls with a native <input>
  // equivalent (number/search) — folding into 'textfield' gives them a
  // correct setValue action for free instead of a bespoke canonical role.
  spinbutton: 'textfield',
  searchbox: 'textfield',
  // Chrome-internal (non-ARIA) role names, not spec role strings — confirmed
  // via live Accessibility.getFullAXTree, not literature. `<input type=date>`
  // behaves like a text field for automation purposes (setValue with an
  // ISO date string); the nested native "Show date picker" button already
  // reports its own `button` role independently and needs no change.
  Date: 'textfield',
  // `<input type=color>` mirrors the existing `<input type=file>` pattern
  // already in this table (native role reports as a plain button that
  // opens an OS-level picture; IBR has no "open native color picker" verb,
  // so 'press' is the correct and only honest action).
  ColorWell: 'button',
  // `<summary>` inside `<details>` — clicking it toggles expand/collapse,
  // which is a press-equivalent action; no dedicated toggle verb exists
  // for switch/checkbox either, so 'button' + press is consistent.
  DisclosureTriangle: 'button',

  // ── Composite/container ARIA roles — deliberately left non-actionable.
  //    Each of these is a container whose actionable content is its
  //    children (already covered above: tab, menuitem, option, treeitem);
  //    the container itself is not "pressed". Listed explicitly (rather
  //    than left to the `?? 'group'` default) so every ARIA widget/
  //    composite role has a visible, intentional disposition here.
  radiogroup: 'group',
  tablist: 'group',
  menu: 'group',
  menubar: 'group',
  tree: 'group',
  treegrid: 'group',
  grid: 'group',
  gridcell: 'group',
  // scrollbar: only appears in the AX tree for hand-authored ARIA
  // scrollbar widgets (native scrollbars are not AX nodes); the correct
  // action is a drag gesture, which is outside IBR's press/setValue verb
  // set today. Left as an inert 'group' rather than offering an action
  // IBR cannot honestly perform.
  scrollbar: 'group',
  // separator: ARIA overloads this role for both a non-focusable divider
  // (no action, ever) and a focusable resizable splitter (needs a drag
  // action IBR does not have). Since the two cannot be told apart from
  // the role alone and a wrong action is worse than no action, both
  // collapse to inert 'group'.
  separator: 'group',
  // progressbar: read-only status display by definition (implicitly
  // aria-readonly); there is no user action to infer, ever.
  progressbar: 'group',
}

const MACOS_ROLES: Record<string, string> = {
  AXButton: 'button', AXTextField: 'textfield', AXTextArea: 'textfield',
  AXLink: 'link', AXCheckBox: 'checkbox', AXSwitch: 'switch', AXSlider: 'slider',
  // AXRadioButton -> 'tab' was assessed, not a deliberate segmented-control
  // convention: two OTHER role maps already in this repo (native/role-map.ts
  // ARIA_MAP and engine/safari/driver.ts's _mapAXRole) both map AXRadioButton
  // to 'radio', distinct from AXTab, with no exception for toolbar/segmented
  // controls. Nothing in this codebase treats "AXRadioButton as tab" as
  // intentional; it looks like a copy of the adjacent AXTab line. Fixed to
  // match the other two maps. (Note: normalizeRole(_, 'macos'|'ios'|'watchos')
  // has no production caller today — src/native/* drives the real macOS/iOS
  // pipeline via role-map.ts and safari/driver.ts, which were already
  // correct — so this fix corrects public API surface and test coverage,
  // not a live runtime bug.)
  AXTab: 'tab', AXRadioButton: 'radio', AXPopUpButton: 'select', AXComboBox: 'select',
  AXStaticText: 'text', AXImage: 'image', AXGroup: 'group', AXWindow: 'group',
  AXScrollArea: 'group', AXToolbar: 'group', AXSplitGroup: 'group',
  AXList: 'group', AXOutline: 'group', AXTable: 'group',
  AXRow: 'group', AXColumn: 'group', AXCell: 'group',
}

export function normalizeRole(rawRole: string, platform: Platform): string {
  if (platform === 'web') return WEB_ROLES[rawRole] ?? 'group'
  // iOS and watchOS share macOS AX role naming conventions
  return MACOS_ROLES[rawRole] ?? 'group'
}
