import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { buildObsidianStub } from './stub.js';
import { generateHarness, resolvePluginPaths } from './harness.js';
import { deriveHarnessIssues, inferMobile, resolveObsidianViewport, isMountMarkerMissing } from './scan.js';

const FIXTURES = join(__dirname, 'fixtures');
const BUNDLE = join(FIXTURES, 'fixture-plugin.js');
const STYLES = join(FIXTURES, 'fixture-plugin.css');

describe('buildObsidianStub', () => {
  it('declares nothing at top level that a plugin bundle also declares', () => {
    // The bug this guards: a plugin's first line is
    // `const { ItemView, Notice, ... } = require("obsidian")`, a top-level
    // LEXICAL declaration. Classic scripts share one global lexical scope, so a
    // shim that also declares top-level `class ItemView` makes the bundle die
    // with "Identifier 'ItemView' has already been declared" — and it dies
    // SILENTLY: module.exports just stays {}. Everything must be IIFE-scoped.
    const stub = buildObsidianStub({ mobile: true });
    const topLevelDecls = stub
      .split('\n')
      .filter((line) => /^(var|let|const|class|function)\s/.test(line));
    expect(topLevelDecls).toEqual([]);
  });

  it('publishes require/module/exports as window properties, not lexical bindings', () => {
    // Bare `require(...)` in the bundle resolves through the global OBJECT, so
    // these must be properties. A top-level `function require()` would be a
    // lexical binding and collide with nothing — but also could not be replaced.
    const stub = buildObsidianStub({ mobile: true });
    expect(stub).toContain('window.require = function');
    expect(stub).toContain('window.module = { exports: {} }');
    expect(stub).toContain('window.exports = window.module.exports');
  });

  it('threads Platform.isMobile through to the plugin branch', () => {
    expect(buildObsidianStub({ mobile: true })).toContain('isMobile: true');
    expect(buildObsidianStub({ mobile: false })).toContain('isMobile: false');
  });

  it('patches the Obsidian DOM extensions a view renders with', () => {
    const stub = buildObsidianStub({ mobile: false });
    for (const api of ['createEl', 'createDiv', 'createSpan', 'setText', 'empty', 'addClass', 'removeClass', 'toggleClass', 'setAttr', 'detach']) {
      expect(stub, `HTMLElement.prototype.${api}`).toContain(`P.${api} =`);
    }
  });
});

describe('generateHarness', () => {
  it('inlines the bundle and the stylesheet into one self-contained document', () => {
    const html = generateHarness({ bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'FixtureView', mobile: true });
    expect(html).toContain('module.exports.FixtureView = FixtureView'); // the real bundle
    expect(html).toContain('--fx-grad-accent'); // the real stylesheet
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)=/); // no subresources
  });

  it('orders the scripts stub → bundle → mount', () => {
    // The bundle calls require("obsidian") at load, so the shim must already
    // exist; the mount script reads module.exports, so the bundle must have run.
    const html = generateHarness({ bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'FixtureView', mobile: true });
    const stubAt = html.indexOf('window.require = function');
    const bundleAt = html.indexOf('module.exports.FixtureView');
    const mountAt = html.indexOf("data-ibr-mount', 'ok'");
    expect(stubAt).toBeGreaterThan(-1);
    expect(stubAt).toBeLessThan(bundleAt);
    expect(bundleAt).toBeLessThan(mountAt);
  });

  it('serialises viewState into the mount script', () => {
    const html = generateHarness({
      bundlePath: BUNDLE, stylesPath: STYLES, viewClass: 'FixtureView', mobile: true,
      viewState: { title: 'Injected', items: [{ title: 'one' }] },
    });
    expect(html).toContain('"title":"Injected"');
    expect(html).toContain('"items":[{"title":"one"}]');
  });

  it('applies the requested theme class', () => {
    expect(generateHarness({ bundlePath: BUNDLE, viewClass: 'FixtureView', mobile: false, theme: 'light' })).toContain('class="theme-light');
    expect(generateHarness({ bundlePath: BUNDLE, viewClass: 'FixtureView', mobile: false })).toContain('class="theme-dark');
  });

  it('reproduces Obsidian\'s containerEl.children[1] content-area contract', () => {
    // Every ItemView reads containerEl.children[1]; children[0] is the header.
    const html = generateHarness({ bundlePath: BUNDLE, viewClass: 'FixtureView', mobile: false });
    expect(html).toContain("headerEl.className = 'view-header'");
    expect(html).toContain("contentEl.className = 'view-content'");
  });

  it('names the available exports when the view class is missing', () => {
    // A bad view_class is the most likely user error; the message has to say
    // what IS exported rather than just "undefined".
    const html = generateHarness({ bundlePath: BUNDLE, viewClass: 'Nope', mobile: false });
    expect(html).toContain('Available exports: ');
  });

  it('throws a located error when the bundle is missing', () => {
    expect(() => generateHarness({ bundlePath: join(FIXTURES, 'nope.js'), viewClass: 'X', mobile: false }))
      .toThrow(/Plugin bundle not found/);
  });
});

describe('generateHarness — inline escaping', () => {
  it('neutralises a literal </script> so the document cannot be truncated', () => {
    // `</script` inside inlined JS ends the block at the HTML level and silently
    // dumps the rest of the bundle into the DOM as text.
    const html = generateHarness({
      bundlePath: BUNDLE, viewClass: 'FixtureView', mobile: false,
      postMount: 'var s = "</script><h1>injected</h1>";',
    });
    expect(html).not.toContain('</script><h1>injected</h1>');
    expect(html).toContain('<\\/script>');
  });
});

describe('resolvePluginPaths', () => {
  it('resolves a plugin directory to main.js + styles.css', () => {
    const r = resolvePluginPaths(FIXTURES);
    expect(r.bundlePath).toBe(join(FIXTURES, 'main.js'));
    expect(r.stylesPath).toBeUndefined(); // fixtures dir has no styles.css
  });

  it('accepts a direct path to a bundle', () => {
    expect(resolvePluginPaths(BUNDLE).bundlePath).toBe(BUNDLE);
  });
});

describe('resolveObsidianViewport', () => {
  it('defaults to a 390px phone', () => {
    expect(resolveObsidianViewport(undefined).width).toBe(390);
  });

  it('resolves a preset name', () => {
    expect(resolveObsidianViewport('iphone-14').width).toBe(390);
    expect(resolveObsidianViewport('desktop').width).toBe(1920);
  });

  it('passes an explicit viewport through', () => {
    const vp = { name: 'custom', width: 375, height: 667 } as never;
    expect(resolveObsidianViewport(vp)).toBe(vp);
  });

  it('lists the known presets when the name is wrong', () => {
    expect(() => resolveObsidianViewport('nonsense')).toThrow(/Unknown viewport "nonsense". Known: /);
  });
});

describe('inferMobile', () => {
  it('honours an explicit value over the viewport', () => {
    // Platform.isMobile forks plugin BEHAVIOUR, not just styling, so an explicit
    // false at 390px must stay false.
    expect(inferMobile(false, { name: 'x', width: 390, height: 844 } as never)).toBe(false);
    expect(inferMobile(true, { name: 'x', width: 1920, height: 1080 } as never)).toBe(true);
  });

  it('infers from viewport width when unset', () => {
    expect(inferMobile(undefined, { name: 'x', width: 390, height: 844 } as never)).toBe(true);
    expect(inferMobile(undefined, { name: 'x', width: 480, height: 800 } as never)).toBe(true);
    expect(inferMobile(undefined, { name: 'x', width: 481, height: 800 } as never)).toBe(false);
    expect(inferMobile(undefined, { name: 'x', width: 1920, height: 1080 } as never)).toBe(false);
  });
});

describe('deriveHarnessIssues', () => {
  it('promotes harness and stub errors to error-severity issues', () => {
    const issues = deriveHarnessIssues([
      'IBR obsidian-harness: mount failed at render: TypeError: x',
      'IBR obsidian-stub: unstubbed API used: obsidian.Whatever()',
    ]);
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.severity === 'error' && i.category === 'structure')).toBe(true);
  });

  it('points an unstubbed-API failure at the stub, and a mount failure at the mount', () => {
    expect(deriveHarnessIssues(['IBR obsidian-stub: unstubbed API used: obsidian.X()'])[0].fix)
      .toMatch(/stub\.ts/);
    expect(deriveHarnessIssues(['IBR obsidian-harness: mount failed at render: boom'])[0].fix)
      .toMatch(/unreliable/);
  });

  it('ignores console noise from the page under test', () => {
    expect(deriveHarnessIssues(['Failed to load resource: favicon.ico', 'some app warning'])).toEqual([]);
  });
});

describe('isMountMarkerMissing', () => {
  it('detects the PARTIAL-because-selector-never-appeared case', () => {
    // This is the only signal for a mount script that never RAN (e.g. a syntax
    // error in post_mount): Chrome reports parse errors via
    // Runtime.exceptionThrown, which IBR's console capture does not subscribe to.
    expect(isMountMarkerMissing({ verdict: 'PARTIAL', partialReason: 'Page still loading after 10000ms — selector not found. Re-scan when content has loaded.' })).toBe(true);
  });

  it('does not fire for an unrelated PARTIAL', () => {
    expect(isMountMarkerMissing({ verdict: 'PARTIAL', partialReason: 'Persistent skeleton/loading state — 4 skeleton nodes still present' })).toBe(false);
  });

  it('does not fire for a normal verdict', () => {
    expect(isMountMarkerMissing({ verdict: 'PASS' })).toBe(false);
    expect(isMountMarkerMissing({ verdict: 'FAIL' })).toBe(false);
  });
});
