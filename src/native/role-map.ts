/**
 * Shared AX role mapping utilities for native element extraction.
 *
 * Used by both simulator (extract.ts) and macOS (macos.ts) pipelines.
 */

const TAG_MAP: Record<string, string> = {
  'AXButton': 'button',
  'AXLink': 'a',
  'AXTextField': 'input',
  'AXTextArea': 'textarea',
  'AXSecureTextField': 'input',
  'AXStaticText': 'span',
  'AXImage': 'img',
  'AXGroup': 'div',
  'AXSplitGroup': 'div',
  'AXList': 'ul',
  'AXCell': 'li',
  'AXTable': 'table',
  'AXScrollArea': 'div',
  'AXToolbar': 'nav',
  'AXMenuBar': 'nav',
  'AXMenu': 'nav',
  'AXMenuItem': 'li',
  'AXCheckBox': 'input',
  'AXRadioButton': 'input',
  'AXSlider': 'input',
  'AXSwitch': 'input',
  'AXPopUpButton': 'select',
  'AXComboBox': 'select',
  'AXTabGroup': 'div',
  'AXTab': 'button',
  'AXNavigationBar': 'nav',
  'AXHeader': 'header',
  'AXWindow': 'main',
};

const ARIA_MAP: Record<string, string> = {
  'AXButton': 'button',
  'AXLink': 'link',
  'AXTextField': 'textbox',
  'AXTextArea': 'textbox',
  'AXSecureTextField': 'textbox',
  'AXStaticText': 'text',
  'AXImage': 'img',
  'AXGroup': 'group',
  'AXList': 'list',
  'AXCell': 'listitem',
  'AXTable': 'table',
  'AXCheckBox': 'checkbox',
  'AXRadioButton': 'radio',
  'AXSlider': 'slider',
  'AXSwitch': 'switch',
  'AXTab': 'tab',
  'AXTabGroup': 'tablist',
  'AXNavigationBar': 'navigation',
  'AXToolbar': 'toolbar',
  'AXMenuItem': 'menuitem',
  'AXMenu': 'menu',
  'AXScrollArea': 'scrollbar',
  'AXWindow': 'main',
};

const INTERACTIVE_ROLES = new Set([
  'AXButton',
  'AXLink',
  'AXTextField',
  'AXTextArea',
  'AXSecureTextField',
  'AXCheckBox',
  'AXRadioButton',
  'AXSlider',
  'AXSwitch',
  'AXPopUpButton',
  'AXComboBox',
  'AXMenuItem',
  'AXTab',
]);

/** Map AX role to HTML-equivalent tag name */
export function mapRoleToTag(role: string): string {
  return TAG_MAP[role] || role.replace(/^AX/, '').toLowerCase();
}

/** Map AX role to ARIA role */
export function mapRoleToAriaRole(role: string): string | null {
  return ARIA_MAP[role] || null;
}

/** Check if an AX role represents an interactive element */
export function isInteractiveRole(role: string): boolean {
  return INTERACTIVE_ROLES.has(role);
}
