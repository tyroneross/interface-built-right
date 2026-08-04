/**
 * Layout-overflow detector — finds content that has escaped its box.
 *
 * The bug class
 * -------------
 * Obsidian's `app.css` pins every `<button>` to `height: var(--input-height)`
 * (30px). A plugin that uses `<button>` as a multi-line layout container —
 * a very common idiom, since the whole row is the click target — gets its
 * content pinned to 30px while the content itself is 78px tall. The extra 48px
 * paints OUTSIDE the button, spilling ~29px into the row below: text over text,
 * with the row divider cutting through it.
 *
 * Nothing in IBR could see that. Touch targets pass (the button is 30px, which
 * is under 44 but that is a different finding). Contrast passes. The a11y tree
 * passes. `layout-collision` compares only EXTRACTED INTERACTIVE elements, and
 * the colliding pieces here are plain `<span>` chips inside a `<div>`.
 *
 * Two views of one defect
 * -----------------------
 * A constrained box is visible from both sides, and each side answers a
 * different question:
 *
 *   self-overflow    `scrollHeight > clientHeight` on an `overflow: visible`
 *                    box. Answers "which box is too small, and which
 *                    declaration made it too small".
 *   container-escape a child's rect extends past the parent's border box.
 *                    Answers "by how many pixels, and in which direction".
 *   sibling-overlap  two text-bearing rects intersect. Answers "what does the
 *                    user actually see broken".
 *
 * All three are reported, but `container-escape` is SUPPRESSED when the parent
 * is itself an overflowing box on that axis — the two would otherwise
 * double-count one defect. Escapes that `scrollHeight` cannot see (absolutely
 * positioned children, negative margins) still surface. Suppression keys off
 * the measured FACT, not off whether a finding cleared the report threshold, so
 * tuning a threshold changes how many findings appear and never which kind.
 *
 * Attribution
 * -----------
 * "Something overlaps" is not actionable. Each finding names the computed
 * declaration most likely responsible. The strongest case is exact: when a
 * `<button>`'s computed height equals the resolved value of Obsidian's own
 * `--input-height` custom property, the constraint is Obsidian's base
 * `button { height: var(--input-height) }` rule with near-certainty, and the
 * fix is named literally (`height: auto; min-height: 0`).
 *
 * Shape follows `src/native/layout-fill.ts`: a PURE analyzer over measurements
 * plus a separate probe that collects them, so the detector is unit-testable
 * against a fixture without a live browser, and testable end-to-end with one.
 */

// ---------------------------------------------------------------------------
// Measurement (probe output)
// ---------------------------------------------------------------------------

export interface LayoutOverflowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One measured element. Produced by the probe, consumed by the analyzer. */
export interface LayoutOverflowNode {
  /** Index into the node array. Equal to the node's position in the array. */
  index: number;
  /** Index of the parent node, or null for the walk root. */
  parent: number | null;
  /** Depth below the walk root (root = 0). */
  depth: number;
  /** CSS-ish path, e.g. `#ibr-container > li.task-row > button.row-btn`. */
  selector: string;
  tagName: string;
  /** Text from DIRECT child text nodes only — NOT innerText. See analyzer. */
  ownText: string;
  rect: LayoutOverflowRect;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  overflowX: string;
  overflowY: string;
  display: string;
  position: string;
  /** Computed `height` — a px string when constrained, `auto` otherwise. */
  height: string;
  minHeight: string;
  maxHeight: string;
  width: string;
  minWidth: string;
  maxWidth: string;
  boxSizing: string;
  hasTransform: boolean;
  /**
   * Resolved value of Obsidian's `--input-height` custom property at this
   * element, e.g. `"30px"`. Empty when the property is undefined — which is
   * itself the signal that the harness ran WITHOUT Obsidian's base CSS.
   */
  inputHeightVar: string;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type LayoutOverflowKind = 'self-overflow' | 'container-escape' | 'sibling-overlap';

export interface LayoutOverflowCulprit {
  /** Element carrying the constraining declaration. */
  selector: string;
  /** e.g. `height`. */
  property: string;
  /** e.g. `30px`. */
  value: string;
  /**
   * Where the declaration most likely comes from.
   * `obsidian-base` is asserted only on positive evidence (see analyzer).
   */
  origin: 'obsidian-base' | 'author' | 'unknown';
  /** One sentence naming the rule, suitable for pasting into a report. */
  note: string;
}

export interface LayoutOverflowFinding {
  kind: LayoutOverflowKind;
  severity: 'error' | 'warning';
  axis: 'horizontal' | 'vertical';
  /** The element the finding is about. */
  selector: string;
  tagName: string;
  text?: string;
  /** Spill / overlap magnitude in CSS px. */
  spillPx: number;
  /** The other element, for cross-element findings. */
  otherSelector?: string;
  otherText?: string;
  culprit?: LayoutOverflowCulprit;
  /** Pre-formatted message, suitable as a `ScanIssue.description`. */
  detail: string;
  fix?: string;
}

export interface LayoutOverflowOptions {
  /** Min `scroll - client` on a visible-overflow box, in px. Default 8. */
  selfOverflowPx?: number;
  /** Min rect escape past the parent's border box, in px. Default 8. */
  containerEscapePx?: number;
  /** Min overlap on BOTH axes for a cross-element collision, in px. Default 8. */
  overlapPx?: number;
  /** Cap on findings returned, highest severity/magnitude first. Default 40. */
  maxFindings?: number;
}

/**
 * Thresholds calibrated against real plugin output, not chosen for tidiness.
 *
 * 8px is deliberately well above sub-pixel and line-box artifacts and well
 * below one line of text. A first pass at 2px fired on
 * `strong.dpl-metric-value` in a real plugin — `clientHeight: 19,
 * scrollHeight: 21`, an explicit `height: 19px` holding a 21px line box. That
 * is invisible on screen (it is descender space), it appears on every element
 * with a slightly tight explicit height, and a check that fires there teaches
 * people to ignore the check. The defect this detector exists for measured
 * 48px, and any genuine content overflow is at least a partial text line
 * (~17-25px), so nothing real is lost.
 *
 * `overlapPx` governs the only ERROR-severity finding, where a false positive
 * is most expensive, so it gets the same floor: an overlap has to be
 * unmistakable to be called text-on-text. Lower any of these when auditing a
 * dense view where a few px genuinely matters.
 */
export const LAYOUT_OVERFLOW_DEFAULTS = {
  selfOverflowPx: 8,
  containerEscapePx: 8,
  overlapPx: 8,
  maxFindings: 40,
} as const;

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

export interface LayoutOverflowProbeOptions {
  /** Where to start the walk. Default `#ibr-container`, falling back to body. */
  rootSelector?: string;
  /** Hard cap on measured nodes. Default 4000. */
  maxNodes?: number;
}

/**
 * Build the JS expression that collects `LayoutOverflowNode[]` in the page.
 *
 * Returned as an expression string rather than a function because IBR's engine
 * evaluates expressions (`RuntimeDomain.evaluate`, `returnByValue: true`);
 * there is no bundler step between here and the page.
 *
 * ES5-only on purpose: it runs in whatever Chrome the user has, and a syntax
 * error here would surface as a lost probe rather than a loud failure.
 */
export function buildLayoutOverflowProbe(options: LayoutOverflowProbeOptions = {}): string {
  const rootSelector = JSON.stringify(options.rootSelector ?? '#ibr-container');
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 4000));

  return `(function () {
  var MAX = ${maxNodes};
  var root = document.querySelector(${rootSelector}) || document.body;
  if (!root) return [];
  var out = [];

  function nth(el) {
    var p = el.parentElement;
    if (!p) return 1;
    var n = 0;
    for (var i = 0; i < p.children.length; i++) {
      if (p.children[i].tagName === el.tagName) {
        n++;
        if (p.children[i] === el) return n;
      }
    }
    return n;
  }

  function shortSel(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    var cls = (typeof el.className === 'string' ? el.className : '').trim();
    if (cls) {
      var parts = cls.split(/\\s+/).slice(0, 2);
      s += '.' + parts.join('.');
    }
    var i = nth(el);
    if (i > 1) s += ':nth-of-type(' + i + ')';
    return s;
  }

  function pathSel(el, rootEl) {
    var chain = [];
    var cur = el;
    var guard = 0;
    while (cur && guard++ < 12) {
      chain.unshift(shortSel(cur));
      if (cur === rootEl) break;
      cur = cur.parentElement;
    }
    return chain.join(' > ');
  }

  function directText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) t += n.nodeValue;
    }
    t = t.replace(/\\s+/g, ' ').trim();
    return t.length > 80 ? t.slice(0, 80) : t;
  }

  function walk(el, parentIndex, depth) {
    if (out.length >= MAX) return;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    // display:none has no layout at all; its subtree is not rendered either.
    if (cs.display === 'none') return;

    var r = el.getBoundingClientRect();
    var index = out.length;
    out.push({
      index: index,
      parent: parentIndex,
      depth: depth,
      selector: pathSel(el, root),
      tagName: el.tagName,
      ownText: directText(el),
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      display: cs.display,
      position: cs.position,
      height: cs.height,
      minHeight: cs.minHeight,
      maxHeight: cs.maxHeight,
      width: cs.width,
      minWidth: cs.minWidth,
      maxWidth: cs.maxWidth,
      boxSizing: cs.boxSizing,
      hasTransform: cs.transform !== 'none' && cs.transform !== '',
      inputHeightVar: (cs.getPropertyValue('--input-height') || '').trim()
    });

    for (var i = 0; i < el.children.length; i++) {
      walk(el.children[i], index, depth + 1);
      if (out.length >= MAX) return;
    }
  }

  walk(root, null, 0);
  return out;
})()`;
}

// ---------------------------------------------------------------------------
// Analyzer helpers
// ---------------------------------------------------------------------------

function px(value: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/** A box the browser will not grow: overflow is visible, so content escapes. */
function isVisibleOverflow(value: string): boolean {
  return value === 'visible';
}

/** Inline and contents boxes have meaningless client/scroll metrics. */
function hasBoxMetrics(node: LayoutOverflowNode): boolean {
  return node.display !== 'inline' && node.display !== 'contents' && node.clientHeight > 0;
}

/** Out-of-flow boxes are POSITIONED where they are — not a layout accident. */
function isInFlow(node: LayoutOverflowNode): boolean {
  return (node.position === 'static' || node.position === 'relative') && !node.hasTransform;
}

function short(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Name the declaration that pinned this box, and say where it came from.
 *
 * The `obsidian-base` verdict is asserted ONLY on positive evidence: a
 * form-control element whose computed height equals the resolved value of
 * Obsidian's own `--input-height` custom property. That is the exact fingerprint
 * of `app.css`'s bare `button { height: var(--input-height) }` rule. Anything
 * else is reported as `author` (a fixed height IS declared somewhere, we just
 * cannot say by whom) or `unknown` (no fixed constraint on this element — the
 * constraint is on an ancestor, or the content is simply larger than the space).
 */
export function attributeCulprit(
  node: LayoutOverflowNode,
  axis: 'horizontal' | 'vertical',
): LayoutOverflowCulprit {
  const isVertical = axis === 'vertical';
  const sizeProp = isVertical ? 'height' : 'width';
  const maxProp = isVertical ? 'max-height' : 'max-width';
  const size = px(isVertical ? node.height : node.width);
  const maxSize = px(isVertical ? node.maxHeight : node.maxWidth);
  const content = isVertical ? node.scrollHeight : node.scrollWidth;

  const FORM_CONTROLS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
  const inputHeight = px(node.inputHeightVar);

  if (
    isVertical &&
    FORM_CONTROLS.has(node.tagName) &&
    size !== null &&
    inputHeight !== null &&
    Math.abs(size - inputHeight) < 0.5
  ) {
    return {
      selector: node.selector,
      property: 'height',
      value: node.height,
      origin: 'obsidian-base',
      note:
        `Obsidian's app.css pins every <${node.tagName.toLowerCase()}> to ` +
        `height: var(--input-height) (${node.inputHeightVar}). This element's ` +
        `content is ${Math.round(content)}px tall, so it renders outside the box. ` +
        `A <${node.tagName.toLowerCase()}> used as a multi-line layout container ` +
        `must reset that rule.`,
    };
  }

  if (size !== null && content > size + 0.5) {
    return {
      selector: node.selector,
      property: sizeProp,
      value: isVertical ? node.height : node.width,
      origin: 'author',
      note:
        `${sizeProp}: ${isVertical ? node.height : node.width} holds this box to a fixed size ` +
        `while its content measures ${Math.round(content)}px.`,
    };
  }

  if (maxSize !== null && content > maxSize + 0.5) {
    return {
      selector: node.selector,
      property: maxProp,
      value: isVertical ? node.maxHeight : node.maxWidth,
      origin: 'author',
      note:
        `${maxProp}: ${isVertical ? node.maxHeight : node.maxWidth} caps this box ` +
        `below its ${Math.round(content)}px content.`,
    };
  }

  return {
    selector: node.selector,
    property: sizeProp,
    value: isVertical ? node.height : node.width,
    origin: 'unknown',
    note:
      `No fixed ${sizeProp} on this element — the constraint is on an ancestor, ` +
      `or the content genuinely exceeds the space available.`,
  };
}

function fixFor(culprit: LayoutOverflowCulprit | undefined, axis: 'horizontal' | 'vertical'): string {
  if (culprit?.origin === 'obsidian-base') {
    return `Reset the base rule on this element: \`height: auto; min-height: 0;\` (and \`display: block\`/\`grid\` if it must wrap). Or use a non-<button> element with a click handler and \`role="button"\`.`;
  }
  if (culprit?.origin === 'author') {
    return `Replace \`${culprit.property}: ${culprit.value}\` with \`min-${culprit.property}\`, or allow the box to grow (\`${culprit.property}: auto\`).`;
  }
  return axis === 'vertical'
    ? 'Let the box grow (`height: auto`), or give it `overflow: hidden` if clipping is intended.'
    : 'Let the box grow (`width: auto`), allow wrapping, or clip deliberately.';
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze measured nodes for content that has escaped its box.
 *
 * Pure function — no I/O, no DOM. Feed it `buildLayoutOverflowProbe()` output
 * from a real page, or a hand-built fixture in a test.
 */
export function analyzeLayoutOverflow(
  nodes: LayoutOverflowNode[],
  options: LayoutOverflowOptions = {},
): LayoutOverflowFinding[] {
  const selfOverflowPx = options.selfOverflowPx ?? LAYOUT_OVERFLOW_DEFAULTS.selfOverflowPx;
  const containerEscapePx = options.containerEscapePx ?? LAYOUT_OVERFLOW_DEFAULTS.containerEscapePx;
  const overlapPx = options.overlapPx ?? LAYOUT_OVERFLOW_DEFAULTS.overlapPx;
  const maxFindings = options.maxFindings ?? LAYOUT_OVERFLOW_DEFAULTS.maxFindings;

  if (nodes.length === 0) return [];

  const byIndex = new Map<number, LayoutOverflowNode>();
  for (const n of nodes) byIndex.set(n.index, n);

  const findings: LayoutOverflowFinding[] = [];

  /**
   * `${index}:${axis}` for every box that IS overflowing, measured
   * geometrically at a fixed epsilon.
   *
   * Deliberately NOT "every box we emitted a finding for". Suppression and
   * culprit attribution must depend on the FACT, not on the reporting
   * threshold — otherwise raising `selfOverflowPx` would silently convert a
   * suppressed `container-escape` into an emitted one, i.e. tuning the
   * threshold down would change which KIND of finding appears rather than how
   * many. Tests caught exactly that.
   */
  const overflowingBoxes = new Set<string>();
  const EPSILON_PX = 0.5;
  for (const node of nodes) {
    if (!hasBoxMetrics(node)) continue;
    if (isVisibleOverflow(node.overflowY) && node.scrollHeight - node.clientHeight > EPSILON_PX) {
      overflowingBoxes.add(`${node.index}:vertical`);
    }
    if (
      isVisibleOverflow(node.overflowX) &&
      node.clientWidth > 0 &&
      node.scrollWidth - node.clientWidth > EPSILON_PX
    ) {
      overflowingBoxes.add(`${node.index}:horizontal`);
    }
  }

  // --- Pass 1: self-overflow -------------------------------------------------
  // The box is too small for its own content and will not clip it.
  for (const node of nodes) {
    if (!hasBoxMetrics(node)) continue;

    if (isVisibleOverflow(node.overflowY)) {
      const spill = node.scrollHeight - node.clientHeight;
      if (spill >= selfOverflowPx) {
        const culprit = attributeCulprit(node, 'vertical');
        findings.push({
          kind: 'self-overflow',
          severity: 'warning',
          axis: 'vertical',
          selector: node.selector,
          tagName: node.tagName,
          text: node.ownText || undefined,
          spillPx: round(spill),
          culprit,
          detail:
            `layout-overflow: <${node.tagName.toLowerCase()}> ${node.selector} renders ` +
            `${Math.round(node.scrollHeight)}px of content in a ${Math.round(node.clientHeight)}px box ` +
            `(overflow: visible) — ${Math.round(spill)}px paints outside the element. ${culprit?.note ?? ''}`.trim(),
          fix: fixFor(culprit, 'vertical'),
        });
      }
    }

    if (isVisibleOverflow(node.overflowX) && node.clientWidth > 0) {
      const spill = node.scrollWidth - node.clientWidth;
      if (spill >= selfOverflowPx) {
        const culprit = attributeCulprit(node, 'horizontal');
        findings.push({
          kind: 'self-overflow',
          severity: 'warning',
          axis: 'horizontal',
          selector: node.selector,
          tagName: node.tagName,
          text: node.ownText || undefined,
          spillPx: round(spill),
          culprit,
          detail:
            `layout-overflow: <${node.tagName.toLowerCase()}> ${node.selector} renders ` +
            `${Math.round(node.scrollWidth)}px of content in a ${Math.round(node.clientWidth)}px box ` +
            `(overflow: visible) — ${Math.round(spill)}px paints outside the element. ${culprit?.note ?? ''}`.trim(),
          fix: fixFor(culprit, 'horizontal'),
        });
      }
    }
  }

  // --- Pass 2: container escape ---------------------------------------------
  // A child's rect extends past its parent's border box. Suppressed when the
  // parent already reported self-overflow on the same axis — same defect.
  for (const node of nodes) {
    if (node.parent === null) continue;
    if (!isInFlow(node)) continue;
    const parent = byIndex.get(node.parent);
    if (!parent) continue;
    if (parent.rect.width <= 0 || parent.rect.height <= 0) continue;
    if (node.rect.width <= 0 || node.rect.height <= 0) continue;

    const axes: Array<['vertical' | 'horizontal', number, number, number, number, string]> = [
      [
        'vertical',
        node.rect.y,
        node.rect.y + node.rect.height,
        parent.rect.y,
        parent.rect.y + parent.rect.height,
        parent.overflowY,
      ],
      [
        'horizontal',
        node.rect.x,
        node.rect.x + node.rect.width,
        parent.rect.x,
        parent.rect.x + parent.rect.width,
        parent.overflowX,
      ],
    ];

    for (const [axis, start, end, pStart, pEnd, parentOverflow] of axes) {
      if (!isVisibleOverflow(parentOverflow)) continue;
      if (overflowingBoxes.has(`${parent.index}:${axis}`)) continue;

      const past = Math.max(end - pEnd, 0);
      const before = Math.max(pStart - start, 0);
      const spill = Math.max(past, before);
      if (spill < containerEscapePx) continue;

      const culprit = attributeCulprit(parent, axis);
      const direction =
        axis === 'vertical' ? (past >= before ? 'below' : 'above') : past >= before ? 'past the end of' : 'before the start of';
      findings.push({
        kind: 'container-escape',
        severity: 'warning',
        axis,
        selector: node.selector,
        tagName: node.tagName,
        text: node.ownText || undefined,
        spillPx: round(spill),
        otherSelector: parent.selector,
        otherText: parent.ownText || undefined,
        culprit,
        detail:
          `layout-overflow: ${node.selector} extends ${Math.round(spill)}px ${direction} ` +
          `its parent ${parent.selector} (parent overflow: visible, so the excess paints over ` +
          `whatever follows). ${culprit?.note ?? ''}`.trim(),
        fix: fixFor(culprit, axis),
      });
    }
  }

  // --- Pass 3: sibling / cross-element overlap -------------------------------
  // What the user actually sees broken: two pieces of text on the same pixels.
  //
  // Restricted to text-bearing LEAVES — elements with their own direct text
  // nodes. Using innerText would make every ancestor "text-bearing" and turn
  // one visual defect into a storm of nested pairs. `ownText` is the precision
  // control that keeps this finding trustworthy enough to be an ERROR.
  const textNodes = nodes
    .filter(
      (n) =>
        n.ownText.length > 0 &&
        n.rect.width > 0 &&
        n.rect.height > 0 &&
        isInFlow(n),
    )
    .sort((a, b) => (a.rect.y !== b.rect.y ? a.rect.y - b.rect.y : a.rect.x - b.rect.x));

  const ancestorsOf = buildAncestorSets(nodes, byIndex);

  for (let i = 0; i < textNodes.length; i++) {
    const a = textNodes[i];
    const aBottom = a.rect.y + a.rect.height;
    for (let j = i + 1; j < textNodes.length; j++) {
      const b = textNodes[j];
      // Sorted by y: once b starts below a's bottom, no later node can overlap.
      if (b.rect.y >= aBottom - overlapPx) break;
      if (ancestorsOf.get(a.index)?.has(b.index) || ancestorsOf.get(b.index)?.has(a.index)) continue;

      const overlapH = Math.min(aBottom, b.rect.y + b.rect.height) - Math.max(a.rect.y, b.rect.y);
      const overlapW =
        Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width) - Math.max(a.rect.x, b.rect.x);
      if (overlapH < overlapPx || overlapW < overlapPx) continue;

      // Attribute to the nearest ancestor of EITHER element that is itself an
      // overflowing box — that is the box whose fixed size caused the collision.
      const culprit =
        nearestOverflowingAncestor(a, byIndex, overflowingBoxes) ??
        nearestOverflowingAncestor(b, byIndex, overflowingBoxes);

      findings.push({
        kind: 'sibling-overlap',
        severity: 'error',
        axis: 'vertical',
        selector: a.selector,
        tagName: a.tagName,
        text: short(a.ownText),
        spillPx: round(overlapH),
        otherSelector: b.selector,
        otherText: short(b.ownText),
        culprit,
        detail:
          `layout-overflow: "${short(a.ownText)}" (${a.selector}) overlaps ` +
          `"${short(b.ownText)}" (${b.selector}) by ${Math.round(overlapH)}x${Math.round(overlapW)}px — ` +
          `text is rendering on top of text. ${culprit?.note ?? ''}`.trim(),
        fix: culprit
          ? fixFor(culprit, 'vertical')
          : 'Two in-flow text elements occupy the same pixels. Check for a fixed height, a negative margin, or an absolute position on a shared ancestor.',
      });
    }
  }

  // Errors first, then biggest spill. Same ordering rule as layout-fill.
  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return b.spillPx - a.spillPx;
  });
  return findings.slice(0, maxFindings);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildAncestorSets(
  nodes: LayoutOverflowNode[],
  byIndex: Map<number, LayoutOverflowNode>,
): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  for (const node of nodes) {
    const set = new Set<number>();
    let cur = node.parent;
    let guard = 0;
    while (cur !== null && guard++ < 64) {
      set.add(cur);
      cur = byIndex.get(cur)?.parent ?? null;
    }
    out.set(node.index, set);
  }
  return out;
}

function nearestOverflowingAncestor(
  node: LayoutOverflowNode,
  byIndex: Map<number, LayoutOverflowNode>,
  overflowingBoxes: Set<string>,
): LayoutOverflowCulprit | undefined {
  let cur = node.parent;
  let guard = 0;
  while (cur !== null && guard++ < 64) {
    const ancestor = byIndex.get(cur);
    if (!ancestor) return undefined;
    if (overflowingBoxes.has(`${ancestor.index}:vertical`)) {
      return attributeCulprit(ancestor, 'vertical');
    }
    cur = ancestor.parent;
  }
  return undefined;
}
