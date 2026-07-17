/**
 * Obsidian browser stub — patches Obsidian's DOM extensions onto REAL DOM and
 * supplies the `obsidian` module exports a plugin view imports.
 *
 * WHY A STRING, NOT A MODULE: this source is injected into a generated HTML page
 * and evaluated by the browser, so it cannot be a normal TS import — the plugin
 * bundle is a CJS script that calls a bare `require("obsidian")` at load time.
 *
 * THE COLLISION HAZARD (load-bearing — do not "simplify" this away):
 * a plugin bundle's first statement is typically
 *
 *     const { ItemView, Notice, Platform, ... } = require("obsidian");
 *
 * which is a TOP-LEVEL LEXICAL declaration. Classic scripts share one global
 * lexical scope, so if this shim also declares a top-level `class ItemView`, the
 * bundle's script dies with "Identifier 'ItemView' has already been declared" —
 * and it dies SILENTLY as far as the page is concerned: `module.exports` simply
 * stays `{}` and the view never mounts. Every declaration here therefore lives
 * inside an IIFE, and the only things published are `window.module`,
 * `window.exports` and `window.require` (properties, not lexical bindings, so a
 * bare `require(...)` in the bundle still resolves through the global object).
 *
 * FAIL-LOUD CONTRACT: a stub that silently returns `undefined` turns a missing
 * API into a confusing downstream error ("cannot read property of undefined")
 * far from the cause. Instead, any obsidian export we do not model is a Proxy
 * that throws — naming the API — the moment it is called, constructed, or read
 * from. Destructuring stays safe (so a plugin that imports but never uses an API
 * still mounts), and `class X extends Y` still evaluates; only real USE throws.
 */

/**
 * KNOWN LIMIT of the fail-loud contract: `x instanceof SomeUnstubbedClass`
 * returns false rather than throwing, because `instanceof` resolves through
 * `Symbol.hasInstance`, and trapping symbol reads would break ordinary JS
 * (promise adoption, iteration). A plugin that branches on `instanceof` against
 * an unmodeled Obsidian class therefore takes the false branch silently. Model
 * the class in `known` below if a view depends on that.
 */
export interface ObsidianStubOptions {
  /** Value for `Platform.isMobile` / `isPhone`. Drives the plugin's mobile branch. */
  mobile: boolean;
}

/**
 * Build the shim source injected ahead of the plugin bundle.
 *
 * Emits, in order:
 *  1. an IIFE patching Obsidian's DOM extensions onto `HTMLElement.prototype`
 *     (+ `Document.prototype`), and
 *  2. an IIFE defining the `obsidian` module and publishing `window.module`,
 *     `window.exports`, `window.require`.
 */
export function buildObsidianStub(options: ObsidianStubOptions): string {
  const isMobile = options.mobile ? 'true' : 'false';

  return `
/* ---- IBR Obsidian stub: DOM extensions over real DOM ---- */
(function () {
  var P = HTMLElement.prototype;

  function applyInfo(el, o) {
    if (o == null) return el;
    if (typeof o === 'string') { el.className = o; return el; }
    if (o.cls != null) el.className = Array.isArray(o.cls) ? o.cls.join(' ') : String(o.cls);
    if (o.text != null) {
      if (typeof o.text === 'string' || typeof o.text === 'number') el.textContent = String(o.text);
      else el.appendChild(o.text); // DocumentFragment
    }
    if (o.attr) {
      for (var k in o.attr) {
        if (!Object.prototype.hasOwnProperty.call(o.attr, k)) continue;
        var v = o.attr[k];
        if (v != null && v !== false) el.setAttribute(k, String(v));
      }
    }
    if (o.title != null) el.setAttribute('title', String(o.title));
    if (o.type != null) el.setAttribute('type', String(o.type));
    if (o.value != null) el.value = String(o.value);
    if (o.placeholder != null) el.setAttribute('placeholder', String(o.placeholder));
    if (o.href != null) el.setAttribute('href', String(o.href));
    return el;
  }

  function createEl(tag, o, cb) {
    var el = document.createElement(tag);
    applyInfo(el, o);
    var parent = (o && o.parent) || this;
    if (parent && parent.appendChild) {
      if (o && o.prepend) parent.insertBefore(el, parent.firstChild);
      else parent.appendChild(el);
    }
    if (typeof cb === 'function') cb(el);
    return el;
  }

  P.createEl = createEl;
  P.createDiv = function (o, cb) { return createEl.call(this, 'div', o, cb); };
  P.createSpan = function (o, cb) { return createEl.call(this, 'span', o, cb); };
  P.setText = function (t) {
    if (t != null && typeof t === 'object' && t.nodeType) { this.textContent = ''; this.appendChild(t); return; }
    this.textContent = t == null ? '' : String(t);
  };
  P.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  P.addClass = function () { for (var i = 0; i < arguments.length; i++) if (arguments[i]) this.classList.add(arguments[i]); };
  P.removeClass = function () { for (var i = 0; i < arguments.length; i++) if (arguments[i]) this.classList.remove(arguments[i]); };
  P.toggleClass = function (c, v) {
    var list = Array.isArray(c) ? c : [c];
    for (var i = 0; i < list.length; i++) this.classList.toggle(list[i], v);
  };
  P.hasClass = function (c) { return this.classList.contains(c); };
  P.setAttr = function (n, v) { if (v == null || v === false) this.removeAttribute(n); else this.setAttribute(n, String(v)); };
  P.setAttrs = function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) this.setAttr(k, o[k]); };
  P.getAttr = function (n) { return this.getAttribute(n); };
  P.detach = function () { if (this.parentNode) this.parentNode.removeChild(this); };
  P.appendText = function (t) { this.appendChild(document.createTextNode(String(t))); };
  P.setCssStyles = function (styles) { for (var k in styles) if (Object.prototype.hasOwnProperty.call(styles, k)) this.style[k] = styles[k]; };
  P.setCssProps = function (props) { for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) this.style.setProperty(k, props[k]); };
  P.onClickEvent = function (fn, opts) { this.addEventListener('click', fn, opts); };
  P.show = function () { this.style.display = ''; };
  P.hide = function () { this.style.display = 'none'; };
  P.toggleVisibility = function (v) { v ? this.show() : this.hide(); };

  Document.prototype.createEl = function (tag, o, cb) { return createEl.call(this.body, tag, o, cb); };
  Document.prototype.createDiv = function (o, cb) { return createEl.call(this.body, 'div', o, cb); };
  Document.prototype.createSpan = function (o, cb) { return createEl.call(this.body, 'span', o, cb); };
  if (typeof DocumentFragment !== 'undefined') {
    DocumentFragment.prototype.createEl = createEl;
    DocumentFragment.prototype.createDiv = function (o, cb) { return createEl.call(this, 'div', o, cb); };
    DocumentFragment.prototype.createSpan = function (o, cb) { return createEl.call(this, 'span', o, cb); };
  }
  window.createEl = function (tag, o, cb) { return createEl.call(document.body, tag, o, cb); };
  window.createDiv = function (o, cb) { return createEl.call(document.body, 'div', o, cb); };
  window.createSpan = function (o, cb) { return createEl.call(document.body, 'span', o, cb); };
  window.createFragment = function (cb) { var f = document.createDocumentFragment(); if (cb) cb(f); return f; };
})();

/* ---- IBR Obsidian stub: module shim ---- */
window.__IBR_STUB_ERRORS = [];
(function () {
  function record(msg) {
    window.__IBR_STUB_ERRORS.push(msg);
    // Surfaced to scan() via its console capture — see scanObsidian's
    // deriveHarnessIssues(). console.error is the transport, not decoration.
    console.error(msg);
  }

  function fail(api) {
    var msg = 'IBR obsidian-stub: unstubbed API used: ' + api;
    record(msg);
    throw new Error(msg);
  }

  // Reads that JS itself performs on any value (typeof checks, class extends,
  // promise resolution). Throwing on these would break the mount for APIs the
  // plugin merely destructures, so they resolve quietly; USE still throws.
  var PASSIVE = { then: 1, constructor: 1, prototype: 1, name: 1, length: 1, valueOf: 1, toString: 1, inspect: 1, nodeType: 1 };

  function loudStub(name) {
    var target = function () {};
    Object.defineProperty(target, 'name', { value: name });
    return new Proxy(target, {
      get: function (t, prop) {
        if (typeof prop === 'symbol') return t[prop];
        if (Object.prototype.hasOwnProperty.call(PASSIVE, prop)) return t[prop];
        fail(name + '.' + String(prop));
      },
      apply: function () { fail(name + '()'); },
      construct: function () { fail('new ' + name + '()'); },
    });
  }

  var noop = function () {};

  function Component() {}
  Component.prototype.load = noop;
  Component.prototype.unload = noop;
  Component.prototype.onload = noop;
  Component.prototype.onunload = noop;
  Component.prototype.addChild = function (c) { return c; };
  Component.prototype.removeChild = function (c) { return c; };
  Component.prototype.register = noop;
  Component.prototype.registerEvent = noop;
  Component.prototype.registerInterval = function (id) { return id; };
  Component.prototype.registerDomEvent = function (el, type, fn, opts) {
    if (el && el.addEventListener) el.addEventListener(type, fn, opts);
  };

  function ItemView(leaf, plugin) {
    Component.call(this);
    this.leaf = leaf;
    this.plugin = plugin;
    this.app = (leaf && leaf.app) || {};
    this.containerEl = (leaf && leaf.containerEl) || null;
  }
  ItemView.prototype = Object.create(Component.prototype);
  ItemView.prototype.constructor = ItemView;
  ItemView.prototype.getViewType = function () { return 'ibr-stub-view'; };
  ItemView.prototype.getDisplayText = function () { return 'IBR Stub View'; };
  ItemView.prototype.getIcon = function () { return 'document'; };
  ItemView.prototype.onOpen = function () { return Promise.resolve(); };
  ItemView.prototype.onClose = function () { return Promise.resolve(); };

  function Modal(app) {
    Component.call(this);
    this.app = app;
    this.containerEl = document.createElement('div');
    this.modalEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.titleEl = document.createElement('div');
    this.modalEl.appendChild(this.titleEl);
    this.modalEl.appendChild(this.contentEl);
    this.containerEl.appendChild(this.modalEl);
  }
  Modal.prototype = Object.create(Component.prototype);
  Modal.prototype.constructor = Modal;
  Modal.prototype.open = function () {
    document.body.appendChild(this.containerEl);
    if (typeof this.onOpen === 'function') this.onOpen();
  };
  Modal.prototype.close = function () {
    if (typeof this.onClose === 'function') this.onClose();
    if (this.containerEl.parentNode) this.containerEl.parentNode.removeChild(this.containerEl);
  };

  function Plugin(app, manifest) { Component.call(this); this.app = app; this.manifest = manifest; }
  Plugin.prototype = Object.create(Component.prototype);
  Plugin.prototype.constructor = Plugin;
  Plugin.prototype.addRibbonIcon = function () { return document.createElement('div'); };
  Plugin.prototype.addStatusBarItem = function () { return document.createElement('div'); };
  Plugin.prototype.addCommand = function (c) { return c; };
  Plugin.prototype.addSettingTab = noop;
  Plugin.prototype.registerView = noop;
  Plugin.prototype.loadData = function () { return Promise.resolve(null); };
  Plugin.prototype.saveData = function () { return Promise.resolve(); };

  function PluginSettingTab(app, plugin) {
    Component.call(this);
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  PluginSettingTab.prototype = Object.create(Component.prototype);
  PluginSettingTab.prototype.constructor = PluginSettingTab;
  PluginSettingTab.prototype.display = noop;
  PluginSettingTab.prototype.hide = noop;

  // Chainable no-op; every add*() yields a control whose own setters chain too,
  // so a settings tab renders its container without a real Obsidian app.
  function chainableControl() {
    var c = {};
    ['setValue', 'setPlaceholder', 'setDisabled', 'onChange', 'onClick', 'setButtonText',
      'setCta', 'setWarning', 'setIcon', 'setTooltip', 'setDynamicTooltip', 'addOption',
      'addOptions', 'setLimits', 'setInstant', 'then'].forEach(function (m) {
      c[m] = function () { return c; };
    });
    c.inputEl = document.createElement('input');
    c.buttonEl = document.createElement('button');
    c.selectEl = document.createElement('select');
    c.toggleEl = document.createElement('div');
    c.sliderEl = document.createElement('input');
    return c;
  }
  function Setting(containerEl) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement('div');
    this.infoEl = document.createElement('div');
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
    this.controlEl = document.createElement('div');
    if (containerEl && containerEl.appendChild) containerEl.appendChild(this.settingEl);
  }
  ['setName', 'setDesc', 'setClass', 'setHeading', 'setDisabled', 'setTooltip', 'then', 'clear'].forEach(function (m) {
    Setting.prototype[m] = function () { return this; };
  });
  ['addText', 'addTextArea', 'addToggle', 'addDropdown', 'addButton', 'addExtraButton',
    'addSlider', 'addSearch', 'addMomentFormat', 'addColorPicker', 'addProgressBar'].forEach(function (m) {
    Setting.prototype[m] = function (cb) { if (typeof cb === 'function') cb(chainableControl()); return this; };
  });

  function Menu() { this.items = []; }
  Menu.prototype.addItem = function (cb) {
    var item = {};
    ['setTitle', 'setIcon', 'setChecked', 'setDisabled', 'setSection', 'onClick'].forEach(function (m) {
      item[m] = function () { return item; };
    });
    if (typeof cb === 'function') cb(item);
    this.items.push(item);
    return this;
  };
  Menu.prototype.addSeparator = function () { return this; };
  Menu.prototype.showAtMouseEvent = noop;
  Menu.prototype.showAtPosition = noop;
  Menu.prototype.hide = noop;

  function Notice(message) {
    this.message = message;
    window.__IBR_NOTICES = window.__IBR_NOTICES || [];
    window.__IBR_NOTICES.push(String(message));
    this.noticeEl = document.createElement('div');
  }
  Notice.prototype.setMessage = function (m) { this.message = m; return this; };
  Notice.prototype.hide = noop;

  function TFile() { this.path = ''; this.name = ''; this.basename = ''; this.extension = ''; }
  function TFolder() { this.path = ''; this.name = ''; this.children = []; }

  var known = {
    Component: Component,
    ItemView: ItemView,
    View: ItemView,
    Modal: Modal,
    Plugin: Plugin,
    PluginSettingTab: PluginSettingTab,
    Setting: Setting,
    Menu: Menu,
    Notice: Notice,
    TFile: TFile,
    TFolder: TFolder,
    TAbstractFile: TFile,
    Platform: {
      isMobile: ${isMobile},
      isDesktop: !${isMobile},
      isPhone: ${isMobile},
      isTablet: false,
      isMobileApp: ${isMobile},
      isDesktopApp: !${isMobile},
      isIosApp: false,
      isAndroidApp: false,
      isMacOS: true,
      isWin: false,
      isLinux: false,
      isSafari: false,
    },
    setIcon: function (el, name) {
      if (!el || !el.setAttribute) return;
      el.setAttribute('data-icon', String(name));
      el.classList.add('ibr-stub-icon');
    },
    getIcon: function () { return null; },
    setTooltip: function (el, text) { if (el && el.setAttribute) el.setAttribute('aria-label', String(text)); },
    requestUrl: function () {
      return Promise.resolve({ status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), json: {}, text: '' });
    },
    request: function () { return Promise.resolve(''); },
    normalizePath: function (p) { return String(p).replace(/\\\\/g, '/').replace(/^\\/+|\\/+$/g, ''); },
    debounce: function (fn, timeout) {
      var t = null;
      var wrapped = function () {
        var args = arguments, self = this;
        if (t) clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, timeout || 0);
      };
      wrapped.cancel = function () { if (t) clearTimeout(t); return wrapped; };
      wrapped.run = function () { return wrapped; };
      return wrapped;
    },
    addIcon: noop,
    parseYaml: function () { return {}; },
    stringifyYaml: function () { return ''; },
    sanitizeHTMLToDom: function (html) {
      var t = document.createElement('template');
      t.innerHTML = String(html);
      return t.content;
    },
    MarkdownRenderer: { render: function () { return Promise.resolve(); }, renderMarkdown: function () { return Promise.resolve(); } },
  };

  // Any obsidian export not modeled above resolves to a loud stub. This is the
  // difference between "the harness told you setIcon2 is missing" and "undefined
  // is not a function, somewhere, 200 lines into a bundle".
  var obsidian = new Proxy(known, {
    get: function (t, prop) {
      if (typeof prop === 'symbol') return t[prop];
      if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
      if (Object.prototype.hasOwnProperty.call(PASSIVE, prop)) return undefined;
      return loudStub('obsidian.' + String(prop));
    },
    has: function () { return true; },
  });

  window.__IBR_OBSIDIAN = obsidian;
  window.module = { exports: {} };
  window.exports = window.module.exports;
  window.require = function (name) {
    if (name === 'obsidian') return obsidian;
    fail('require("' + name + '")');
  };
})();
`;
}
