/**
 * Static HTML/CSS Parser
 *
 * Regex-based parsing for HTML and CSS files without browser execution.
 * Produces IBR's element format for static analysis.
 */

// Mirrors the EnhancedElement shape from IBR schemas
export interface StaticElement {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  bounds: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  interactive: {
    hasOnClick: boolean;
    hasHref: boolean;
    isDisabled: boolean;
    hasHandler: boolean;
    handlerType: string | null;
  };
  a11y: {
    role: string | null;
    ariaLabel: string | null;
    ariaHidden: boolean;
    tabIndex: number | null;
  };
  sourceHint?: { dataTestId: string | null };
}

export interface CSSRule {
  selector: string;
  properties: Record<string, string>;
}

/**
 * Parse HTML into StaticElement array
 *
 * Extracts all tags with attributes using regex.
 * Skips script/style/meta/link/head tags from element output.
 */
export function parseStaticHTML(html: string): StaticElement[] {
  const elements: StaticElement[] = [];

  // Remove script/style content first to avoid false matches
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Match all opening tags with attributes
  // Matches: <tagName attr="value" ...> or <tagName ... />
  const tagPattern = /<(\w+)([^>]*)>/g;
  const matches = cleanHtml.matchAll(tagPattern);

  for (const match of matches) {
    const tagName = match[1].toLowerCase();
    const attributesStr = match[2];

    // Skip non-UI tags
    if (['script', 'style', 'meta', 'link', 'head'].includes(tagName)) {
      continue;
    }

    // Extract attributes
    const attrs = parseAttributes(attributesStr);

    // Extract text content (simplified - just next text node)
    const textMatch = cleanHtml.slice(match.index! + match[0].length).match(/^([^<]+)/);
    const text = textMatch ? textMatch[1].trim() : undefined;

    // Build selector
    const id = attrs.id;
    const className = attrs.class;
    const selector = buildSelector(tagName, id, className);

    // Parse inline styles
    const inlineStyles = attrs.style ? parseInlineStyle(attrs.style) : {};

    // Determine interactivity from tag and attributes
    const interactive = determineInteractivity(tagName, attrs);

    // Extract accessibility attributes
    const a11y = extractA11y(attrs);

    // Extract bounds hints from inline styles
    const bounds = extractBoundsFromStyles(inlineStyles);

    elements.push({
      selector,
      tagName,
      id,
      className,
      text,
      bounds,
      computedStyles: inlineStyles,
      interactive,
      a11y,
      sourceHint: { dataTestId: attrs['data-testid'] || null },
    });
  }

  return elements;
}

/**
 * Parse CSS rules from stylesheet text
 *
 * Handles:
 * - selector { property: value; }
 * - Multi-selector rules (a, b { })
 * - Skips @media and @keyframes blocks
 */
export function parseCSS(css: string): CSSRule[] {
  const rules: CSSRule[] = [];

  // Remove comments
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove @media and @keyframes blocks (simple strip)
  const withoutAtRules = cleanCss.replace(/@(?:media|keyframes)[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');

  // Match selector { properties } blocks
  const rulePattern = /([^{]+)\{([^}]+)\}/g;
  const matches = withoutAtRules.matchAll(rulePattern);

  for (const match of matches) {
    const selectorsStr = match[1].trim();
    const propertiesStr = match[2].trim();

    // Split multi-selector rules (a, b { } → two rules)
    const selectors = selectorsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    // Parse properties
    const properties = parseProperties(propertiesStr);

    // Create a rule for each selector
    for (const selector of selectors) {
      rules.push({ selector, properties });
    }
  }

  return rules;
}

/**
 * Apply CSS rules to elements using simple selector matching
 *
 * Supports:
 * - tag, .class, #id, tag.class, tag#id
 * - Later rules win (cascade)
 * - Extracts size hints from width/height/min-width/min-height
 */
export function applyStyles(elements: StaticElement[], rules: CSSRule[]): StaticElement[] {
  return elements.map(element => {
    const matchedStyles: Record<string, string> = { ...element.computedStyles };

    // Apply matching rules in order (later wins)
    for (const rule of rules) {
      if (selectorMatches(rule.selector, element)) {
        Object.assign(matchedStyles, rule.properties);
      }
    }

    // Extract size hints and update bounds
    const bounds = { ...element.bounds };
    if (matchedStyles.width) bounds.width = parseSizeValue(matchedStyles.width);
    if (matchedStyles.height) bounds.height = parseSizeValue(matchedStyles.height);
    if (matchedStyles['min-width'] && bounds.width === 0) {
      bounds.width = parseSizeValue(matchedStyles['min-width']);
    }
    if (matchedStyles['min-height'] && bounds.height === 0) {
      bounds.height = parseSizeValue(matchedStyles['min-height']);
    }

    return {
      ...element,
      computedStyles: matchedStyles,
      bounds,
    };
  });
}

// --- Helper functions ---

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  // Match attr="value" or attr='value' or attr=value
  const attrPattern = /(\w+(?:-\w+)*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const matches = attrStr.matchAll(attrPattern);

  for (const match of matches) {
    const key = match[1];
    const value = match[2] || match[3] || match[4] || '';
    if (key) attrs[key] = value;
  }

  return attrs;
}

function parseInlineStyle(styleStr: string): Record<string, string> {
  const styles: Record<string, string> = {};

  // Split by semicolon
  const declarations = styleStr.split(';').map(d => d.trim()).filter(d => d);

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) continue;

    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (property) styles[property] = value;
  }

  return styles;
}

function parseProperties(propertiesStr: string): Record<string, string> {
  return parseInlineStyle(propertiesStr);
}

function buildSelector(tagName: string, id?: string, className?: string): string {
  let selector = tagName;
  if (id) selector += `#${id}`;
  if (className) {
    const firstClass = className.split(/\s+/)[0];
    selector += `.${firstClass}`;
  }
  return selector;
}

function determineInteractivity(tagName: string, attrs: Record<string, string>) {
  const hasHref = 'href' in attrs;
  const hasOnClick = 'onclick' in attrs;
  const isDisabled = 'disabled' in attrs;

  // Tag-based interactivity
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
  const isInteractiveTag = interactiveTags.includes(tagName);

  // Handler type detection
  let handlerType: string | null = null;
  if (hasOnClick) handlerType = 'onclick';
  else if (hasHref) handlerType = 'href';
  else if (attrs.type === 'submit') handlerType = 'submit';

  const hasHandler = hasOnClick || hasHref || (tagName === 'button' || attrs.type === 'submit');

  return {
    hasOnClick: hasOnClick || tagName === 'button',
    hasHref,
    isDisabled,
    hasHandler,
    handlerType,
  };
}

function extractA11y(attrs: Record<string, string>) {
  return {
    role: attrs.role || null,
    ariaLabel: attrs['aria-label'] || null,
    ariaHidden: attrs['aria-hidden'] === 'true',
    tabIndex: attrs.tabindex ? parseInt(attrs.tabindex, 10) : null,
  };
}

function extractBoundsFromStyles(styles: Record<string, string>): { x: number; y: number; width: number; height: number } {
  return {
    x: 0,
    y: 0,
    width: parseSizeValue(styles.width) || 0,
    height: parseSizeValue(styles.height) || 0,
  };
}

function parseSizeValue(value: string | undefined): number {
  if (!value) return 0;

  // Parse px values
  const pxMatch = value.match(/^([\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);

  // Parse percentage (treat as 0 for now - can't resolve without parent)
  if (value.endsWith('%')) return 0;

  // Parse unitless numbers
  const numberMatch = value.match(/^([\d.]+)$/);
  if (numberMatch) return parseFloat(numberMatch[1]);

  return 0;
}

function selectorMatches(cssSelector: string, element: StaticElement): boolean {
  const trimmed = cssSelector.trim();

  // Tag only
  if (/^\w+$/.test(trimmed)) {
    return element.tagName === trimmed;
  }

  // #id
  if (/^#[\w-]+$/.test(trimmed)) {
    const id = trimmed.slice(1);
    return element.id === id;
  }

  // .class
  if (/^\.[\w-]+$/.test(trimmed)) {
    const className = trimmed.slice(1);
    return element.className?.split(/\s+/).includes(className) || false;
  }

  // tag.class
  const tagClassMatch = trimmed.match(/^(\w+)\.([\w-]+)$/);
  if (tagClassMatch) {
    const [, tag, className] = tagClassMatch;
    return element.tagName === tag && element.className?.split(/\s+/).includes(className) || false;
  }

  // tag#id
  const tagIdMatch = trimmed.match(/^(\w+)#([\w-]+)$/);
  if (tagIdMatch) {
    const [, tag, id] = tagIdMatch;
    return element.tagName === tag && element.id === id;
  }

  // Unsupported selector (descendant, child, etc.) - skip
  return false;
}
