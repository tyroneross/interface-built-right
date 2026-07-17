import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { buildObsidianStub } from './stub.js';

/**
 * Harness generator — turns an Obsidian plugin bundle + stylesheet into a
 * self-contained HTML page that mounts one view class into a root element.
 *
 * The page is self-contained (bundle and CSS are inlined, no subresources) so it
 * can be written to disk and opened by a human for inspection. It is still
 * SERVED over http://127.0.0.1 rather than opened as file:// — see server.ts for
 * why.
 */

export interface HarnessInput {
  /** Plugin bundle path (the built CJS `main.js`). */
  bundlePath: string;
  /** Stylesheet path (`styles.css`). Optional — a view may ship no CSS. */
  stylesPath?: string;
  /** Exported view class name, e.g. "DailyPlannerView". */
  viewClass: string;
  /** `Platform.isMobile` value for the stub. */
  mobile: boolean;
  /** Obsidian theme class applied to <body>: `theme-dark` or `theme-light`. */
  theme?: 'dark' | 'light';
  /** Properties assigned onto the view instance before render (the fixture). */
  viewState?: Record<string, unknown>;
  /** Properties assigned onto the fake plugin passed to the view constructor. */
  pluginState?: Record<string, unknown>;
  /** JS evaluated after mount. `view` and `root` are in scope. */
  postMount?: string;
  /** Extra CSS appended after the plugin stylesheet (e.g. theme variables). */
  extraCss?: string;
}

/** Obsidian defines these on `body`; some plugin CSS keys off them. */
const OBSIDIAN_BODY_CLASSES = 'mod-macos is-focused';

/**
 * Inlining JS into HTML breaks if the source contains a literal `</script`,
 * because the HTML parser ends the block there. `<\/script` is byte-identical to
 * `</script` once JS parses it (in a string, a regex, or a comment), so this is
 * a safe transform rather than a semantic edit.
 */
function escapeForInlineScript(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script');
}

/** `</style` cannot appear inside an inline <style> block. */
function escapeForInlineStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

function readRequired(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

/**
 * Resolve a plugin directory into its bundle + stylesheet.
 * Accepts either a plugin directory or a direct path to `main.js`.
 */
export function resolvePluginPaths(pluginPath: string): { bundlePath: string; stylesPath?: string } {
  const abs = isAbsolute(pluginPath) ? pluginPath : resolve(process.cwd(), pluginPath);
  if (abs.endsWith('.js')) {
    return { bundlePath: abs };
  }
  const bundlePath = join(abs, 'main.js');
  const stylesPath = join(abs, 'styles.css');
  return { bundlePath, stylesPath: existsSync(stylesPath) ? stylesPath : undefined };
}

/**
 * The mount script. Kept separate from the bundle's own script block so a
 * SyntaxError in the bundle cannot take the mount reporting down with it.
 *
 * Mount failures are made loud three ways, because a silently-empty page would
 * otherwise scan as a clean PASS — the exact false-negative this harness exists
 * to prevent:
 *   1. `console.error` — picked up by scan()'s console capture,
 *   2. `body[data-ibr-mount="error"]` — machine readable,
 *   3. a visible banner — so a screenshot shows the failure.
 */
function buildMountScript(input: HarnessInput): string {
  const viewStateJson = JSON.stringify(input.viewState ?? {});
  const pluginStateJson = JSON.stringify(input.pluginState ?? {});
  const viewClass = JSON.stringify(input.viewClass);
  const postMount = input.postMount ?? '';

  return `
(function () {
  function markError(stage, err) {
    var message = String((err && err.stack) || err);
    window.__IBR_MOUNT_OK = false;
    window.__IBR_MOUNT_ERROR = message;
    document.body.setAttribute('data-ibr-mount', 'error');
    document.body.setAttribute('data-ibr-mount-stage', stage);
    console.error('IBR obsidian-harness: mount failed at ' + stage + ': ' + message);
    var banner = document.createElement('pre');
    banner.id = 'ibr-mount-error';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'margin:0;padding:16px;background:#7f1d1d;color:#fff;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;';
    banner.textContent = 'IBR harness mount failed at ' + stage + '\\n\\n' + message;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  var view;
  try {
    var exported = window.module.exports || {};
    var View = exported[${viewClass}] || (exported.default && exported.default[${viewClass}]);
    if (typeof View !== 'function') {
      var available = Object.keys(exported).join(', ') || '(none)';
      throw new Error('view class ' + ${viewClass} + ' is not exported from the bundle. Available exports: ' + available);
    }

    // Obsidian's ItemView contract: containerEl.children[1] is the content area
    // (children[0] is the view header). Reproduce that shape exactly.
    var containerEl = document.getElementById('ibr-container');
    var headerEl = document.createElement('div');
    headerEl.className = 'view-header';
    var contentEl = document.createElement('div');
    contentEl.className = 'view-content';
    containerEl.appendChild(headerEl);
    containerEl.appendChild(contentEl);

    var plugin = Object.assign({
      app: {},
      settings: {},
      views: new Set(),
      manifest: { id: 'ibr-harness', version: '0.0.0' },
      saveData: function () { return Promise.resolve(); },
      loadData: function () { return Promise.resolve(null); },
    }, ${pluginStateJson});

    var leaf = { app: plugin.app, containerEl: containerEl, view: null };
    view = new View(leaf, plugin);
    view.containerEl = containerEl;
    view.app = plugin.app;
    leaf.view = view;

    var state = ${viewStateJson};
    for (var k in state) if (Object.prototype.hasOwnProperty.call(state, k)) view[k] = state[k];
  } catch (e) {
    markError('construct', e);
    return;
  }

  try {
    // render() is this plugin family's idiom; onOpen() is Obsidian's lifecycle
    // hook. Prefer render() when present, fall back to onOpen().
    if (typeof view.render === 'function') view.render();
    else if (typeof view.onOpen === 'function') view.onOpen();
    else throw new Error('view exposes neither render() nor onOpen()');
  } catch (e) {
    markError('render', e);
    return;
  }

  window.__IBR_VIEW = view;
  var root = view.rootEl || document.querySelector('#ibr-container .view-content');
  window.__IBR_ROOT = root;

  try {
    ${postMount}
  } catch (e) {
    markError('post-mount', e);
    return;
  }

  window.__IBR_MOUNT_OK = true;
  document.body.setAttribute('data-ibr-mount', 'ok');
})();
`;
}

/** Generate the self-contained harness HTML. */
export function generateHarness(input: HarnessInput): string {
  const bundle = readRequired(input.bundlePath, 'Plugin bundle');
  const css = input.stylesPath ? readRequired(input.stylesPath, 'Plugin stylesheet') : '';
  const stub = buildObsidianStub({ mobile: input.mobile });
  const mount = buildMountScript(input);
  const themeClass = input.theme === 'light' ? 'theme-light' : 'theme-dark';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IBR Obsidian harness — ${input.viewClass}</title>
<style>
/* Obsidian-ish baseline. The plugin stylesheet below owns everything visual;
   this only removes the UA margin and supplies the font stack a real Obsidian
   window would, so measured layout is not skewed by browser defaults. */
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  background: var(--background-primary, #1e1e1e);
  color: var(--text-normal, #dcddde);
}
#ibr-container, #ibr-container .view-content { height: 100%; }
</style>
<style>
${escapeForInlineStyle(css)}
</style>
${input.extraCss ? `<style>\n${escapeForInlineStyle(input.extraCss)}\n</style>` : ''}
</head>
<body class="${themeClass} ${OBSIDIAN_BODY_CLASSES}">
<div id="ibr-container" class="workspace-leaf-content"></div>
<script>${escapeForInlineScript(stub)}</script>
<script>${escapeForInlineScript(bundle)}</script>
<script>${escapeForInlineScript(mount)}</script>
</body>
</html>
`;
}
