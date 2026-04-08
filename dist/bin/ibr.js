#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/engine/cdp/connection.ts
var DEFAULT_TIMEOUT_MS, CdpConnection;
var init_connection = __esm({
  "src/engine/cdp/connection.ts"() {
    "use strict";
    DEFAULT_TIMEOUT_MS = 3e4;
    CdpConnection = class {
      ws = null;
      nextId = 0;
      pending = /* @__PURE__ */ new Map();
      eventHandlers = /* @__PURE__ */ new Map();
      timeoutMs;
      constructor(options) {
        this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      }
      async connect(wsUrl) {
        return new Promise((resolve5, reject) => {
          const ws = new WebSocket(wsUrl);
          let settled = false;
          const onOpen = () => {
            if (settled) return;
            settled = true;
            this.ws = ws;
            ws.addEventListener("message", (event) => this.handleMessage(event));
            ws.addEventListener("close", () => this.handleClose());
            ws.addEventListener("error", () => this.handleClose());
            resolve5();
          };
          const onError = () => {
            if (settled) return;
            settled = true;
            reject(new Error(`WebSocket connection failed: ${wsUrl}`));
          };
          ws.addEventListener("open", onOpen);
          ws.addEventListener("error", onError);
        });
      }
      async send(method, params, sessionId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          throw new Error("Not connected");
        }
        const id = ++this.nextId;
        return new Promise((resolve5, reject) => {
          const timer = setTimeout(() => {
            if (this.pending.has(id)) {
              this.pending.delete(id);
              const secs = (this.timeoutMs / 1e3).toFixed(0);
              reject(new Error(
                `CDP request '${method}' timed out after ${secs}s. The browser may be unresponsive or the operation is taking too long.`
              ));
            }
          }, this.timeoutMs);
          this.pending.set(id, {
            resolve: resolve5,
            reject,
            timer
          });
          const msg = { id, method };
          if (params) msg.params = params;
          if (sessionId) msg.sessionId = sessionId;
          this.ws.send(JSON.stringify(msg));
        });
      }
      on(method, handler) {
        if (!this.eventHandlers.has(method)) {
          this.eventHandlers.set(method, /* @__PURE__ */ new Set());
        }
        this.eventHandlers.get(method).add(handler);
      }
      off(method, handler) {
        this.eventHandlers.get(method)?.delete(handler);
      }
      handleMessage(event) {
        let data;
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if ("id" in data && this.pending.has(data.id)) {
          const id = data.id;
          const { resolve: resolve5, reject, timer } = this.pending.get(id);
          clearTimeout(timer);
          this.pending.delete(id);
          if (data.error) {
            const err = data.error;
            reject(new Error(`CDP error ${err.code}: ${err.message}`));
          } else {
            resolve5(data.result);
          }
        } else if ("method" in data) {
          const handlers = this.eventHandlers.get(data.method);
          if (handlers) {
            for (const handler of handlers) handler(data.params);
          }
        }
      }
      handleClose() {
        for (const [, { reject, timer }] of this.pending) {
          clearTimeout(timer);
          reject(new Error("WebSocket closed"));
        }
        this.pending.clear();
        this.ws = null;
      }
      async close() {
        for (const [, { timer }] of this.pending) {
          clearTimeout(timer);
        }
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.pending.clear();
      }
      get connected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
      }
    };
  }
});

// src/engine/cdp/browser.ts
function findChrome() {
  for (const p of CHROME_PATHS) {
    if ((0, import_node_fs.existsSync)(p)) return p;
  }
  return null;
}
function randomPort() {
  return 49152 + Math.floor(Math.random() * (65535 - 49152));
}
async function findFreePort(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = randomPort();
    const isFree = await checkPortFree(port);
    if (isFree) return port;
  }
  return new Promise((resolve5, reject) => {
    const srv = (0, import_node_net.createServer)();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve5(port));
    });
    srv.on("error", reject);
  });
}
function checkPortFree(port) {
  return new Promise((resolve5) => {
    const srv = (0, import_node_net.createServer)();
    srv.once("error", () => resolve5(false));
    srv.listen(port, () => srv.close(() => resolve5(true)));
  });
}
var import_node_child_process, import_node_fs, import_promises, import_node_net, import_node_os, import_node_path, CHROME_PATHS, BrowserManager;
var init_browser = __esm({
  "src/engine/cdp/browser.ts"() {
    "use strict";
    import_node_child_process = require("child_process");
    import_node_fs = require("fs");
    import_promises = require("fs/promises");
    import_node_net = require("net");
    import_node_os = require("os");
    import_node_path = require("path");
    CHROME_PATHS = [
      // macOS
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      // Linux
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      // Windows (WSL)
      "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    ];
    BrowserManager = class {
      process = null;
      _port = 0;
      async launch(options = {}) {
        const headless = options.headless ?? true;
        this._port = options.port ?? await findFreePort();
        let userDataDir = options.userDataDir ?? (0, import_node_path.join)((0, import_node_os.homedir)(), ".ibr", "chromium-profile");
        const lockPath = (0, import_node_path.join)(userDataDir, "SingletonLock");
        if ((0, import_node_fs.existsSync)(lockPath)) {
          userDataDir = (0, import_node_fs.mkdtempSync)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "ibr-chrome-"));
        }
        const chromePath = options.chromePath ?? findChrome();
        if (!chromePath) {
          throw new Error(
            `Chrome not found. Install Google Chrome or pass chromePath option.
Checked: ${CHROME_PATHS.join(", ")}`
          );
        }
        await (0, import_promises.mkdir)(userDataDir, { recursive: true });
        const args = [
          `--remote-debugging-port=${this._port}`,
          `--user-data-dir=${userDataDir}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-sync"
        ];
        if (headless) {
          args.push("--headless=new");
        }
        if (options.normalize) {
          args.push("--disable-lcd-text");
          args.push("--force-device-scale-factor=1");
        }
        this.process = (0, import_node_child_process.spawn)(chromePath, args, { stdio: "pipe" });
        this.process.on("error", (err) => {
          console.error(`Chrome process error: ${err.message}`);
        });
        return this.waitForDebugger();
      }
      async waitForDebugger() {
        const maxAttempts = 50;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${this._port}/json/version`);
            const data = await res.json();
            return data.webSocketDebuggerUrl;
          } catch {
            await new Promise((r) => setTimeout(r, 100));
          }
        }
        throw new Error(
          `Chrome debugger did not respond within 5s on port ${this._port}. Is another Chrome instance using this port?`
        );
      }
      async close() {
        if (!this.process) return;
        const proc = this.process;
        this.process = null;
        await new Promise((resolve5) => {
          const killTimer = setTimeout(() => {
            try {
              proc.kill("SIGKILL");
            } catch {
            }
            resolve5();
          }, 3e3);
          proc.once("close", () => {
            clearTimeout(killTimer);
            resolve5();
          });
          proc.kill("SIGTERM");
        });
      }
      get running() {
        return this.process !== null && !this.process.killed;
      }
      get port() {
        return this._port;
      }
      get pid() {
        return this.process?.pid ?? null;
      }
    };
  }
});

// src/engine/cdp/target.ts
var TargetDomain;
var init_target = __esm({
  "src/engine/cdp/target.ts"() {
    "use strict";
    TargetDomain = class {
      constructor(conn) {
        this.conn = conn;
      }
      async createPage(url) {
        const result = await this.conn.send(
          "Target.createTarget",
          { url }
        );
        return result.targetId;
      }
      async attach(targetId) {
        const result = await this.conn.send(
          "Target.attachToTarget",
          { targetId, flatten: true }
        );
        return result.sessionId;
      }
      async close(targetId) {
        await this.conn.send("Target.closeTarget", { targetId });
      }
      async list() {
        const result = await this.conn.send("Target.getTargets");
        return result.targetInfos;
      }
    };
  }
});

// src/engine/cdp/page.ts
var PageDomain;
var init_page = __esm({
  "src/engine/cdp/page.ts"() {
    "use strict";
    PageDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async navigate(url) {
        const result = await this.conn.send(
          "Page.navigate",
          { url },
          this.sessionId
        );
        return result.frameId;
      }
      async screenshot(options = {}) {
        const format = options.format ?? "png";
        if (options.fullPage) {
          return this.fullPageScreenshot(format, options.quality);
        }
        const params = { format };
        if (options.quality !== void 0) params.quality = options.quality;
        if (options.clip) {
          params.clip = { ...options.clip, scale: options.clip.scale ?? 1 };
        }
        const result = await this.conn.send(
          "Page.captureScreenshot",
          params,
          this.sessionId
        );
        return Buffer.from(result.data, "base64");
      }
      /**
       * Full-page screenshot via getLayoutMetrics + device metrics override.
       * Technique: get content size → override viewport to content size →
       * capture with captureBeyondViewport → restore viewport.
       */
      async fullPageScreenshot(format, quality) {
        const metrics = await this.getLayoutMetrics();
        const { width, height } = metrics.contentSize;
        await this.conn.send("Emulation.setDeviceMetricsOverride", {
          width: Math.ceil(width),
          height: Math.ceil(height),
          deviceScaleFactor: 1,
          mobile: false
        }, this.sessionId);
        try {
          const params = {
            format,
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width, height, scale: 1 }
          };
          if (quality !== void 0) params.quality = quality;
          const result = await this.conn.send(
            "Page.captureScreenshot",
            params,
            this.sessionId
          );
          return Buffer.from(result.data, "base64");
        } finally {
          await this.conn.send("Emulation.clearDeviceMetricsOverride", {}, this.sessionId);
        }
      }
      async getLayoutMetrics() {
        return this.conn.send(
          "Page.getLayoutMetrics",
          {},
          this.sessionId
        );
      }
      async enableLifecycleEvents() {
        await this.conn.send("Page.setLifecycleEventsEnabled", { enabled: true }, this.sessionId);
        await this.conn.send("Page.enable", {}, this.sessionId);
      }
      /**
       * Inject CSS into the page.
       * Uses callFunctionOn with CSS passed as a proper argument (not interpolated)
       * to avoid injection issues with special characters in CSS content.
       */
      async addStyleTag(css) {
        const docResult = await this.conn.send("Runtime.evaluate", {
          expression: "document",
          returnByValue: false
        }, this.sessionId);
        await this.conn.send("Runtime.callFunctionOn", {
          functionDeclaration: '(cssText) => { const style = document.createElement("style"); style.textContent = cssText; document.head.appendChild(style); }',
          objectId: docResult.result.objectId,
          arguments: [{ value: css }],
          returnByValue: true
        }, this.sessionId);
      }
      /**
       * Inject script that runs on every navigation (including future ones).
       * Uses Page.addScriptToEvaluateOnNewDocument.
       */
      async addScriptOnLoad(source) {
        const result = await this.conn.send(
          "Page.addScriptToEvaluateOnNewDocument",
          { source },
          this.sessionId
        );
        return result.identifier;
      }
    };
  }
});

// src/engine/normalize.ts
function normalizeRole(rawRole, platform) {
  if (platform === "web") return WEB_ROLES[rawRole] ?? "group";
  return MACOS_ROLES[rawRole] ?? "group";
}
var WEB_ROLES, MACOS_ROLES;
var init_normalize = __esm({
  "src/engine/normalize.ts"() {
    "use strict";
    WEB_ROLES = {
      button: "button",
      textbox: "textfield",
      TextField: "textfield",
      link: "link",
      checkbox: "checkbox",
      switch: "switch",
      slider: "slider",
      tab: "tab",
      combobox: "select",
      listbox: "select",
      heading: "heading",
      img: "image",
      image: "image",
      StaticText: "text",
      group: "group",
      generic: "group",
      navigation: "group",
      main: "group",
      contentinfo: "group",
      banner: "group",
      form: "group",
      search: "group",
      region: "group",
      article: "group",
      section: "group",
      complementary: "group"
    };
    MACOS_ROLES = {
      AXButton: "button",
      AXTextField: "textfield",
      AXTextArea: "textfield",
      AXLink: "link",
      AXCheckBox: "checkbox",
      AXSwitch: "switch",
      AXSlider: "slider",
      AXTab: "tab",
      AXRadioButton: "tab",
      AXPopUpButton: "select",
      AXComboBox: "select",
      AXStaticText: "text",
      AXImage: "image",
      AXGroup: "group",
      AXWindow: "group",
      AXScrollArea: "group",
      AXToolbar: "group",
      AXSplitGroup: "group",
      AXList: "group",
      AXOutline: "group",
      AXTable: "group",
      AXRow: "group",
      AXColumn: "group",
      AXCell: "group"
    };
  }
});

// src/engine/cdp/accessibility.ts
var SKIP_ROLES, AccessibilityDomain;
var init_accessibility = __esm({
  "src/engine/cdp/accessibility.ts"() {
    "use strict";
    init_normalize();
    SKIP_ROLES = /* @__PURE__ */ new Set(["WebArea", "RootWebArea", "GenericContainer", "none", "IgnoredRole"]);
    AccessibilityDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      nodeMap = /* @__PURE__ */ new Map();
      // elementId → backendDOMNodeId
      loadCompleteHandlers = /* @__PURE__ */ new Set();
      nodesUpdatedHandlers = /* @__PURE__ */ new Set();
      enabled = false;
      // Stored references for cleanup
      loadCompleteListener = null;
      nodesUpdatedListener = null;
      async enable() {
        if (this.enabled) return;
        this.enabled = true;
        await this.conn.send("Accessibility.enable", {}, this.sessionId);
        this.loadCompleteListener = () => {
          for (const handler of this.loadCompleteHandlers) handler();
        };
        this.nodesUpdatedListener = (params) => {
          const { nodes } = params;
          for (const handler of this.nodesUpdatedHandlers) handler(nodes);
        };
        this.conn.on("Accessibility.loadComplete", this.loadCompleteListener);
        this.conn.on("Accessibility.nodesUpdated", this.nodesUpdatedListener);
      }
      async disable() {
        if (!this.enabled) return;
        this.enabled = false;
        if (this.loadCompleteListener) {
          this.conn.off("Accessibility.loadComplete", this.loadCompleteListener);
          this.loadCompleteListener = null;
        }
        if (this.nodesUpdatedListener) {
          this.conn.off("Accessibility.nodesUpdated", this.nodesUpdatedListener);
          this.nodesUpdatedListener = null;
        }
      }
      async getSnapshot() {
        const result = await this.conn.send(
          "Accessibility.getFullAXTree",
          {},
          this.sessionId
        );
        return this.convertToElements(result.nodes);
      }
      /**
       * queryAXTree — CDP-native search by accessible name and/or role.
       * Faster than getFullAXTree + filter for targeted element finding.
       * Note: does NOT clear/repopulate nodeMap — merges into existing map.
       */
      async queryAXTree(options) {
        const params = {};
        if (options.accessibleName) params.accessibleName = options.accessibleName;
        if (options.role) params.role = options.role;
        if (options.backendNodeId) {
          params.backendNodeId = options.backendNodeId;
        } else {
          const doc = await this.conn.send(
            "DOM.getDocument",
            {},
            this.sessionId
          );
          params.nodeId = doc.root.nodeId;
        }
        try {
          const result = await this.conn.send(
            "Accessibility.queryAXTree",
            params,
            this.sessionId
          );
          return this.convertToElements(result.nodes, false);
        } catch {
          return [];
        }
      }
      getBackendNodeId(elementId) {
        return this.nodeMap.get(elementId);
      }
      /** Subscribe to Accessibility.loadComplete events. */
      onLoadComplete(handler) {
        this.loadCompleteHandlers.add(handler);
      }
      /** Subscribe to Accessibility.nodesUpdated events. */
      onNodesUpdated(handler) {
        this.nodesUpdatedHandlers.add(handler);
      }
      offLoadComplete(handler) {
        this.loadCompleteHandlers.delete(handler);
      }
      offNodesUpdated(handler) {
        this.nodesUpdatedHandlers.delete(handler);
      }
      /**
       * Convert CDP AX nodes to Elements.
       * @param clearMap If true (default), clears nodeMap first. Set false for queryAXTree
       *   to merge results into existing map without invalidating prior IDs.
       */
      convertToElements(nodes, clearMap = true) {
        const elements = [];
        if (clearMap) {
          this.nodeMap.clear();
        }
        for (const node of nodes) {
          if (SKIP_ROLES.has(node.role.value)) continue;
          const role = normalizeRole(node.role.value, "web");
          const label = node.name?.value ?? "";
          if (role === "group" && !label) continue;
          const id = node.backendDOMNodeId ? `e${node.backendDOMNodeId}` : `ex${Math.random().toString(36).slice(2, 8)}`;
          const el = {
            id,
            role,
            label,
            value: node.value?.value ?? null,
            enabled: this.getProperty(node, "disabled") !== true,
            focused: this.getProperty(node, "focused") === true,
            actions: this.inferActions(role),
            bounds: [0, 0, 0, 0],
            parent: null
          };
          if (node.backendDOMNodeId) {
            this.nodeMap.set(el.id, node.backendDOMNodeId);
          }
          elements.push(el);
        }
        return elements;
      }
      getProperty(node, name) {
        return node.properties?.find((p) => p.name === name)?.value?.value;
      }
      inferActions(role) {
        switch (role) {
          case "button":
          case "link":
          case "checkbox":
          case "tab":
          case "switch":
            return ["press"];
          case "textfield":
            return ["setValue"];
          case "slider":
            return ["increment", "decrement", "setValue"];
          case "select":
            return ["press", "showMenu"];
          default:
            return [];
        }
      }
    };
  }
});

// src/engine/cdp/dom.ts
var DomDomain;
var init_dom = __esm({
  "src/engine/cdp/dom.ts"() {
    "use strict";
    DomDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async getElementCenter(backendNodeId) {
        const result = await this.conn.send("DOM.getBoxModel", { backendNodeId }, this.sessionId);
        const q = result.model.content;
        const x = Math.round((q[0] + q[2] + q[4] + q[6]) / 4);
        const y = Math.round((q[1] + q[3] + q[5] + q[7]) / 4);
        return { x, y };
      }
      async getBoxModel(backendNodeId) {
        const result = await this.conn.send("DOM.getBoxModel", { backendNodeId }, this.sessionId);
        return result.model;
      }
      async getDocument() {
        return this.conn.send("DOM.getDocument", {}, this.sessionId);
      }
      /**
       * Find a single element by CSS selector.
       * Returns the nodeId, or null if not found.
       */
      async querySelector(nodeId, selector) {
        try {
          const result = await this.conn.send(
            "DOM.querySelector",
            { nodeId, selector },
            this.sessionId
          );
          return result.nodeId > 0 ? result.nodeId : null;
        } catch {
          return null;
        }
      }
      /**
       * Find all elements matching a CSS selector.
       * Returns array of nodeIds.
       */
      async querySelectorAll(nodeId, selector) {
        try {
          const result = await this.conn.send(
            "DOM.querySelectorAll",
            { nodeId, selector },
            this.sessionId
          );
          return result.nodeIds.filter((id) => id > 0);
        } catch {
          return [];
        }
      }
      /**
       * Get the outer HTML of a node.
       */
      async getOuterHTML(nodeId, backendNodeId) {
        const params = {};
        if (nodeId !== void 0) params.nodeId = nodeId;
        if (backendNodeId !== void 0) params.backendNodeId = backendNodeId;
        const result = await this.conn.send(
          "DOM.getOuterHTML",
          params,
          this.sessionId
        );
        return result.outerHTML;
      }
      /**
       * Get attributes of a node as key-value pairs.
       */
      async getAttributes(nodeId) {
        const result = await this.conn.send(
          "DOM.getAttributes",
          { nodeId },
          this.sessionId
        );
        const attrs = {};
        for (let i = 0; i < result.attributes.length; i += 2) {
          attrs[result.attributes[i]] = result.attributes[i + 1];
        }
        return attrs;
      }
    };
  }
});

// src/engine/cdp/input.ts
function charToCode(char) {
  if (SPECIAL_CODES[char]) return SPECIAL_CODES[char];
  const upper = char.toUpperCase();
  if (upper >= "A" && upper <= "Z") return `Key${upper}`;
  return "";
}
var InputDomain, SPECIAL_KEYS, SPECIAL_CODES;
var init_input = __esm({
  "src/engine/cdp/input.ts"() {
    "use strict";
    InputDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async click(x, y) {
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1
        }, this.sessionId);
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1
        }, this.sessionId);
      }
      async type(text) {
        for (const char of text) {
          const code = charToCode(char);
          await this.conn.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            text: char,
            key: char,
            code
          }, this.sessionId);
          await this.conn.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: char,
            code
          }, this.sessionId);
        }
      }
      /**
       * Press a special key (Enter, Tab, Escape, Backspace, etc.)
       */
      async pressKey(key) {
        const keyDef = SPECIAL_KEYS[key];
        if (!keyDef) {
          await this.type(key);
          return;
        }
        await this.conn.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: keyDef.key,
          code: keyDef.code,
          text: keyDef.text
        }, this.sessionId);
        await this.conn.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: keyDef.key,
          code: keyDef.code
        }, this.sessionId);
      }
      async hover(x, y) {
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x,
          y
        }, this.sessionId);
      }
      async scroll(x, y, deltaX, deltaY) {
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x,
          y,
          deltaX,
          deltaY
        }, this.sessionId);
      }
    };
    SPECIAL_KEYS = {
      Enter: { key: "Enter", code: "Enter", text: "\r" },
      Tab: { key: "Tab", code: "Tab", text: "	" },
      Escape: { key: "Escape", code: "Escape" },
      Backspace: { key: "Backspace", code: "Backspace" },
      Delete: { key: "Delete", code: "Delete" },
      ArrowUp: { key: "ArrowUp", code: "ArrowUp" },
      ArrowDown: { key: "ArrowDown", code: "ArrowDown" },
      ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft" },
      ArrowRight: { key: "ArrowRight", code: "ArrowRight" },
      Home: { key: "Home", code: "Home" },
      End: { key: "End", code: "End" },
      PageUp: { key: "PageUp", code: "PageUp" },
      PageDown: { key: "PageDown", code: "PageDown" }
    };
    SPECIAL_CODES = {
      " ": "Space",
      "0": "Digit0",
      "1": "Digit1",
      "2": "Digit2",
      "3": "Digit3",
      "4": "Digit4",
      "5": "Digit5",
      "6": "Digit6",
      "7": "Digit7",
      "8": "Digit8",
      "9": "Digit9",
      "`": "Backquote",
      "-": "Minus",
      "=": "Equal",
      "[": "BracketLeft",
      "]": "BracketRight",
      "\\": "Backslash",
      ";": "Semicolon",
      "'": "Quote",
      ",": "Comma",
      ".": "Period",
      "/": "Slash",
      "~": "Backquote",
      "!": "Digit1",
      "@": "Digit2",
      "#": "Digit3",
      "$": "Digit4",
      "%": "Digit5",
      "^": "Digit6",
      "&": "Digit7",
      "*": "Digit8",
      "(": "Digit9",
      ")": "Digit0",
      "_": "Minus",
      "+": "Equal",
      "{": "BracketLeft",
      "}": "BracketRight",
      "|": "Backslash",
      ":": "Semicolon",
      '"': "Quote",
      "<": "Comma",
      ">": "Period",
      "?": "Slash",
      "	": "Tab",
      "\n": "Enter"
    };
  }
});

// src/engine/cdp/runtime.ts
var RuntimeDomain;
var init_runtime = __esm({
  "src/engine/cdp/runtime.ts"() {
    "use strict";
    RuntimeDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      /**
       * Evaluate a JavaScript expression string in the page context.
       */
      async evaluate(expression) {
        const result = await this.conn.send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true
        }, this.sessionId);
        if (result.exceptionDetails) {
          const msg = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
          throw new Error(`Evaluation failed: ${msg}`);
        }
        return result.result.value;
      }
      /**
       * Call a function with structured arguments in the page context.
       * This is the CDP equivalent of Playwright's page.evaluate(fn, ...args).
       *
       * The function declaration is serialized as a string, and arguments
       * are passed as CDP CallArgument objects (primitives by value).
       *
       * Usage:
       *   await runtime.callFunctionOn(
       *     '(selector, prop) => getComputedStyle(document.querySelector(selector))[prop]',
       *     ['.header', 'color']
       *   )
       */
      async callFunctionOn(functionDeclaration, args) {
        const docResult = await this.conn.send("Runtime.evaluate", {
          expression: "document",
          returnByValue: false
        }, this.sessionId);
        const callArgs = args?.map((arg) => {
          if (arg === void 0) return { unserializableValue: "undefined" };
          return { value: arg };
        });
        const result = await this.conn.send("Runtime.callFunctionOn", {
          functionDeclaration,
          objectId: docResult.result.objectId,
          arguments: callArgs,
          returnByValue: true,
          awaitPromise: true
        }, this.sessionId);
        if (result.exceptionDetails) {
          const msg = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
          throw new Error(`callFunctionOn failed: ${msg}`);
        }
        return result.result.value;
      }
      /**
       * Enable the Runtime domain to receive events (like consoleAPICalled).
       */
      async enable() {
        await this.conn.send("Runtime.enable", {}, this.sessionId);
      }
    };
  }
});

// src/engine/cdp/css.ts
var CssDomain;
var init_css = __esm({
  "src/engine/cdp/css.ts"() {
    "use strict";
    CssDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async enable() {
        await this.conn.send("CSS.enable", {}, this.sessionId);
      }
      /**
       * Get computed styles for a DOM node.
       * Returns all computed CSS properties as key-value pairs.
       */
      async getComputedStyle(nodeId) {
        const result = await this.conn.send("CSS.getComputedStyleForNode", { nodeId }, this.sessionId);
        const styles = {};
        for (const { name, value } of result.computedStyle) {
          styles[name] = value;
        }
        return styles;
      }
      /**
       * Get computed styles filtered to specific properties.
       * More efficient when you only need a few properties.
       */
      async getComputedStyleFiltered(nodeId, properties) {
        const all = await this.getComputedStyle(nodeId);
        const filtered = {};
        for (const prop of properties) {
          if (prop in all) {
            filtered[prop] = all[prop];
          }
        }
        return filtered;
      }
      /**
       * Get matched CSS rules for a node — includes inline, attribute,
       * inherited, pseudo-element, and keyframe styles.
       */
      async getMatchedStyles(nodeId) {
        return this.conn.send("CSS.getMatchedStylesForNode", { nodeId }, this.sessionId);
      }
    };
  }
});

// src/engine/cdp/snapshot.ts
var SnapshotDomain;
var init_snapshot = __esm({
  "src/engine/cdp/snapshot.ts"() {
    "use strict";
    SnapshotDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async enable() {
        await this.conn.send("DOMSnapshot.enable", {}, this.sessionId);
      }
      /**
       * Capture full DOM snapshot — one call gets everything.
       * Returns flattened arrays with string deduplication.
       */
      async captureSnapshot(options) {
        return this.conn.send(
          "DOMSnapshot.captureSnapshot",
          {
            computedStyles: options.computedStyles,
            includePaintOrder: options.includePaintOrder,
            includeDOMRects: options.includeDOMRects,
            includeBlendedBackgroundColors: options.includeBlendedBackgroundColors,
            includeTextColorOpacities: options.includeTextColorOpacities
          },
          this.sessionId
        );
      }
      /**
       * Helper: resolve a string index from the snapshot's strings array.
       */
      resolveString(strings, index) {
        return strings[index] ?? "";
      }
      /**
       * Helper: extract computed style values for a layout node.
       *
       * CDP format: `styles[nodeIndex]` is an array of string indices.
       * Each index maps to the value of the corresponding property in the
       * `computedStyles` parameter you passed to `captureSnapshot`.
       * The property names are known — they're the strings you requested.
       *
       * @param strings The strings array from CaptureSnapshotResult
       * @param styleIndices The style indices for one layout node (from LayoutTreeSnapshot.styles[n])
       * @param requestedProperties The computedStyles array you passed to captureSnapshot
       */
      resolveStyles(strings, styleIndices, requestedProperties) {
        const result = {};
        for (let i = 0; i < styleIndices.length && i < requestedProperties.length; i++) {
          const name = requestedProperties[i];
          const value = strings[styleIndices[i]];
          if (name) result[name] = value ?? "";
        }
        return result;
      }
    };
  }
});

// src/engine/cdp/emulation.ts
var EmulationDomain;
var init_emulation = __esm({
  "src/engine/cdp/emulation.ts"() {
    "use strict";
    EmulationDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      /**
       * Override device metrics (viewport size, scale, mobile mode).
       */
      async setDeviceMetrics(config) {
        await this.conn.send("Emulation.setDeviceMetricsOverride", {
          width: config.width,
          height: config.height,
          deviceScaleFactor: config.deviceScaleFactor ?? 1,
          mobile: config.mobile ?? false
        }, this.sessionId);
      }
      /**
       * Clear device metrics override (restore defaults).
       */
      async clearDeviceMetrics() {
        await this.conn.send("Emulation.clearDeviceMetricsOverride", {}, this.sessionId);
      }
      /**
       * Hide scrollbars (useful for consistent screenshots).
       */
      async setScrollbarsHidden(hidden) {
        await this.conn.send("Emulation.setScrollbarsHidden", { hidden }, this.sessionId);
      }
      /**
       * Emulate reduced motion preference (disable animations for screenshots).
       */
      async setReducedMotion(enabled) {
        await this.conn.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value: enabled ? "reduce" : "" }]
        }, this.sessionId);
      }
    };
  }
});

// src/engine/cdp/network.ts
var NetworkDomain;
var init_network = __esm({
  "src/engine/cdp/network.ts"() {
    "use strict";
    NetworkDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      async enable() {
        await this.conn.send("Network.enable", {}, this.sessionId);
      }
      /**
       * Get all cookies, optionally filtered by URLs.
       */
      async getCookies(urls) {
        const params = {};
        if (urls) params.urls = urls;
        const result = await this.conn.send(
          "Network.getCookies",
          params,
          this.sessionId
        );
        return result.cookies;
      }
      /**
       * Set a cookie.
       */
      async setCookie(cookie) {
        const result = await this.conn.send(
          "Network.setCookie",
          cookie,
          this.sessionId
        );
        return result.success;
      }
      /**
       * Set multiple cookies at once.
       */
      async setCookies(cookies) {
        await this.conn.send("Network.setCookies", {
          cookies
        }, this.sessionId);
      }
      /**
       * Clear all browser cookies.
       */
      async clearCookies() {
        await this.conn.send("Network.clearBrowserCookies", {}, this.sessionId);
      }
      /**
       * Delete specific cookies by name and optional URL/domain.
       */
      async deleteCookies(params) {
        await this.conn.send("Network.deleteCookies", params, this.sessionId);
      }
    };
  }
});

// src/engine/cdp/console.ts
var ConsoleDomain;
var init_console = __esm({
  "src/engine/cdp/console.ts"() {
    "use strict";
    ConsoleDomain = class {
      constructor(conn, sessionId) {
        this.conn = conn;
        this.sessionId = sessionId;
      }
      handlers = /* @__PURE__ */ new Set();
      messages = [];
      enabled = false;
      /**
       * Enable console capture.
       * Must call Runtime.enable first to receive consoleAPICalled events.
       */
      async enable() {
        if (this.enabled) return;
        this.enabled = true;
        await this.conn.send("Runtime.enable", {}, this.sessionId);
        this.conn.on("Runtime.consoleAPICalled", (params) => {
          const data = params;
          const text = data.args.map((arg) => arg.value !== void 0 ? String(arg.value) : arg.description ?? "").join(" ");
          const frame = data.stackTrace?.callFrames[0];
          const message = {
            type: data.type,
            text,
            url: frame?.url,
            lineNumber: frame?.lineNumber,
            timestamp: data.timestamp
          };
          this.messages.push(message);
          for (const handler of this.handlers) {
            handler(message);
          }
        });
      }
      /** Subscribe to console messages. */
      onMessage(handler) {
        this.handlers.add(handler);
      }
      offMessage(handler) {
        this.handlers.delete(handler);
      }
      /** Get all captured messages. */
      getMessages() {
        return [...this.messages];
      }
      /** Get only errors and warnings. */
      getErrors() {
        return this.messages.filter((m) => m.type === "error" || m.type === "warning");
      }
      /** Clear captured messages. */
      clear() {
        this.messages = [];
      }
    };
  }
});

// src/engine/cdp/wait.ts
function buildFingerprint(elements) {
  return elements.filter((e) => e.actions.length > 0).map((e) => `${e.role}:${e.label}:${e.enabled}`).sort().join("|");
}
async function waitForStableTree(getSnapshot, options) {
  const interval = options?.interval ?? 100;
  const stableTime = options?.stableTime ?? 300;
  const timeout = options?.timeout ?? 1e4;
  let lastFingerprint = "";
  let stableSince = Date.now();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const elements2 = await getSnapshot();
    const fingerprint = buildFingerprint(elements2);
    if (fingerprint === lastFingerprint) {
      if (Date.now() - stableSince >= stableTime) {
        return { elements: elements2, timedOut: false };
      }
    } else {
      lastFingerprint = fingerprint;
      stableSince = Date.now();
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  const elements = await getSnapshot();
  return { elements, timedOut: true };
}
async function waitForStable(conn, getSnapshot, options) {
  const eventName = options?.eventName ?? "Accessibility.nodesUpdated";
  const timeout = options?.timeout ?? 1e4;
  const stableTime = options?.stableTime ?? 300;
  const deadline = Date.now() + timeout;
  let changed = false;
  const handler = () => {
    changed = true;
  };
  conn.on(eventName, handler);
  let elements = await getSnapshot();
  let lastFingerprint = buildFingerprint(elements);
  let stableSince = Date.now();
  try {
    while (Date.now() < deadline) {
      if (changed) {
        changed = false;
        elements = await getSnapshot();
        const fingerprint = buildFingerprint(elements);
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          stableSince = Date.now();
        }
      }
      if (Date.now() - stableSince >= stableTime) {
        return { elements, timedOut: false };
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    elements = await getSnapshot();
    return { elements, timedOut: true };
  } finally {
    conn.off(eventName, handler);
  }
}
var init_wait = __esm({
  "src/engine/cdp/wait.ts"() {
    "use strict";
  }
});

// src/engine/serialize.ts
function serializeSnapshot(snapshot) {
  const target = snapshot.url ?? snapshot.appName ?? "unknown";
  const lines = [
    `# Page: ${target}`,
    `# Platform: ${snapshot.platform} | Elements: ${snapshot.elements.length}`,
    ""
  ];
  for (const el of snapshot.elements) {
    lines.push(serializeElement(el));
  }
  return lines.join("\n");
}
function serializeElement(el) {
  let line = `[${el.id}] ${el.role} "${el.label}"`;
  const props = [];
  if (el.role === "textfield") {
    if (el.value !== null && el.value !== "") {
      props.push(`value="${el.value}"`);
    } else {
      props.push("empty");
    }
  } else if (el.value !== null && el.value !== "") {
    props.push(`value="${el.value}"`);
  }
  if (el.focused) props.push("focused");
  if (el.role === "button") {
    props.push(el.enabled ? "enabled" : "disabled");
  }
  if (props.length > 0) line += " " + props.join(", ");
  return line;
}
var init_serialize = __esm({
  "src/engine/serialize.ts"() {
    "use strict";
  }
});

// src/engine/observe.ts
function observe(elements, options = {}) {
  let filtered = elements.filter((e) => e.actions.length > 0);
  if (options.role) {
    const role = options.role.toLowerCase();
    filtered = filtered.filter((e) => e.role === role);
  }
  if (options.intent) {
    const words = options.intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      filtered = filtered.filter((e) => {
        const labelLower = e.label.toLowerCase();
        return words.some((w) => labelLower.includes(w));
      });
    }
  }
  const descriptors = filtered.map((el) => ({
    elementId: el.id,
    description: describeAction(el),
    actions: el.actions,
    role: el.role,
    label: el.label,
    serialized: serializeElement(el)
  }));
  if (options.limit && descriptors.length > options.limit) {
    return descriptors.slice(0, options.limit);
  }
  return descriptors;
}
function describeAction(el) {
  const actionVerb = el.actions[0] === "press" ? "Click" : el.actions[0] === "setValue" ? "Type into" : el.actions[0] === "showMenu" ? "Open" : "Interact with";
  const state = el.enabled ? "" : " (disabled)";
  return `${actionVerb} ${el.role} "${el.label}"${state}`;
}
var init_observe = __esm({
  "src/engine/observe.ts"() {
    "use strict";
    init_serialize();
  }
});

// src/engine/extract.ts
function extractFromAXTree(elements, schema) {
  const result = {};
  for (const [fieldName, field] of Object.entries(schema)) {
    const match = findMatchingElement(elements, field);
    if (!match) {
      result[fieldName] = field.extract === "exists" ? false : null;
      continue;
    }
    switch (field.extract) {
      case "text":
        result[fieldName] = match.label || match.value || null;
        break;
      case "value":
        result[fieldName] = match.value || null;
        break;
      case "exists":
        result[fieldName] = true;
        break;
      default:
        result[fieldName] = null;
    }
  }
  return result;
}
function extractList(elements, options) {
  let filtered = elements;
  if (options.role) {
    filtered = filtered.filter((e) => e.role === options.role);
  }
  if (options.labelPattern) {
    filtered = filtered.filter((e) => options.labelPattern.test(e.label));
  }
  const items = filtered.map((e) => ({
    label: e.label,
    value: e.value,
    id: e.id
  }));
  if (options.maxItems) {
    return items.slice(0, options.maxItems);
  }
  return items;
}
function extractPageMeta(elements) {
  return {
    headings: elements.filter((e) => e.role === "heading").map((e) => e.label),
    links: elements.filter((e) => e.role === "link").map((e) => ({ label: e.label, id: e.id })),
    inputs: elements.filter((e) => e.role === "textfield").map((e) => ({ label: e.label, value: e.value, id: e.id })),
    buttons: elements.filter((e) => e.role === "button").map((e) => ({ label: e.label, enabled: e.enabled, id: e.id }))
  };
}
function findMatchingElement(elements, field) {
  for (const el of elements) {
    if (field.role && el.role !== field.role) continue;
    if (field.label) {
      if (!el.label.toLowerCase().includes(field.label.toLowerCase())) continue;
    }
    return el;
  }
  return null;
}
var init_extract = __esm({
  "src/engine/extract.ts"() {
    "use strict";
  }
});

// src/engine/cache.ts
var ResolutionCache;
var init_cache = __esm({
  "src/engine/cache.ts"() {
    "use strict";
    ResolutionCache = class {
      cache = /* @__PURE__ */ new Map();
      maxEntries;
      ttl;
      minConfidence;
      constructor(options = {}) {
        this.maxEntries = options.maxEntries ?? 100;
        this.ttl = options.ttl ?? 5 * 60 * 1e3;
        this.minConfidence = options.minConfidence ?? 0.7;
      }
      /**
       * Look up a cached resolution for an intent.
       * Returns the cached elementId if found and not expired, null otherwise.
       */
      get(intent) {
        const key = this.normalizeKey(intent);
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.createdAt > this.ttl) {
          this.cache.delete(key);
          return null;
        }
        entry.hits++;
        entry.lastHit = Date.now();
        return entry;
      }
      /**
       * Cache a successful resolution.
       * Only caches if confidence meets threshold.
       */
      set(intent, elementId, metadata) {
        if (metadata.confidence < this.minConfidence) return;
        const key = this.normalizeKey(intent);
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
          this.evictOldest();
        }
        this.cache.set(key, {
          intent,
          elementId,
          role: metadata.role,
          label: metadata.label,
          confidence: metadata.confidence,
          createdAt: Date.now(),
          hits: 0,
          lastHit: 0
        });
      }
      /**
       * Invalidate a specific cache entry (e.g., when element is gone).
       */
      invalidate(intent) {
        this.cache.delete(this.normalizeKey(intent));
      }
      /**
       * Clear all cache entries (e.g., after navigation).
       */
      clear() {
        this.cache.clear();
      }
      /**
       * Get cache statistics.
       */
      stats() {
        let totalHits = 0;
        let totalConfidence = 0;
        for (const entry of this.cache.values()) {
          totalHits += entry.hits;
          totalConfidence += entry.confidence;
        }
        return {
          entries: this.cache.size,
          totalHits,
          avgConfidence: this.cache.size > 0 ? totalConfidence / this.cache.size : 0
        };
      }
      normalizeKey(intent) {
        return intent.toLowerCase().trim();
      }
      evictOldest() {
        let oldest = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache) {
          const lastUsed = entry.lastHit || entry.createdAt;
          if (lastUsed < oldestTime) {
            oldestTime = lastUsed;
            oldest = key;
          }
        }
        if (oldest) this.cache.delete(oldest);
      }
    };
  }
});

// src/engine/modality.ts
function assessUnderstanding(elements, options = {}) {
  const threshold = options.threshold ?? 0.6;
  if (elements.length === 0) {
    return {
      score: 0,
      needsScreenshot: true,
      dimensions: { textQuality: 0, semanticRelevance: 0, structuralClarity: 0, specialCasePenalty: 0 },
      reasoning: "Empty AX tree \u2014 screenshot required for any understanding"
    };
  }
  const textQuality = scoreTextQuality(elements);
  const semanticRelevance = scoreSemanticRelevance(elements);
  const structuralClarity = scoreStructuralClarity(elements);
  const specialCasePenalty = scoreSpecialCases(elements);
  const raw = textQuality * 0.35 + semanticRelevance * 0.3 + structuralClarity * 0.2;
  const score = Math.max(0, Math.min(1, raw - specialCasePenalty));
  const needsScreenshot = score < threshold;
  const reasoning = buildReasoning(score, threshold, { textQuality, semanticRelevance, structuralClarity, specialCasePenalty });
  return {
    score,
    needsScreenshot,
    dimensions: { textQuality, semanticRelevance, structuralClarity, specialCasePenalty },
    reasoning
  };
}
function scoreTextQuality(elements) {
  if (elements.length === 0) return 0;
  let labeled = 0;
  let meaningful = 0;
  for (const el of elements) {
    if (el.label) {
      labeled++;
      if (el.label.length > 1 && /[a-zA-Z]/.test(el.label)) {
        meaningful++;
      }
    }
  }
  const labelRatio = labeled / elements.length;
  const meaningfulRatio = elements.length > 0 ? meaningful / elements.length : 0;
  return labelRatio * 0.4 + meaningfulRatio * 0.6;
}
function scoreSemanticRelevance(elements) {
  const interactive = elements.filter((e) => e.actions.length > 0);
  if (interactive.length === 0) return 0.5;
  let wellLabeled = 0;
  for (const el of interactive) {
    if (el.label && el.label.length > 1) {
      wellLabeled++;
    }
  }
  return wellLabeled / interactive.length;
}
function scoreStructuralClarity(elements) {
  const roles = new Set(elements.map((e) => e.role));
  const roleDiversity = Math.min(1, roles.size / 5);
  const count = elements.length;
  let countScore;
  if (count < 3) {
    countScore = count / 3;
  } else if (count > 500) {
    countScore = Math.max(0.3, 1 - (count - 500) / 2e3);
  } else {
    countScore = 1;
  }
  return roleDiversity * 0.5 + countScore * 0.5;
}
function scoreSpecialCases(elements) {
  let penalty = 0;
  const roles = new Set(elements.map((e) => e.role));
  if (roles.size === 1 && elements.length > 5) {
    penalty += 0.3;
  }
  if (elements.length < 3) {
    penalty += 0.2;
  }
  const interactive = elements.filter((e) => e.actions.length > 0);
  const unlabeled = interactive.filter((e) => !e.label || e.label.length <= 1);
  if (interactive.length > 0 && unlabeled.length / interactive.length > 0.5) {
    penalty += 0.2;
  }
  return Math.min(0.8, penalty);
}
function buildReasoning(score, threshold, dims) {
  const parts = [];
  if (dims.textQuality < 0.4) parts.push("low text quality (many unlabeled elements)");
  if (dims.semanticRelevance < 0.5) parts.push("poor semantic relevance (interactive elements lack labels)");
  if (dims.structuralClarity < 0.4) parts.push("weak structure (low role diversity)");
  if (dims.specialCasePenalty > 0.1) parts.push("special case detected (possible Canvas/custom rendering)");
  if (parts.length === 0) {
    return score >= threshold ? "AX tree provides sufficient understanding \u2014 screenshot not needed" : "AX tree quality is borderline \u2014 screenshot recommended for accuracy";
  }
  const action = score >= threshold ? "AX tree usable despite" : "Screenshot recommended due to";
  return `${action}: ${parts.join(", ")}`;
}
var init_modality = __esm({
  "src/engine/modality.ts"() {
    "use strict";
  }
});

// src/engine/shadow-dom.ts
async function extractShadowElements(runtime) {
  const result = await runtime.evaluate(`
    (function() {
      const found = [];

      function walk(root) {
        const children = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const el of children) {
          // Descend into open shadow roots
          if (el.shadowRoot) {
            const shadowChildren = Array.from(el.shadowRoot.querySelectorAll('*'));
            for (const shadowEl of shadowChildren) {
              const rect = shadowEl.getBoundingClientRect();
              found.push({
                tagName: shadowEl.tagName.toLowerCase(),
                role: shadowEl.getAttribute('role'),
                label: shadowEl.getAttribute('aria-label') || shadowEl.getAttribute('aria-labelledby'),
                textContent: (shadowEl.textContent || '').trim().slice(0, 200) || null,
                bounds: rect.width > 0 || rect.height > 0
                  ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                  : null,
              });
              // Recurse into nested shadow roots
              if (shadowEl.shadowRoot) {
                walk(shadowEl.shadowRoot);
              }
            }
          }
        }
      }

      walk(document);
      return found;
    })()
  `);
  if (!Array.isArray(result)) return [];
  return result.map((item) => ({
    tagName: String(item.tagName ?? "unknown"),
    role: item.role != null ? String(item.role) : null,
    label: item.label != null ? String(item.label) : null,
    textContent: item.textContent != null ? String(item.textContent) : null,
    bounds: item.bounds != null ? item.bounds : null
  }));
}
var init_shadow_dom = __esm({
  "src/engine/shadow-dom.ts"() {
    "use strict";
  }
});

// src/engine/resolve.ts
var resolve_exports = {};
__export(resolve_exports, {
  jaroWinkler: () => jaroWinkler,
  parseSpatialHints: () => parseSpatialHints,
  resolve: () => resolve
});
function resolve(options) {
  if (options.mode === "algorithmic") {
    return resolveAlgorithmic(options);
  }
  const { intent, elements } = options;
  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] };
  }
  const intentLower = intent.toLowerCase();
  const scored = scoreElements(elements, intentLower);
  if (scored.length === 0) {
    return {
      element: elements[0],
      confidence: 0,
      candidates: elements.filter((e) => e.actions.length > 0),
      visionFallback: options.mode === "claude"
    };
  }
  const best = scored[0];
  if (best.score >= 1 || scored.length === 1 && best.score >= 0.5) {
    return {
      element: best.element,
      confidence: best.score
    };
  }
  const threshold = best.score * 0.8;
  const candidates = scored.filter((s) => s.score >= threshold).map((s) => s.element);
  const result = {
    element: best.element,
    confidence: best.score,
    candidates: candidates.length > 1 ? candidates : void 0
  };
  if (best.score < 0.3 && options.mode === "claude") {
    result.visionFallback = true;
  }
  return result;
}
function scoreElements(elements, intentLower) {
  const scored = [];
  for (const el of elements) {
    const labelLower = el.label.toLowerCase();
    let score = 0;
    if (labelLower.length === 0) continue;
    const escapedLabel = escapeRegex(labelLower);
    const labelRegex = new RegExp(`\\b${escapedLabel}\\b`, "i");
    if (labelRegex.test(intentLower)) {
      const labelWords = labelLower.trim().split(/\s+/);
      if (labelWords.length > 1) {
        score = 1;
      } else {
        const intentWords = intentLower.split(/\s+/);
        const exactWordMatch = intentWords.includes(labelLower);
        if (exactWordMatch && labelWords[0].length > 1) {
          score = 0.5;
        }
      }
    } else {
      const intentWords = intentLower.split(/\s+/);
      const matchedWords = intentWords.filter(
        (w) => w.length > 2 && labelLower.includes(w)
      );
      if (matchedWords.length > 0) {
        score = 0.5;
      }
    }
    if (intentLower.includes(el.role)) {
      score = Math.min(score + 0.2, 1);
    }
    if (el.actions.length === 0 && score > 0) {
      score *= 0.5;
    }
    if (score > 0) {
      scored.push({ element: el, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolveAlgorithmic(options) {
  const { intent, elements } = options;
  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] };
  }
  const intentLower = intent.toLowerCase();
  const hints = parseSpatialHints(intentLower);
  const cleanedIntent = cleanIntent(intentLower);
  const scored = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let score = 0;
    const roleScore = scoreRole(cleanedIntent, el.role);
    const intentIsOnlyRole = cleanedIntent.trim() === el.role.toLowerCase() || cleanedIntent.trim().split(/\s+/).every((w) => scoreRole(w, el.role) > 0);
    const labelScore = intentIsOnlyRole ? 0 : scoreLabelSimilarity(cleanedIntent, el.label);
    const spatialScore = scoreSpatial(hints, el, i, elements);
    score = roleScore * 0.3 + labelScore * 0.5 + spatialScore * 0.2;
    if (labelScore >= 0.99) {
      score = Math.max(score, 0.75);
    }
    if (score > 0) {
      scored.push({ element: el, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { element: elements[0], confidence: 0, candidates: [] };
  }
  const best = scored[0];
  if (best.score >= 0.7) {
    return {
      element: best.element,
      confidence: best.score
    };
  }
  return {
    element: best.element,
    confidence: best.score,
    candidates: scored.map((s) => s.element)
  };
}
function scoreRole(intent, role) {
  const roleLower = role.toLowerCase();
  const intentWords = intent.split(/\s+/);
  for (const word of intentWords) {
    if (word === roleLower) return 1;
    if (word === "btn" && roleLower === "button") return 0.8;
    if (word === "input" && roleLower === "textfield") return 0.8;
    if (word === "text" && roleLower === "textfield") return 0.6;
  }
  return 0;
}
function scoreLabelSimilarity(intent, label) {
  if (!label) return 0;
  const labelLower = label.toLowerCase();
  if (intent.includes(labelLower)) return 1;
  if (labelLower.includes(intent.trim())) return 0.9;
  const jw = jaroWinkler(intent, labelLower);
  const intentWords = intent.split(/\s+/).filter((w) => w.length > 2);
  let bestWordJw = 0;
  for (const word of intentWords) {
    bestWordJw = Math.max(bestWordJw, jaroWinkler(word, labelLower));
  }
  const labelWords = labelLower.split(/\s+/).filter((w) => w.length > 2);
  let bestLabelWordJw = 0;
  for (const lw of labelWords) {
    for (const iw of intentWords) {
      bestLabelWordJw = Math.max(bestLabelWordJw, jaroWinkler(iw, lw));
    }
  }
  return Math.max(jw, bestWordJw, bestLabelWordJw);
}
function parseSpatialHints(intent) {
  const hints = {};
  if (/\bfirst\b/.test(intent)) hints.position = "first";
  else if (/\blast\b/.test(intent)) hints.position = "last";
  else if (/\btop\b/.test(intent)) hints.position = "top";
  else if (/\bbottom\b/.test(intent)) hints.position = "bottom";
  const nearMatch = intent.match(/\b(?:next to|near|beside|by)\s+(.+?)(?:\s*$)/);
  if (nearMatch) hints.near = nearMatch[1].trim();
  return hints;
}
function scoreSpatial(hints, _el, index, allElements) {
  if (!hints.position && !hints.near) return 0;
  let score = 0;
  if (hints.position) {
    switch (hints.position) {
      case "first":
      case "top":
        score = Math.max(0, 1 - index / Math.max(allElements.length - 1, 1));
        break;
      case "last":
      case "bottom":
        score = index / Math.max(allElements.length - 1, 1);
        break;
    }
  }
  if (hints.near) {
    const nearLower = hints.near.toLowerCase();
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].label.toLowerCase().includes(nearLower)) {
        const distance = Math.abs(index - i);
        if (distance > 0 && distance <= 3) {
          score = Math.max(score, 1 - (distance - 1) * 0.3);
        }
        break;
      }
    }
  }
  return score;
}
function cleanIntent(intent) {
  return intent.replace(/\b(first|last|top|bottom)\b/g, "").replace(/\b(next to|near|beside|by)\s+\S+/g, "").replace(/\b(click|tap|press|select|choose)\b/g, "").replace(/\s+/g, " ").trim();
}
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const jaro = jaroDistance(s1, s2);
  if (jaro === 0) return 0;
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }
  return jaro + prefixLen * 0.1 * (1 - jaro);
}
function jaroDistance(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}
var init_resolve = __esm({
  "src/engine/resolve.ts"() {
    "use strict";
  }
});

// src/engine/driver.ts
var driver_exports = {};
__export(driver_exports, {
  EngineDriver: () => EngineDriver
});
function chunkElements(elements, maxTokens) {
  const charsPerToken = 4;
  const charsPerElement = 40;
  const maxElements = Math.floor(maxTokens * charsPerToken / charsPerElement);
  return elements.slice(0, maxElements);
}
var import_pixelmatch, import_pngjs, EngineDriver;
var init_driver = __esm({
  "src/engine/driver.ts"() {
    "use strict";
    init_connection();
    init_browser();
    init_target();
    init_page();
    init_accessibility();
    init_dom();
    init_input();
    init_runtime();
    init_css();
    init_snapshot();
    init_emulation();
    init_network();
    init_console();
    init_wait();
    import_pixelmatch = __toESM(require("pixelmatch"));
    import_pngjs = require("pngjs");
    init_serialize();
    init_observe();
    init_extract();
    init_cache();
    init_modality();
    init_shadow_dom();
    EngineDriver = class {
      browser = new BrowserManager();
      conn = new CdpConnection();
      // Resolution cache initialized in constructor or with defaults
      target;
      _page;
      ax;
      dom;
      input;
      runtime;
      css;
      snapshot;
      emulation;
      network;
      console;
      targetId = null;
      sessionId = null;
      _currentUrl = "";
      launched = false;
      resolutionCache = new ResolutionCache();
      // ─── Lifecycle ──────────────────────────────────────────
      async launch(options = {}) {
        const wsUrl = await this.browser.launch(options);
        await this.conn.connect(wsUrl);
        this.target = new TargetDomain(this.conn);
        this.launched = true;
        this.targetId = await this.target.createPage("about:blank");
        this.sessionId = await this.target.attach(this.targetId);
        this._page = new PageDomain(this.conn, this.sessionId);
        this.ax = new AccessibilityDomain(this.conn, this.sessionId);
        this.dom = new DomDomain(this.conn, this.sessionId);
        this.input = new InputDomain(this.conn, this.sessionId);
        this.runtime = new RuntimeDomain(this.conn, this.sessionId);
        this.css = new CssDomain(this.conn, this.sessionId);
        this.snapshot = new SnapshotDomain(this.conn, this.sessionId);
        this.emulation = new EmulationDomain(this.conn, this.sessionId);
        this.network = new NetworkDomain(this.conn, this.sessionId);
        this.console = new ConsoleDomain(this.conn, this.sessionId);
        await this._page.enableLifecycleEvents();
        await this.ax.enable();
        await this.console.enable();
        if (options.viewport) {
          await this.emulation.setDeviceMetrics(options.viewport);
        }
      }
      async close() {
        if (this.targetId) {
          await this.target.close(this.targetId).catch(() => {
          });
          this.targetId = null;
        }
        await this.conn.close();
        await this.browser.close();
        this.launched = false;
      }
      /**
       * Release the CDP WebSocket for this driver without terminating the browser.
       * Used by one-shot CLI commands that attach to a shared browser-server via
       * connectExisting() — they must drop their WebSocket at the end of the
       * command so the node process can exit, but the browser-server's Chrome
       * process must keep running for subsequent commands.
       *
       * Closes the per-command tab that was spawned in connectExisting(), then
       * closes the WebSocket. Does NOT call this.browser.close() (which would
       * terminate the whole browser-server process).
       */
      async disconnect() {
        if (this.targetId) {
          await this.target.close(this.targetId).catch(() => {
          });
          this.targetId = null;
        }
        await this.conn.close().catch(() => {
        });
        this.launched = false;
      }
      get isLaunched() {
        return this.launched;
      }
      // ─── Navigation ─────────────────────────────────────────
      async navigate(url, options = {}) {
        const waitFor = options.waitFor ?? "stable";
        await this._page.navigate(url);
        if (waitFor === "stable") {
          await waitForStable(
            this.conn,
            () => this.ax.getSnapshot(),
            { timeout: options.timeout ?? 1e4, eventName: "Accessibility.nodesUpdated" }
          );
        } else if (waitFor === "load") {
          await waitForStableTree(
            () => this.ax.getSnapshot(),
            { timeout: options.timeout ?? 1e4 }
          );
        }
        this._currentUrl = await this.runtime.evaluate("location.href") ?? url;
        this.resolutionCache.clear();
      }
      get url() {
        return this._currentUrl;
      }
      /** BrowserDriver interface: currentUrl alias */
      get currentUrl() {
        return this._currentUrl;
      }
      // ─── Element Discovery (LLM-native) ────────────────────
      /**
       * Discover elements on the page with filtering and chunking.
       * Designed for LLM context windows — returns only actionable elements.
       */
      async discover(options = {}) {
        const filter = options.filter ?? "interactive";
        const elements = await this.ax.getSnapshot();
        let filtered;
        switch (filter) {
          case "interactive":
            filtered = elements.filter((e) => e.actions.length > 0);
            break;
          case "leaf":
            filtered = elements.filter((e) => e.label && e.role !== "group");
            break;
          case "all":
          default:
            filtered = elements;
        }
        if (options.chunk && options.maxTokens) {
          filtered = chunkElements(filtered, options.maxTokens);
        }
        if (options.serialize) {
          const snap = {
            url: this._currentUrl,
            platform: "web",
            elements: filtered,
            timestamp: Date.now()
          };
          return serializeSnapshot(snap);
        }
        return filtered;
      }
      /**
       * 3-tier element resolution with auto-caching:
       * Tier 1: Check cache → Tier 2: queryAXTree → Tier 3: Jaro-Winkler → Tier 4: vision fallback.
       * Delegates to findWithDiagnostics() and returns the matched element or null.
       */
      async find(name, options = {}) {
        const diag = await this.findWithDiagnostics(name, options);
        if (!diag.elementId) return null;
        const elements = await this.ax.getSnapshot();
        return elements.find((e) => e.id === diag.elementId) ?? null;
      }
      /**
       * Like find(), but returns rich diagnostics for agent error feedback.
       * Includes confidence, resolution tier, and fuzzy alternatives when not found.
       */
      async findWithDiagnostics(name, options = {}) {
        const { jaroWinkler: jaroWinkler2 } = await Promise.resolve().then(() => (init_resolve(), resolve_exports));
        const cacheKey = options.role ? `${name}:${options.role}` : name;
        const cached = this.resolutionCache.get(cacheKey);
        if (cached) {
          const elements = await this.ax.getSnapshot();
          const match = elements.find((e) => e.id === cached.elementId);
          if (match) {
            const interactive2 = elements.filter((e) => e.actions.length > 0);
            return {
              elementId: cached.elementId,
              confidence: cached.confidence,
              tier: 1,
              tierName: "cache",
              alternatives: [],
              totalInteractive: interactive2.length
            };
          }
          this.resolutionCache.invalidate(cacheKey);
        }
        const queryResult = await this.ax.queryAXTree({
          accessibleName: name,
          role: options.role
        });
        if (queryResult.length > 0) {
          const el = queryResult[0];
          this.resolutionCache.set(cacheKey, el.id, {
            role: el.role,
            label: el.label,
            confidence: 1
          });
          const allElements2 = await this.ax.getSnapshot();
          const interactive2 = allElements2.filter((e) => e.actions.length > 0);
          return {
            elementId: el.id,
            confidence: 0.95,
            tier: 2,
            tierName: "queryAXTree",
            alternatives: [],
            totalInteractive: interactive2.length
          };
        }
        const { resolve: resolve5 } = await Promise.resolve().then(() => (init_resolve(), resolve_exports));
        const allElements = await this.ax.getSnapshot();
        const interactive = allElements.filter((e) => e.actions.length > 0);
        const result = resolve5({
          intent: options.role ? `${name} ${options.role}` : name,
          elements: allElements,
          mode: "algorithmic"
        });
        if (result.confidence >= 0.5 && result.element) {
          this.resolutionCache.set(cacheKey, result.element.id, {
            role: result.element.role,
            label: result.element.label,
            confidence: result.confidence
          });
          return {
            elementId: result.element.id,
            confidence: result.confidence,
            tier: 3,
            tierName: "jaro-winkler",
            alternatives: [],
            totalInteractive: interactive.length
          };
        }
        const nameLower = name.toLowerCase();
        const scored = interactive.filter((e) => e.label).map((e) => ({
          name: e.label,
          role: e.role,
          score: jaroWinkler2(nameLower, e.label.toLowerCase())
        })).sort((a, b) => b.score - a.score).slice(0, 5);
        let screenshot;
        try {
          const buf = await this.screenshot();
          screenshot = buf.toString("base64");
        } catch {
        }
        return {
          elementId: null,
          confidence: 0,
          tier: 4,
          tierName: "vision",
          alternatives: scored,
          totalInteractive: interactive.length,
          screenshot
        };
      }
      // ─── Interactions ───────────────────────────────────────
      async click(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const sid = this.sessionId ?? void 0;
        let domClickWorked = false;
        try {
          const resolved = await this.conn.send("DOM.resolveNode", { backendNodeId }, sid);
          if (resolved?.object?.objectId) {
            await this.conn.send("Runtime.callFunctionOn", {
              objectId: resolved.object.objectId,
              functionDeclaration: "function() { this.click(); }"
            }, sid);
            domClickWorked = true;
          }
        } catch {
        }
        if (!domClickWorked) {
          const { x, y } = await this.dom.getElementCenter(backendNodeId);
          await this.input.click(x, y);
        }
      }
      async type(elementId, text) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.click(x, y);
        await this.input.type(text);
      }
      async fill(elementId, value) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.click(x, y);
        await this.runtime.callFunctionOn(
          '() => { if (document.activeElement) { document.activeElement.value = ""; document.activeElement.dispatchEvent(new Event("input", { bubbles: true })); } }'
        );
        await this.input.type(value);
      }
      async hover(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.hover(x, y);
      }
      async pressKey(key) {
        await this.input.pressKey(key);
      }
      async scroll(deltaY, x = 0, y = 0) {
        await this.input.scroll(x, y, 0, deltaY);
      }
      // ─── Interaction Assertions ─────────────────────────────
      /**
       * Before/after state capture around an action.
       * Returns element diff and pixel diff.
       */
      async actAndCapture(action) {
        const [beforeElements, beforeScreenshot] = await Promise.all([
          this.ax.getSnapshot(),
          this._page.screenshot()
        ]);
        await action();
        await waitForStableTree(() => this.ax.getSnapshot(), { timeout: 5e3, stableTime: 300 });
        await this.runtime.evaluate(
          "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
        ).catch(() => {
        });
        const [afterElements, afterScreenshot] = await Promise.all([
          this.ax.getSnapshot(),
          this._page.screenshot()
        ]);
        const beforeIds = new Set(beforeElements.map((e) => e.id));
        const afterIds = new Set(afterElements.map((e) => e.id));
        const addedElements = afterElements.filter((e) => !beforeIds.has(e.id));
        const removedElements = beforeElements.filter((e) => !afterIds.has(e.id));
        let pixelDiff = 0;
        try {
          const beforePng = import_pngjs.PNG.sync.read(beforeScreenshot);
          const afterPng = import_pngjs.PNG.sync.read(afterScreenshot);
          if (beforePng.width === afterPng.width && beforePng.height === afterPng.height) {
            const { width, height } = beforePng;
            const diffPng = new import_pngjs.PNG({ width, height });
            pixelDiff = (0, import_pixelmatch.default)(beforePng.data, afterPng.data, diffPng.data, width, height, {
              threshold: 0.1,
              includeAA: false
            });
          }
        } catch {
        }
        return {
          before: { elements: beforeElements, screenshot: beforeScreenshot },
          after: { elements: afterElements, screenshot: afterScreenshot },
          diff: { addedElements, removedElements, pixelDiff }
        };
      }
      /**
       * Set a <select> element's value and dispatch change event.
       */
      async select(elementId, value) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.click(x, y);
        await new Promise((r) => setTimeout(r, 100));
        await this.runtime.callFunctionOn(
          '(val) => { const el = document.activeElement; if (el && el.tagName === "SELECT") { el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } }',
          [value]
        );
      }
      /**
       * Toggle a checkbox element.
       */
      async check(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.click(x, y);
      }
      /**
       * Double-click an element.
       */
      async doubleClick(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        await this.input.click(x, y);
        await new Promise((r) => setTimeout(r, 50));
        await this.input.click(x, y);
      }
      /**
       * Right-click an element (opens context menu).
       */
      async rightClick(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const { x, y } = await this.dom.getElementCenter(backendNodeId);
        const sid = this.sessionId ?? void 0;
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "right",
          buttons: 2,
          clickCount: 1
        }, sid);
        await this.conn.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "right",
          buttons: 0,
          clickCount: 1
        }, sid);
      }
      /**
       * Wait until an element with the given name (and optional role) appears in the AX tree.
       * Polls at 200ms intervals. Throws on timeout.
       */
      async waitForElement(name, options) {
        const timeout = options?.timeout ?? 1e4;
        const deadline = Date.now() + timeout;
        const interval = 200;
        while (Date.now() < deadline) {
          const elements = await this.ax.getSnapshot();
          const match = elements.find((e) => {
            const nameMatch = e.label?.toLowerCase().includes(name.toLowerCase()) || e.value?.toString().toLowerCase().includes(name.toLowerCase());
            const roleMatch = !options?.role || e.role === options.role;
            return nameMatch && roleMatch;
          });
          if (match) return match;
          await new Promise((r) => setTimeout(r, interval));
        }
        throw new Error(
          `waitForElement: element "${name}"${options?.role ? ` (role: ${options.role})` : ""} not found within ${timeout}ms`
        );
      }
      // ─── Screenshots ────────────────────────────────────────
      async screenshot(options = {}) {
        return this._page.screenshot(options);
      }
      async screenshotElement(elementId) {
        const backendNodeId = this.ax.getBackendNodeId(elementId);
        if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
        const model = await this.dom.getBoxModel(backendNodeId);
        const q = model.content;
        const x = Math.min(q[0], q[2], q[4], q[6]);
        const y = Math.min(q[1], q[3], q[5], q[7]);
        return this._page.screenshot({
          clip: { x, y, width: model.width, height: model.height }
        });
      }
      // ─── Page State ─────────────────────────────────────────
      /**
       * One-call page state capture — combines DOMSnapshot, AX tree, and screenshot.
       */
      async captureState(options = {}) {
        const state = {
          url: this._currentUrl,
          timestamp: Date.now()
        };
        const promises = [];
        if (options.computedStyles) {
          promises.push(
            this.snapshot.captureSnapshot({
              computedStyles: options.computedStyles
            }).then((result) => {
              state.domSnapshot = result;
            })
          );
        }
        if (options.includeAXTree !== false) {
          promises.push(
            this.ax.getSnapshot().then((elements) => {
              state.axTree = elements;
            })
          );
        }
        if (options.includeScreenshot) {
          promises.push(
            this._page.screenshot().then((buf) => {
              state.screenshot = buf;
            })
          );
        }
        await Promise.all(promises);
        return state;
      }
      /** Get AX tree snapshot. */
      async getSnapshot() {
        return this.ax.getSnapshot();
      }
      async evaluate(exprOrFn, ...args) {
        if (args.length > 0) {
          return this.runtime.callFunctionOn(exprOrFn, args);
        }
        return this.runtime.evaluate(exprOrFn);
      }
      // ─── DOM Queries ────────────────────────────────────────
      async querySelector(selector) {
        const doc = await this.dom.getDocument();
        return this.dom.querySelector(doc.root.nodeId, selector);
      }
      async querySelectorAll(selector) {
        const doc = await this.dom.getDocument();
        return this.dom.querySelectorAll(doc.root.nodeId, selector);
      }
      async getOuterHTML(nodeId) {
        return this.dom.getOuterHTML(nodeId);
      }
      async getAttributes(nodeId) {
        return this.dom.getAttributes(nodeId);
      }
      async getComputedStyle(nodeId, properties) {
        if (properties) {
          return this.css.getComputedStyleFiltered(nodeId, properties);
        }
        return this.css.getComputedStyle(nodeId);
      }
      // ─── CSS Injection ──────────────────────────────────────
      async addStyleTag(css) {
        return this._page.addStyleTag(css);
      }
      // ─── Viewport ───────────────────────────────────────────
      async setViewport(config) {
        await this.emulation.setDeviceMetrics(config);
      }
      async clearViewport() {
        await this.emulation.clearDeviceMetrics();
      }
      // ─── Cookies / Auth ─────────────────────────────────────
      async getCookies(urls) {
        return this.network.getCookies(urls);
      }
      async setCookies(cookies) {
        return this.network.setCookies(cookies);
      }
      async clearCookies() {
        return this.network.clearCookies();
      }
      // ─── Console ────────────────────────────────────────────
      getConsoleMessages() {
        return this.console.getMessages();
      }
      getConsoleErrors() {
        return this.console.getErrors();
      }
      clearConsole() {
        this.console.clear();
      }
      // ─── Content ────────────────────────────────────────────
      async content() {
        return this.runtime.evaluate("document.documentElement.outerHTML");
      }
      async title() {
        return this.runtime.evaluate("document.title");
      }
      async textContent(selector) {
        return this.runtime.callFunctionOn(
          "(sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; }",
          [selector]
        );
      }
      async getAttribute(selector, attribute) {
        return this.runtime.callFunctionOn(
          "(sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; }",
          [selector, attribute]
        );
      }
      // ─── LLM-Native: Observe ─────────────────────────────────
      /**
       * Preview what actions are possible without executing.
       * Returns serializable descriptors for act().
       */
      async observe(options) {
        const elements = await this.ax.getSnapshot();
        return observe(elements, options);
      }
      // ─── LLM-Native: Extract ───────────────────────────────
      /**
       * Extract structured data from AX tree using a schema.
       */
      async extract(schema) {
        const elements = await this.ax.getSnapshot();
        return extractFromAXTree(elements, schema);
      }
      /**
       * Extract a list of repeated elements.
       */
      async extractItems(options) {
        const elements = await this.ax.getSnapshot();
        return extractList(elements, options);
      }
      /**
       * Extract page-level metadata (headings, links, inputs, buttons).
       */
      async extractMeta() {
        const elements = await this.ax.getSnapshot();
        return extractPageMeta(elements);
      }
      // ─── LLM-Native: Adaptive Modality ─────────────────────
      /**
       * Assess how well the AX tree captures the page.
       * Returns a score and whether a screenshot is recommended.
       */
      async assessUnderstanding(options) {
        const elements = await this.ax.getSnapshot();
        return assessUnderstanding(elements, options);
      }
      // ─── Coverage Reporting ────────────────────────────────
      /**
       * Report AX tree coverage against estimated visible DOM elements.
       * Surfaces blind spots: shadow DOM, canvas, iframes.
       */
      async getCoverage() {
        const gaps = [];
        const axElements = await this.ax.getSnapshot();
        const axTreeCount = axElements.length;
        const estimatedVisible = await this.runtime.evaluate(`
      (function() {
        const all = document.querySelectorAll('*');
        let count = 0;
        for (const el of all) {
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (el.offsetWidth > 0 || el.offsetHeight > 0) count++;
        }
        return count;
      })()
    `);
        const canvasCount = await this.runtime.evaluate(
          `document.querySelectorAll('canvas').length`
        );
        const iframeCount = await this.runtime.evaluate(
          `document.querySelectorAll('iframe').length`
        );
        const shadowElements = await extractShadowElements(this.runtime);
        const shadowDomCount = shadowElements.length;
        const recovered = shadowDomCount;
        if (canvasCount > 0) {
          gaps.push(`${canvasCount} canvas element${canvasCount > 1 ? "s" : ""} (invisible to AX tree)`);
        }
        if (iframeCount > 0) {
          gaps.push(`${iframeCount} iframe${iframeCount > 1 ? "s" : ""} (separate AX tree${iframeCount > 1 ? "s" : ""})`);
        }
        if (shadowDomCount > 0) {
          gaps.push(`${shadowDomCount} shadow DOM element${shadowDomCount > 1 ? "s" : ""} (open shadow root \u2014 recovered via piercing)`);
        }
        const safeVisible = estimatedVisible > 0 ? estimatedVisible : 1;
        const coveragePercent = Math.min(100, Math.round(axTreeCount / safeVisible * 100));
        if (coveragePercent < 50) {
          gaps.push(`Low AX coverage: ${coveragePercent}% of visible DOM captured`);
        }
        return {
          axTreeCount,
          estimatedVisible,
          coveragePercent,
          shadowDomCount,
          canvasCount,
          iframeCount,
          recovered,
          gaps
        };
      }
      // ─── LLM-Native: Cache ─────────────────────────────────
      /** Get resolution cache statistics. */
      get cacheStats() {
        return this.resolutionCache.stats();
      }
      /** Configure the resolution cache. */
      configureCache(options) {
        this.resolutionCache = new ResolutionCache(options);
      }
      // ─── Direct domain access (for advanced use) ───────────
      get page() {
        return this._page;
      }
      get accessibility() {
        return this.ax;
      }
      get domDomain() {
        return this.dom;
      }
      get runtimeDomain() {
        return this.runtime;
      }
      get cssDomain() {
        return this.css;
      }
      get snapshotDomain() {
        return this.snapshot;
      }
      get emulationDomain() {
        return this.emulation;
      }
      get networkDomain() {
        return this.network;
      }
      get consoleDomain() {
        return this.console;
      }
      get connection() {
        return this.conn;
      }
      /** The CDP debug port Chrome is listening on. Only valid after launch(). */
      get debugPort() {
        return this.browser.port;
      }
      /** The OS PID of the Chrome process. Only valid after launch(). Null when connected to existing. */
      get chromePid() {
        return this.browser.pid;
      }
      /**
       * Connect to an already-running Chrome instance instead of launching a new one.
       * Used by browser-server reconnection to attach to a persistent Chrome process.
       */
      async connectExisting(wsUrl) {
        await this.conn.connect(wsUrl);
        this.target = new TargetDomain(this.conn);
        this.launched = true;
        this.targetId = await this.target.createPage("about:blank");
        this.sessionId = await this.target.attach(this.targetId);
        this._page = new PageDomain(this.conn, this.sessionId);
        this.ax = new AccessibilityDomain(this.conn, this.sessionId);
        this.dom = new DomDomain(this.conn, this.sessionId);
        this.input = new InputDomain(this.conn, this.sessionId);
        this.runtime = new RuntimeDomain(this.conn, this.sessionId);
        this.css = new CssDomain(this.conn, this.sessionId);
        this.snapshot = new SnapshotDomain(this.conn, this.sessionId);
        this.emulation = new EmulationDomain(this.conn, this.sessionId);
        this.network = new NetworkDomain(this.conn, this.sessionId);
        this.console = new ConsoleDomain(this.conn, this.sessionId);
        await this._page.enableLifecycleEvents();
        await this.ax.enable();
        await this.console.enable();
      }
    };
  }
});

// src/engine/compat.ts
var compat_exports = {};
__export(compat_exports, {
  CompatElementHandle: () => CompatElementHandle,
  CompatLocator: () => CompatLocator,
  CompatPage: () => CompatPage
});
var import_promises2, import_path, CompatElementHandle, CompatLocator, CompatPage;
var init_compat = __esm({
  "src/engine/compat.ts"() {
    "use strict";
    import_promises2 = require("fs/promises");
    import_path = require("path");
    CompatElementHandle = class {
      constructor(driver3, nodeId) {
        this.driver = driver3;
        this.nodeId = nodeId;
      }
      async screenshot(options) {
        const model = await this.driver.domDomain.getBoxModel(this.nodeId);
        const q = model.content;
        const x = Math.min(q[0], q[2], q[4], q[6]);
        const y = Math.min(q[1], q[3], q[5], q[7]);
        const buf = await this.driver.page.screenshot({
          clip: { x, y, width: model.width, height: model.height }
        });
        if (options?.path) {
          await (0, import_promises2.mkdir)((0, import_path.dirname)(options.path), { recursive: true });
          await (0, import_promises2.writeFile)(options.path, buf);
        }
        return buf;
      }
      async textContent() {
        const html = await this.driver.domDomain.getOuterHTML(this.nodeId);
        return html.replace(/<[^>]*>/g, "").trim() || null;
      }
      async boundingBox() {
        try {
          const model = await this.driver.domDomain.getBoxModel(this.nodeId);
          const q = model.content;
          return {
            x: Math.min(q[0], q[2], q[4], q[6]),
            y: Math.min(q[1], q[3], q[5], q[7]),
            width: model.width,
            height: model.height
          };
        } catch {
          return null;
        }
      }
      async getAttribute(name) {
        try {
          const attrs = await this.driver.domDomain.getAttributes(this.nodeId);
          return attrs[name] ?? null;
        } catch {
          return null;
        }
      }
    };
    CompatLocator = class _CompatLocator {
      constructor(driver3, selector) {
        this.driver = driver3;
        this.selector = selector;
      }
      // Visible filter stored for potential future use in resolveNode
      visible = false;
      filter(options) {
        const loc = new _CompatLocator(this.driver, this.selector);
        loc.visible = options.visible ?? false;
        return loc;
      }
      first() {
        return this;
      }
      async click(_options) {
        const nodeId = await this.resolveNode(_options?.timeout);
        if (!nodeId) throw new Error(`Element not found: ${this.selector}`);
        await this.driver.runtimeDomain.callFunctionOn(
          '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
          [this.selector]
        );
      }
      async fill(text, _options) {
        await this.driver.runtimeDomain.callFunctionOn(
          `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
          [this.selector, text]
        );
      }
      async focus(_options) {
        await this.driver.runtimeDomain.callFunctionOn(
          "(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }",
          [this.selector]
        );
      }
      async press(key, _options) {
        await this.focus();
        await this.driver.pressKey(key);
      }
      async pressSequentially(text, _options) {
        await this.focus();
        for (const char of text) {
          await this.driver.runtimeDomain.callFunctionOn(
            '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
            [this.selector, char]
          );
        }
      }
      async waitFor(options) {
        const timeout = options?.timeout ?? 3e4;
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const nodeId = await this.driver.querySelector(this.selector);
          if (nodeId) return;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Timed out waiting for ${this.selector}`);
      }
      async resolveNode(timeout) {
        const deadline = Date.now() + (timeout ?? 5e3);
        while (Date.now() < deadline) {
          const nodeId = await this.driver.querySelector(this.selector);
          if (nodeId) return nodeId;
          await new Promise((r) => setTimeout(r, 100));
        }
        return null;
      }
    };
    CompatPage = class {
      constructor(driver3) {
        this.driver = driver3;
      }
      consoleHandlers = [];
      consoleListening = false;
      async goto(url, options) {
        await this.driver.navigate(url, {
          waitFor: options?.waitUntil === "networkidle" ? "stable" : "load",
          timeout: options?.timeout
        });
      }
      async evaluate(fnOrExpr, ...args) {
        if (typeof fnOrExpr === "function") {
          const fnStr = fnOrExpr.toString();
          if (args.length > 0) {
            const actualArgs = args.length === 1 && typeof args[0] === "object" && args[0] !== null ? Object.values(args[0]) : args;
            return this.driver.evaluate(`(${fnStr})`, ...actualArgs);
          }
          return this.driver.evaluate(`(${fnStr})()`);
        }
        if (args.length > 0) {
          return this.driver.evaluate(fnOrExpr, ...args);
        }
        return this.driver.evaluate(fnOrExpr);
      }
      async $(selector) {
        const nodeId = await this.driver.querySelector(selector);
        if (!nodeId) return null;
        return new CompatElementHandle(this.driver, nodeId);
      }
      async $$(selector) {
        const nodeIds = await this.driver.querySelectorAll(selector);
        return nodeIds.map((id) => new CompatElementHandle(this.driver, id));
      }
      async screenshot(options) {
        const buf = await this.driver.screenshot({
          fullPage: options?.fullPage
        });
        if (options?.path) {
          await (0, import_promises2.mkdir)((0, import_path.dirname)(options.path), { recursive: true });
          await (0, import_promises2.writeFile)(options.path, buf);
        }
        return buf;
      }
      async addStyleTag(options) {
        await this.driver.addStyleTag(options.content);
      }
      async waitForSelector(selector, options) {
        const timeout = options?.timeout ?? 3e4;
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const nodeId = await this.driver.querySelector(selector);
          if (nodeId) return new CompatElementHandle(this.driver, nodeId);
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Timed out waiting for selector: ${selector}`);
      }
      async waitForTimeout(ms) {
        await new Promise((r) => setTimeout(r, ms));
      }
      async waitForLoadState(_state, _options) {
        await this.driver.navigate(this.driver.url, { waitFor: "stable", timeout: _options?.timeout ?? 1e4 }).catch(() => {
        });
      }
      async waitForNavigation() {
        await new Promise((r) => setTimeout(r, 500));
      }
      async content() {
        return this.driver.content();
      }
      async title() {
        return this.driver.title();
      }
      async textContent(selector) {
        return this.driver.textContent(selector);
      }
      async innerText(selector) {
        return this.driver.evaluate(
          '(sel) => { const el = document.querySelector(sel); return el ? el.innerText : ""; }',
          selector
        );
      }
      async getAttribute(selector, name) {
        return this.driver.getAttribute(selector, name);
      }
      async click(selector, _options) {
        await this.driver.runtimeDomain.callFunctionOn(
          '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
          [selector]
        );
      }
      async fill(selector, value) {
        await this.driver.runtimeDomain.callFunctionOn(
          `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
          [selector, value]
        );
      }
      async type(selector, text, _options) {
        await this.driver.runtimeDomain.callFunctionOn(
          "(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }",
          [selector]
        );
        for (const char of text) {
          await this.driver.runtimeDomain.callFunctionOn(
            '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
            [selector, char]
          );
        }
      }
      async check(selector) {
        await this.driver.runtimeDomain.callFunctionOn(
          "(sel) => { const el = document.querySelector(sel); if (el && !el.checked) el.click(); }",
          [selector]
        );
      }
      async uncheck(selector) {
        await this.driver.runtimeDomain.callFunctionOn(
          "(sel) => { const el = document.querySelector(sel); if (el && el.checked) el.click(); }",
          [selector]
        );
      }
      async selectOption(selector, value) {
        await this.driver.runtimeDomain.callFunctionOn(
          `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
          [selector, value]
        );
      }
      async hover(selector, _options) {
        const nodeId = await this.driver.querySelector(selector);
        if (!nodeId) throw new Error(`Element not found: ${selector}`);
        const center = await this.driver.domDomain.getElementCenter(nodeId);
        await this.driver.runtimeDomain.callFunctionOn(
          '(x, y) => { const el = document.elementFromPoint(x, y); if (el) el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); }',
          [center.x, center.y]
        );
      }
      locator(selector) {
        return new CompatLocator(this.driver, selector);
      }
      on(event, handler) {
        if (event === "console") {
          this.consoleHandlers.push(handler);
          if (!this.consoleListening) {
            this.consoleListening = true;
            this.driver.consoleDomain.onMessage((msg) => {
              const compatMsg = {
                type: () => msg.type,
                text: () => msg.text
              };
              for (const h of this.consoleHandlers) h(compatMsg);
            });
          }
        }
      }
      url() {
        return this.driver.url;
      }
      keyboard = {
        press: async (key) => {
          await this.driver.pressKey(key);
        }
      };
    };
  }
});

// src/schemas.ts
var import_zod, ViewportSchema, VIEWPORTS, ConfigSchema, SessionQuerySchema, ComparisonResultSchema, ChangedRegionSchema, VerdictSchema, AnalysisSchema, SessionStatusSchema, BoundsSchema, LandmarkElementSchema, SessionSchema, ComparisonReportSchema, InteractiveStateSchema, A11yAttributesSchema, EnhancedElementSchema, ElementIssueSchema, AuditResultSchema, RuleSeveritySchema, RuleSettingSchema, RulesConfigSchema, ViolationSchema, RuleAuditResultSchema, MemorySourceSchema, PreferenceCategorySchema, ExpectationOperatorSchema, ExpectationSchema, PreferenceSchema, ObservationSchema, LearnedExpectationSchema, ActivePreferenceSchema, MemorySummarySchema, DesignSystemViolationSchema, DesignSystemResultSchema;
var init_schemas = __esm({
  "src/schemas.ts"() {
    "use strict";
    import_zod = require("zod");
    ViewportSchema = import_zod.z.object({
      name: import_zod.z.string().min(1).max(50),
      width: import_zod.z.number().min(100).max(3840),
      height: import_zod.z.number().min(100).max(2160)
    });
    VIEWPORTS = {
      desktop: { name: "desktop", width: 1920, height: 1080 },
      "desktop-lg": { name: "desktop-lg", width: 2560, height: 1440 },
      "desktop-sm": { name: "desktop-sm", width: 1440, height: 900 },
      laptop: { name: "laptop", width: 1366, height: 768 },
      tablet: { name: "tablet", width: 768, height: 1024 },
      "tablet-landscape": { name: "tablet-landscape", width: 1024, height: 768 },
      mobile: { name: "mobile", width: 375, height: 667 },
      "mobile-lg": { name: "mobile-lg", width: 414, height: 896 },
      "iphone-14": { name: "iphone-14", width: 390, height: 844 },
      "iphone-14-pro-max": { name: "iphone-14-pro-max", width: 430, height: 932 },
      // Native simulator viewports
      "iphone-16": { name: "iphone-16", width: 393, height: 852 },
      "iphone-16-plus": { name: "iphone-16-plus", width: 430, height: 932 },
      "iphone-16-pro": { name: "iphone-16-pro", width: 402, height: 874 },
      "iphone-16-pro-max": { name: "iphone-16-pro-max", width: 440, height: 956 },
      "watch-series-10-42mm": { name: "watch-series-10-42mm", width: 176, height: 215 },
      "watch-series-10-46mm": { name: "watch-series-10-46mm", width: 198, height: 242 },
      "watch-ultra-2-49mm": { name: "watch-ultra-2-49mm", width: 205, height: 251 }
    };
    ConfigSchema = import_zod.z.object({
      baseUrl: import_zod.z.string().url("Must be a valid URL"),
      outputDir: import_zod.z.string().default("./.ibr"),
      viewport: ViewportSchema.default(VIEWPORTS.desktop),
      viewports: import_zod.z.array(ViewportSchema).optional(),
      // Multi-viewport support
      threshold: import_zod.z.number().min(0).max(100).default(1),
      fullPage: import_zod.z.boolean().default(true),
      waitForNetworkIdle: import_zod.z.boolean().default(true),
      timeout: import_zod.z.number().min(1e3).max(12e4).default(3e4)
    });
    SessionQuerySchema = import_zod.z.object({
      route: import_zod.z.string().optional(),
      url: import_zod.z.string().optional(),
      status: import_zod.z.enum(["baseline", "compared", "pending"]).optional(),
      name: import_zod.z.string().optional(),
      createdAfter: import_zod.z.date().optional(),
      createdBefore: import_zod.z.date().optional(),
      viewport: import_zod.z.string().optional(),
      limit: import_zod.z.number().min(1).max(100).default(50)
    });
    ComparisonResultSchema = import_zod.z.object({
      match: import_zod.z.boolean(),
      diffPercent: import_zod.z.number(),
      diffPixels: import_zod.z.number(),
      totalPixels: import_zod.z.number(),
      threshold: import_zod.z.number()
    });
    ChangedRegionSchema = import_zod.z.object({
      location: import_zod.z.enum(["top", "bottom", "left", "right", "center", "full"]),
      bounds: import_zod.z.object({
        x: import_zod.z.number(),
        y: import_zod.z.number(),
        width: import_zod.z.number(),
        height: import_zod.z.number()
      }),
      description: import_zod.z.string(),
      severity: import_zod.z.enum(["expected", "unexpected", "critical"])
    });
    VerdictSchema = import_zod.z.enum([
      "MATCH",
      "EXPECTED_CHANGE",
      "UNEXPECTED_CHANGE",
      "LAYOUT_BROKEN"
    ]);
    AnalysisSchema = import_zod.z.object({
      verdict: VerdictSchema,
      summary: import_zod.z.string(),
      changedRegions: import_zod.z.array(ChangedRegionSchema),
      unexpectedChanges: import_zod.z.array(ChangedRegionSchema),
      recommendation: import_zod.z.string().nullable()
    });
    SessionStatusSchema = import_zod.z.enum(["baseline", "compared", "pending"]);
    BoundsSchema = import_zod.z.object({
      x: import_zod.z.number(),
      y: import_zod.z.number(),
      width: import_zod.z.number(),
      height: import_zod.z.number()
    });
    LandmarkElementSchema = import_zod.z.object({
      name: import_zod.z.string(),
      // e.g., 'logo', 'header', 'nav'
      selector: import_zod.z.string(),
      // CSS selector used to find it
      found: import_zod.z.boolean(),
      bounds: BoundsSchema.optional()
    });
    SessionSchema = import_zod.z.object({
      id: import_zod.z.string(),
      name: import_zod.z.string(),
      url: import_zod.z.string().min(1),
      viewport: ViewportSchema,
      status: SessionStatusSchema,
      platform: import_zod.z.enum(["web", "ios", "watchos"]).optional(),
      createdAt: import_zod.z.string().datetime(),
      updatedAt: import_zod.z.string().datetime(),
      comparison: ComparisonResultSchema.optional(),
      analysis: AnalysisSchema.optional(),
      // Landmark elements detected at baseline capture
      landmarkElements: import_zod.z.array(LandmarkElementSchema).optional(),
      // Page intent detected at baseline
      pageIntent: import_zod.z.string().optional()
    });
    ComparisonReportSchema = import_zod.z.object({
      sessionId: import_zod.z.string(),
      sessionName: import_zod.z.string(),
      url: import_zod.z.string(),
      timestamp: import_zod.z.string().datetime(),
      viewport: ViewportSchema,
      comparison: ComparisonResultSchema,
      analysis: AnalysisSchema,
      files: import_zod.z.object({
        baseline: import_zod.z.string(),
        current: import_zod.z.string(),
        diff: import_zod.z.string()
      }),
      webViewUrl: import_zod.z.string().optional()
    });
    InteractiveStateSchema = import_zod.z.object({
      hasOnClick: import_zod.z.boolean(),
      hasHref: import_zod.z.boolean(),
      isDisabled: import_zod.z.boolean(),
      tabIndex: import_zod.z.number(),
      cursor: import_zod.z.string(),
      // Framework-specific detection
      hasReactHandler: import_zod.z.boolean().optional(),
      hasVueHandler: import_zod.z.boolean().optional(),
      hasAngularHandler: import_zod.z.boolean().optional()
    });
    A11yAttributesSchema = import_zod.z.object({
      role: import_zod.z.string().nullable(),
      ariaLabel: import_zod.z.string().nullable(),
      ariaDescribedBy: import_zod.z.string().nullable(),
      ariaHidden: import_zod.z.boolean().optional()
    });
    EnhancedElementSchema = import_zod.z.object({
      // Identity
      selector: import_zod.z.string(),
      tagName: import_zod.z.string(),
      id: import_zod.z.string().optional(),
      className: import_zod.z.string().optional(),
      text: import_zod.z.string().optional(),
      // Position
      bounds: BoundsSchema,
      // Styles (subset)
      computedStyles: import_zod.z.record(import_zod.z.string(), import_zod.z.string()).optional(),
      // Interactivity
      interactive: InteractiveStateSchema,
      // Accessibility
      a11y: A11yAttributesSchema,
      // Source hints for debugging
      sourceHint: import_zod.z.object({
        dataTestId: import_zod.z.string().nullable()
      }).optional()
    });
    ElementIssueSchema = import_zod.z.object({
      type: import_zod.z.enum([
        "NO_HANDLER",
        // Interactive-looking but no handler
        "PLACEHOLDER_LINK",
        // href="#" without handler
        "TOUCH_TARGET_SMALL",
        // < 44px on mobile
        "MISSING_ARIA_LABEL",
        // Interactive without label
        "DISABLED_NO_VISUAL"
        // Disabled but no visual indication
      ]),
      severity: import_zod.z.enum(["error", "warning", "info"]),
      message: import_zod.z.string()
    });
    AuditResultSchema = import_zod.z.object({
      totalElements: import_zod.z.number(),
      interactiveCount: import_zod.z.number(),
      withHandlers: import_zod.z.number(),
      withoutHandlers: import_zod.z.number(),
      issues: import_zod.z.array(ElementIssueSchema)
    });
    RuleSeveritySchema = import_zod.z.enum(["off", "warn", "error"]);
    RuleSettingSchema = import_zod.z.union([
      RuleSeveritySchema,
      import_zod.z.tuple([RuleSeveritySchema, import_zod.z.record(import_zod.z.string(), import_zod.z.unknown())])
    ]);
    RulesConfigSchema = import_zod.z.object({
      extends: import_zod.z.array(import_zod.z.string()).optional(),
      rules: import_zod.z.record(import_zod.z.string(), RuleSettingSchema).optional()
    });
    ViolationSchema = import_zod.z.object({
      ruleId: import_zod.z.string(),
      ruleName: import_zod.z.string(),
      severity: import_zod.z.enum(["warn", "error"]),
      message: import_zod.z.string(),
      element: import_zod.z.string().optional(),
      // Selector of violating element
      bounds: BoundsSchema.optional(),
      fix: import_zod.z.string().optional()
      // Suggested fix
    });
    RuleAuditResultSchema = import_zod.z.object({
      url: import_zod.z.string(),
      timestamp: import_zod.z.string(),
      elementsScanned: import_zod.z.number(),
      violations: import_zod.z.array(ViolationSchema),
      summary: import_zod.z.object({
        errors: import_zod.z.number(),
        warnings: import_zod.z.number(),
        passed: import_zod.z.number()
      })
    });
    MemorySourceSchema = import_zod.z.enum(["user", "learned", "framework"]);
    PreferenceCategorySchema = import_zod.z.enum([
      "color",
      "layout",
      "typography",
      "navigation",
      "component",
      "spacing",
      "interaction",
      "content"
    ]);
    ExpectationOperatorSchema = import_zod.z.enum(["equals", "contains", "matches", "gte", "lte"]);
    ExpectationSchema = import_zod.z.object({
      property: import_zod.z.string(),
      operator: ExpectationOperatorSchema,
      value: import_zod.z.string()
    });
    PreferenceSchema = import_zod.z.object({
      id: import_zod.z.string(),
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      source: MemorySourceSchema,
      route: import_zod.z.string().optional(),
      componentType: import_zod.z.string().optional(),
      expectation: ExpectationSchema,
      confidence: import_zod.z.number().min(0).max(1).default(1),
      createdAt: import_zod.z.string().datetime(),
      updatedAt: import_zod.z.string().datetime(),
      sessionIds: import_zod.z.array(import_zod.z.string()).optional()
    });
    ObservationSchema = import_zod.z.object({
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      property: import_zod.z.string(),
      value: import_zod.z.string()
    });
    LearnedExpectationSchema = import_zod.z.object({
      id: import_zod.z.string(),
      sessionId: import_zod.z.string(),
      route: import_zod.z.string(),
      observations: import_zod.z.array(ObservationSchema),
      approved: import_zod.z.boolean(),
      createdAt: import_zod.z.string().datetime()
    });
    ActivePreferenceSchema = import_zod.z.object({
      id: import_zod.z.string(),
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      route: import_zod.z.string().optional(),
      componentType: import_zod.z.string().optional(),
      property: import_zod.z.string(),
      operator: ExpectationOperatorSchema,
      value: import_zod.z.string(),
      confidence: import_zod.z.number()
    });
    MemorySummarySchema = import_zod.z.object({
      version: import_zod.z.literal(1),
      updatedAt: import_zod.z.string().datetime(),
      stats: import_zod.z.object({
        totalPreferences: import_zod.z.number(),
        totalLearned: import_zod.z.number(),
        byCategory: import_zod.z.record(import_zod.z.string(), import_zod.z.number()),
        bySource: import_zod.z.record(import_zod.z.string(), import_zod.z.number())
      }),
      activePreferences: import_zod.z.array(ActivePreferenceSchema)
    });
    DesignSystemViolationSchema = import_zod.z.object({
      principleId: import_zod.z.string(),
      principleName: import_zod.z.string(),
      severity: import_zod.z.enum(["error", "warn"]),
      message: import_zod.z.string(),
      element: import_zod.z.string().optional(),
      bounds: BoundsSchema.optional(),
      fix: import_zod.z.string().optional()
    });
    DesignSystemResultSchema = import_zod.z.object({
      configName: import_zod.z.string(),
      principleViolations: import_zod.z.array(DesignSystemViolationSchema),
      tokenViolations: import_zod.z.array(import_zod.z.object({
        element: import_zod.z.string(),
        property: import_zod.z.string(),
        expected: import_zod.z.union([import_zod.z.string(), import_zod.z.number()]),
        actual: import_zod.z.union([import_zod.z.string(), import_zod.z.number()]),
        severity: import_zod.z.enum(["error", "warning"]),
        message: import_zod.z.string()
      })),
      customViolations: import_zod.z.array(DesignSystemViolationSchema),
      complianceScore: import_zod.z.number().min(0).max(100)
    });
  }
});

// src/types.ts
var DEFAULT_DYNAMIC_SELECTORS;
var init_types = __esm({
  "src/types.ts"() {
    "use strict";
    DEFAULT_DYNAMIC_SELECTORS = [
      // Timestamps and dates
      '[data-testid*="timestamp"]',
      '[data-testid*="date"]',
      '[data-testid*="time"]',
      '[class*="timestamp"]',
      '[class*="relative-time"]',
      '[class*="timeago"]',
      "time[datetime]",
      // Loading indicators
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="skeleton"]',
      '[class*="shimmer"]',
      '[role="progressbar"]',
      // Live counters
      '[class*="live-count"]',
      '[class*="viewer-count"]',
      '[class*="online-count"]',
      // Avatars with random colors
      '[class*="avatar"][style*="background"]',
      // Random IDs displayed
      '[data-testid*="session-id"]',
      '[class*="request-id"]'
    ];
  }
});

// src/auth.ts
var auth_exports = {};
__export(auth_exports, {
  clearAuthState: () => clearAuthState,
  getAuthStateInfo: () => getAuthStateInfo,
  getAuthStatePath: () => getAuthStatePath,
  getSecureAuthPath: () => getSecureAuthPath,
  hasAuthState: () => hasAuthState,
  isDeployedEnvironment: () => isDeployedEnvironment,
  loadAuthState: () => loadAuthState,
  performLogin: () => performLogin
});
function isDeployedEnvironment() {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI || process.env.JENKINS_URL || process.env.TRAVIS || process.env.HEROKU || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT);
}
function getAuthStatePath(outputDir) {
  const username = (0, import_os.userInfo)().username;
  return (0, import_path2.join)(outputDir, `auth.${username}.json`);
}
function getSecureAuthPath(projectPath) {
  const username = (0, import_os.userInfo)().username;
  const projectHash = (0, import_crypto.createHash)("sha256").update((0, import_path2.resolve)(projectPath)).digest("hex").substring(0, 16);
  return (0, import_path2.join)(
    (0, import_os.homedir)(),
    ".config",
    "ibr",
    "auth",
    `${projectHash}.${username}.json`
  );
}
function validateGitignore(projectDir) {
  const gitignorePath = (0, import_path2.join)(projectDir, ".gitignore");
  if ((0, import_fs.existsSync)(gitignorePath)) {
    const gitignore = (0, import_fs.readFileSync)(gitignorePath, "utf-8");
    const lines = gitignore.split("\n").map((l) => l.trim());
    const hasIbrIgnore = lines.some(
      (line) => line === ".ibr/" || line === ".ibr" || line === "**/.ibr/" || line === "**/.ibr"
    );
    if (!hasIbrIgnore) {
      console.warn("\n\u26A0\uFE0F  WARNING: .ibr/ is not in .gitignore!");
      console.warn('   Add ".ibr/" to .gitignore to prevent credential leaks.\n');
    }
  } else {
    console.warn('\n\u26A0\uFE0F  No .gitignore found. Create one with ".ibr/" entry.\n');
  }
}
async function hasAuthState(outputDir) {
  try {
    await (0, import_promises3.access)(getAuthStatePath(outputDir));
    return true;
  } catch {
    return false;
  }
}
async function loadAuthState(outputDir) {
  if (isDeployedEnvironment()) {
    console.warn("\u26A0\uFE0F  Deployed environment detected. Auth state not available.");
    return null;
  }
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await (0, import_promises3.readFile)(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      console.warn("\u26A0\uFE0F  Legacy auth format detected. Please re-authenticate with `ibr login`.");
      return null;
    }
    const currentUser = (0, import_os.userInfo)().username;
    if (stored.metadata.username !== currentUser) {
      console.warn(`\u26A0\uFE0F  Auth state belongs to different user (${stored.metadata.username}).`);
      return null;
    }
    if (Date.now() > stored.metadata.expiresAt) {
      console.warn("\u26A0\uFE0F  Auth state expired. Please re-authenticate with `ibr login`.");
      await clearAuthState(outputDir);
      return null;
    }
    const ageHours = (Date.now() - stored.metadata.createdAt) / (1e3 * 60 * 60);
    if (ageHours > 24) {
      console.warn(`\u26A0\uFE0F  Auth state is ${Math.floor(ageHours)} hours old. Consider re-authenticating.`);
    }
    return stored.state;
  } catch {
    return null;
  }
}
async function performLogin(options) {
  const { url, outputDir, timeout = 3e5 } = options;
  if (isDeployedEnvironment()) {
    throw new Error(
      "Authentication cannot be performed in deployed environments.\nRun `ibr login` locally on your development machine."
    );
  }
  validateGitignore(process.cwd());
  await (0, import_promises3.mkdir)(outputDir, { recursive: true, mode: 448 });
  try {
    await (0, import_promises3.chmod)(outputDir, 448);
  } catch {
  }
  const authStatePath = getAuthStatePath(outputDir);
  const currentUser = (0, import_os.userInfo)().username;
  console.log("\n\u{1F510} Opening browser for login...");
  console.log(`   User: ${currentUser}`);
  console.log("   Navigate to your login page and complete authentication.");
  console.log("   When finished, close the browser window to save your session.\n");
  const driver3 = new EngineDriver();
  await driver3.launch({
    headless: false,
    // Visible browser for manual login
    viewport: { width: 1280, height: 800 }
  });
  const page = new CompatPage(driver3);
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    });
    await Promise.race([
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Login timeout exceeded")), timeout);
      })
    ]);
  } catch (error) {
    if (driver3.isLaunched) {
      await saveAuthState(driver3, authStatePath, outputDir);
      await driver3.close();
    }
    if (error instanceof Error && error.message.includes("timeout")) {
      throw error;
    }
  }
  if (driver3.isLaunched) {
    await saveAuthState(driver3, authStatePath, outputDir);
    await driver3.close();
  }
  console.log(`
\u2705 Auth state saved for user: ${currentUser}`);
  console.log(`   Location: ${authStatePath}`);
  console.log("   Expires: 7 days from now");
  console.log("   Future captures will use this authentication.\n");
  return authStatePath;
}
async function saveAuthState(driver3, authStatePath, _outputDir) {
  const cookies = await driver3.getCookies();
  const state = { cookies, origins: [] };
  const currentUser = (0, import_os.userInfo)().username;
  const storedState = {
    state,
    metadata: {
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1e3,
      // 7 days
      username: currentUser,
      projectPath: (0, import_path2.resolve)(process.cwd())
    }
  };
  await (0, import_promises3.writeFile)(
    authStatePath,
    JSON.stringify(storedState, null, 2),
    { mode: 384 }
    // rw-------
  );
  try {
    await (0, import_promises3.chmod)(authStatePath, 384);
  } catch {
  }
}
async function clearAuthState(outputDir) {
  const authPath = getAuthStatePath(outputDir);
  try {
    const stats = await (0, import_promises3.stat)(authPath);
    const randomData = (0, import_crypto.randomBytes)(stats.size);
    await (0, import_promises3.writeFile)(authPath, randomData, { mode: 384 });
    await (0, import_promises3.unlink)(authPath);
    console.log("\u2705 Auth state securely cleared");
  } catch {
    console.log("\u2139\uFE0F  No auth state to clear");
  }
}
async function getAuthStateInfo(outputDir) {
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await (0, import_promises3.readFile)(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      return { exists: true };
    }
    return {
      exists: true,
      username: stored.metadata.username,
      createdAt: new Date(stored.metadata.createdAt),
      expiresAt: new Date(stored.metadata.expiresAt),
      expired: Date.now() > stored.metadata.expiresAt
    };
  } catch {
    return null;
  }
}
var import_promises3, import_path2, import_fs, import_os, import_crypto;
var init_auth = __esm({
  "src/auth.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_promises3 = require("fs/promises");
    import_path2 = require("path");
    import_fs = require("fs");
    import_os = require("os");
    import_crypto = require("crypto");
  }
});

// src/semantic/landmarks.ts
async function detectLandmarks(page) {
  const landmarks = [];
  for (const [name, selector] of Object.entries(LANDMARK_SELECTORS)) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        landmarks.push({
          name,
          selector,
          found: true,
          bounds: box ? {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height)
          } : void 0
        });
      } else {
        landmarks.push({
          name,
          selector,
          found: false
        });
      }
    } catch {
      landmarks.push({
        name,
        selector,
        found: false
      });
    }
  }
  return landmarks;
}
function getExpectedLandmarksForIntent(intent) {
  const common = ["header", "navigation", "main", "footer", "logo"];
  const intentSpecific = {
    auth: ["loginForm", "logo"],
    form: ["heading"],
    listing: ["search", "heading"],
    detail: ["heading"],
    dashboard: ["sidebar", "userMenu", "heading"],
    error: ["heading"],
    landing: ["heroSection", "ctaButton", "heading"],
    empty: ["heading"],
    unknown: []
  };
  const expected = [.../* @__PURE__ */ new Set([...common, ...intentSpecific[intent] || []])];
  return expected;
}
function compareLandmarks(baseline, current) {
  const baselineFound = baseline.filter((l) => l.found);
  const currentFound = current.filter((l) => l.found);
  const baselineNames = new Set(baselineFound.map((l) => l.name));
  const currentNames = new Set(currentFound.map((l) => l.name));
  const missing = baselineFound.filter((l) => !currentNames.has(l.name));
  const added = currentFound.filter((l) => !baselineNames.has(l.name));
  const unchanged = currentFound.filter((l) => baselineNames.has(l.name));
  return { missing, added, unchanged };
}
function getExpectedLandmarksFromContext(framework) {
  if (!framework) return [];
  const expected = [];
  const principlesText = framework.principles.join(" ").toLowerCase();
  if (principlesText.includes("logo") || principlesText.includes("brand")) {
    expected.push("logo");
  }
  if (principlesText.includes("navigation") || principlesText.includes("nav")) {
    expected.push("navigation");
  }
  if (principlesText.includes("header") || principlesText.includes("banner")) {
    expected.push("header");
  }
  if (principlesText.includes("footer")) {
    expected.push("footer");
  }
  if (principlesText.includes("sidebar")) {
    expected.push("sidebar");
  }
  if (principlesText.includes("search")) {
    expected.push("search");
  }
  if (principlesText.includes("cta") || principlesText.includes("call-to-action")) {
    expected.push("ctaButton");
  }
  if (principlesText.includes("hero")) {
    expected.push("heroSection");
  }
  return expected;
}
function formatLandmarkComparison(comparison) {
  const lines = [];
  if (comparison.missing.length > 0) {
    lines.push("Missing (were in baseline):");
    for (const el of comparison.missing) {
      lines.push(`  ! ${el.name}`);
    }
  }
  if (comparison.added.length > 0) {
    lines.push("New (not in baseline):");
    for (const el of comparison.added) {
      lines.push(`  + ${el.name}`);
    }
  }
  if (comparison.unchanged.length > 0) {
    lines.push("Unchanged:");
    for (const el of comparison.unchanged) {
      lines.push(`  \u2713 ${el.name}`);
    }
  }
  return lines.join("\n");
}
var LANDMARK_SELECTORS;
var init_landmarks = __esm({
  "src/semantic/landmarks.ts"() {
    "use strict";
    LANDMARK_SELECTORS = {
      logo: 'img[src*="logo"], img[alt*="logo" i], [class*="logo"], [id*="logo"], svg[class*="logo"]',
      header: 'header, [role="banner"], [class*="header"]:not([class*="subheader"])',
      navigation: 'nav, [role="navigation"], [class*="nav"]:not([class*="subnav"])',
      main: 'main, [role="main"], [class*="main-content"], #main',
      footer: 'footer, [role="contentinfo"], [class*="footer"]',
      sidebar: 'aside, [role="complementary"], [class*="sidebar"]',
      search: 'input[type="search"], [role="search"], [class*="search-input"], input[name*="search"]',
      heading: "h1",
      userMenu: '[class*="user-menu"], [class*="avatar"], [class*="profile"], [class*="account"]',
      loginForm: 'form:has(input[type="password"])',
      heroSection: '[class*="hero"], [class*="banner"], [class*="jumbotron"]',
      ctaButton: '[class*="cta"], a[class*="primary"], button[class*="primary"]'
    };
  }
});

// src/semantic/page-intent.ts
async function classifyPageIntent(page) {
  const signals = [];
  const scores = {
    auth: 0,
    form: 0,
    listing: 0,
    detail: 0,
    dashboard: 0,
    error: 0,
    landing: 0,
    empty: 0
  };
  const checks = await page.evaluate(() => {
    const doc = document;
    const body = doc.body;
    const text = body?.innerText?.toLowerCase() || "";
    const count = (selector) => doc.querySelectorAll(selector).length;
    const exists = (selector) => count(selector) > 0;
    const textContains = (terms) => terms.some((t) => text.includes(t));
    return {
      // Auth signals
      hasPasswordField: exists('input[type="password"]'),
      hasEmailField: exists('input[type="email"], input[name*="email"], input[name*="username"]'),
      hasLoginText: textContains(["sign in", "log in", "login", "sign up", "register", "forgot password", "reset password"]),
      hasRememberMe: exists('input[type="checkbox"][name*="remember"]') || Array.from(doc.querySelectorAll("label")).some((l) => l.textContent?.toLowerCase().includes("remember")),
      hasOAuthButtons: exists('[class*="google"], [class*="facebook"], [class*="github"], [class*="oauth"], [class*="social"]'),
      // Form signals
      formCount: count("form"),
      inputCount: count('input:not([type="hidden"]):not([type="search"])'),
      textareaCount: count("textarea"),
      selectCount: count("select"),
      hasSubmitButton: exists('button[type="submit"], input[type="submit"]'),
      hasFormLabels: count("label") > 2,
      // Listing signals
      listItemCount: count('li, [class*="item"], [class*="card"], [class*="row"]'),
      hasGrid: exists('[class*="grid"], [class*="list"], [class*="feed"]'),
      hasTable: exists("table tbody tr"),
      hasPagination: exists('[class*="pagination"], [class*="pager"], nav[aria-label*="page"]'),
      hasFilters: exists('[class*="filter"], [class*="sort"], [class*="facet"]'),
      repeatingSimilarElements: (() => {
        const cards = doc.querySelectorAll('[class*="card"], [class*="item"]');
        if (cards.length < 3) return false;
        const classes = Array.from(cards).map((c) => c.className);
        const unique = new Set(classes);
        return unique.size <= 3;
      })(),
      // Detail signals
      hasMainArticle: exists('article, main > [class*="content"], [class*="detail"]'),
      hasLongContent: text.length > 2e3,
      hasSingleHeading: count("h1") === 1,
      hasMetadata: exists('[class*="meta"], [class*="author"], [class*="date"], time'),
      hasComments: exists('[class*="comment"], [id*="comment"]'),
      hasSocialShare: exists('[class*="share"], [class*="social"]'),
      // Dashboard signals
      hasCharts: exists('canvas, svg[class*="chart"], [class*="chart"], [class*="graph"]'),
      hasStats: exists('[class*="stat"], [class*="metric"], [class*="kpi"]'),
      hasSidebar: exists('aside, [class*="sidebar"], nav[class*="side"]'),
      hasWidgets: exists('[class*="widget"], [class*="panel"], [class*="tile"]'),
      hasUserMenu: exists('[class*="user"], [class*="avatar"], [class*="profile"]'),
      hasNavTabs: exists('[role="tablist"], [class*="tabs"]'),
      // Error signals
      hasErrorCode: textContains(["404", "500", "403", "401", "not found", "error", "denied", "forbidden"]),
      hasErrorClass: exists('[class*="error"], [class*="404"], [class*="500"]'),
      isMinimalContent: text.length < 200,
      hasBackLink: textContains(["go back", "go home", "return"]),
      // Landing signals
      hasHero: exists('[class*="hero"], [class*="banner"], [class*="jumbotron"]'),
      hasCTA: exists('[class*="cta"], [class*="call-to-action"], a[class*="primary"]'),
      hasTestimonials: exists('[class*="testimonial"], [class*="review"], [class*="quote"]'),
      hasPricing: exists('[class*="pricing"], [class*="plan"]'),
      hasFeatures: exists('[class*="feature"], [class*="benefit"]'),
      // Empty signals
      hasEmptyState: exists('[class*="empty"], [class*="no-data"], [class*="no-results"]'),
      hasEmptyText: textContains(["no results", "nothing here", "no items", "empty"]),
      // General metrics
      totalElements: count("*"),
      interactiveElements: count("a, button, input, select, textarea")
    };
  });
  if (checks.hasPasswordField) {
    scores.auth += 40;
    signals.push("password field present");
  }
  if (checks.hasEmailField && checks.hasPasswordField) {
    scores.auth += 20;
    signals.push("email + password combination");
  }
  if (checks.hasLoginText) {
    scores.auth += 15;
    signals.push("login-related text");
  }
  if (checks.hasRememberMe) {
    scores.auth += 10;
    signals.push("remember me checkbox");
  }
  if (checks.hasOAuthButtons) {
    scores.auth += 10;
    signals.push("OAuth buttons");
  }
  if (checks.formCount > 0 && !checks.hasPasswordField) {
    scores.form += 20;
    signals.push("form without password");
  }
  if (checks.inputCount > 3 && !checks.hasPasswordField) {
    scores.form += 15;
    signals.push("multiple input fields");
  }
  if (checks.textareaCount > 0) {
    scores.form += 15;
    signals.push("textarea present");
  }
  if (checks.hasFormLabels && checks.inputCount > 2) {
    scores.form += 10;
    signals.push("labeled form fields");
  }
  if (checks.listItemCount > 5) {
    scores.listing += 25;
    signals.push(`${checks.listItemCount} list items`);
  }
  if (checks.hasGrid) {
    scores.listing += 15;
    signals.push("grid/list layout");
  }
  if (checks.hasTable) {
    scores.listing += 20;
    signals.push("data table");
  }
  if (checks.hasPagination) {
    scores.listing += 20;
    signals.push("pagination");
  }
  if (checks.hasFilters) {
    scores.listing += 15;
    signals.push("filters/sorting");
  }
  if (checks.repeatingSimilarElements) {
    scores.listing += 15;
    signals.push("repeating card elements");
  }
  if (checks.hasMainArticle) {
    scores.detail += 25;
    signals.push("main article element");
  }
  if (checks.hasLongContent) {
    scores.detail += 20;
    signals.push("long content");
  }
  if (checks.hasSingleHeading && checks.hasMetadata) {
    scores.detail += 20;
    signals.push("single heading with metadata");
  }
  if (checks.hasComments) {
    scores.detail += 15;
    signals.push("comments section");
  }
  if (checks.hasSocialShare) {
    scores.detail += 10;
    signals.push("social share buttons");
  }
  if (checks.hasCharts) {
    scores.dashboard += 30;
    signals.push("charts/graphs");
  }
  if (checks.hasStats) {
    scores.dashboard += 25;
    signals.push("stats/metrics");
  }
  if (checks.hasSidebar && checks.hasWidgets) {
    scores.dashboard += 20;
    signals.push("sidebar with widgets");
  }
  if (checks.hasNavTabs) {
    scores.dashboard += 10;
    signals.push("navigation tabs");
  }
  if (checks.hasUserMenu) {
    scores.dashboard += 10;
    signals.push("user menu");
  }
  if (checks.hasErrorCode && checks.isMinimalContent) {
    scores.error += 50;
    signals.push("error code with minimal content");
  }
  if (checks.hasErrorClass) {
    scores.error += 30;
    signals.push("error CSS class");
  }
  if (checks.hasBackLink && checks.isMinimalContent) {
    scores.error += 20;
    signals.push("back link on minimal page");
  }
  if (checks.hasHero) {
    scores.landing += 25;
    signals.push("hero section");
  }
  if (checks.hasCTA) {
    scores.landing += 20;
    signals.push("call-to-action");
  }
  if (checks.hasTestimonials) {
    scores.landing += 15;
    signals.push("testimonials");
  }
  if (checks.hasPricing) {
    scores.landing += 20;
    signals.push("pricing section");
  }
  if (checks.hasFeatures) {
    scores.landing += 15;
    signals.push("features section");
  }
  if (checks.hasEmptyState) {
    scores.empty += 40;
    signals.push("empty state element");
  }
  if (checks.hasEmptyText && checks.listItemCount === 0) {
    scores.empty += 30;
    signals.push("empty text with no items");
  }
  const entries = Object.entries(scores);
  entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0];
  const [secondIntent, secondScore] = entries[1];
  const maxPossible = 100;
  const confidence = Math.min(topScore / maxPossible, 1);
  const hasSecondary = secondScore > 30 && secondScore > topScore * 0.5;
  return {
    intent: topScore > 20 ? topIntent : "unknown",
    confidence,
    signals: signals.slice(0, 5),
    // Top 5 signals
    secondaryIntent: hasSecondary ? secondIntent : void 0
  };
}
function getIntentDescription(intent) {
  const descriptions = {
    auth: "Authentication page (login, register, password reset)",
    form: "Form page (data entry, settings, contact)",
    listing: "Listing page (search results, product grid, table)",
    detail: "Detail page (article, product, profile)",
    dashboard: "Dashboard (admin panel, analytics, user home)",
    error: "Error page (404, 500, access denied)",
    landing: "Landing page (marketing, homepage)",
    empty: "Empty state (no content)",
    unknown: "Unknown page type"
  };
  return descriptions[intent];
}
var init_page_intent = __esm({
  "src/semantic/page-intent.ts"() {
    "use strict";
  }
});

// src/capture.ts
var capture_exports = {};
__export(capture_exports, {
  captureMultipleViewports: () => captureMultipleViewports,
  captureScreenshot: () => captureScreenshot,
  captureWithDiagnostics: () => captureWithDiagnostics,
  captureWithLandmarks: () => captureWithLandmarks,
  closeBrowser: () => closeBrowser,
  getViewport: () => getViewport
});
async function applyMasking(page, mask) {
  const hideAnimations = mask?.hideAnimations !== false;
  const selectorsToHide = [];
  if (mask?.selectors) {
    selectorsToHide.push(...mask.selectors);
  }
  if (mask?.hideDynamicContent) {
    selectorsToHide.push(...DEFAULT_DYNAMIC_SELECTORS);
  }
  const cssRules = [];
  if (hideAnimations) {
    cssRules.push(`
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      @keyframes none { }
    `);
  }
  if (selectorsToHide.length > 0) {
    const selectorList = selectorsToHide.join(",\n");
    cssRules.push(`
      ${selectorList} {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `);
  }
  if (cssRules.length > 0) {
    await page.addStyleTag({
      content: cssRules.join("\n")
    });
  }
  if (mask?.textPatterns && mask.textPatterns.length > 0) {
    const placeholder = mask.placeholder || "\u2588\u2588\u2588";
    const patterns = mask.textPatterns.map(
      (p) => typeof p === "string" ? p : p.source
    );
    await page.evaluate(({ patterns: patterns2, placeholder: placeholder2 }) => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      for (const textNode of textNodes) {
        let text = textNode.textContent || "";
        for (const pattern of patterns2) {
          const regex = new RegExp(pattern, "gi");
          text = text.replace(regex, placeholder2);
        }
        if (text !== textNode.textContent) {
          textNode.textContent = text;
        }
      }
    }, { patterns, placeholder });
  }
}
async function closeBrowser() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
async function captureScreenshot(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector,
    waitFor,
    delay
  } = options;
  await (0, import_promises4.mkdir)((0, import_path3.dirname)(outputPath), { recursive: true });
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      console.log("\u{1F510} Using saved authentication state");
    }
  }
  const driverInstance = new EngineDriver();
  await driverInstance.launch({
    headless: true,
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = new CompatPage(driverInstance);
  try {
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "load",
      timeout
    });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }
    await page.waitForTimeout(delay ?? 500);
    await applyMasking(page, options.mask);
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5e3 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: "png"
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: "png"
      });
    }
    return outputPath;
  } finally {
    await driverInstance.close();
  }
}
async function captureWithLandmarks(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector,
    waitFor
  } = options;
  await (0, import_promises4.mkdir)((0, import_path3.dirname)(outputPath), { recursive: true });
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      console.log("\u{1F510} Using saved authentication state");
    }
  }
  const driverInstance = new EngineDriver();
  await driverInstance.launch({
    headless: true,
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = new CompatPage(driverInstance);
  try {
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "load",
      timeout
    });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }
    await page.waitForTimeout(500);
    const intentResult = await classifyPageIntent(page);
    const landmarkElements = await detectLandmarks(page);
    await applyMasking(page, options.mask);
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5e3 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: "png"
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: "png"
      });
    }
    return {
      outputPath,
      landmarkElements,
      pageIntent: intentResult.intent
    };
  } finally {
    await driverInstance.close();
  }
}
function getViewport(name) {
  return VIEWPORTS[name];
}
async function captureMultipleViewports(url, outputDir, viewports = ["desktop"], options = {}) {
  const results = {};
  for (const viewportName of viewports) {
    const viewport = getViewport(viewportName);
    const outputPath = `${outputDir}/${viewportName}.png`;
    await captureScreenshot({
      url,
      outputPath,
      viewport,
      ...options
    });
    results[viewportName] = outputPath;
  }
  return results;
}
async function captureWithDiagnostics(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector
  } = options;
  const startTime = Date.now();
  let navigationTime = 0;
  let renderTime = 0;
  const consoleErrors = [];
  const networkErrors = [];
  const suggestions = [];
  let httpStatus;
  try {
    await (0, import_promises4.mkdir)((0, import_path3.dirname)(outputPath), { recursive: true });
    if (outputDir && !isDeployedEnvironment()) {
      await loadAuthState(outputDir);
    }
    const driverInstance = new EngineDriver();
    await driverInstance.launch({
      headless: true,
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = new CompatPage(driverInstance);
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on?.("requestfailed", ((request) => {
      const failure = request.failure();
      networkErrors.push(`${request.url()}: ${failure?.errorText || "failed"}`);
    }));
    page.on?.("response", ((response) => {
      if (response.url() === url || response.url() === url + "/") {
        httpStatus = response.status();
      }
    }));
    try {
      const navStart = Date.now();
      await page.goto(url, {
        waitUntil: waitForNetworkIdle ? "networkidle" : "load",
        timeout
      });
      navigationTime = Date.now() - navStart;
    } catch (navError) {
      await driverInstance.close();
      const errorMsg = navError instanceof Error ? navError.message : String(navError);
      const isTimeout = errorMsg.includes("Timeout");
      if (isTimeout) {
        suggestions.push(`Page took longer than ${timeout}ms to load`);
        suggestions.push("Try increasing timeout: --timeout 60000");
        if (waitForNetworkIdle) {
          suggestions.push('Try disabling network idle wait: use "load" instead of "networkidle"');
        }
      }
      if (networkErrors.length > 0) {
        suggestions.push(`${networkErrors.length} network request(s) failed`);
      }
      if (httpStatus && httpStatus >= 400) {
        suggestions.push(`Server returned HTTP ${httpStatus}`);
      }
      return {
        success: false,
        timing: {
          navigationMs: Date.now() - startTime,
          renderMs: 0,
          totalMs: Date.now() - startTime
        },
        diagnostics: {
          httpStatus,
          consoleErrors,
          networkErrors,
          suggestions
        },
        error: {
          type: isTimeout ? "timeout" : "navigation",
          message: errorMsg,
          suggestion: isTimeout ? `Increase timeout or check if ${url} is responding` : `Check if the server is running at ${url}`
        }
      };
    }
    await page.waitForTimeout(500);
    await applyMasking(page, options.mask);
    const renderStart = Date.now();
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5e3 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: "png"
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: "png"
      });
    }
    renderTime = Date.now() - renderStart;
    await driverInstance.close();
    if (navigationTime > 5e3) {
      suggestions.push(`Slow page load: ${(navigationTime / 1e3).toFixed(1)}s`);
    }
    if (consoleErrors.length > 0) {
      suggestions.push(`${consoleErrors.length} JavaScript error(s) detected`);
    }
    return {
      success: true,
      outputPath,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions
      },
      error: {
        type: "unknown",
        message: errorMsg,
        suggestion: "Check that Chrome is installed and accessible. IBR uses a direct CDP connection \u2014 ensure Chrome is available on your PATH or at the default install location."
      }
    };
  }
}
var import_promises4, import_path3, driver;
var init_capture = __esm({
  "src/capture.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_promises4 = require("fs/promises");
    import_path3 = require("path");
    init_schemas();
    init_types();
    init_auth();
    init_landmarks();
    init_page_intent();
    driver = null;
  }
});

// src/compare.ts
var compare_exports = {};
__export(compare_exports, {
  analyzeComparison: () => analyzeComparison,
  compareImages: () => compareImages,
  detectChangedRegions: () => detectChangedRegions,
  getVerdictDescription: () => getVerdictDescription
});
function detectChangedRegions(diffData, width, height, regions = DEFAULT_REGIONS) {
  const changedRegions = [];
  for (const region of regions) {
    const xStart = Math.floor(region.xStart * width);
    const xEnd = Math.floor(region.xEnd * width);
    const yStart = Math.floor(region.yStart * height);
    const yEnd = Math.floor(region.yEnd * height);
    const regionWidth = xEnd - xStart;
    const regionHeight = yEnd - yStart;
    const regionPixels = regionWidth * regionHeight;
    if (regionPixels === 0) continue;
    let diffPixels = 0;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * width + x) * 4;
        if (diffData[idx] === 255 && diffData[idx + 1] === 0 && diffData[idx + 2] === 0) {
          diffPixels++;
        }
      }
    }
    const diffPercent = diffPixels / regionPixels * 100;
    if (diffPercent > 0.1) {
      const severity = diffPercent > 30 ? "critical" : diffPercent > 10 ? "unexpected" : "expected";
      changedRegions.push({
        location: region.location,
        bounds: {
          x: xStart,
          y: yStart,
          width: regionWidth,
          height: regionHeight
        },
        description: `${region.name}: ${diffPercent.toFixed(1)}% changed`,
        severity
      });
    }
  }
  return changedRegions.sort((a, b) => {
    const severityOrder = { critical: 0, unexpected: 1, expected: 2 };
    const aSev = severityOrder[a.severity];
    const bSev = severityOrder[b.severity];
    if (aSev !== bSev) return aSev - bSev;
    const aPercent = parseFloat(a.description.match(/(\d+\.?\d*)%/)?.[1] || "0");
    const bPercent = parseFloat(b.description.match(/(\d+\.?\d*)%/)?.[1] || "0");
    return bPercent - aPercent;
  });
}
async function compareImages(options) {
  const {
    baselinePath,
    currentPath,
    diffPath,
    threshold = 0.1
    // pixelmatch threshold (0-1), lower = stricter
  } = options;
  const [baselineBuffer, currentBuffer] = await Promise.all([
    (0, import_promises5.readFile)(baselinePath),
    (0, import_promises5.readFile)(currentPath)
  ]);
  const baseline = import_pngjs2.PNG.sync.read(baselineBuffer);
  const current = import_pngjs2.PNG.sync.read(currentBuffer);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }
  const { width, height } = baseline;
  const diff = new import_pngjs2.PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = (0, import_pixelmatch2.default)(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    {
      threshold,
      includeAA: false,
      // Ignore anti-aliasing differences
      alpha: 0.1,
      diffColor: [255, 0, 0],
      // Red for differences
      diffColorAlt: [0, 255, 0]
      // Green for anti-aliased differences
    }
  );
  await (0, import_promises5.mkdir)((0, import_path4.dirname)(diffPath), { recursive: true });
  await (0, import_promises5.writeFile)(diffPath, import_pngjs2.PNG.sync.write(diff));
  const diffPercent = diffPixels / totalPixels * 100;
  return {
    match: diffPixels === 0,
    diffPercent: Math.round(diffPercent * 100) / 100,
    // Round to 2 decimal places
    diffPixels,
    totalPixels,
    threshold,
    // Include diff data for regional analysis
    diffData: diff.data,
    width,
    height
  };
}
function analyzeComparison(result, thresholdPercent = 1) {
  const { match, diffPercent, diffData, width, height } = result;
  let detectedRegions = [];
  if (diffData && width && height && !match) {
    detectedRegions = detectChangedRegions(diffData, width, height);
  }
  const criticalRegions = detectedRegions.filter((r) => r.severity === "critical");
  const unexpectedRegions = detectedRegions.filter((r) => r.severity === "unexpected");
  const hasNavigationChanges = detectedRegions.some(
    (r) => r.description.toLowerCase().includes("navigation") || r.description.toLowerCase().includes("header")
  );
  let verdict;
  let summary;
  let recommendation = null;
  if (match || diffPercent === 0) {
    verdict = "MATCH";
    summary = "No visual changes detected. Screenshots are identical.";
  } else if (criticalRegions.length > 0) {
    verdict = "LAYOUT_BROKEN";
    const regionNames = criticalRegions.map(
      (r) => r.description.split(":")[0]
    ).join(", ");
    summary = `Critical changes in: ${regionNames}. Layout may be broken.`;
    recommendation = `Major changes detected in ${regionNames}. Check for missing elements, broken layout, or loading errors.`;
  } else if (unexpectedRegions.length > 0 || diffPercent > 20) {
    verdict = "UNEXPECTED_CHANGE";
    const regionNames = unexpectedRegions.length > 0 ? unexpectedRegions.map((r) => r.description.split(":")[0]).join(", ") : "multiple areas";
    summary = `Significant changes in: ${regionNames} (${diffPercent}% overall).`;
    recommendation = hasNavigationChanges ? "Navigation area changed - verify menu items and links are correct." : "Review changes carefully - some may be unintentional.";
  } else if (diffPercent <= thresholdPercent) {
    verdict = "EXPECTED_CHANGE";
    summary = `Minor changes detected (${diffPercent}%). Within acceptable threshold.`;
  } else {
    verdict = "EXPECTED_CHANGE";
    const regionNames = detectedRegions.length > 0 ? detectedRegions.map((r) => r.description.split(":")[0]).join(", ") : "content area";
    summary = `Changes in: ${regionNames} (${diffPercent}% overall). Changes appear intentional.`;
  }
  const changedRegions = detectedRegions.filter((r) => r.severity === "expected");
  const unexpectedChanges = detectedRegions.filter(
    (r) => r.severity === "unexpected" || r.severity === "critical"
  );
  if (detectedRegions.length === 0 && !match) {
    const fallbackRegion = {
      location: diffPercent > 50 ? "full" : "center",
      bounds: { x: 0, y: 0, width: width || 0, height: height || 0 },
      description: `overall: ${diffPercent}% changed`,
      severity: verdict === "LAYOUT_BROKEN" ? "critical" : verdict === "UNEXPECTED_CHANGE" ? "unexpected" : "expected"
    };
    if (verdict === "UNEXPECTED_CHANGE" || verdict === "LAYOUT_BROKEN") {
      unexpectedChanges.push(fallbackRegion);
    } else {
      changedRegions.push(fallbackRegion);
    }
  }
  return {
    verdict,
    summary,
    changedRegions,
    unexpectedChanges,
    recommendation
  };
}
function getVerdictDescription(verdict) {
  switch (verdict) {
    case "MATCH":
      return "No changes - screenshots match";
    case "EXPECTED_CHANGE":
      return "Changes detected - appear intentional";
    case "UNEXPECTED_CHANGE":
      return "Unexpected changes - review required";
    case "LAYOUT_BROKEN":
      return "Layout broken - significant issues detected";
    default:
      return "Unknown verdict";
  }
}
var import_pixelmatch2, import_pngjs2, import_promises5, import_path4, DEFAULT_REGIONS;
var init_compare = __esm({
  "src/compare.ts"() {
    "use strict";
    import_pixelmatch2 = __toESM(require("pixelmatch"));
    import_pngjs2 = require("pngjs");
    import_promises5 = require("fs/promises");
    import_path4 = require("path");
    DEFAULT_REGIONS = [
      { name: "header", location: "top", xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.1 },
      { name: "navigation", location: "left", xStart: 0, xEnd: 0.2, yStart: 0.1, yEnd: 0.9 },
      { name: "content", location: "center", xStart: 0.2, xEnd: 1, yStart: 0.1, yEnd: 0.9 },
      { name: "footer", location: "bottom", xStart: 0, xEnd: 1, yStart: 0.9, yEnd: 1 }
    ];
  }
});

// src/git-context.ts
var git_context_exports = {};
__export(git_context_exports, {
  getAppContext: () => getAppContext,
  getAppName: () => getAppName,
  getGitContext: () => getGitContext,
  getSessionBasePath: () => getSessionBasePath
});
async function parseGitConfig(configPath) {
  try {
    const content = await (0, import_promises6.readFile)(configPath, "utf-8");
    const lines = content.split("\n");
    let currentRemote = null;
    let remoteUrl = null;
    for (const line of lines) {
      const trimmed = line.trim();
      const remoteMatch = trimmed.match(/^\[remote "(.+)"\]$/);
      if (remoteMatch) {
        currentRemote = remoteMatch[1];
        continue;
      }
      if (currentRemote && trimmed.startsWith("url = ")) {
        remoteUrl = trimmed.substring(6).trim();
        break;
      }
    }
    return { remote: currentRemote, remoteUrl };
  } catch {
    return { remote: null, remoteUrl: null };
  }
}
function extractRepoName(remoteUrl) {
  try {
    const sshMatch = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      const parts = sshMatch[1].split("/");
      return parts[parts.length - 1].replace(/\.git$/, "");
    }
    const httpsMatch = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return httpsMatch[1].replace(/\.git$/, "");
    }
    return null;
  } catch {
    return null;
  }
}
function getCurrentBranch(dir) {
  try {
    const branch = (0, import_child_process.execSync)("git branch --show-current", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}
async function getGitContext(dir) {
  const gitConfigPath = (0, import_path5.join)(dir, ".git", "config");
  const { remote, remoteUrl } = await parseGitConfig(gitConfigPath);
  const repoName = remoteUrl ? extractRepoName(remoteUrl) : null;
  const branch = getCurrentBranch(dir);
  return {
    repoName,
    branch,
    remote,
    remoteUrl
  };
}
async function getAppName(dir) {
  try {
    const packageJsonPath = (0, import_path5.join)(dir, "package.json");
    const content = await (0, import_promises6.readFile)(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    if (packageJson.name) {
      const name = packageJson.name;
      const scopeMatch = name.match(/^@[^/]+\/(.+)$/);
      return scopeMatch ? scopeMatch[1] : name;
    }
  } catch {
  }
  return (0, import_path5.basename)(dir);
}
async function getAppContext(dir) {
  const [gitContext, appName] = await Promise.all([
    getGitContext(dir),
    getAppName(dir)
  ]);
  return {
    ...gitContext,
    appName
  };
}
function getSessionBasePath(outputDir, context) {
  if (context.repoName && context.branch) {
    return (0, import_path5.join)(outputDir, "apps", context.appName, context.branch, "sessions");
  }
  return (0, import_path5.join)(outputDir, "sessions");
}
var import_promises6, import_path5, import_child_process;
var init_git_context = __esm({
  "src/git-context.ts"() {
    "use strict";
    import_promises6 = require("fs/promises");
    import_path5 = require("path");
    import_child_process = require("child_process");
  }
});

// src/session.ts
var session_exports = {};
__export(session_exports, {
  cleanSessions: () => cleanSessions,
  createSession: () => createSession,
  deleteSession: () => deleteSession,
  findSessions: () => findSessions,
  generateSessionId: () => generateSessionId,
  getCachedAppContext: () => getCachedAppContext,
  getMostRecentSession: () => getMostRecentSession,
  getSession: () => getSession,
  getSessionPaths: () => getSessionPaths,
  getSessionPathsWithContext: () => getSessionPathsWithContext,
  getSessionStats: () => getSessionStats,
  getSessionsByRoute: () => getSessionsByRoute,
  getTimeline: () => getTimeline,
  listSessions: () => listSessions,
  markSessionCompared: () => markSessionCompared,
  updateSession: () => updateSession
});
function generateSessionId() {
  return `${SESSION_PREFIX}${(0, import_nanoid.nanoid)(10)}`;
}
function getSessionPaths(outputDir, sessionId) {
  const root = (0, import_path6.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path6.join)(root, "session.json"),
    baseline: (0, import_path6.join)(root, "baseline.png"),
    current: (0, import_path6.join)(root, "current.png"),
    diff: (0, import_path6.join)(root, "diff.png")
  };
}
function getSessionPathsWithContext(outputDir, sessionId, context) {
  const basePath = context ? getSessionBasePath(outputDir, context) : (0, import_path6.join)(outputDir, "sessions");
  const root = (0, import_path6.join)(basePath, sessionId);
  return {
    root,
    sessionJson: (0, import_path6.join)(root, "session.json"),
    baseline: (0, import_path6.join)(root, "baseline.png"),
    current: (0, import_path6.join)(root, "current.png"),
    diff: (0, import_path6.join)(root, "diff.png")
  };
}
async function getCachedAppContext(projectDir) {
  if (contextCacheDir === projectDir && cachedContext !== null) {
    return cachedContext;
  }
  try {
    cachedContext = await getAppContext(projectDir);
    contextCacheDir = projectDir;
    return cachedContext;
  } catch {
    cachedContext = null;
    contextCacheDir = projectDir;
    return null;
  }
}
async function createSession(outputDir, url, name, viewport, platform) {
  const sessionId = generateSessionId();
  const paths = getSessionPaths(outputDir, sessionId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const session = {
    id: sessionId,
    name,
    url,
    viewport,
    status: "baseline",
    ...platform ? { platform } : {},
    createdAt: now,
    updatedAt: now
  };
  await (0, import_promises7.mkdir)(paths.root, { recursive: true });
  await (0, import_promises7.writeFile)(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await (0, import_promises7.readFile)(paths.sessionJson, "utf-8");
    const data = JSON.parse(content);
    return SessionSchema.parse(data);
  } catch {
    return null;
  }
}
async function updateSession(outputDir, sessionId, updates) {
  const session = await getSession(outputDir, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const updated = {
    ...session,
    ...updates,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const paths = getSessionPaths(outputDir, sessionId);
  await (0, import_promises7.writeFile)(paths.sessionJson, JSON.stringify(updated, null, 2));
  return updated;
}
async function markSessionCompared(outputDir, sessionId, comparison, analysis) {
  return updateSession(outputDir, sessionId, {
    status: "compared",
    comparison,
    analysis
  });
}
async function listSessions(outputDir) {
  const sessionsDir = (0, import_path6.join)(outputDir, "sessions");
  try {
    const entries = await (0, import_promises7.readdir)(sessionsDir, { withFileTypes: true });
    const sessions = [];
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(SESSION_PREFIX)) {
        const session = await getSession(outputDir, entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }
    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}
async function getMostRecentSession(outputDir) {
  const sessions = await listSessions(outputDir);
  return sessions[0] || null;
}
async function deleteSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    await (0, import_promises7.rm)(paths.root, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
function parseDuration(duration) {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '7d', '24h', '30m', '60s'`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1e3;
    case "h":
      return value * 60 * 60 * 1e3;
    case "m":
      return value * 60 * 1e3;
    case "s":
      return value * 1e3;
    default:
      return value * 1e3;
  }
}
async function cleanSessions(outputDir, options = {}) {
  const { olderThan, keepLast = 0, dryRun = false } = options;
  const sessions = await listSessions(outputDir);
  const deleted = [];
  const kept = [];
  const keepIds = new Set(sessions.slice(0, keepLast).map((s) => s.id));
  const cutoffTime = olderThan ? Date.now() - parseDuration(olderThan) : 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const shouldDelete = !keepIds.has(session.id) && (olderThan ? sessionTime < cutoffTime : true);
    if (shouldDelete && !keepIds.has(session.id)) {
      if (!dryRun) {
        await deleteSession(outputDir, session.id);
      }
      deleted.push(session.id);
    } else {
      kept.push(session.id);
    }
  }
  return { deleted, kept };
}
async function findSessions(outputDir, query = {}) {
  const validatedQuery = SessionQuerySchema.parse({
    limit: 50,
    ...query
  });
  const allSessions = await listSessions(outputDir);
  let filtered = allSessions;
  if (validatedQuery.route) {
    const routePattern = validatedQuery.route.toLowerCase();
    filtered = filtered.filter((s) => {
      try {
        const urlPath = new URL(s.url).pathname.toLowerCase();
        return urlPath.includes(routePattern) || urlPath === routePattern;
      } catch {
        return s.url.toLowerCase().includes(routePattern);
      }
    });
  }
  if (validatedQuery.url) {
    const urlPattern = validatedQuery.url.toLowerCase();
    filtered = filtered.filter((s) => s.url.toLowerCase().includes(urlPattern));
  }
  if (validatedQuery.status) {
    filtered = filtered.filter((s) => s.status === validatedQuery.status);
  }
  if (validatedQuery.name) {
    const namePattern = validatedQuery.name.toLowerCase();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(namePattern));
  }
  if (validatedQuery.viewport) {
    const viewportPattern = validatedQuery.viewport.toLowerCase();
    filtered = filtered.filter((s) => s.viewport.name.toLowerCase() === viewportPattern);
  }
  if (validatedQuery.createdAfter) {
    const afterTime = validatedQuery.createdAfter.getTime();
    filtered = filtered.filter((s) => new Date(s.createdAt).getTime() >= afterTime);
  }
  if (validatedQuery.createdBefore) {
    const beforeTime = validatedQuery.createdBefore.getTime();
    filtered = filtered.filter((s) => new Date(s.createdAt).getTime() <= beforeTime);
  }
  return filtered.slice(0, validatedQuery.limit);
}
async function getTimeline(outputDir, route, limit = 10) {
  const sessions = await findSessions(outputDir, { route, limit });
  return sessions.reverse();
}
async function getSessionsByRoute(outputDir) {
  const allSessions = await listSessions(outputDir);
  const byRoute = {};
  for (const session of allSessions) {
    let route;
    try {
      route = new URL(session.url).pathname;
    } catch {
      route = session.url;
    }
    if (!byRoute[route]) {
      byRoute[route] = [];
    }
    byRoute[route].push(session);
  }
  return byRoute;
}
async function getSessionStats(outputDir) {
  const sessions = await listSessions(outputDir);
  const byStatus = {};
  const byViewport = {};
  const byVerdict = {};
  for (const session of sessions) {
    byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    const viewportName = session.viewport.name;
    byViewport[viewportName] = (byViewport[viewportName] || 0) + 1;
    if (session.analysis?.verdict) {
      byVerdict[session.analysis.verdict] = (byVerdict[session.analysis.verdict] || 0) + 1;
    }
  }
  return {
    total: sessions.length,
    byStatus,
    byViewport,
    byVerdict
  };
}
var import_nanoid, import_promises7, import_path6, SESSION_PREFIX, cachedContext, contextCacheDir;
var init_session = __esm({
  "src/session.ts"() {
    "use strict";
    import_nanoid = require("nanoid");
    import_promises7 = require("fs/promises");
    import_path6 = require("path");
    init_schemas();
    init_git_context();
    SESSION_PREFIX = "sess_";
    cachedContext = null;
    contextCacheDir = null;
  }
});

// src/report.ts
function generateReport(session, comparison, analysis, outputDir, webViewPort) {
  const paths = getSessionPaths(outputDir, session.id);
  const report = {
    sessionId: session.id,
    sessionName: session.name,
    url: session.url,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport: session.viewport,
    comparison,
    analysis,
    files: {
      baseline: paths.baseline,
      current: paths.current,
      diff: paths.diff
    }
  };
  if (webViewPort) {
    report.webViewUrl = `http://localhost:${webViewPort}/sessions/${session.id}`;
  }
  return report;
}
function getVerdictIndicator(verdict) {
  switch (verdict) {
    case "MATCH":
      return { symbol: "[PASS]", label: "No visual changes detected" };
    case "EXPECTED_CHANGE":
      return { symbol: "[OK]  ", label: "Changes detected, appear intentional" };
    case "UNEXPECTED_CHANGE":
      return { symbol: "[WARN]", label: "Unexpected changes - investigate" };
    case "LAYOUT_BROKEN":
      return { symbol: "[FAIL]", label: "Layout broken - fix required" };
    default:
      return { symbol: "[????]", label: "Unknown verdict" };
  }
}
function formatReportText(report) {
  const lines = [];
  const { symbol, label } = getVerdictIndicator(report.analysis.verdict);
  lines.push("");
  lines.push(`${symbol} ${report.analysis.verdict} - ${label}`);
  lines.push("");
  lines.push(`Diff: ${report.comparison.diffPercent}% (${report.comparison.diffPixels.toLocaleString()} pixels)`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`Session: ${report.sessionName} (${report.sessionId})`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height})`);
  lines.push("");
  lines.push(`Summary: ${report.analysis.summary}`);
  if (report.analysis.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${report.analysis.recommendation}`);
  }
  if (report.analysis.unexpectedChanges.length > 0) {
    lines.push("");
    lines.push("Unexpected Changes:");
    for (const change of report.analysis.unexpectedChanges) {
      lines.push(`  - ${change.location}: ${change.description}`);
    }
  }
  lines.push("");
  lines.push("Files:");
  lines.push(`  Baseline: ${report.files.baseline}`);
  lines.push(`  Current: ${report.files.current}`);
  lines.push(`  Diff: ${report.files.diff}`);
  if (report.webViewUrl) {
    lines.push("");
    lines.push(`View in browser: ${report.webViewUrl}`);
  }
  return lines.join("\n");
}
function formatReportMinimal(report) {
  const status = report.comparison.match ? "PASS" : "FAIL";
  return `${status} ${report.sessionId} ${report.analysis.verdict} ${report.comparison.diffPercent}%`;
}
function formatReportJson(report) {
  return JSON.stringify(report, null, 2);
}
function formatSessionSummary(session) {
  const status = session.status.padEnd(8);
  const viewport = `${session.viewport.name}`.padEnd(8);
  const date = new Date(session.createdAt).toLocaleDateString();
  let diffInfo = "";
  if (session.comparison) {
    diffInfo = session.comparison.match ? " (no diff)" : ` (${session.comparison.diffPercent}% diff)`;
  }
  return `${session.id}  ${status}  ${viewport}  ${date}  ${session.name}${diffInfo}`;
}
var init_report = __esm({
  "src/report.ts"() {
    "use strict";
    init_session();
  }
});

// src/semantic/state-detector.ts
async function detectAuthState(page) {
  const signals = [];
  let authenticated = null;
  let confidence = 0;
  let username;
  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText?.toLowerCase() || "";
    function findByText(tags, patterns) {
      for (const tag of tags) {
        for (const el of Array.from(doc.querySelectorAll(tag))) {
          const t = el.textContent?.trim().toLowerCase() || "";
          if (patterns.some((p) => t === p || t.includes(p))) return el;
        }
      }
      return null;
    }
    const logoutButton = findByText(["button", "a"], ["logout", "sign out"]) || doc.querySelector('[class*="logout"], [data-testid*="logout"]');
    const userMenu = doc.querySelector(
      '[class*="user-menu"], [class*="avatar"], [class*="profile-menu"], [class*="account-menu"], [data-testid*="user"]'
    );
    const welcomeText = text.match(/welcome,?\s+(\w+)/i);
    const userNameEl = doc.querySelector(
      '[class*="username"], [class*="user-name"], [class*="display-name"]'
    );
    const loginLink = findByText(["a", "button"], ["login", "sign in"]) || doc.querySelector('[class*="login-link"], [href*="/login"], [href*="/signin"]');
    const signupLink = findByText(["a"], ["sign up", "register"]) || doc.querySelector('[href*="/signup"], [href*="/register"]');
    const authRequired = doc.querySelector(
      '[class*="auth-required"], [class*="login-required"], [class*="protected"]'
    );
    let hasAuthCookie = false;
    try {
      hasAuthCookie = document.cookie.includes("auth") || document.cookie.includes("session") || document.cookie.includes("token");
    } catch {
    }
    const socialProviderPatterns = ["google", "github", "apple", "microsoft", "facebook", "discord"];
    const socialTriggerPhrases = ["sign in with", "continue with"];
    const socialProviders = [];
    const socialElements = Array.from(doc.querySelectorAll(
      'button, a, [class*="social"], [class*="oauth"], [class*="provider"]'
    ));
    for (const el of socialElements) {
      const t = el.textContent?.trim().toLowerCase() || "";
      const cls = el.className?.toLowerCase() || "";
      for (const provider of socialProviderPatterns) {
        if (!socialProviders.includes(provider)) {
          if (t.includes(provider) || cls.includes(provider)) {
            const isTriggered = socialTriggerPhrases.some((ph) => t.includes(ph)) || t === provider || t === `sign in with ${provider}` || t === `continue with ${provider}` || cls.includes("social") || cls.includes("oauth") || cls.includes("provider");
            if (isTriggered) socialProviders.push(provider);
          }
        }
      }
    }
    const forgotPasswordPatterns = ["forgot", "reset password", "can't sign in", "trouble signing in", "lost password"];
    const forgotEl = findByText(["a", "button"], forgotPasswordPatterns) || doc.querySelector('[href*="forgot"], [href*="reset-password"], [href*="password-reset"]');
    const toggleEl = doc.querySelector(
      '[aria-label*="show password" i], [aria-label*="hide password" i], [aria-label*="toggle password" i], [class*="eye"], [class*="visibility"], [class*="toggle-password"]'
    );
    let hasPasswordToggle = !!toggleEl;
    if (!hasPasswordToggle) {
      const passwordInput = doc.querySelector('input[type="password"]');
      if (passwordInput) {
        const parent = passwordInput.parentElement;
        const sibling = passwordInput.nextElementSibling;
        if (parent?.querySelector("button")) hasPasswordToggle = true;
        if (sibling?.tagName === "BUTTON") hasPasswordToggle = true;
      }
    }
    return {
      hasLogoutButton: !!logoutButton,
      hasUserMenu: !!userMenu,
      hasWelcomeText: !!welcomeText,
      welcomeName: welcomeText?.[1],
      hasUserNameElement: !!userNameEl,
      userName: userNameEl?.textContent?.trim(),
      hasLoginLink: !!loginLink,
      hasSignupLink: !!signupLink,
      hasAuthRequired: !!authRequired,
      hasAuthCookie,
      socialLoginProviders: socialProviders,
      hasForgotPassword: !!forgotEl,
      hasPasswordToggle
    };
  });
  if (checks.hasLogoutButton) {
    authenticated = true;
    confidence += 40;
    signals.push("logout button present");
  }
  if (checks.hasUserMenu) {
    authenticated = true;
    confidence += 30;
    signals.push("user menu present");
  }
  if (checks.hasWelcomeText) {
    authenticated = true;
    confidence += 20;
    signals.push("welcome text");
    username = checks.welcomeName;
  }
  if (checks.hasUserNameElement) {
    authenticated = true;
    confidence += 15;
    signals.push("username displayed");
    username = username || checks.userName;
  }
  if (checks.hasAuthCookie) {
    confidence += 10;
    signals.push("auth cookie present");
  }
  if (checks.hasLoginLink && !checks.hasLogoutButton) {
    authenticated = false;
    confidence += 30;
    signals.push("login link visible");
  }
  if (checks.hasSignupLink && !checks.hasUserMenu) {
    authenticated = false;
    confidence += 20;
    signals.push("signup link visible");
  }
  if (checks.hasAuthRequired) {
    authenticated = false;
    confidence += 25;
    signals.push("auth-required message");
  }
  if (checks.socialLoginProviders.length > 0) {
    signals.push(`social login: ${checks.socialLoginProviders.join(", ")}`);
  }
  if (checks.hasForgotPassword) {
    signals.push("forgot password link present");
  }
  if (checks.hasPasswordToggle) {
    signals.push("password visibility toggle present");
  }
  confidence = Math.min(confidence / 100, 1);
  if (confidence < 0.3) {
    authenticated = null;
  }
  return {
    authenticated,
    confidence,
    signals,
    username,
    socialLoginProviders: checks.socialLoginProviders,
    hasForgotPassword: checks.hasForgotPassword,
    hasSignupLink: checks.hasSignupLink,
    hasPasswordToggle: checks.hasPasswordToggle
  };
}
async function detectLoadingState(page) {
  const checks = await page.evaluate(() => {
    const doc = document;
    const spinners = doc.querySelectorAll(
      '[class*="spinner"], [class*="loading"], [class*="loader"], [role="progressbar"][aria-busy="true"], .animate-spin, [class*="spin"]'
    );
    const skeletons = doc.querySelectorAll(
      '[class*="skeleton"], [class*="shimmer"], [class*="placeholder"], [class*="pulse"], [aria-busy="true"]'
    );
    const progress = doc.querySelectorAll(
      'progress, [role="progressbar"], [class*="progress-bar"], [class*="loading-bar"]'
    );
    const lazyImages = doc.querySelectorAll(
      'img[loading="lazy"]:not([src]), [class*="lazy"]:not([src])'
    );
    const bodyLoading = doc.body?.classList.contains("loading") || doc.body?.getAttribute("aria-busy") === "true";
    return {
      spinnerCount: spinners.length,
      skeletonCount: skeletons.length,
      progressCount: progress.length,
      lazyCount: lazyImages.length,
      bodyLoading
    };
  });
  let type = "none";
  let elements = 0;
  let loading = false;
  if (checks.spinnerCount > 0) {
    type = "spinner";
    elements = checks.spinnerCount;
    loading = true;
  } else if (checks.skeletonCount > 0) {
    type = "skeleton";
    elements = checks.skeletonCount;
    loading = true;
  } else if (checks.progressCount > 0) {
    type = "progress";
    elements = checks.progressCount;
    loading = true;
  } else if (checks.lazyCount > 0) {
    type = "lazy";
    elements = checks.lazyCount;
    loading = true;
  } else if (checks.bodyLoading) {
    type = "spinner";
    loading = true;
  }
  return { loading, type, elements };
}
async function detectErrorState(page) {
  const errors = [];
  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText || "";
    const validationErrors = doc.querySelectorAll(
      '[class*="error"]:not([class*="error-boundary"]), [class*="invalid"], [aria-invalid="true"], .field-error, .form-error, .validation-error'
    );
    const apiErrors = doc.querySelectorAll(
      '[class*="api-error"], [class*="server-error"], [class*="fetch-error"], [class*="network-error"]'
    );
    const permissionText = text.match(/access denied|forbidden|unauthorized|not allowed/i);
    const notFoundText = text.match(/not found|404|page doesn't exist|no longer available/i);
    const serverText = text.match(/500|server error|something went wrong|internal error/i);
    const toastErrors = doc.querySelectorAll(
      '[class*="toast"][class*="error"], [class*="notification"][class*="error"], [role="alert"][class*="error"], [class*="snackbar"][class*="error"]'
    );
    const extractText = (el) => el.textContent?.trim().slice(0, 200) || "";
    return {
      validationErrors: Array.from(validationErrors).map(extractText).filter(Boolean),
      apiErrors: Array.from(apiErrors).map(extractText).filter(Boolean),
      toastErrors: Array.from(toastErrors).map(extractText).filter(Boolean),
      hasPermissionError: !!permissionText,
      hasNotFoundError: !!notFoundText,
      hasServerError: !!serverText
    };
  });
  if (checks.hasPermissionError) {
    errors.push({
      type: "permission",
      message: "Access denied or unauthorized"
    });
  }
  if (checks.hasNotFoundError) {
    errors.push({
      type: "notfound",
      message: "Page or resource not found"
    });
  }
  if (checks.hasServerError) {
    errors.push({
      type: "server",
      message: "Server error occurred"
    });
  }
  for (const msg of checks.validationErrors) {
    errors.push({
      type: "validation",
      message: msg
    });
  }
  for (const msg of checks.apiErrors) {
    errors.push({
      type: "api",
      message: msg
    });
  }
  for (const msg of checks.toastErrors) {
    errors.push({
      type: "unknown",
      message: msg
    });
  }
  let severity = "none";
  if (errors.length > 0) {
    const hasCritical = errors.some(
      (e) => e.type === "server" || e.type === "permission"
    );
    const hasError = errors.some(
      (e) => e.type === "api" || e.type === "notfound"
    );
    const hasWarning = errors.some((e) => e.type === "validation");
    if (hasCritical) severity = "critical";
    else if (hasError) severity = "error";
    else if (hasWarning) severity = "warning";
  }
  return {
    hasErrors: errors.length > 0,
    errors,
    severity
  };
}
async function detectPageState(page) {
  const [auth, loading, errors] = await Promise.all([
    detectAuthState(page),
    detectLoadingState(page),
    detectErrorState(page)
  ]);
  const ready = !loading.loading && errors.severity !== "critical" && errors.severity !== "error";
  return {
    auth,
    loading,
    errors,
    ready
  };
}
async function waitForPageReady(page, options = {}) {
  const { timeout = 1e4, ignoreErrors = false } = options;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const state = await detectPageState(page);
    if (!state.loading.loading) {
      if (ignoreErrors || !state.errors.hasErrors) {
        return state;
      }
    }
    await page.waitForTimeout(200);
  }
  return detectPageState(page);
}
var init_state_detector = __esm({
  "src/semantic/state-detector.ts"() {
    "use strict";
  }
});

// src/semantic/output.ts
async function getSemanticOutput(page) {
  const url = page.url?.() ?? "";
  const title = await page.title();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const [pageIntent, state] = await Promise.all([
    classifyPageIntent(page),
    detectPageState(page)
  ]);
  const availableActions = await detectAvailableActions(page, pageIntent.intent);
  const issues = collectIssues(state, pageIntent, url);
  const verdict = determineVerdict(state, issues);
  const recovery = verdict === "FAIL" || verdict === "ERROR" ? generateRecoveryHint(state, pageIntent.intent) : void 0;
  const summary = generateSummary(pageIntent, state, verdict, issues.length);
  return {
    verdict,
    confidence: pageIntent.confidence,
    pageIntent,
    state,
    availableActions,
    issues,
    recovery,
    summary,
    url,
    title,
    timestamp
  };
}
async function detectAvailableActions(page, intent) {
  const actions = [];
  const checks = await page.evaluate(() => {
    const doc = document;
    function findByText(tags, patterns) {
      for (const tag of tags) {
        for (const el of Array.from(doc.querySelectorAll(tag))) {
          const t = el.textContent?.trim().toLowerCase() || "";
          if (patterns.some((p) => t === p || t.includes(p))) return el;
        }
      }
      return null;
    }
    const submitButton = doc.querySelector('button[type="submit"], input[type="submit"]');
    const searchInput = doc.querySelector('input[type="search"], input[name*="search"], input[placeholder*="search"]');
    const loginForm = doc.querySelector('form input[type="password"]');
    const mainNav = doc.querySelector("nav a, header a");
    const backButton = findByText(["a", "button"], ["back"]);
    const addButton = findByText(["button"], ["add", "create", "new"]);
    const editButton = findByText(["button", "a"], ["edit"]);
    const deleteButton = findByText(["button"], ["delete", "remove"]);
    const filterSelect = doc.querySelector('select[name*="filter"], [class*="filter"] select');
    const sortSelect = doc.querySelector('select[name*="sort"], [class*="sort"] select');
    const pagination = doc.querySelector('[class*="pagination"] a, [class*="pager"] button');
    const socialProviderNames = ["google", "github", "apple", "microsoft", "facebook", "discord"];
    const socialTriggerPhrases = ["sign in with", "continue with"];
    const detectedProviders = [];
    const socialEls = Array.from(doc.querySelectorAll(
      'button, a, [class*="social"], [class*="oauth"], [class*="provider"]'
    ));
    for (const el of socialEls) {
      const t = el.textContent?.trim().toLowerCase() || "";
      const cls = el.className?.toLowerCase() || "";
      for (const provider of socialProviderNames) {
        if (!detectedProviders.includes(provider)) {
          if (t.includes(provider) || cls.includes(provider)) {
            const triggered = socialTriggerPhrases.some((ph) => t.includes(ph)) || t === provider || cls.includes("social") || cls.includes("oauth") || cls.includes("provider");
            if (triggered) detectedProviders.push(provider);
          }
        }
      }
    }
    return {
      hasSubmit: !!submitButton,
      submitSelector: submitButton ? getSelector(submitButton) : null,
      hasSearch: !!searchInput,
      searchSelector: searchInput ? getSelector(searchInput) : null,
      hasLogin: !!loginForm,
      hasNav: !!mainNav,
      hasBack: !!backButton,
      hasAdd: !!addButton,
      addSelector: addButton ? getSelector(addButton) : null,
      hasEdit: !!editButton,
      hasDelete: !!deleteButton,
      hasFilter: !!filterSelect,
      hasSort: !!sortSelect,
      hasPagination: !!pagination,
      hasSocialLogin: detectedProviders.length > 0,
      socialProviders: detectedProviders
    };
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
      if (el.className) return `.${el.className.split(" ")[0]}`;
      return el.tagName.toLowerCase();
    }
  });
  if (intent === "auth" && checks.hasLogin) {
    actions.push({
      action: "login",
      selector: "form",
      description: "Submit login credentials"
    });
  }
  if (intent === "auth" && checks.hasSocialLogin) {
    for (const provider of checks.socialProviders) {
      actions.push({
        action: `login-with-${provider}`,
        selector: `[class*="${provider}"], button:has-text("${provider}")`,
        description: `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
      });
    }
  }
  if (checks.hasSearch) {
    actions.push({
      action: "search",
      selector: checks.searchSelector || 'input[type="search"]',
      description: "Search for content"
    });
  }
  if (checks.hasSubmit && intent !== "auth") {
    actions.push({
      action: "submit",
      selector: checks.submitSelector || 'button[type="submit"]',
      description: "Submit form"
    });
  }
  if (checks.hasAdd) {
    actions.push({
      action: "create",
      selector: checks.addSelector || "button",
      description: "Create new item"
    });
  }
  if (intent === "listing") {
    if (checks.hasFilter) {
      actions.push({
        action: "filter",
        description: "Filter results"
      });
    }
    if (checks.hasSort) {
      actions.push({
        action: "sort",
        description: "Sort results"
      });
    }
    if (checks.hasPagination) {
      actions.push({
        action: "paginate",
        description: "Navigate to next/previous page"
      });
    }
  }
  if (checks.hasBack) {
    actions.push({
      action: "back",
      description: "Go back to previous page"
    });
  }
  return actions;
}
function collectIssues(state, intent, url = "") {
  const issues = [];
  for (const error of state.errors.errors) {
    issues.push({
      severity: error.type === "server" || error.type === "permission" ? "critical" : "major",
      type: error.type,
      problem: error.message,
      fix: getErrorFix(error.type)
    });
  }
  if (state.loading.loading && state.loading.elements > 3) {
    issues.push({
      severity: "minor",
      type: "slow-loading",
      problem: `Page has ${state.loading.elements} loading indicators`,
      fix: "Wait for content to load or check network"
    });
  }
  if (state.auth.authenticated === false && intent.intent === "dashboard") {
    issues.push({
      severity: "major",
      type: "auth-required",
      problem: "Dashboard requires authentication",
      fix: "Login first before accessing this page"
    });
  }
  if (intent.intent === "auth") {
    const socialProviders = state.auth.socialLoginProviders ?? [];
    if (socialProviders.length === 0) {
      issues.push({
        severity: "minor",
        type: "auth-no-social-login",
        problem: "Auth page has no social login options (Google, GitHub, etc.)",
        fix: "Add OAuth/social login buttons to reduce friction"
      });
    }
    const signals = state.auth.signals;
    const hasSignupLinkSignal = signals.includes("signup link visible") || (state.auth.hasSignupLink ?? false);
    const hasLoginLinkSignal = signals.includes("login link visible");
    const urlPath = (() => {
      try {
        return new URL(url).pathname.toLowerCase();
      } catch {
        return url.toLowerCase();
      }
    })();
    const isSignUp = hasLoginLinkSignal || urlPath.includes("sign-up") || urlPath.includes("signup") || urlPath.includes("register");
    const isSignIn = hasSignupLinkSignal || urlPath.includes("sign-in") || urlPath.includes("signin") || urlPath.includes("login");
    if (!state.auth.hasForgotPassword && (isSignIn || !isSignIn && !isSignUp)) {
      issues.push({
        severity: "minor",
        type: "auth-no-forgot-password",
        problem: "Sign-in page has no forgot password option",
        fix: 'Add a "Forgot your password?" link'
      });
    }
    if (!state.auth.hasPasswordToggle) {
      issues.push({
        severity: "minor",
        type: "auth-no-password-toggle",
        problem: "Password field has no show/hide toggle",
        fix: "Add a visibility toggle for the password field"
      });
    }
  }
  return issues;
}
function getErrorFix(errorType) {
  const fixes = {
    validation: "Fix the highlighted form fields",
    api: "Retry the request or check API status",
    permission: "Login with appropriate permissions",
    notfound: "Check the URL or navigate to a valid page",
    server: "Wait and retry, or contact support",
    network: "Check internet connection",
    unknown: "Investigate the error message"
  };
  return fixes[errorType] || "Investigate the issue";
}
function determineVerdict(state, issues) {
  const hasCritical = issues.some((i) => i.severity === "critical");
  if (hasCritical) return "ERROR";
  if (state.loading.loading) return "LOADING";
  if (state.errors.hasErrors) return "FAIL";
  const hasMajor = issues.some((i) => i.severity === "major");
  if (hasMajor) return "ISSUES";
  return "PASS";
}
function generateRecoveryHint(state, _intent) {
  if (state.auth.authenticated === false) {
    return {
      suggestion: "Login to access this page",
      alternatives: ["Use ibr.flow.login()", "Navigate to /login first"],
      waitFor: '[class*="user"], [class*="avatar"]'
    };
  }
  if (state.errors.errors.some((e) => e.type === "server")) {
    return {
      suggestion: "Server error - wait and retry",
      alternatives: ["Refresh the page", "Check server status"]
    };
  }
  if (state.errors.errors.some((e) => e.type === "notfound")) {
    return {
      suggestion: "Page not found - check URL",
      alternatives: ["Navigate to homepage", "Use search to find content"]
    };
  }
  if (state.loading.loading) {
    return {
      suggestion: "Wait for page to finish loading",
      waitFor: state.loading.type === "skeleton" ? ':not([class*="skeleton"])' : ':not([class*="loading"])'
    };
  }
  return {
    suggestion: "Investigate the page state and retry"
  };
}
function generateSummary(intent, state, verdict, issueCount) {
  const parts = [];
  parts.push(`${intent.intent} page`);
  if (intent.confidence < 0.5) {
    parts.push("(low confidence)");
  }
  if (state.auth.authenticated === true) {
    parts.push(`authenticated${state.auth.username ? ` as ${state.auth.username}` : ""}`);
  } else if (state.auth.authenticated === false) {
    parts.push("not authenticated");
  }
  if (state.loading.loading) {
    parts.push(`loading (${state.loading.type})`);
  }
  if (verdict === "PASS") {
    parts.push("ready for interaction");
  } else if (verdict === "ISSUES") {
    parts.push(`${issueCount} issue${issueCount > 1 ? "s" : ""} detected`);
  } else if (verdict === "ERROR" || verdict === "FAIL") {
    parts.push(`${issueCount} error${issueCount > 1 ? "s" : ""}`);
  }
  return parts.join(", ");
}
function formatSemanticText(result) {
  const lines = [];
  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Page: ${result.pageIntent.intent} (${Math.round(result.confidence * 100)}% confidence)`);
  lines.push(`Summary: ${result.summary}`);
  if (result.state.auth.authenticated !== null) {
    lines.push(`Auth: ${result.state.auth.authenticated ? "logged in" : "logged out"}`);
  }
  if (result.availableActions.length > 0) {
    lines.push(`Actions: ${result.availableActions.map((a) => a.action).join(", ")}`);
  }
  if (result.issues.length > 0) {
    lines.push(`Issues: ${result.issues.map((i) => i.problem).join("; ")}`);
  }
  if (result.recovery) {
    lines.push(`Recovery: ${result.recovery.suggestion}`);
  }
  return lines.join("\n");
}
function formatSemanticJson(result) {
  return JSON.stringify({
    verdict: result.verdict,
    intent: result.pageIntent.intent,
    confidence: result.confidence,
    authenticated: result.state.auth.authenticated,
    loading: result.state.loading.loading,
    ready: result.state.ready,
    actions: result.availableActions.map((a) => a.action),
    issues: result.issues.map((i) => ({ severity: i.severity, problem: i.problem })),
    recovery: result.recovery?.suggestion
  }, null, 2);
}
var init_output = __esm({
  "src/semantic/output.ts"() {
    "use strict";
    init_page_intent();
    init_state_detector();
  }
});

// src/semantic/index.ts
var semantic_exports = {};
__export(semantic_exports, {
  LANDMARK_SELECTORS: () => LANDMARK_SELECTORS,
  classifyPageIntent: () => classifyPageIntent,
  compareLandmarks: () => compareLandmarks,
  detectAuthState: () => detectAuthState,
  detectErrorState: () => detectErrorState,
  detectLandmarks: () => detectLandmarks,
  detectLoadingState: () => detectLoadingState,
  detectPageState: () => detectPageState,
  formatLandmarkComparison: () => formatLandmarkComparison,
  formatSemanticJson: () => formatSemanticJson,
  formatSemanticText: () => formatSemanticText,
  getExpectedLandmarksForIntent: () => getExpectedLandmarksForIntent,
  getExpectedLandmarksFromContext: () => getExpectedLandmarksFromContext,
  getIntentDescription: () => getIntentDescription,
  getSemanticOutput: () => getSemanticOutput,
  waitForPageReady: () => waitForPageReady
});
var init_semantic = __esm({
  "src/semantic/index.ts"() {
    "use strict";
    init_page_intent();
    init_state_detector();
    init_output();
    init_landmarks();
  }
});

// src/flows/types.ts
async function findFieldByLabel(page, labels) {
  for (const label of labels) {
    const selectors = [
      `input[name*="${label}" i]`,
      `input[id*="${label}" i]`,
      `input[placeholder*="${label}" i]`,
      `input[aria-label*="${label}" i]`,
      `label:has-text("${label}") + input`,
      `label:has-text("${label}") input`
    ];
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }
  return null;
}
async function findButton(page, patterns) {
  for (const pattern of patterns) {
    const selectors = [
      `button:has-text("${pattern}")`,
      `input[type="submit"][value*="${pattern}" i]`,
      `button[type="submit"]:has-text("${pattern}")`,
      `a:has-text("${pattern}")`,
      `[role="button"]:has-text("${pattern}")`
    ];
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }
  return page.$('button[type="submit"], input[type="submit"]');
}
async function waitForNavigation(page, timeout = 1e4) {
  try {
    await Promise.race([
      page.waitForNavigation?.(),
      page.waitForLoadState?.("networkidle", { timeout })
    ]);
  } catch {
  }
}
var init_types2 = __esm({
  "src/flows/types.ts"() {
    "use strict";
  }
});

// src/flows/login.ts
var login_exports = {};
__export(login_exports, {
  loginFlow: () => loginFlow
});
async function loginFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const timeout = options.timeout || 3e4;
  try {
    const emailField = await findFieldByLabel(page, [
      "email",
      "username",
      "login",
      "user",
      "mail"
    ]);
    if (!emailField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find email/username field",
        duration: Date.now() - startTime
      };
    }
    await emailField.fill?.(options.email);
    steps.push({ action: "fill email/username", success: true });
    const passwordField = await page.$('input[type="password"]');
    if (!passwordField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find password field",
        duration: Date.now() - startTime
      };
    }
    await passwordField.fill?.(options.password);
    steps.push({ action: "fill password", success: true });
    if (options.rememberMe) {
      const rememberCheckbox = await page.$(
        'input[type="checkbox"][name*="remember"], input[type="checkbox"][id*="remember"], label:has-text("remember") input[type="checkbox"]'
      );
      if (rememberCheckbox) {
        await rememberCheckbox.check?.();
        steps.push({ action: "check remember me", success: true });
      }
    }
    const submitButton = await findButton(page, [
      "login",
      "sign in",
      "log in",
      "submit",
      "continue"
    ]);
    if (!submitButton) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find submit button",
        duration: Date.now() - startTime
      };
    }
    await submitButton.click?.();
    steps.push({ action: "click submit", success: true });
    await waitForNavigation(page, timeout);
    steps.push({ action: "wait for response", success: true });
    const authState = await detectAuthState(page);
    const authenticated = authState.authenticated === true;
    let successVerified = authenticated;
    if (options.successIndicator && authenticated) {
      if (options.successIndicator.startsWith(".") || options.successIndicator.startsWith("#") || options.successIndicator.startsWith("[")) {
        const indicator = await page.$(options.successIndicator);
        successVerified = !!indicator;
      }
    }
    steps.push({
      action: "verify authentication",
      success: successVerified
    });
    return {
      success: successVerified,
      authenticated: successVerified,
      username: authState.username,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      authenticated: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}
var init_login = __esm({
  "src/flows/login.ts"() {
    "use strict";
    init_types2();
    init_state_detector();
  }
});

// src/flows/search.ts
var search_exports = {};
__export(search_exports, {
  aiSearchFlow: () => aiSearchFlow,
  searchFlow: () => searchFlow
});
async function searchFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const timeout = options.timeout || 1e4;
  try {
    const searchInput = await findFieldByLabel(page, [
      "search",
      "query",
      "q",
      "find"
    ]);
    const searchField = searchInput || await page.$(
      'input[type="search"], input[name="q"], input[name="query"], input[placeholder*="search" i], [role="searchbox"]'
    );
    if (!searchField) {
      return {
        success: false,
        resultCount: 0,
        hasResults: false,
        steps,
        error: "Could not find search input",
        duration: Date.now() - startTime
      };
    }
    await searchField.fill?.("");
    await searchField.fill?.(options.query);
    steps.push({ action: `type "${options.query}"`, success: true });
    if (options.submit !== false) {
      await searchField.press?.("Enter");
      steps.push({ action: "submit search", success: true });
      await waitForNavigation(page, timeout);
      steps.push({ action: "wait for results", success: true });
    } else {
      await page.waitForTimeout(500);
      steps.push({ action: "wait for autocomplete", success: true });
    }
    const resultsSelector = options.resultsSelector || '[class*="result"], [class*="item"], [class*="card"], [data-testid*="result"], li[class*="search"]';
    const results = await page.$$(resultsSelector);
    const resultCount = results.length;
    const hasResults = resultCount > 0;
    const emptyState = await page.$(
      '[class*="no-results"], [class*="empty"], :has-text("no results"), :has-text("nothing found")'
    );
    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults || !!emptyState
    });
    return {
      success: true,
      resultCount,
      hasResults,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      resultCount: 0,
      hasResults: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}
async function captureStepScreenshot(page, step, artifactDir, startTime) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const timing = Date.now() - startTime;
  const stepNum = { before: "01", "after-query": "02", loading: "03", results: "04" }[step];
  const filename = `${stepNum}-${step}.png`;
  const path2 = (0, import_path7.join)(artifactDir, filename);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
  await page.screenshot({
    path: path2,
    fullPage: false,
    type: "png"
  });
  return { step, path: path2, timestamp, timing };
}
async function extractResultContent(page, resultsSelector) {
  return page.evaluate((selector) => {
    const elements = document.querySelectorAll(selector);
    const results = [];
    elements.forEach((el, index) => {
      const htmlEl = el;
      const rect = htmlEl.getBoundingClientRect();
      const titleEl = htmlEl.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [class*="title"]');
      const title = titleEl?.textContent?.trim();
      const snippetEl = htmlEl.querySelector('p, [class*="snippet"], [class*="description"], [class*="summary"]');
      const snippet = snippetEl?.textContent?.trim();
      const fullText = htmlEl.textContent?.trim() || "";
      let selector2 = el.tagName.toLowerCase();
      if (el.id) {
        selector2 = `#${el.id}`;
      } else if (el.className && typeof el.className === "string") {
        const classes = el.className.split(" ").filter((c) => c.trim())[0];
        if (classes) selector2 += `.${classes}`;
        selector2 += `:nth-of-type(${index + 1})`;
      }
      results.push({
        index,
        title: title || void 0,
        snippet: snippet || void 0,
        fullText: fullText.slice(0, 500),
        // Limit length
        selector: selector2,
        visible: rect.top >= 0 && rect.top < window.innerHeight
      });
    });
    return results;
  }, resultsSelector);
}
async function aiSearchFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const screenshots = [];
  const timeout = options.timeout || 1e4;
  const captureSteps = options.captureSteps !== false;
  const extractContent = options.extractContent !== false;
  const timing = {
    total: 0,
    typing: 0,
    waiting: 0,
    rendering: 0
  };
  let artifactDir;
  if (captureSteps && options.sessionDir) {
    artifactDir = (0, import_path7.join)(options.sessionDir, `search-${Date.now()}`);
    await (0, import_promises8.mkdir)(artifactDir, { recursive: true });
  }
  try {
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "before", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture before screenshot", success: true, duration: shot.timing });
    }
    const searchInput = await findFieldByLabel(page, ["search", "query", "q", "find"]);
    const searchField = searchInput || await page.$(
      'input[type="search"], input[name="q"], input[name="query"], input[placeholder*="search" i], [role="searchbox"]'
    );
    if (!searchField) {
      return {
        success: false,
        query: options.query,
        userIntent: options.userIntent,
        resultCount: 0,
        hasResults: false,
        steps,
        screenshots,
        extractedResults: [],
        timing: { ...timing, total: Date.now() - startTime },
        error: "Could not find search input",
        duration: Date.now() - startTime,
        artifactDir
      };
    }
    const typingStart = Date.now();
    await searchField.fill?.("");
    await searchField.fill?.(options.query);
    timing.typing = Date.now() - typingStart;
    steps.push({ action: `type "${options.query}"`, success: true, duration: timing.typing });
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "after-query", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture after-query screenshot", success: true });
    }
    const waitingStart = Date.now();
    if (options.submit !== false) {
      await searchField.press?.("Enter");
      steps.push({ action: "submit search", success: true });
      await waitForNavigation(page, timeout);
      steps.push({ action: "wait for results", success: true });
    } else {
      await page.waitForTimeout(500);
      steps.push({ action: "wait for autocomplete", success: true });
    }
    timing.waiting = Date.now() - waitingStart;
    const renderingStart = Date.now();
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "results", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture results screenshot", success: true });
    }
    const resultsSelector = options.resultsSelector || '[class*="result"], [class*="item"], [class*="card"], [data-testid*="result"], li[class*="search"]';
    const resultElements = await page.$$(resultsSelector);
    const resultCount = resultElements.length;
    const hasResults = resultCount > 0;
    let extractedResults = [];
    if (extractContent && hasResults) {
      extractedResults = await extractResultContent(page, resultsSelector);
      steps.push({ action: `extracted ${extractedResults.length} results`, success: true });
    }
    timing.rendering = Date.now() - renderingStart;
    timing.total = Date.now() - startTime;
    if (artifactDir) {
      const resultsData = {
        query: options.query,
        userIntent: options.userIntent,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        resultCount,
        hasResults,
        timing,
        extractedResults
      };
      await (0, import_promises8.writeFile)(
        (0, import_path7.join)(artifactDir, "results.json"),
        JSON.stringify(resultsData, null, 2)
      );
    }
    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults
    });
    return {
      success: true,
      query: options.query,
      userIntent: options.userIntent,
      resultCount,
      hasResults,
      steps,
      screenshots,
      extractedResults,
      timing,
      duration: timing.total,
      artifactDir
    };
  } catch (error) {
    timing.total = Date.now() - startTime;
    return {
      success: false,
      query: options.query,
      userIntent: options.userIntent,
      resultCount: 0,
      hasResults: false,
      steps,
      screenshots,
      extractedResults: [],
      timing,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: timing.total,
      artifactDir
    };
  }
}
var import_promises8, import_path7;
var init_search = __esm({
  "src/flows/search.ts"() {
    "use strict";
    import_promises8 = require("fs/promises");
    import_path7 = require("path");
    init_types2();
  }
});

// src/flows/form.ts
var form_exports = {};
__export(form_exports, {
  formFlow: () => formFlow
});
async function formFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const filledFields = [];
  const failedFields = [];
  const timeout = options.timeout || 1e4;
  try {
    for (const field of options.fields) {
      const fieldType = field.type || "text";
      let element;
      if (fieldType === "textarea") {
        element = await page.$(`textarea[name*="${field.name}" i], textarea[id*="${field.name}" i]`);
      } else if (fieldType === "select") {
        element = await page.$(`select[name*="${field.name}" i], select[id*="${field.name}" i]`);
      } else if (fieldType === "checkbox" || fieldType === "radio") {
        element = await page.$(
          `input[type="${fieldType}"][name*="${field.name}" i], input[type="${fieldType}"][id*="${field.name}" i]`
        );
      } else {
        element = await findFieldByLabel(page, [field.name]);
      }
      if (element) {
        try {
          if (fieldType === "select") {
            await element.selectOption?.(field.value);
          } else if (fieldType === "checkbox") {
            if (field.value === "true" || field.value === "1") {
              await element.check?.();
            } else {
              await element.uncheck?.();
            }
          } else if (fieldType === "radio") {
            await element.check?.();
          } else {
            await element.fill?.(field.value);
          }
          filledFields.push(field.name);
          steps.push({ action: `fill ${field.name}`, success: true });
        } catch (err) {
          failedFields.push(field.name);
          steps.push({
            action: `fill ${field.name}`,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      } else {
        failedFields.push(field.name);
        steps.push({
          action: `fill ${field.name}`,
          success: false,
          error: "Field not found"
        });
      }
    }
    const submitPatterns = options.submitButton ? [options.submitButton] : ["submit", "save", "send", "continue", "confirm"];
    const submitButton = await findButton(page, submitPatterns);
    if (!submitButton) {
      return {
        success: false,
        filledFields,
        failedFields,
        steps,
        error: "Could not find submit button",
        duration: Date.now() - startTime
      };
    }
    await submitButton.click?.();
    steps.push({ action: "click submit", success: true });
    await waitForNavigation(page, timeout);
    steps.push({ action: "wait for response", success: true });
    let success = true;
    if (options.successSelector) {
      const successElement = await page.$(options.successSelector);
      success = !!successElement;
      steps.push({
        action: "verify success",
        success
      });
    }
    const errorElement = await page.$(
      '[class*="error"]:not([class*="error-boundary"]), [role="alert"][class*="error"], .form-error, .validation-error'
    );
    if (errorElement) {
      const errorText = await errorElement.textContent();
      success = false;
      steps.push({
        action: "check for errors",
        success: false,
        error: errorText?.trim() || "Form has errors"
      });
    }
    return {
      success: success && failedFields.length === 0,
      filledFields,
      failedFields,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      filledFields,
      failedFields,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}
var init_form = __esm({
  "src/flows/form.ts"() {
    "use strict";
    init_types2();
  }
});

// src/flows/search-validation.ts
var search_validation_exports = {};
__export(search_validation_exports, {
  analyzeForObviousIssues: () => analyzeForObviousIssues,
  formatValidationResult: () => formatValidationResult,
  generateDevModePrompt: () => generateDevModePrompt,
  generateQuickSummary: () => generateQuickSummary,
  generateValidationContext: () => generateValidationContext,
  generateValidationPrompt: () => generateValidationPrompt
});
function generateValidationContext(result) {
  return {
    query: result.query,
    userIntent: result.userIntent || `Find results related to: ${result.query}`,
    results: result.extractedResults,
    screenshotPaths: result.screenshots.map((s) => s.path),
    timing: result.timing,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    hasResults: result.hasResults,
    resultCount: result.resultCount
  };
}
function generateValidationPrompt(context) {
  const lines = [];
  lines.push("# Search Result Validation Request");
  lines.push("");
  lines.push("Please analyze the following search results and determine if they are relevant to the user's intent.");
  lines.push("");
  lines.push("## Search Details");
  lines.push(`- **Query:** "${context.query}"`);
  lines.push(`- **User Intent:** ${context.userIntent}`);
  lines.push(`- **Results Found:** ${context.resultCount}`);
  lines.push(`- **Total Time:** ${context.timing.total}ms`);
  lines.push("");
  if (context.screenshotPaths.length > 0) {
    lines.push("## Screenshots");
    lines.push("The following screenshots capture the search interaction:");
    for (const path2 of context.screenshotPaths) {
      lines.push(`- ${path2}`);
    }
    lines.push("");
    lines.push("*Please view these screenshots using the Read tool to see the visual state.*");
    lines.push("");
  }
  if (context.results.length > 0) {
    lines.push("## Extracted Results");
    lines.push("");
    for (const result of context.results.slice(0, 10)) {
      lines.push(`### Result ${result.index + 1}`);
      if (result.title) {
        lines.push(`**Title:** ${result.title}`);
      }
      if (result.snippet) {
        lines.push(`**Snippet:** ${result.snippet}`);
      }
      lines.push(`**Full Text:** ${result.fullText.slice(0, 200)}${result.fullText.length > 200 ? "..." : ""}`);
      lines.push(`**Visible:** ${result.visible ? "Yes" : "No"}`);
      lines.push("");
    }
    if (context.results.length > 10) {
      lines.push(`*...and ${context.results.length - 10} more results*`);
      lines.push("");
    }
  } else {
    lines.push("## No Results");
    lines.push("The search returned no results. This may indicate:");
    lines.push("- The search query is too specific");
    lines.push("- No matching content exists");
    lines.push("- A bug in the search functionality");
    lines.push("");
  }
  lines.push("## Validation Questions");
  lines.push("");
  lines.push("1. **Relevance:** Do the results match the user's intent?");
  lines.push("2. **Quality:** Are the results useful and informative?");
  lines.push("3. **Issues:** Are there any obvious problems (e.g., unrelated content)?");
  lines.push("4. **Suggestions:** What could improve the search experience?");
  lines.push("");
  lines.push("## Expected Response");
  lines.push("");
  lines.push("Please respond with:");
  lines.push("- `relevant`: true/false - whether results match user intent");
  lines.push("- `confidence`: 0-1 - how confident you are in the assessment");
  lines.push("- `reasoning`: brief explanation of your assessment");
  lines.push("- `suggestions`: (optional) array of improvement suggestions");
  lines.push("- `issues`: (optional) array of specific issues found");
  return lines.join("\n");
}
function generateQuickSummary(context) {
  const lines = [];
  lines.push(`Search: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push(`Results: ${context.resultCount} found in ${context.timing.total}ms`);
  if (context.results.length > 0) {
    lines.push("");
    lines.push("Top results:");
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 50);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
  }
  return lines.join("\n");
}
function analyzeForObviousIssues(context) {
  const issues = [];
  if (!context.hasResults) {
    issues.push({
      type: "empty",
      description: "Search returned no results",
      severity: "high"
    });
  }
  if (context.timing.total > 5e3) {
    issues.push({
      type: "slow",
      description: `Search took ${context.timing.total}ms (>5s)`,
      severity: context.timing.total > 1e4 ? "high" : "medium"
    });
  }
  for (const result of context.results) {
    if (!result.fullText || result.fullText.trim().length < 10) {
      issues.push({
        type: "error",
        resultIndex: result.index,
        description: `Result ${result.index + 1} has no meaningful content`,
        severity: "medium"
      });
    }
  }
  const queryTerms = context.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const result of context.results) {
    const textLower = result.fullText.toLowerCase();
    const matchCount = queryTerms.filter((term) => textLower.includes(term)).length;
    const matchRatio = matchCount / queryTerms.length;
    if (matchRatio < 0.2 && queryTerms.length > 1) {
      issues.push({
        type: "irrelevant",
        resultIndex: result.index,
        description: `Result ${result.index + 1} may not match query (low keyword overlap)`,
        severity: "low"
      });
    }
  }
  return issues;
}
function formatValidationResult(result) {
  const lines = [];
  const status = result.relevant ? "PASS" : "FAIL";
  const confidence = Math.round(result.confidence * 100);
  lines.push(`## Validation: ${status} (${confidence}% confidence)`);
  lines.push("");
  lines.push(`**Assessment:** ${result.reasoning}`);
  if (result.issues && result.issues.length > 0) {
    lines.push("");
    lines.push("**Issues Found:**");
    for (const issue of result.issues) {
      const severity = issue.severity.toUpperCase();
      lines.push(`- [${severity}] ${issue.description}`);
    }
  }
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push("");
    lines.push("**Suggestions:**");
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }
  return lines.join("\n");
}
function generateDevModePrompt(context, issues) {
  const lines = [];
  lines.push("## Search Results Review");
  lines.push("");
  lines.push(`Query: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push("");
  if (issues.length > 0) {
    lines.push("**Potential issues detected:**");
    for (const issue of issues) {
      lines.push(`- ${issue.description}`);
    }
    lines.push("");
  }
  if (context.results.length > 0) {
    lines.push("**Sample results:**");
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 40);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
    lines.push("");
  }
  lines.push("**What would you like to do?**");
  lines.push("1. Accept results as expected");
  lines.push("2. Refine the search query");
  lines.push("3. Report as bug");
  lines.push("4. Skip this test");
  return lines.join("\n");
}
var init_search_validation = __esm({
  "src/flows/search-validation.ts"() {
    "use strict";
  }
});

// src/flows/index.ts
var flows;
var init_flows = __esm({
  "src/flows/index.ts"() {
    "use strict";
    init_login();
    init_search();
    init_form();
    init_types2();
    init_search_validation();
    init_login();
    init_search();
    init_form();
    flows = {
      login: loginFlow,
      search: searchFlow,
      aiSearch: aiSearchFlow,
      form: formFlow
    };
  }
});

// src/cleanup.ts
async function loadRetentionConfig(outputDir) {
  const configPath = (0, import_path8.join)(outputDir, "..", ".ibrrc.json");
  try {
    await (0, import_promises9.access)(configPath);
    const content = await (0, import_promises9.readFile)(configPath, "utf-8");
    const config = JSON.parse(content);
    return {
      ...DEFAULT_RETENTION,
      ...config.retention
    };
  } catch {
    return DEFAULT_RETENTION;
  }
}
function isFailedSession(session) {
  return session.analysis?.verdict === "LAYOUT_BROKEN" || session.analysis?.verdict === "UNEXPECTED_CHANGE";
}
async function enforceRetentionPolicy(outputDir, config) {
  const retentionConfig = config || await loadRetentionConfig(outputDir);
  if (!retentionConfig.maxSessions && !retentionConfig.maxAgeDays) {
    const sessions2 = await listSessions(outputDir);
    return {
      deleted: [],
      kept: sessions2.map((s) => s.id),
      keptFailed: [],
      totalBefore: sessions2.length,
      totalAfter: sessions2.length
    };
  }
  const sessions = await listSessions(outputDir);
  const totalBefore = sessions.length;
  const deleted = [];
  const kept = [];
  const keptFailed = [];
  const cutoffTime = retentionConfig.maxAgeDays ? Date.now() - retentionConfig.maxAgeDays * 24 * 60 * 60 * 1e3 : 0;
  let keptCount = 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = retentionConfig.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = retentionConfig.maxSessions && keptCount >= retentionConfig.maxSessions;
    const isFailed = isFailedSession(session);
    if (isFailed && retentionConfig.keepFailed) {
      kept.push(session.id);
      keptFailed.push(session.id);
      continue;
    }
    if (isTooOld || isOverLimit) {
      await deleteSession(outputDir, session.id);
      deleted.push(session.id);
    } else {
      kept.push(session.id);
      keptCount++;
    }
  }
  return {
    deleted,
    kept,
    keptFailed,
    totalBefore,
    totalAfter: kept.length
  };
}
async function maybeAutoClean(outputDir) {
  const config = await loadRetentionConfig(outputDir);
  if (!config.autoClean) {
    return null;
  }
  return enforceRetentionPolicy(outputDir, config);
}
async function getRetentionStatus(outputDir) {
  const config = await loadRetentionConfig(outputDir);
  const sessions = await listSessions(outputDir);
  let wouldDelete = 0;
  const cutoffTime = config.maxAgeDays ? Date.now() - config.maxAgeDays * 24 * 60 * 60 * 1e3 : 0;
  let keptCount = 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = config.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = config.maxSessions && keptCount >= config.maxSessions;
    const isFailed = isFailedSession(session);
    if (isFailed && config.keepFailed) {
      continue;
    }
    if (isTooOld || isOverLimit) {
      wouldDelete++;
    } else {
      keptCount++;
    }
  }
  return {
    config,
    currentSessions: sessions.length,
    oldestSession: sessions.length > 0 ? new Date(sessions[sessions.length - 1].createdAt) : null,
    newestSession: sessions.length > 0 ? new Date(sessions[0].createdAt) : null,
    wouldDelete
  };
}
function formatRetentionStatus(status) {
  const lines = [];
  lines.push("Session Retention Status");
  lines.push("========================");
  lines.push("");
  lines.push(`Current sessions: ${status.currentSessions}`);
  if (status.oldestSession) {
    lines.push(`Oldest: ${status.oldestSession.toISOString()}`);
  }
  if (status.newestSession) {
    lines.push(`Newest: ${status.newestSession.toISOString()}`);
  }
  lines.push("");
  lines.push("Retention Policy:");
  if (status.config.maxSessions) {
    lines.push(`  Max sessions: ${status.config.maxSessions}`);
  } else {
    lines.push("  Max sessions: unlimited");
  }
  if (status.config.maxAgeDays) {
    lines.push(`  Max age: ${status.config.maxAgeDays} days`);
  } else {
    lines.push("  Max age: unlimited");
  }
  lines.push(`  Keep failed: ${status.config.keepFailed ? "yes" : "no"}`);
  lines.push(`  Auto-clean: ${status.config.autoClean ? "enabled" : "disabled"}`);
  if (status.wouldDelete > 0) {
    lines.push("");
    lines.push(`\u26A0\uFE0F  ${status.wouldDelete} session(s) would be deleted if cleanup runs`);
  } else {
    lines.push("");
    lines.push("\u2713 All sessions within retention policy");
  }
  return lines.join("\n");
}
var import_promises9, import_path8, DEFAULT_RETENTION;
var init_cleanup = __esm({
  "src/cleanup.ts"() {
    "use strict";
    import_promises9 = require("fs/promises");
    import_path8 = require("path");
    init_session();
    DEFAULT_RETENTION = {
      maxSessions: void 0,
      maxAgeDays: void 0,
      keepFailed: true,
      autoClean: false
    };
  }
});

// src/consistency.ts
var consistency_exports = {};
__export(consistency_exports, {
  analyzeThemeConsistency: () => analyzeThemeConsistency,
  checkConsistency: () => checkConsistency,
  formatConsistencyReport: () => formatConsistencyReport
});
function parseColor(color) {
  if (!color || color === "transparent") return null;
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }
  const named = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 }
  };
  return named[color.toLowerCase()] ?? null;
}
function relativeLuminance(r, g, b) {
  const linearize = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
async function analyzeThemeConsistency(page) {
  const data = await page.evaluate(() => {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
    const pageBg = bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent" ? bodyBg : htmlBg;
    const containerSelectors = [
      '[class*="card"]',
      '[class*="form"]',
      '[class*="dialog"]',
      '[class*="modal"]',
      '[class*="panel"]',
      "main > *",
      "form"
    ];
    const cards = [];
    const seen = /* @__PURE__ */ new Set();
    for (const sel of containerSelectors) {
      let elements;
      try {
        elements = Array.from(document.querySelectorAll(sel));
      } catch {
        continue;
      }
      for (const el of elements) {
        if (seen.has(el)) continue;
        seen.add(el);
        const bg = window.getComputedStyle(el).backgroundColor;
        if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;
        cards.push({ selector: sel, color: bg });
        if (cards.length >= 10) break;
      }
      if (cards.length >= 10) break;
    }
    return { pageBg, cards };
  });
  const pageParsed = parseColor(data.pageBg);
  const pageLuminance = pageParsed ? relativeLuminance(pageParsed.r, pageParsed.g, pageParsed.b) : 0.5;
  const pageBackground = { color: data.pageBg, luminance: pageLuminance };
  const contentCards = data.cards.map((c) => {
    const parsed = parseColor(c.color);
    const luminance = parsed ? relativeLuminance(parsed.r, parsed.g, parsed.b) : 0.5;
    return { selector: c.selector, color: c.color, luminance };
  });
  let themeMismatch = false;
  let mismatchDetails;
  const darkPage = pageLuminance < 0.2;
  const lightPage = pageLuminance > 0.7;
  for (const card of contentCards) {
    if (darkPage && card.luminance > 0.7) {
      themeMismatch = true;
      mismatchDetails = `Page background is dark (luminance ${pageLuminance.toFixed(3)}) but a content container matched by "${card.selector}" has a light background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
    if (lightPage && card.luminance < 0.2) {
      themeMismatch = true;
      mismatchDetails = `Page background is light (luminance ${pageLuminance.toFixed(3)}) but a content container matched by "${card.selector}" has a dark background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
  }
  return { pageBackground, contentCards, themeMismatch, mismatchDetails };
}
async function extractMetrics(page, url) {
  const parsedUrl = new URL(url);
  const metrics = await page.evaluate(() => {
    const getComputedStyleProp = (selector, prop) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(prop) || null;
    };
    const getElementHeight = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().height;
    };
    const getElementWidth = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().width;
    };
    const headerSelectors = ["header", '[role="banner"]', ".header", "#header", "nav"];
    const navSelectors = ["nav", '[role="navigation"]', ".sidebar", ".nav", "#sidebar"];
    const mainSelectors = ["main", '[role="main"]', ".content", "#content", ".main"];
    const footerSelectors = ["footer", '[role="contentinfo"]', ".footer", "#footer"];
    const buttonSelectors = ["button", ".btn", '[role="button"]', "a.button"];
    const cardSelectors = [".card", '[class*="card"]', ".panel", ".box"];
    const findFirst = (selectors, fn) => {
      for (const sel of selectors) {
        const result = fn(sel);
        if (result !== null) return result;
      }
      return null;
    };
    const getContentPadding = () => {
      for (const sel of mainSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const style = window.getComputedStyle(el);
          return {
            top: parseFloat(style.paddingTop) || 0,
            right: parseFloat(style.paddingRight) || 0,
            bottom: parseFloat(style.paddingBottom) || 0,
            left: parseFloat(style.paddingLeft) || 0
          };
        }
      }
      return null;
    };
    return {
      title: document.title,
      layout: {
        headerHeight: findFirst(headerSelectors, getElementHeight),
        navWidth: findFirst(navSelectors, getElementWidth),
        contentPadding: getContentPadding(),
        footerHeight: findFirst(footerSelectors, getElementHeight)
      },
      typography: {
        bodyFontFamily: getComputedStyleProp("body", "font-family"),
        bodyFontSize: getComputedStyleProp("body", "font-size"),
        headingFontFamily: getComputedStyleProp("h1, h2, h3", "font-family"),
        h1FontSize: getComputedStyleProp("h1", "font-size"),
        h2FontSize: getComputedStyleProp("h2", "font-size"),
        lineHeight: getComputedStyleProp("body", "line-height")
      },
      colors: {
        backgroundColor: getComputedStyleProp("body", "background-color"),
        textColor: getComputedStyleProp("body", "color"),
        linkColor: getComputedStyleProp("a", "color"),
        primaryButtonBg: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "background-color")),
        primaryButtonText: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "color"))
      },
      spacing: {
        buttonPadding: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "padding")),
        cardPadding: findFirst(cardSelectors, (s) => getComputedStyleProp(s, "padding")),
        sectionGap: getComputedStyleProp("main > *", "margin-bottom")
      }
    };
  });
  return {
    url,
    path: parsedUrl.pathname,
    ...metrics
  };
}
function findInconsistencies(pages, ignore = []) {
  const inconsistencies = [];
  const checkProperty = (type, property, getValue, description, severity = "warning") => {
    if (ignore.includes(type)) return;
    const values = pages.map((p) => ({
      path: p.path,
      value: getValue(p)
    }));
    const nonNullValues = values.filter((v) => v.value !== null);
    if (nonNullValues.length < 2) return;
    const uniqueValues = new Set(nonNullValues.map((v) => String(v.value)));
    if (uniqueValues.size > 1) {
      inconsistencies.push({
        type,
        property,
        severity,
        description,
        pages: values
      });
    }
  };
  checkProperty("layout", "headerHeight", (p) => p.layout.headerHeight, "Header height differs across pages");
  checkProperty("layout", "navWidth", (p) => p.layout.navWidth, "Navigation width differs across pages");
  checkProperty("layout", "footerHeight", (p) => p.layout.footerHeight, "Footer height differs across pages");
  checkProperty("typography", "bodyFontFamily", (p) => p.typography.bodyFontFamily, "Body font family differs across pages", "error");
  checkProperty("typography", "bodyFontSize", (p) => p.typography.bodyFontSize, "Body font size differs across pages");
  checkProperty("typography", "headingFontFamily", (p) => p.typography.headingFontFamily, "Heading font family differs across pages", "error");
  checkProperty("typography", "h1FontSize", (p) => p.typography.h1FontSize, "H1 font size differs across pages");
  checkProperty("typography", "lineHeight", (p) => p.typography.lineHeight, "Line height differs across pages");
  checkProperty("color", "backgroundColor", (p) => p.colors.backgroundColor, "Background color differs across pages");
  checkProperty("color", "textColor", (p) => p.colors.textColor, "Text color differs across pages", "error");
  checkProperty("color", "linkColor", (p) => p.colors.linkColor, "Link color differs across pages");
  checkProperty("color", "primaryButtonBg", (p) => p.colors.primaryButtonBg, "Primary button background differs across pages");
  checkProperty("spacing", "buttonPadding", (p) => p.spacing.buttonPadding, "Button padding differs across pages");
  checkProperty("spacing", "cardPadding", (p) => p.spacing.cardPadding, "Card padding differs across pages");
  return inconsistencies;
}
function calculateScore(inconsistencies) {
  if (inconsistencies.length === 0) return 100;
  const weights = { error: 10, warning: 5, info: 1 };
  const totalPenalty = inconsistencies.reduce((sum, i) => sum + weights[i.severity], 0);
  return Math.max(0, 100 - totalPenalty);
}
async function checkConsistency(options) {
  const { urls, timeout = 15e3, ignore = [] } = options;
  let driver3 = null;
  const pages = [];
  try {
    driver3 = new EngineDriver();
    await driver3.launch({
      headless: true,
      viewport: { width: 1920, height: 1080 }
    });
    const page = new CompatPage(driver3);
    for (const url of urls) {
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout
        });
        const metrics = await extractMetrics(page, url);
        pages.push(metrics);
      } catch (error) {
        console.error(`Failed to analyze ${url}:`, error instanceof Error ? error.message : error);
      }
    }
    await driver3.close();
  } catch (error) {
    if (driver3) await driver3.close();
    throw error;
  }
  if (pages.length < 2) {
    return {
      pages,
      inconsistencies: [],
      score: 100,
      summary: "Need at least 2 pages to check consistency"
    };
  }
  const inconsistencies = findInconsistencies(pages, ignore);
  const score = calculateScore(inconsistencies);
  const errorCount = inconsistencies.filter((i) => i.severity === "error").length;
  const warningCount = inconsistencies.filter((i) => i.severity === "warning").length;
  let summary;
  if (score === 100) {
    summary = `All ${pages.length} pages are consistent.`;
  } else if (score >= 80) {
    summary = `Minor inconsistencies found across ${pages.length} pages. ${warningCount} warning(s).`;
  } else if (score >= 50) {
    summary = `Notable inconsistencies found. ${errorCount} error(s), ${warningCount} warning(s).`;
  } else {
    summary = `Significant style inconsistencies detected. ${errorCount} error(s), ${warningCount} warning(s). Review recommended.`;
  }
  return {
    pages,
    inconsistencies,
    score,
    summary
  };
}
function formatConsistencyReport(result) {
  const lines = [];
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  UI CONSISTENCY REPORT");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("");
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Pages analyzed: ${result.pages.length}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push("");
  if (result.inconsistencies.length === 0) {
    lines.push("\u2713 No inconsistencies found");
  } else {
    lines.push("Inconsistencies:");
    lines.push("");
    for (const issue of result.inconsistencies) {
      const icon = issue.severity === "error" ? "\u2717" : issue.severity === "warning" ? "!" : "\u2139";
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);
      for (const page of issue.pages) {
        if (page.value !== null) {
          lines.push(`      ${page.path}: ${page.value}`);
        }
      }
      lines.push("");
    }
  }
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("Pages analyzed:");
  for (const page of result.pages) {
    lines.push(`  \u2022 ${page.path} (${page.title})`);
  }
  return lines.join("\n");
}
var init_consistency = __esm({
  "src/consistency.ts"() {
    "use strict";
    init_driver();
    init_compat();
  }
});

// src/crawl.ts
var crawl_exports = {};
__export(crawl_exports, {
  discoverPages: () => discoverPages,
  getNavigationLinks: () => getNavigationLinks
});
async function discoverPages(options) {
  const {
    url,
    maxPages = 5,
    pathPrefix,
    timeout = 1e4,
    includeExternal = false
  } = options;
  const startTime = Date.now();
  const startUrl = new import_url.URL(url);
  const origin = startUrl.origin;
  const discovered = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const queue = [
    { url, depth: 0 }
  ];
  let driver3 = null;
  let totalLinks = 0;
  try {
    driver3 = new EngineDriver();
    await driver3.launch({ headless: true });
    const page = new CompatPage(driver3);
    while (queue.length > 0 && discovered.size < maxPages) {
      const current = queue.shift();
      if (!current) break;
      const currentUrl = normalizeUrl(current.url);
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      try {
        await page.goto(current.url, {
          waitUntil: "domcontentloaded",
          timeout
        });
        const title = await page.title();
        const parsedUrl = new import_url.URL(current.url);
        discovered.set(currentUrl, {
          url: current.url,
          path: parsedUrl.pathname,
          title: title || parsedUrl.pathname,
          linkText: current.linkText,
          depth: current.depth
        });
        if (discovered.size >= maxPages) break;
        const links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          return anchors.map((a) => ({
            href: a.getAttribute("href") || "",
            text: a.textContent?.trim() || ""
          }));
        });
        totalLinks += links.length;
        for (const link of links) {
          if (discovered.size >= maxPages) break;
          try {
            const absoluteUrl = new import_url.URL(link.href, current.url);
            const normalizedUrl = normalizeUrl(absoluteUrl.href);
            if (visited.has(normalizedUrl)) continue;
            if (!includeExternal && absoluteUrl.origin !== origin) continue;
            if (pathPrefix && !absoluteUrl.pathname.startsWith(pathPrefix)) continue;
            if (shouldSkipUrl(absoluteUrl)) continue;
            queue.push({
              url: absoluteUrl.href,
              depth: current.depth + 1,
              linkText: link.text
            });
          } catch {
          }
        }
      } catch (error) {
        console.error(`Failed to load ${current.url}:`, error instanceof Error ? error.message : error);
      }
    }
    await driver3.close();
  } catch (error) {
    if (driver3) await driver3.close();
    throw error;
  }
  const crawlTime = Date.now() - startTime;
  return {
    baseUrl: origin,
    pages: Array.from(discovered.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.path.localeCompare(b.path);
    }),
    totalLinks,
    crawlTime
  };
}
function normalizeUrl(url) {
  try {
    const parsed = new import_url.URL(url);
    let normalized = `${parsed.origin}${parsed.pathname}`;
    if (normalized.endsWith("/") && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}
function shouldSkipUrl(url) {
  const path2 = url.pathname.toLowerCase();
  const skipExtensions = [
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".ico",
    ".woff",
    ".woff2",
    ".mp3",
    ".mp4",
    ".webm",
    ".zip",
    ".tar",
    ".gz"
  ];
  if (skipExtensions.some((ext) => path2.endsWith(ext))) return true;
  const skipPaths = [
    "/api/",
    "/static/",
    "/assets/",
    "/_next/",
    "/fonts/",
    "/images/",
    "/img/",
    "/cdn/",
    "/admin/",
    "/auth/"
  ];
  if (skipPaths.some((p) => path2.includes(p))) return true;
  if (url.hash && url.pathname === "/") return true;
  return false;
}
async function getNavigationLinks(url) {
  let driver3 = null;
  try {
    driver3 = new EngineDriver();
    await driver3.launch({ headless: true });
    const page = new CompatPage(driver3);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
    const origin = new import_url.URL(url).origin;
    const navLinks = await page.evaluate(() => {
      const selectors = [
        "nav a[href]",
        "header a[href]",
        '[role="navigation"] a[href]',
        ".nav a[href]",
        ".navbar a[href]",
        ".sidebar a[href]",
        ".menu a[href]"
      ];
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const selector of selectors) {
        const anchors = Array.from(document.querySelectorAll(selector));
        for (const a of anchors) {
          const href = a.getAttribute("href");
          const text = a.textContent?.trim();
          if (href && text && !seen.has(href)) {
            seen.add(href);
            links.push({ href, text });
          }
        }
      }
      return links;
    });
    await driver3.close();
    const pages = [];
    for (const link of navLinks) {
      try {
        const absoluteUrl = new import_url.URL(link.href, url);
        if (absoluteUrl.origin !== origin) continue;
        if (shouldSkipUrl(absoluteUrl)) continue;
        pages.push({
          url: absoluteUrl.href,
          path: absoluteUrl.pathname,
          title: link.text,
          linkText: link.text,
          depth: 1
        });
      } catch {
      }
    }
    const uniquePages = /* @__PURE__ */ new Map();
    for (const page2 of pages) {
      if (!uniquePages.has(page2.path)) {
        uniquePages.set(page2.path, page2);
      }
    }
    return Array.from(uniquePages.values());
  } catch (error) {
    if (driver3) await driver3.close();
    throw error;
  }
}
var import_url;
var init_crawl = __esm({
  "src/crawl.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_url = require("url");
  }
});

// src/integration.ts
var integration_exports = {};
__export(integration_exports, {
  discoverApiRoutes: () => discoverApiRoutes,
  extractApiCalls: () => extractApiCalls,
  filePathToRoute: () => filePathToRoute,
  filterByEndpoint: () => filterByEndpoint,
  filterByMethod: () => filterByMethod,
  findOrphanEndpoints: () => findOrphanEndpoints,
  groupByEndpoint: () => groupByEndpoint,
  groupByFile: () => groupByFile,
  scanDirectoryForApiCalls: () => scanDirectoryForApiCalls
});
function extractCallerContext(content, targetLine) {
  const lines = content.split("\n");
  for (let i = targetLine - 1; i >= Math.max(0, targetLine - 30); i--) {
    const line = lines[i];
    const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    const componentMatch = line.match(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)/);
    if (functionMatch) return functionMatch[1];
    if (arrowMatch) return arrowMatch[1];
    if (componentMatch) return componentMatch[1];
  }
  return void 0;
}
function parseEndpoint(rawEndpoint) {
  const hasTemplateLiteral = rawEndpoint.includes("${") || rawEndpoint.includes("`");
  const hasConcatenation = /['"].*\+|^\w+$/.test(rawEndpoint);
  if (hasTemplateLiteral || hasConcatenation) {
    return {
      endpoint: rawEndpoint.replace(/`/g, "").replace(/\$\{[^}]+\}/g, "{dynamic}"),
      isDynamic: true
    };
  }
  return {
    endpoint: rawEndpoint.replace(/['"]/g, ""),
    isDynamic: false
  };
}
function extractFromContent(content, sourceFile) {
  const calls = [];
  const lines = content.split("\n");
  const fetchPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1/g;
  const fetchWithOptionsPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*\{[^}]*method\s*:\s*['"](\w+)['"]/g;
  const axiosPattern = /axios\.(get|post|put|delete|patch|head|options)\s*\(\s*(['"`])([^'"`]+)\2/g;
  const axiosConfigPattern = /axios\s*\(\s*\{[^}]*url\s*:\s*(['"`])([^'"`]+)\1[^}]*method\s*:\s*['"](\w+)['"]/g;
  const templateLiteralPattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*`([^`]+)`/g;
  const urlVariablePattern = /const\s+(\w*[Uu]rl\w*)\s*=\s*(['"`])([^'"`]+)\2/g;
  const urlUsagePattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*(\w+)/g;
  const urlVariables = /* @__PURE__ */ new Map();
  lines.forEach((line, index) => {
    let match;
    const urlVarRegex = new RegExp(urlVariablePattern.source, "g");
    while ((match = urlVarRegex.exec(line)) !== null) {
      urlVariables.set(match[1], {
        endpoint: match[3],
        lineNumber: index + 1
      });
    }
  });
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let match;
    const fetchOptsRegex = new RegExp(fetchWithOptionsPattern.source, "g");
    while ((match = fetchOptsRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const fetchRegex = new RegExp(fetchPattern.source, "g");
    while ((match = fetchRegex.exec(line)) !== null) {
      if (!line.includes("method:")) {
        const { endpoint, isDynamic } = parseEndpoint(match[2]);
        calls.push({
          endpoint,
          method: "GET",
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }
    const axiosRegex = new RegExp(axiosPattern.source, "g");
    while ((match = axiosRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[3]);
      calls.push({
        endpoint,
        method: match[1].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const axiosConfigRegex = new RegExp(axiosConfigPattern.source, "g");
    while ((match = axiosConfigRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const templateRegex = new RegExp(templateLiteralPattern.source, "g");
    while ((match = templateRegex.exec(line)) !== null) {
      const { endpoint } = parseEndpoint(match[1]);
      let method = "GET";
      const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
      }
      calls.push({
        endpoint,
        method,
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic: true
        // Template literals are always dynamic
      });
    }
    const urlUsageRegex = new RegExp(urlUsagePattern.source, "g");
    while ((match = urlUsageRegex.exec(line)) !== null) {
      const varName = match[1];
      if (urlVariables.has(varName)) {
        const urlInfo = urlVariables.get(varName);
        const { endpoint, isDynamic } = parseEndpoint(urlInfo.endpoint);
        let method = "GET";
        const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }
        calls.push({
          endpoint,
          method,
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }
  });
  const uniqueCalls = calls.filter(
    (call, index, self) => index === self.findIndex(
      (c) => c.endpoint === call.endpoint && c.method === call.method && c.lineNumber === call.lineNumber
    )
  );
  return uniqueCalls;
}
async function extractApiCalls(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return extractFromContent(content, filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}
async function scanDirectoryForApiCalls(dir, _pattern = "**/*.{ts,tsx,js,jsx}") {
  const allCalls = [];
  async function scanDir(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next", "__tests__", "__mocks__"];
          if (!skipDirs.includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            const isTestFile = entry.name.includes(".test.") || entry.name.includes(".spec.") || entry.name.includes(".mock.") || entry.name === "integration.ts";
            if (!isTestFile) {
              const calls = await extractApiCalls(fullPath);
              allCalls.push(...calls);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error);
    }
  }
  await scanDir(dir);
  return allCalls;
}
function groupByEndpoint(calls) {
  const grouped = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const key = call.endpoint;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(call);
  }
  return grouped;
}
function groupByFile(calls) {
  const grouped = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const key = call.sourceFile;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(call);
  }
  return grouped;
}
function filterByMethod(calls, methods) {
  const upperMethods = methods.map((m) => m.toUpperCase());
  return calls.filter((call) => upperMethods.includes(call.method));
}
function filterByEndpoint(calls, endpointPattern) {
  const regex = new RegExp(
    "^" + endpointPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );
  return calls.filter((call) => regex.test(call.endpoint));
}
async function discoverApiRoutes(projectDir) {
  const routes = [];
  async function discoverInDir(dir) {
    const appApiDir = path.join(dir, "app", "api");
    if (await directoryExists(appApiDir)) {
      const appRoutes = await discoverAppRouterRoutes(appApiDir, dir);
      routes.push(...appRoutes);
    }
    const pagesApiDir = path.join(dir, "pages", "api");
    if (await directoryExists(pagesApiDir)) {
      const pagesRoutes = await discoverPagesRouterRoutes(pagesApiDir, dir);
      routes.push(...pagesRoutes);
    }
    const srcAppApiDir = path.join(dir, "src", "app", "api");
    if (await directoryExists(srcAppApiDir)) {
      const srcAppRoutes = await discoverAppRouterRoutes(srcAppApiDir, dir);
      routes.push(...srcAppRoutes);
    }
    const srcPagesApiDir = path.join(dir, "src", "pages", "api");
    if (await directoryExists(srcPagesApiDir)) {
      const srcPagesRoutes = await discoverPagesRouterRoutes(srcPagesApiDir, dir);
      routes.push(...srcPagesRoutes);
    }
  }
  await discoverInDir(projectDir);
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next"];
    for (const entry of entries) {
      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        const subDir = path.join(projectDir, entry.name);
        const hasPackageJson = await fileExists(path.join(subDir, "package.json"));
        if (hasPackageJson) {
          await discoverInDir(subDir);
        }
      }
    }
  } catch {
  }
  return routes;
}
async function fileExists(filePath) {
  try {
    const stat5 = await fs.stat(filePath);
    return stat5.isFile();
  } catch {
    return false;
  }
}
function filePathToRoute(filePath, projectDir) {
  const normalizedFilePath = path.normalize(filePath);
  const normalizedProjectDir = path.normalize(projectDir);
  const relativePath = path.relative(normalizedProjectDir, normalizedFilePath);
  let routePath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  routePath = routePath.replace(/\/route$/, "");
  routePath = routePath.replace(/\\route$/, "");
  let apiPath = "";
  if (routePath.includes("app/api/") || routePath.includes("app\\api\\")) {
    apiPath = routePath.split(/app[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("src/app/api/") || routePath.includes("src\\app\\api\\")) {
    apiPath = routePath.split(/src[/\\]app[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("pages/api/") || routePath.includes("pages\\api\\")) {
    apiPath = routePath.split(/pages[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("src/pages/api/") || routePath.includes("src\\pages\\api\\")) {
    apiPath = routePath.split(/src[/\\]pages[/\\]api[/\\]/)[1] || "";
  }
  const route = "/api/" + (apiPath ? apiPath.replace(/\\/g, "/") : "");
  return route;
}
function findOrphanEndpoints(apiCalls, apiRoutes) {
  const orphans = [];
  for (const call of apiCalls) {
    const endpoint = call.endpoint;
    if (!endpoint.startsWith("/api") && !endpoint.includes("/api/")) {
      continue;
    }
    if (endpoint.includes("{dynamic}")) {
      continue;
    }
    let apiPath = endpoint;
    if (endpoint.includes("/api/")) {
      apiPath = "/api/" + endpoint.split("/api/")[1].split("?")[0];
    }
    const matchedRoute = apiRoutes.find((route) => {
      const methodMatches = route.method.includes(call.method) || route.method.includes("ALL");
      if (!methodMatches) {
        return false;
      }
      return routeMatchesEndpoint(route.route, apiPath);
    });
    if (!matchedRoute) {
      const searchedLocations = generatePossibleRouteFiles(apiPath);
      orphans.push({
        call,
        searchedLocations
      });
    }
  }
  return orphans;
}
function routeMatchesEndpoint(routePattern, endpoint) {
  const routeParts = routePattern.split("/").filter(Boolean);
  const endpointParts = endpoint.split("/").filter(Boolean);
  if (routeParts.length !== endpointParts.length) {
    return false;
  }
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const endpointPart = endpointParts[i];
    if (routePart.startsWith("[") && routePart.endsWith("]")) {
      continue;
    }
    if (routePart !== endpointPart) {
      return false;
    }
  }
  return true;
}
function generatePossibleRouteFiles(apiPath) {
  const pathWithoutApi = apiPath.replace(/^\/api\//, "");
  const locations = [];
  locations.push(`app/api/${pathWithoutApi}/route.ts`);
  locations.push(`app/api/${pathWithoutApi}/route.js`);
  locations.push(`src/app/api/${pathWithoutApi}/route.ts`);
  locations.push(`src/app/api/${pathWithoutApi}/route.js`);
  locations.push(`pages/api/${pathWithoutApi}.ts`);
  locations.push(`pages/api/${pathWithoutApi}.js`);
  locations.push(`src/pages/api/${pathWithoutApi}.ts`);
  locations.push(`src/pages/api/${pathWithoutApi}.js`);
  return locations;
}
async function discoverAppRouterRoutes(apiDir, projectDir) {
  const routes = [];
  try {
    const files = await findRouteFiles(apiDir, "route");
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes("[") && route.includes("]");
      if (methods.length > 0) {
        routes.push({
          route,
          method: methods,
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
  }
  return routes;
}
async function discoverPagesRouterRoutes(apiDir, projectDir) {
  const routes = [];
  try {
    const files = await findRouteFiles(apiDir);
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes("[") && route.includes("]");
      if (methods.length > 0 || content.includes("export default")) {
        routes.push({
          route,
          method: methods.length > 0 ? methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
  }
  return routes;
}
async function findRouteFiles(dir, filename) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findRouteFiles(fullPath, filename);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const baseName = path.basename(entry.name, ext);
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          if (filename) {
            if (baseName === filename) {
              files.push(fullPath);
            }
          } else {
            files.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
  }
  return files;
}
function extractHttpMethods(content) {
  const methods = [];
  const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
  for (const method of httpMethods) {
    const exportPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, "g");
    if (exportPattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}
async function directoryExists(dir) {
  try {
    const stat5 = await fs.stat(dir);
    return stat5.isDirectory();
  } catch {
    return false;
  }
}
var fs, path;
var init_integration = __esm({
  "src/integration.ts"() {
    "use strict";
    fs = __toESM(require("fs/promises"));
    path = __toESM(require("path"));
  }
});

// src/operation-tracker.ts
function getOperationsPath(outputDir) {
  return (0, import_path9.join)(outputDir, "operations.json");
}
async function readState(outputDir) {
  const path2 = getOperationsPath(outputDir);
  try {
    const content = await (0, import_promises10.readFile)(path2, "utf-8");
    return JSON.parse(content);
  } catch {
    return { pending: [], lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
  }
}
async function writeState(outputDir, state) {
  const path2 = getOperationsPath(outputDir);
  await (0, import_promises10.mkdir)((0, import_path9.dirname)(path2), { recursive: true });
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await (0, import_promises10.writeFile)(path2, JSON.stringify(state, null, 2));
}
async function registerOperation(outputDir, options) {
  const state = await readState(outputDir);
  state.pending = await cleanupStaleOperations(state.pending);
  const operation = {
    id: `${OPERATION_PREFIX}${(0, import_nanoid2.nanoid)(8)}`,
    type: options.type,
    sessionId: options.sessionId,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pid: process.pid,
    command: options.command
  };
  state.pending.push(operation);
  await writeState(outputDir, state);
  return operation.id;
}
async function completeOperation(outputDir, operationId) {
  const state = await readState(outputDir);
  state.pending = state.pending.filter((op) => op.id !== operationId);
  await writeState(outputDir, state);
}
async function getPendingOperations(outputDir) {
  const state = await readState(outputDir);
  const activeOps = await cleanupStaleOperations(state.pending);
  if (activeOps.length !== state.pending.length) {
    state.pending = activeOps;
    await writeState(outputDir, state);
  }
  return activeOps;
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function cleanupStaleOperations(operations) {
  return operations.filter((op) => isProcessAlive(op.pid));
}
async function waitForCompletion(outputDir, options = {}) {
  const timeout = options.timeout ?? 3e4;
  const pollInterval = options.pollInterval ?? 500;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const pending = await getPendingOperations(outputDir);
    if (pending.length === 0) {
      return true;
    }
    if (options.onProgress) {
      options.onProgress(pending.length);
    }
    await new Promise((resolve5) => setTimeout(resolve5, pollInterval));
  }
  return false;
}
function formatPendingOperations(operations) {
  if (operations.length === 0) {
    return "No pending operations";
  }
  const lines = operations.map((op) => {
    const age = Math.round((Date.now() - new Date(op.startedAt).getTime()) / 1e3);
    return `  ${op.id.slice(0, 11)} | ${op.type.padEnd(10)} | ${op.sessionId.slice(0, 12)} | ${age}s`;
  });
  return [
    "  ID          | Type       | Session      | Age",
    "  ----------- | ---------- | ------------ | ---",
    ...lines
  ].join("\n");
}
function withOperationTracking(outputDir, options) {
  return async (fn) => {
    const opId = await registerOperation(outputDir, options);
    try {
      return await fn();
    } finally {
      await completeOperation(outputDir, opId);
    }
  };
}
var import_nanoid2, import_promises10, import_path9, OPERATION_PREFIX;
var init_operation_tracker = __esm({
  "src/operation-tracker.ts"() {
    "use strict";
    import_nanoid2 = require("nanoid");
    import_promises10 = require("fs/promises");
    import_path9 = require("path");
    OPERATION_PREFIX = "op_";
  }
});

// src/performance.ts
var performance_exports = {};
__export(performance_exports, {
  PERFORMANCE_THRESHOLDS: () => PERFORMANCE_THRESHOLDS,
  formatPerformanceResult: () => formatPerformanceResult,
  measurePerformance: () => measurePerformance,
  measureWebVitals: () => measureWebVitals
});
function rateMetric(value, thresholds) {
  if (value === null) return null;
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}
async function measureWebVitals(page) {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve5) => {
      const result = {
        LCP: null,
        FID: null,
        CLS: null,
        TTFB: null,
        FCP: null,
        TTI: null
      };
      const navEntry = performance.getEntriesByType("navigation")[0];
      if (navEntry) {
        result.TTFB = navEntry.responseStart - navEntry.requestStart;
      }
      const paintEntries = performance.getEntriesByType("paint");
      const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
      if (fcpEntry) {
        result.FCP = fcpEntry.startTime;
      }
      let lcpValue = null;
      let clsValue = 0;
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          lcpValue = lastEntry.startTime;
        }
      });
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      try {
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
      }
      try {
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch {
      }
      setTimeout(() => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
        result.LCP = lcpValue;
        result.CLS = clsValue;
        if (navEntry) {
          result.TTI = navEntry.domInteractive;
        }
        resolve5(result);
      }, 3e3);
    });
  });
  return metrics;
}
async function measurePerformance(page) {
  const metrics = await measureWebVitals(page);
  const ratings = {
    LCP: { value: metrics.LCP, rating: rateMetric(metrics.LCP, PERFORMANCE_THRESHOLDS.LCP) },
    FID: { value: metrics.FID, rating: rateMetric(metrics.FID, PERFORMANCE_THRESHOLDS.FID) },
    CLS: { value: metrics.CLS, rating: rateMetric(metrics.CLS, PERFORMANCE_THRESHOLDS.CLS) },
    TTFB: { value: metrics.TTFB, rating: rateMetric(metrics.TTFB, PERFORMANCE_THRESHOLDS.TTFB) },
    FCP: { value: metrics.FCP, rating: rateMetric(metrics.FCP, PERFORMANCE_THRESHOLDS.FCP) },
    TTI: { value: metrics.TTI, rating: rateMetric(metrics.TTI, PERFORMANCE_THRESHOLDS.TTI) }
  };
  const issues = [];
  const recommendations = [];
  let passedVitals = 0;
  let totalVitals = 0;
  const coreVitals = ["LCP", "CLS", "TTFB", "FCP"];
  for (const vital of coreVitals) {
    const rated = ratings[vital];
    if (rated.value !== null) {
      totalVitals++;
      if (rated.rating === "good") {
        passedVitals++;
      } else if (rated.rating === "poor") {
        issues.push(`${vital} is poor (${formatMetric(vital, rated.value)})`);
        recommendations.push(getRecommendation(vital));
      } else if (rated.rating === "needs-improvement") {
        issues.push(`${vital} needs improvement (${formatMetric(vital, rated.value)})`);
      }
    }
  }
  const poorCount = Object.values(ratings).filter((r) => r.rating === "poor").length;
  const needsImprovementCount = Object.values(ratings).filter((r) => r.rating === "needs-improvement").length;
  let overallRating = "good";
  if (poorCount > 0) {
    overallRating = "poor";
  } else if (needsImprovementCount > 0) {
    overallRating = "needs-improvement";
  }
  return {
    metrics,
    ratings,
    summary: {
      overallRating,
      passedVitals,
      totalVitals,
      issues,
      recommendations
    }
  };
}
function formatMetric(name, value) {
  if (name === "CLS") {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}
function getRecommendation(metric) {
  const recommendations = {
    LCP: "Optimize largest image/text block: use lazy loading, preload critical assets, optimize server response",
    FID: "Reduce JavaScript execution time: split code, defer non-critical JS, use web workers",
    CLS: "Reserve space for dynamic content: set explicit dimensions for images/ads/embeds",
    TTFB: "Improve server response: use CDN, optimize database queries, enable caching",
    FCP: "Eliminate render-blocking resources: inline critical CSS, defer non-critical JS",
    TTI: "Reduce main thread work: minimize/defer JavaScript, reduce DOM size"
  };
  return recommendations[metric];
}
function formatPerformanceResult(result) {
  const lines = [];
  lines.push("Performance Metrics");
  lines.push("===================");
  lines.push("");
  const ratingIcon = result.summary.overallRating === "good" ? "\u2713" : result.summary.overallRating === "needs-improvement" ? "~" : "\u2717";
  const ratingColor = result.summary.overallRating === "good" ? "\x1B[32m" : result.summary.overallRating === "needs-improvement" ? "\x1B[33m" : "\x1B[31m";
  lines.push(`Overall: ${ratingColor}${ratingIcon} ${result.summary.overallRating.toUpperCase()}\x1B[0m`);
  lines.push(`Passed: ${result.summary.passedVitals}/${result.summary.totalVitals} core vitals`);
  lines.push("");
  lines.push("Core Web Vitals:");
  const vitals = ["LCP", "FCP", "TTFB", "CLS"];
  for (const vital of vitals) {
    const rated = result.ratings[vital];
    if (rated.value !== null) {
      const icon = rated.rating === "good" ? "\u2713" : rated.rating === "needs-improvement" ? "~" : "\u2717";
      const color = rated.rating === "good" ? "\x1B[32m" : rated.rating === "needs-improvement" ? "\x1B[33m" : "\x1B[31m";
      lines.push(`  ${color}${icon}\x1B[0m ${vital}: ${formatMetric(vital, rated.value)}`);
    }
  }
  if (result.summary.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of result.summary.issues) {
      lines.push(`  ! ${issue}`);
    }
  }
  if (result.summary.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const rec of result.summary.recommendations) {
      lines.push(`  -> ${rec}`);
    }
  }
  return lines.join("\n");
}
var PERFORMANCE_THRESHOLDS;
var init_performance = __esm({
  "src/performance.ts"() {
    "use strict";
    PERFORMANCE_THRESHOLDS = {
      LCP: { good: 2500, poor: 4e3 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 },
      FCP: { good: 1800, poor: 3e3 },
      TTI: { good: 3800, poor: 7300 }
    };
  }
});

// src/interactivity.ts
var interactivity_exports = {};
__export(interactivity_exports, {
  formatInteractivityResult: () => formatInteractivityResult,
  testInteractivity: () => testInteractivity
});
async function testInteractivity(page) {
  const data = await page.evaluate(() => {
    const results = {
      buttons: [],
      links: [],
      forms: []
    };
    function hasEventHandler(el) {
      const inlineHandlers = ["onclick", "onmousedown", "onmouseup", "ontouchstart", "ontouchend"];
      for (const handler of inlineHandlers) {
        if (el.getAttribute(handler)) return true;
      }
      const attrs = Array.from(el.attributes).map((a) => a.name);
      const frameworkPatterns = ["@click", "v-on:click", "ng-click", "(click)"];
      for (const pattern of frameworkPatterns) {
        if (attrs.some((a) => a.includes(pattern) || a.startsWith(pattern))) return true;
      }
      if (el.getAttribute("data-action") || el.getAttribute("data-onclick")) return true;
      const tagName = el.tagName.toLowerCase();
      if (tagName === "a" && el.href) return true;
      if (tagName === "button") return true;
      if (tagName === "input" && ["submit", "button"].includes(el.type)) return true;
      return false;
    }
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).slice(0, 2).join(".");
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    }
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    for (const btn of buttons) {
      const el = btn;
      results.buttons.push({
        selector: getSelector(el),
        tagName: el.tagName.toLowerCase(),
        type: el.type || void 0,
        text: el.textContent?.trim() || el.value || void 0,
        hasHandler: hasEventHandler(el),
        isDisabled: el.disabled || el.getAttribute("aria-disabled") === "true",
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute("role") || void 0,
          ariaLabel: el.getAttribute("aria-label") || void 0,
          tabIndex: el.tabIndex
        },
        buttonType: el.type || void 0,
        formId: el.form?.id || void 0
      });
    }
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const link of links) {
      const el = link;
      const href = el.getAttribute("href") || "";
      const isPlaceholder = href === "#" || href === "" || href === "javascript:void(0)";
      results.links.push({
        selector: getSelector(el),
        tagName: "a",
        text: el.textContent?.trim() || void 0,
        hasHandler: hasEventHandler(el) || !isPlaceholder,
        isDisabled: el.getAttribute("aria-disabled") === "true",
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute("role") || void 0,
          ariaLabel: el.getAttribute("aria-label") || void 0,
          tabIndex: el.tabIndex
        },
        href,
        isPlaceholder,
        opensNewTab: el.target === "_blank",
        isExternal: el.hostname !== window.location.hostname
      });
    }
    const forms = Array.from(document.querySelectorAll("form"));
    for (const form of forms) {
      const el = form;
      const fields = [];
      const inputs = Array.from(el.querySelectorAll("input, select, textarea"));
      for (const input of inputs) {
        const field = input;
        if (["hidden", "submit", "button"].includes(field.type)) continue;
        const labelEl = el.querySelector(`label[for="${field.id}"]`) || field.closest("label");
        fields.push({
          selector: getSelector(field),
          name: field.name || void 0,
          type: field.type || field.tagName.toLowerCase(),
          label: labelEl?.textContent?.trim() || void 0,
          required: field.required,
          hasValidation: field.hasAttribute("pattern") || field.hasAttribute("min") || field.hasAttribute("max") || field.hasAttribute("minlength") || field.hasAttribute("maxlength")
        });
      }
      const submitBtn = el.querySelector('button[type="submit"], input[type="submit"]');
      let submitInfo;
      if (submitBtn) {
        const btn = submitBtn;
        submitInfo = {
          selector: getSelector(btn),
          tagName: btn.tagName.toLowerCase(),
          text: btn.textContent?.trim() || btn.value || void 0,
          hasHandler: hasEventHandler(btn),
          isDisabled: btn.disabled,
          isVisible: isVisible(btn),
          a11y: {
            role: btn.getAttribute("role") || void 0,
            ariaLabel: btn.getAttribute("aria-label") || void 0
          },
          buttonType: "submit"
        };
      }
      const hasSubmitHandler = hasEventHandler(el) || el.getAttribute("action") !== null || submitBtn !== null;
      results.forms.push({
        selector: getSelector(el),
        action: el.action || void 0,
        method: el.method || void 0,
        hasSubmitHandler,
        fields,
        hasValidation: fields.some((f) => f.hasValidation || f.required),
        submitButton: submitInfo
      });
    }
    return results;
  });
  const issues = [];
  for (const btn of data.buttons) {
    if (!btn.hasHandler && !btn.isDisabled) {
      issues.push({
        type: "NO_HANDLER",
        element: btn.selector,
        severity: "warning",
        description: `Button "${btn.text || btn.selector}" has no click handler`
      });
    }
    if (btn.isDisabled && btn.isVisible) {
    }
    if (!btn.a11y.ariaLabel && !btn.text) {
      issues.push({
        type: "MISSING_LABEL",
        element: btn.selector,
        severity: "error",
        description: `Button has no accessible label (no text or aria-label)`
      });
    }
  }
  for (const link of data.links) {
    if (link.isPlaceholder && !link.hasHandler) {
      issues.push({
        type: "PLACEHOLDER_LINK",
        element: link.selector,
        severity: "error",
        description: `Link "${link.text || link.selector}" has placeholder href without handler`
      });
    }
    if (!link.a11y.ariaLabel && !link.text) {
      issues.push({
        type: "MISSING_LABEL",
        element: link.selector,
        severity: "error",
        description: `Link has no accessible label (no text or aria-label)`
      });
    }
  }
  for (const form of data.forms) {
    if (!form.hasSubmitHandler) {
      issues.push({
        type: "FORM_NO_SUBMIT",
        element: form.selector,
        severity: "warning",
        description: `Form has no submit handler or action`
      });
    }
    for (const field of form.fields) {
      if (!field.label && field.type !== "hidden") {
        issues.push({
          type: "MISSING_LABEL",
          element: field.selector,
          severity: "warning",
          description: `Form field "${field.name || field.selector}" has no label`
        });
      }
    }
  }
  const allInteractive = [...data.buttons, ...data.links];
  const withHandlers = allInteractive.filter((e) => e.hasHandler).length;
  return {
    buttons: data.buttons,
    links: data.links,
    forms: data.forms,
    issues,
    summary: {
      totalInteractive: allInteractive.length,
      withHandlers,
      withoutHandlers: allInteractive.length - withHandlers,
      issueCount: {
        error: issues.filter((i) => i.severity === "error").length,
        warning: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length
      }
    }
  };
}
function formatInteractivityResult(result) {
  const lines = [];
  lines.push("Interactivity Analysis");
  lines.push("======================");
  lines.push("");
  lines.push(`Total interactive elements: ${result.summary.totalInteractive}`);
  lines.push(`  With handlers: ${result.summary.withHandlers}`);
  lines.push(`  Without handlers: ${result.summary.withoutHandlers}`);
  lines.push("");
  lines.push(`Buttons: ${result.buttons.length}`);
  lines.push(`Links: ${result.links.length}`);
  lines.push(`Forms: ${result.forms.length}`);
  lines.push("");
  if (result.forms.length > 0) {
    lines.push("Forms:");
    for (const form of result.forms) {
      const icon = form.hasSubmitHandler ? "\u2713" : "!";
      lines.push(`  ${icon} ${form.selector} (${form.fields.length} fields)`);
    }
    lines.push("");
  }
  if (result.issues.length > 0) {
    lines.push("Issues:");
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "i";
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);
    }
  } else {
    lines.push("No issues detected.");
  }
  return lines.join("\n");
}
var init_interactivity = __esm({
  "src/interactivity.ts"() {
    "use strict";
  }
});

// src/api-timing.ts
var api_timing_exports = {};
__export(api_timing_exports, {
  createApiTracker: () => createApiTracker,
  formatApiTimingResult: () => formatApiTimingResult,
  measureApiTiming: () => measureApiTiming
});
async function measureApiTiming(page, options = {}) {
  const {
    filter,
    includeStatic = false,
    timeout = 1e4,
    minDuration = 0
  } = options;
  const requests = /* @__PURE__ */ new Map();
  const completedRequests = [];
  const requestHandler = (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    if (!includeStatic && ["image", "font", "stylesheet", "media"].includes(resourceType)) {
      return;
    }
    if (filter && !filter.test(url)) {
      return;
    }
    requests.set(request, { startTime: Date.now() });
  };
  const responseHandler = async (response) => {
    const request = response.request();
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    if (duration < minDuration) {
      requests.delete(request);
      return;
    }
    try {
      const body = await response.body().catch(() => Buffer.alloc(0));
      const size = body.length;
      let timing = {};
      try {
        timing = response.request().timing();
      } catch {
      }
      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size,
        resourceType: request.resourceType(),
        timing: {
          dnsLookup: timing.domainLookupEnd !== void 0 && timing.domainLookupStart !== void 0 ? timing.domainLookupEnd - timing.domainLookupStart : void 0,
          tcpConnect: timing.connectEnd !== void 0 && timing.connectStart !== void 0 ? timing.connectEnd - timing.connectStart : void 0,
          requestSent: timing.requestStart !== void 0 && timing.connectEnd !== void 0 ? timing.requestStart - timing.connectEnd : void 0,
          waiting: timing.responseStart !== void 0 && timing.requestStart !== void 0 ? timing.responseStart - timing.requestStart : void 0,
          contentDownload: timing.responseEnd !== void 0 && timing.responseStart !== void 0 ? timing.responseEnd - timing.responseStart : void 0
        }
      });
    } catch {
    }
    requests.delete(request);
  };
  const requestFailedHandler = (request) => {
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration,
      status: 0,
      // 0 indicates failure
      size: 0,
      resourceType: request.resourceType(),
      timing: {}
    });
    requests.delete(request);
  };
  page.on("request", requestHandler);
  page.on("response", responseHandler);
  page.on("requestfailed", requestFailedHandler);
  await new Promise((resolve5) => {
    const startWait = Date.now();
    const check = () => {
      if (requests.size === 0 || Date.now() - startWait > timeout) {
        resolve5();
        return;
      }
      setTimeout(check, 100);
    };
    setTimeout(check, 1e3);
  });
  page.off?.("request", requestHandler);
  page.off?.("response", responseHandler);
  page.off?.("requestfailed", requestFailedHandler);
  const totalRequests = completedRequests.length;
  const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
  const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
  const failedRequests = completedRequests.filter((r) => r.status === 0 || r.status >= 400).length;
  let slowestRequest = null;
  let fastestRequest = null;
  if (completedRequests.length > 0) {
    const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
    slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
    fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
  }
  const byStatus = {};
  for (const req of completedRequests) {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
  }
  return {
    requests: completedRequests.sort((a, b) => b.duration - a.duration),
    summary: {
      totalRequests,
      totalTime,
      totalSize,
      averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
      slowestRequest,
      fastestRequest,
      failedRequests,
      byStatus
    }
  };
}
function createApiTracker(page, options = {}) {
  const {
    filter,
    includeStatic = false,
    minDuration = 0
  } = options;
  const requests = /* @__PURE__ */ new Map();
  const completedRequests = [];
  let isTracking = false;
  const requestHandler = (request) => {
    if (!isTracking) return;
    const url = request.url();
    const resourceType = request.resourceType();
    if (!includeStatic && ["image", "font", "stylesheet", "media"].includes(resourceType)) {
      return;
    }
    if (filter && !filter.test(url)) {
      return;
    }
    requests.set(request, { startTime: Date.now() });
  };
  const responseHandler = async (response) => {
    const request = response.request();
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    if (duration < minDuration) {
      requests.delete(request);
      return;
    }
    try {
      const body = await response.body().catch(() => Buffer.alloc(0));
      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size: body.length,
        resourceType: request.resourceType(),
        timing: {}
      });
    } catch {
    }
    requests.delete(request);
  };
  const requestFailedHandler = (request) => {
    const requestData = requests.get(request);
    if (!requestData) return;
    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration: Date.now() - requestData.startTime,
      status: 0,
      size: 0,
      resourceType: request.resourceType(),
      timing: {}
    });
    requests.delete(request);
  };
  return {
    start() {
      isTracking = true;
      page.on("request", requestHandler);
      page.on("response", responseHandler);
      page.on("requestfailed", requestFailedHandler);
    },
    stop() {
      isTracking = false;
      page.off?.("request", requestHandler);
      page.off?.("response", responseHandler);
      page.off?.("requestfailed", requestFailedHandler);
      const totalRequests = completedRequests.length;
      const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
      const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
      const failedRequests = completedRequests.filter((r) => r.status === 0 || r.status >= 400).length;
      let slowestRequest = null;
      let fastestRequest = null;
      if (completedRequests.length > 0) {
        const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
        slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
        fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
      }
      const byStatus = {};
      for (const req of completedRequests) {
        byStatus[req.status] = (byStatus[req.status] || 0) + 1;
      }
      return {
        requests: completedRequests.sort((a, b) => b.duration - a.duration),
        summary: {
          totalRequests,
          totalTime,
          totalSize,
          averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
          slowestRequest,
          fastestRequest,
          failedRequests,
          byStatus
        }
      };
    },
    getRequests() {
      return [...completedRequests];
    }
  };
}
function formatApiTimingResult(result) {
  const lines = [];
  lines.push("API Timing Analysis");
  lines.push("===================");
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Total requests: ${result.summary.totalRequests}`);
  lines.push(`  Total time: ${result.summary.totalTime}ms`);
  lines.push(`  Total size: ${formatBytes(result.summary.totalSize)}`);
  lines.push(`  Average time: ${result.summary.averageTime}ms`);
  lines.push(`  Failed requests: ${result.summary.failedRequests}`);
  lines.push("");
  if (result.summary.slowestRequest) {
    lines.push(`Slowest: ${result.summary.slowestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.slowestRequest.url)}`);
  }
  if (result.summary.fastestRequest && result.requests.length > 1) {
    lines.push(`Fastest: ${result.summary.fastestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.fastestRequest.url)}`);
  }
  lines.push("");
  if (result.requests.length > 0) {
    lines.push("Slowest requests:");
    const top10 = result.requests.slice(0, 10);
    for (const req of top10) {
      const statusIcon = req.status === 0 ? "\x1B[31m\u2717\x1B[0m" : req.status >= 400 ? "\x1B[31m!\x1B[0m" : "\x1B[32m\u2713\x1B[0m";
      lines.push(`  ${statusIcon} ${req.duration}ms ${req.method} ${truncateUrl(req.url)}`);
    }
  }
  return lines.join("\n");
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function truncateUrl(url, maxLength = 60) {
  try {
    const parsed = new URL(url);
    const path2 = parsed.pathname + parsed.search;
    if (path2.length > maxLength) {
      return path2.substring(0, maxLength - 3) + "...";
    }
    return path2;
  } catch {
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + "...";
    }
    return url;
  }
}
var init_api_timing = __esm({
  "src/api-timing.ts"() {
    "use strict";
  }
});

// src/responsive.ts
async function testResponsive(url, options = {}) {
  const {
    viewports = ["desktop", "tablet", "mobile"],
    captureScreenshots = false,
    outputDir = "./.ibr/responsive",
    minTouchTarget = 44,
    minFontSize = 12,
    timeout = 3e4
  } = options;
  const results = [];
  for (const viewportSpec of viewports) {
    let viewport;
    let viewportName;
    if (typeof viewportSpec === "string") {
      viewport = VIEWPORTS[viewportSpec];
      viewportName = viewportSpec;
    } else {
      viewport = viewportSpec;
      viewportName = `${viewportSpec.width}x${viewportSpec.height}`;
    }
    const driver3 = new EngineDriver();
    await driver3.launch({
      headless: true,
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = new CompatPage(driver3);
    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout
      });
      await page.waitForTimeout(500);
      const result = await analyzeViewport(page, viewport, viewportName, {
        minTouchTarget,
        minFontSize
      });
      if (captureScreenshots) {
        const { mkdir: mkdir26 } = await import("fs/promises");
        await mkdir26(outputDir, { recursive: true });
        const screenshotPath = `${outputDir}/${viewportName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;
      }
      results.push(result);
    } finally {
      await driver3.close();
    }
  }
  const totalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.length + r.touchTargets.filter((t) => t.isTooSmall).length + r.textIssues.length,
    0
  );
  const viewportsWithIssues = results.filter(
    (r) => r.layoutIssues.length > 0 || r.touchTargets.some((t) => t.isTooSmall) || r.textIssues.length > 0
  ).length;
  const criticalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.filter((i) => i.issue === "overflow" || i.issue === "hidden").length,
    0
  );
  return {
    url,
    results,
    summary: {
      totalIssues,
      viewportsWithIssues,
      criticalIssues
    }
  };
}
async function analyzeViewport(page, viewport, viewportName, options) {
  const isMobile = viewport.width < 768;
  const analysisResult = await page.evaluate(({ viewportWidth, minTouchTarget, minFontSize, isMobile: isMobile2 }) => {
    const layoutIssues = [];
    const touchTargets = [];
    const textIssues = [];
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).slice(0, 2).join(".");
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > viewportWidth) {
      layoutIssues.push({
        element: "body",
        issue: "overflow",
        description: `Page has horizontal overflow (${bodyWidth}px > ${viewportWidth}px viewport)`,
        bounds: { x: 0, y: 0, width: bodyWidth, height: document.body.scrollHeight }
      });
    }
    const allElements = Array.from(document.querySelectorAll("*"));
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        continue;
      }
      if (rect.right > viewportWidth + 10) {
        layoutIssues.push({
          element: getSelector(el),
          issue: "overflow",
          description: `Element extends ${Math.round(rect.right - viewportWidth)}px beyond viewport`,
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
      }
      if (style.textOverflow === "ellipsis" && style.overflow === "hidden") {
        const scrollWidth = el.scrollWidth;
        const clientWidth = el.clientWidth;
        if (scrollWidth > clientWidth) {
          layoutIssues.push({
            element: getSelector(el),
            issue: "truncated",
            description: "Text is truncated with ellipsis",
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          });
        }
      }
    }
    if (isMobile2) {
      const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ));
      for (const el of interactiveElements) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          continue;
        }
        const width = rect.width;
        const height = rect.height;
        const isTooSmall = width < minTouchTarget || height < minTouchTarget;
        touchTargets.push({
          element: el.textContent?.trim().slice(0, 30) || getSelector(el),
          selector: getSelector(el),
          size: { width: Math.round(width), height: Math.round(height) },
          minimumSize: minTouchTarget,
          isTooSmall
        });
      }
    }
    const textElements = Array.from(document.querySelectorAll("p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6"));
    for (const el of textElements) {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < minFontSize && el.textContent?.trim()) {
        textIssues.push({
          element: getSelector(el),
          issue: "too-small",
          fontSize: Math.round(fontSize)
        });
      }
    }
    return { layoutIssues, touchTargets, textIssues };
  }, {
    viewportWidth: viewport.width,
    minTouchTarget: options.minTouchTarget,
    minFontSize: options.minFontSize,
    isMobile
  });
  return {
    viewport,
    viewportName,
    ...analysisResult
  };
}
function formatResponsiveResult(result) {
  const lines = [];
  lines.push("Responsive Test Results");
  lines.push("=======================");
  lines.push("");
  lines.push(`URL: ${result.url}`);
  lines.push(`Viewports tested: ${result.results.length}`);
  lines.push("");
  const icon = result.summary.criticalIssues > 0 ? "\x1B[31m\u2717\x1B[0m" : result.summary.totalIssues > 0 ? "\x1B[33m!\x1B[0m" : "\x1B[32m\u2713\x1B[0m";
  lines.push(`${icon} Total issues: ${result.summary.totalIssues}`);
  lines.push(`   Critical: ${result.summary.criticalIssues}`);
  lines.push(`   Viewports with issues: ${result.summary.viewportsWithIssues}/${result.results.length}`);
  lines.push("");
  for (const vr of result.results) {
    const issueCount = vr.layoutIssues.length + vr.touchTargets.filter((t) => t.isTooSmall).length + vr.textIssues.length;
    const vpIcon = issueCount === 0 ? "\x1B[32m\u2713\x1B[0m" : "\x1B[33m!\x1B[0m";
    lines.push(`${vpIcon} ${vr.viewportName} (${vr.viewport.width}x${vr.viewport.height})`);
    if (issueCount === 0) {
      lines.push("   No issues detected");
    } else {
      if (vr.layoutIssues.length > 0) {
        lines.push("   Layout issues:");
        for (const issue of vr.layoutIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.issue}: ${issue.description}`);
        }
        if (vr.layoutIssues.length > 5) {
          lines.push(`     ... and ${vr.layoutIssues.length - 5} more`);
        }
      }
      const smallTargets = vr.touchTargets.filter((t) => t.isTooSmall);
      if (smallTargets.length > 0) {
        lines.push("   Small touch targets:");
        for (const target of smallTargets.slice(0, 5)) {
          lines.push(`     ! "${target.element}" is ${target.size.width}x${target.size.height}px (min: ${target.minimumSize}px)`);
        }
        if (smallTargets.length > 5) {
          lines.push(`     ... and ${smallTargets.length - 5} more`);
        }
      }
      if (vr.textIssues.length > 0) {
        lines.push("   Text issues:");
        for (const issue of vr.textIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.element}: ${issue.issue} (${issue.fontSize}px)`);
        }
        if (vr.textIssues.length > 5) {
          lines.push(`     ... and ${vr.textIssues.length - 5} more`);
        }
      }
    }
    if (vr.screenshot) {
      lines.push(`   Screenshot: ${vr.screenshot}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
var init_responsive = __esm({
  "src/responsive.ts"() {
    "use strict";
    init_driver();
    init_compat();
    init_schemas();
  }
});

// src/memory.ts
var memory_exports = {};
__export(memory_exports, {
  addPreference: () => addPreference,
  archiveSummary: () => archiveSummary,
  createMemoryPreset: () => createMemoryPreset,
  formatGlobalMemory: () => formatGlobalMemory,
  formatMemorySummary: () => formatMemorySummary,
  formatPreference: () => formatPreference,
  getPreference: () => getPreference,
  initMemory: () => initMemory,
  learnFromSession: () => learnFromSession,
  listGlobalPreferences: () => listGlobalPreferences,
  listLearned: () => listLearned,
  listPreferences: () => listPreferences,
  loadSummary: () => loadSummary,
  preferencesToRules: () => preferencesToRules,
  promoteToGlobal: () => promoteToGlobal,
  promoteToPreference: () => promoteToPreference,
  queryMemory: () => queryMemory,
  rebuildSummary: () => rebuildSummary,
  removeGlobalPreference: () => removeGlobalPreference,
  removePreference: () => removePreference,
  saveSummary: () => saveSummary,
  seedFromGlobal: () => seedFromGlobal
});
async function initMemory(outputDir) {
  const memoryDir = (0, import_path10.join)(outputDir, MEMORY_DIR);
  await (0, import_promises11.mkdir)((0, import_path10.join)(memoryDir, PREFERENCES_DIR), { recursive: true });
  await (0, import_promises11.mkdir)((0, import_path10.join)(memoryDir, LEARNED_DIR), { recursive: true });
  await (0, import_promises11.mkdir)((0, import_path10.join)(memoryDir, ARCHIVE_DIR), { recursive: true });
}
function getMemoryPath(outputDir, ...segments) {
  return (0, import_path10.join)(outputDir, MEMORY_DIR, ...segments);
}
async function loadSummary(outputDir) {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  if (!(0, import_fs2.existsSync)(summaryPath)) {
    return createEmptySummary();
  }
  try {
    const content = await (0, import_promises11.readFile)(summaryPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return createEmptySummary();
  }
}
async function saveSummary(outputDir, summary) {
  await initMemory(outputDir);
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  await (0, import_promises11.writeFile)(summaryPath, JSON.stringify(summary, null, 2));
}
function createEmptySummary() {
  return {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      totalPreferences: 0,
      totalLearned: 0,
      byCategory: {},
      bySource: {}
    },
    activePreferences: []
  };
}
async function addPreference(outputDir, input) {
  await initMemory(outputDir);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const pref = {
    id: `${PREF_PREFIX}${(0, import_nanoid3.nanoid)(8)}`,
    description: input.description,
    category: input.category,
    source: input.source ?? "user",
    route: input.route,
    componentType: input.componentType,
    expectation: {
      property: input.property,
      operator: input.operator ?? "equals",
      value: input.value
    },
    confidence: input.confidence ?? 1,
    createdAt: now,
    updatedAt: now,
    sessionIds: input.sessionIds
  };
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${pref.id}.json`);
  await (0, import_promises11.writeFile)(prefPath, JSON.stringify(pref, null, 2));
  await rebuildSummary(outputDir);
  return pref;
}
async function getPreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!(0, import_fs2.existsSync)(prefPath)) return null;
  try {
    const content = await (0, import_promises11.readFile)(prefPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function removePreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!(0, import_fs2.existsSync)(prefPath)) return false;
  await (0, import_promises11.unlink)(prefPath);
  await rebuildSummary(outputDir);
  return true;
}
async function listPreferences(outputDir, filter) {
  const prefsDir = getMemoryPath(outputDir, PREFERENCES_DIR);
  if (!(0, import_fs2.existsSync)(prefsDir)) return [];
  const files = await (0, import_promises11.readdir)(prefsDir);
  const prefs = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await (0, import_promises11.readFile)((0, import_path10.join)(prefsDir, file), "utf-8");
      const pref = JSON.parse(content);
      if (filter?.category && pref.category !== filter.category) continue;
      if (filter?.route && pref.route !== filter.route) continue;
      if (filter?.componentType && pref.componentType !== filter.componentType) continue;
      prefs.push(pref);
    } catch {
    }
  }
  return prefs.sort((a, b) => b.confidence - a.confidence);
}
async function learnFromSession(outputDir, session, observations) {
  await initMemory(outputDir);
  const route = new URL(session.url).pathname;
  const learned = {
    id: `${LEARN_PREFIX}${(0, import_nanoid3.nanoid)(8)}`,
    sessionId: session.id,
    route,
    observations,
    approved: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const learnPath = getMemoryPath(outputDir, LEARNED_DIR, `${learned.id}.json`);
  await (0, import_promises11.writeFile)(learnPath, JSON.stringify(learned, null, 2));
  return learned;
}
async function listLearned(outputDir) {
  const learnedDir = getMemoryPath(outputDir, LEARNED_DIR);
  if (!(0, import_fs2.existsSync)(learnedDir)) return [];
  const files = await (0, import_promises11.readdir)(learnedDir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await (0, import_promises11.readFile)((0, import_path10.join)(learnedDir, file), "utf-8");
      items.push(JSON.parse(content));
    } catch {
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function promoteToPreference(outputDir, learnedId) {
  const learnedPath = getMemoryPath(outputDir, LEARNED_DIR, `${learnedId}.json`);
  if (!(0, import_fs2.existsSync)(learnedPath)) return null;
  const content = await (0, import_promises11.readFile)(learnedPath, "utf-8");
  const learned = JSON.parse(content);
  if (learned.observations.length === 0) return null;
  const obs = learned.observations[0];
  const pref = await addPreference(outputDir, {
    description: obs.description,
    category: obs.category,
    source: "learned",
    route: learned.route,
    property: obs.property,
    value: obs.value,
    confidence: 0.8,
    sessionIds: [learned.sessionId]
  });
  return pref;
}
async function rebuildSummary(outputDir) {
  await archiveSummary(outputDir);
  const prefs = await listPreferences(outputDir);
  const learned = await listLearned(outputDir);
  const byCategory = {};
  const bySource = {};
  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1;
    bySource[pref.source] = (bySource[pref.source] || 0) + 1;
  }
  const activePrefs = prefs.slice(0, MAX_ACTIVE_PREFERENCES).map((pref) => ({
    id: pref.id,
    description: pref.description,
    category: pref.category,
    route: pref.route,
    componentType: pref.componentType,
    property: pref.expectation.property,
    operator: pref.expectation.operator,
    value: pref.expectation.value,
    confidence: pref.confidence
  }));
  const summary = {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      totalPreferences: prefs.length,
      totalLearned: learned.length,
      byCategory,
      bySource
    },
    activePreferences: activePrefs
  };
  await saveSummary(outputDir, summary);
  return summary;
}
async function archiveSummary(outputDir) {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  if (!(0, import_fs2.existsSync)(summaryPath)) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const archivePath = getMemoryPath(outputDir, ARCHIVE_DIR, `summary_${timestamp}.json`);
  try {
    await (0, import_promises11.copyFile)(summaryPath, archivePath);
  } catch {
  }
}
async function queryMemory(outputDir, query) {
  const summary = await loadSummary(outputDir);
  return summary.activePreferences.filter((pref) => {
    if (query.route && pref.route && !query.route.includes(pref.route)) return false;
    if (query.category && pref.category !== query.category) return false;
    if (query.componentType && pref.componentType !== query.componentType) return false;
    return true;
  });
}
function evaluateOperator(operator, actual, expected) {
  switch (operator) {
    case "equals":
      return actual.toLowerCase() === expected.toLowerCase();
    case "contains":
      return actual.toLowerCase().includes(expected.toLowerCase());
    case "matches":
      try {
        return new RegExp(expected, "i").test(actual);
      } catch {
        return false;
      }
    case "gte":
      return parseFloat(actual) >= parseFloat(expected);
    case "lte":
      return parseFloat(actual) <= parseFloat(expected);
    default:
      return false;
  }
}
function preferencesToRules(preferences) {
  return preferences.map((pref) => ({
    id: `memory-${pref.id}`,
    name: `Memory: ${pref.description}`,
    description: `User preference: ${pref.description}`,
    defaultSeverity: pref.confidence >= 0.8 ? "error" : "warn",
    check: (element, context) => {
      if (pref.route && !context.url.includes(pref.route)) return null;
      if (pref.componentType) {
        const matchesTag = element.tagName.toLowerCase() === pref.componentType.toLowerCase();
        const matchesRole = element.a11y?.role?.toLowerCase() === pref.componentType.toLowerCase();
        if (!matchesTag && !matchesRole) return null;
      }
      const styles = element.computedStyles;
      if (!styles) return null;
      const actual = styles[pref.property];
      if (!actual) return null;
      if (evaluateOperator(pref.operator, actual, pref.value)) return null;
      return {
        ruleId: `memory-${pref.id}`,
        ruleName: `Memory: ${pref.description}`,
        severity: pref.confidence >= 0.8 ? "error" : "warn",
        message: `Expected ${pref.property} to ${pref.operator} "${pref.value}", got "${actual}". (${pref.description})`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Update ${pref.property} to ${pref.value}`
      };
    }
  }));
}
function createMemoryPreset(preferences) {
  const rules2 = preferencesToRules(preferences);
  const defaults = {};
  for (const rule of rules2) {
    defaults[rule.id] = rule.defaultSeverity;
  }
  return {
    name: "memory",
    description: "UI/UX preferences from IBR memory",
    rules: rules2,
    defaults
  };
}
function formatMemorySummary(summary) {
  const lines = [];
  lines.push("IBR Memory");
  lines.push(`Updated: ${summary.updatedAt}`);
  lines.push("");
  lines.push(`Preferences: ${summary.stats.totalPreferences}`);
  lines.push(`Learned: ${summary.stats.totalLearned}`);
  if (Object.keys(summary.stats.byCategory).length > 0) {
    lines.push("");
    lines.push("By category:");
    for (const [cat, count] of Object.entries(summary.stats.byCategory)) {
      lines.push(`  ${cat}: ${count}`);
    }
  }
  if (summary.activePreferences.length > 0) {
    lines.push("");
    lines.push("Active preferences:");
    for (const pref of summary.activePreferences) {
      const scope = pref.route ? ` (${pref.route})` : " (global)";
      const conf = pref.confidence < 1 ? ` [${Math.round(pref.confidence * 100)}%]` : "";
      lines.push(`  ${pref.id}: ${pref.description}${scope}${conf}`);
    }
  }
  return lines.join("\n");
}
function formatPreference(pref) {
  const lines = [];
  lines.push(`ID: ${pref.id}`);
  lines.push(`Description: ${pref.description}`);
  lines.push(`Category: ${pref.category}`);
  lines.push(`Source: ${pref.source}`);
  lines.push(`Confidence: ${Math.round(pref.confidence * 100)}%`);
  lines.push(`Expectation: ${pref.expectation.property} ${pref.expectation.operator} "${pref.expectation.value}"`);
  if (pref.route) lines.push(`Route: ${pref.route}`);
  if (pref.componentType) lines.push(`Component: ${pref.componentType}`);
  if (pref.sessionIds?.length) lines.push(`Sessions: ${pref.sessionIds.join(", ")}`);
  lines.push(`Created: ${pref.createdAt}`);
  lines.push(`Updated: ${pref.updatedAt}`);
  return lines.join("\n");
}
async function initGlobalMemory() {
  await (0, import_promises11.mkdir)(GLOBAL_PREFS_DIR, { recursive: true });
}
async function promoteToGlobal(outputDir) {
  await initGlobalMemory();
  const localPrefs = await listPreferences(outputDir);
  const globalPrefs = await listGlobalPreferences();
  const globalIndex = new Set(
    globalPrefs.map((p) => `${p.expectation.property}|${p.expectation.operator}|${p.expectation.value}`)
  );
  const promoted = [];
  let skipped = 0;
  let alreadyGlobal = 0;
  for (const pref of localPrefs) {
    if (pref.route) {
      skipped++;
      continue;
    }
    if (pref.confidence < GLOBAL_PROMOTION_THRESHOLD) {
      skipped++;
      continue;
    }
    const key = `${pref.expectation.property}|${pref.expectation.operator}|${pref.expectation.value}`;
    if (globalIndex.has(key)) {
      alreadyGlobal++;
      continue;
    }
    const globalPref = {
      ...pref,
      id: `global_${(0, import_nanoid3.nanoid)(8)}`,
      source: "learned",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const globalPath = (0, import_path10.join)(GLOBAL_PREFS_DIR, `${globalPref.id}.json`);
    await (0, import_promises11.writeFile)(globalPath, JSON.stringify(globalPref, null, 2));
    globalIndex.add(key);
    promoted.push(`${pref.category}: ${pref.description}`);
  }
  await rebuildGlobalSummary();
  return { promoted, skipped, alreadyGlobal };
}
async function listGlobalPreferences() {
  if (!(0, import_fs2.existsSync)(GLOBAL_PREFS_DIR)) return [];
  const files = await (0, import_promises11.readdir)(GLOBAL_PREFS_DIR);
  const prefs = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await (0, import_promises11.readFile)((0, import_path10.join)(GLOBAL_PREFS_DIR, file), "utf-8");
      prefs.push(JSON.parse(content));
    } catch {
    }
  }
  return prefs.sort((a, b) => b.confidence - a.confidence);
}
async function seedFromGlobal(outputDir) {
  await initMemory(outputDir);
  const globalPrefs = await listGlobalPreferences();
  const localPrefs = await listPreferences(outputDir);
  const localIndex = new Set(
    localPrefs.map((p) => `${p.expectation.property}|${p.expectation.operator}|${p.expectation.value}`)
  );
  const seeded = [];
  let skipped = 0;
  for (const pref of globalPrefs) {
    const key = `${pref.expectation.property}|${pref.expectation.operator}|${pref.expectation.value}`;
    if (localIndex.has(key)) {
      skipped++;
      continue;
    }
    await addPreference(outputDir, {
      description: pref.description,
      category: pref.category,
      source: "learned",
      componentType: pref.componentType,
      property: pref.expectation.property,
      operator: pref.expectation.operator,
      value: pref.expectation.value,
      confidence: 0.7
      // Lower than locally-learned (0.8)
    });
    seeded.push(`${pref.category}: ${pref.description}`);
  }
  return { seeded, skipped };
}
async function rebuildGlobalSummary() {
  const prefs = await listGlobalPreferences();
  const byCategory = {};
  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1;
  }
  const summary = {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    totalPreferences: prefs.length,
    byCategory,
    preferences: prefs.slice(0, MAX_ACTIVE_PREFERENCES).map((p) => ({
      id: p.id,
      description: p.description,
      category: p.category,
      property: p.expectation.property,
      operator: p.expectation.operator,
      value: p.expectation.value,
      confidence: p.confidence
    }))
  };
  await (0, import_promises11.writeFile)(GLOBAL_SUMMARY, JSON.stringify(summary, null, 2));
}
async function removeGlobalPreference(prefId) {
  const prefPath = (0, import_path10.join)(GLOBAL_PREFS_DIR, `${prefId}.json`);
  if (!(0, import_fs2.existsSync)(prefPath)) return false;
  await (0, import_promises11.unlink)(prefPath);
  await rebuildGlobalSummary();
  return true;
}
function formatGlobalMemory(prefs) {
  if (prefs.length === 0) return "No global preferences. Run `memory:promote` to promote local patterns.";
  const lines = [
    `Global Memory: ${prefs.length} preferences`,
    `Location: ${GLOBAL_DIR}`,
    ""
  ];
  const byCategory = /* @__PURE__ */ new Map();
  for (const p of prefs) {
    const arr = byCategory.get(p.category) || [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }
  for (const [cat, catPrefs] of byCategory) {
    lines.push(`  ${cat} (${catPrefs.length}):`);
    for (const p of catPrefs) {
      lines.push(`    ${p.id}: ${p.description} [${Math.round(p.confidence * 100)}%]`);
    }
  }
  return lines.join("\n");
}
var import_promises11, import_fs2, import_path10, import_os2, import_nanoid3, MEMORY_DIR, SUMMARY_FILE, PREFERENCES_DIR, LEARNED_DIR, ARCHIVE_DIR, PREF_PREFIX, LEARN_PREFIX, MAX_ACTIVE_PREFERENCES, GLOBAL_DIR, GLOBAL_PREFS_DIR, GLOBAL_SUMMARY, GLOBAL_PROMOTION_THRESHOLD;
var init_memory = __esm({
  "src/memory.ts"() {
    "use strict";
    import_promises11 = require("fs/promises");
    import_fs2 = require("fs");
    import_path10 = require("path");
    import_os2 = require("os");
    import_nanoid3 = require("nanoid");
    MEMORY_DIR = "memory";
    SUMMARY_FILE = "summary.json";
    PREFERENCES_DIR = "preferences";
    LEARNED_DIR = "learned";
    ARCHIVE_DIR = "archive";
    PREF_PREFIX = "pref_";
    LEARN_PREFIX = "learn_";
    MAX_ACTIVE_PREFERENCES = 50;
    GLOBAL_DIR = (0, import_path10.join)((0, import_os2.homedir)(), ".ibr", "global-memory");
    GLOBAL_PREFS_DIR = (0, import_path10.join)(GLOBAL_DIR, "preferences");
    GLOBAL_SUMMARY = (0, import_path10.join)(GLOBAL_DIR, "summary.json");
    GLOBAL_PROMOTION_THRESHOLD = 0.9;
  }
});

// src/context/types.ts
var types_exports = {};
__export(types_exports, {
  CompactContextSchema: () => CompactContextSchema,
  CompactionRequestSchema: () => CompactionRequestSchema,
  CompactionResultSchema: () => CompactionResultSchema,
  CurrentUIStateSchema: () => CurrentUIStateSchema,
  DecisionEntrySchema: () => DecisionEntrySchema,
  DecisionEntryWithChecksSchema: () => DecisionEntryWithChecksSchema,
  DecisionStateSchema: () => DecisionStateSchema,
  DecisionSummarySchema: () => DecisionSummarySchema,
  DecisionTypeSchema: () => DecisionTypeSchema,
  DesignChangeSchema: () => DesignChangeSchema,
  DesignCheckOperatorSchema: () => DesignCheckOperatorSchema,
  DesignCheckSchema: () => DesignCheckSchema
});
var import_zod2, DecisionTypeSchema, DecisionStateSchema, DecisionEntrySchema, DecisionSummarySchema, CurrentUIStateSchema, CompactContextSchema, CompactionRequestSchema, CompactionResultSchema, DesignCheckOperatorSchema, DesignCheckSchema, DesignChangeSchema, DecisionEntryWithChecksSchema;
var init_types3 = __esm({
  "src/context/types.ts"() {
    "use strict";
    import_zod2 = require("zod");
    DecisionTypeSchema = import_zod2.z.enum([
      "css_change",
      "layout_change",
      "color_change",
      "spacing_change",
      "component_add",
      "component_remove",
      "component_modify",
      "content_change"
    ]);
    DecisionStateSchema = import_zod2.z.object({
      css: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
      html_snippet: import_zod2.z.string().optional(),
      screenshot_ref: import_zod2.z.string().optional()
    });
    DecisionEntrySchema = import_zod2.z.object({
      id: import_zod2.z.string(),
      timestamp: import_zod2.z.string().datetime(),
      route: import_zod2.z.string(),
      component: import_zod2.z.string().optional(),
      type: DecisionTypeSchema,
      description: import_zod2.z.string(),
      rationale: import_zod2.z.string().optional(),
      before: DecisionStateSchema.optional(),
      after: DecisionStateSchema.optional(),
      files_changed: import_zod2.z.array(import_zod2.z.string()),
      session_id: import_zod2.z.string().optional()
    });
    DecisionSummarySchema = import_zod2.z.object({
      route: import_zod2.z.string(),
      component: import_zod2.z.string().optional(),
      latest_change: import_zod2.z.string(),
      decision_count: import_zod2.z.number(),
      full_log_ref: import_zod2.z.string()
    });
    CurrentUIStateSchema = import_zod2.z.object({
      last_snapshot_ref: import_zod2.z.string().optional(),
      pending_verifications: import_zod2.z.number(),
      known_issues: import_zod2.z.array(import_zod2.z.string())
    });
    CompactContextSchema = import_zod2.z.object({
      version: import_zod2.z.literal(1),
      session_id: import_zod2.z.string(),
      updated_at: import_zod2.z.string().datetime(),
      active_route: import_zod2.z.string().optional(),
      decisions_summary: import_zod2.z.array(DecisionSummarySchema),
      current_ui_state: CurrentUIStateSchema,
      preferences_active: import_zod2.z.number()
    });
    CompactionRequestSchema = import_zod2.z.object({
      reason: import_zod2.z.enum(["session_ending", "context_limit", "manual"]),
      preserve_decisions: import_zod2.z.array(import_zod2.z.string()).optional()
    });
    CompactionResultSchema = import_zod2.z.object({
      compact_context: CompactContextSchema,
      archived_to: import_zod2.z.string(),
      decisions_compacted: import_zod2.z.number(),
      decisions_preserved: import_zod2.z.number()
    });
    DesignCheckOperatorSchema = import_zod2.z.enum([
      "eq",
      // exact equality
      "gt",
      // numeric greater-than
      "lt",
      // numeric less-than
      "contains",
      // substring or token match
      "not",
      // negation
      "exists",
      // element is present in AX tree
      "truthy"
      // value is non-empty / non-zero
    ]);
    DesignCheckSchema = import_zod2.z.object({
      property: import_zod2.z.string(),
      operator: DesignCheckOperatorSchema,
      value: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]),
      confidence: import_zod2.z.number().min(0).max(1)
    });
    DesignChangeSchema = import_zod2.z.object({
      description: import_zod2.z.string(),
      element: import_zod2.z.string(),
      checks: import_zod2.z.array(DesignCheckSchema),
      source: import_zod2.z.enum(["structured", "parsed"]),
      platform: import_zod2.z.enum(["web", "ios", "macos"]).optional(),
      timestamp: import_zod2.z.string()
    });
    DecisionEntryWithChecksSchema = DecisionEntrySchema.extend({
      checks: import_zod2.z.array(DesignCheckSchema).optional()
    });
  }
});

// src/decision-tracker.ts
function getDecisionsDir(outputDir) {
  return (0, import_path11.join)(outputDir, CONTEXT_DIR, DECISIONS_DIR);
}
function routeToFilename(route) {
  return route.replace(/^\/+/, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "_root";
}
function getRouteLogPath(outputDir, route) {
  const filename = `${routeToFilename(route)}.jsonl`;
  return (0, import_path11.join)(getDecisionsDir(outputDir), filename);
}
async function ensureContextDirs(outputDir) {
  await (0, import_promises12.mkdir)(getDecisionsDir(outputDir), { recursive: true });
}
async function recordDecision(outputDir, options) {
  await ensureContextDirs(outputDir);
  const entry = {
    id: `dec_${(0, import_nanoid4.nanoid)(10)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: options.route,
    component: options.component,
    type: options.type,
    description: options.description,
    rationale: options.rationale,
    before: options.before,
    after: options.after,
    files_changed: options.files_changed,
    session_id: options.session_id
  };
  DecisionEntrySchema.parse(entry);
  const logPath = getRouteLogPath(outputDir, options.route);
  await (0, import_promises12.appendFile)(logPath, JSON.stringify(entry) + "\n");
  return entry;
}
async function getDecisionsByRoute(outputDir, route) {
  const logPath = getRouteLogPath(outputDir, route);
  if (!(0, import_fs3.existsSync)(logPath)) {
    return [];
  }
  const content = await (0, import_promises12.readFile)(logPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.map((line) => DecisionEntrySchema.parse(JSON.parse(line)));
}
async function queryDecisions(outputDir, options = {}) {
  const { route, component, type, since, limit = 50 } = options;
  let decisions = [];
  if (route) {
    decisions = await getDecisionsByRoute(outputDir, route);
  } else {
    const decisionsDir = getDecisionsDir(outputDir);
    if (!(0, import_fs3.existsSync)(decisionsDir)) {
      return [];
    }
    const files = await (0, import_promises12.readdir)(decisionsDir);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = (0, import_path11.join)(decisionsDir, file);
      const content = await (0, import_promises12.readFile)(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        decisions.push(DecisionEntrySchema.parse(JSON.parse(line)));
      }
    }
  }
  if (component) {
    decisions = decisions.filter((d) => d.component === component);
  }
  if (type) {
    decisions = decisions.filter((d) => d.type === type);
  }
  if (since) {
    const sinceTime = new Date(since).getTime();
    decisions = decisions.filter((d) => new Date(d.timestamp).getTime() >= sinceTime);
  }
  decisions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return decisions.slice(0, limit);
}
async function getDecision(outputDir, decisionId) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!(0, import_fs3.existsSync)(decisionsDir)) {
    return null;
  }
  const files = await (0, import_promises12.readdir)(decisionsDir);
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = (0, import_path11.join)(decisionsDir, file);
    const content = await (0, import_promises12.readFile)(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const entry = DecisionEntrySchema.parse(JSON.parse(line));
      if (entry.id === decisionId) {
        return entry;
      }
    }
  }
  return null;
}
async function getTrackedRoutes(outputDir) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!(0, import_fs3.existsSync)(decisionsDir)) {
    return [];
  }
  const files = await (0, import_promises12.readdir)(decisionsDir);
  return files.filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(".jsonl", "").replace(/_/g, "/").replace(/^\/?/, "/"));
}
async function getDecisionStats(outputDir) {
  const all = await queryDecisions(outputDir, { limit: 1e4 });
  const byRoute = {};
  const byType = {};
  for (const d of all) {
    byRoute[d.route] = (byRoute[d.route] || 0) + 1;
    byType[d.type] = (byType[d.type] || 0) + 1;
  }
  return { total: all.length, byRoute, byType };
}
async function getDecisionsSize(outputDir) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!(0, import_fs3.existsSync)(decisionsDir)) {
    return 0;
  }
  const files = await (0, import_promises12.readdir)(decisionsDir);
  let total = 0;
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const s = await (0, import_promises12.stat)((0, import_path11.join)(decisionsDir, file));
    total += s.size;
  }
  return total;
}
var import_nanoid4, import_promises12, import_path11, import_fs3, CONTEXT_DIR, DECISIONS_DIR;
var init_decision_tracker = __esm({
  "src/decision-tracker.ts"() {
    "use strict";
    import_nanoid4 = require("nanoid");
    import_promises12 = require("fs/promises");
    import_path11 = require("path");
    import_fs3 = require("fs");
    init_types3();
    CONTEXT_DIR = "context";
    DECISIONS_DIR = "decisions";
  }
});

// src/context/compact.ts
function getCompactPath(outputDir) {
  return (0, import_path12.join)(outputDir, CONTEXT_DIR2, COMPACT_FILE);
}
function getArchiveDir(outputDir) {
  return (0, import_path12.join)(outputDir, CONTEXT_DIR2, ARCHIVE_DIR2);
}
async function loadCompactContext(outputDir, sessionId) {
  const compactPath = getCompactPath(outputDir);
  if ((0, import_fs4.existsSync)(compactPath)) {
    const content = await (0, import_promises13.readFile)(compactPath, "utf-8");
    return CompactContextSchema.parse(JSON.parse(content));
  }
  return {
    version: 1,
    session_id: sessionId || `ctx_${(0, import_nanoid5.nanoid)(8)}`,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    active_route: void 0,
    decisions_summary: [],
    current_ui_state: {
      last_snapshot_ref: void 0,
      pending_verifications: 0,
      known_issues: []
    },
    preferences_active: 0
  };
}
async function saveCompactContext(outputDir, context) {
  const contextDir = (0, import_path12.join)(outputDir, CONTEXT_DIR2);
  await (0, import_promises13.mkdir)(contextDir, { recursive: true });
  const compactPath = getCompactPath(outputDir);
  await (0, import_promises13.writeFile)(compactPath, JSON.stringify(context, null, 2));
}
async function updateCompactContext(outputDir, sessionId) {
  const current = await loadCompactContext(outputDir, sessionId);
  const routes = await getTrackedRoutes(outputDir);
  const summaries = [];
  for (const route of routes) {
    const decisions = await queryDecisions(outputDir, { route, limit: 100 });
    if (decisions.length === 0) continue;
    const byComponent = /* @__PURE__ */ new Map();
    for (const d of decisions) {
      const key = d.component || "_page";
      if (!byComponent.has(key)) {
        byComponent.set(key, []);
      }
      byComponent.get(key).push(d);
    }
    for (const [component, componentDecisions] of byComponent) {
      const latest = componentDecisions[0];
      const routeFilename = route.replace(/^\/+/, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "_root";
      summaries.push({
        route,
        component: component === "_page" ? void 0 : component,
        latest_change: latest.description,
        decision_count: componentDecisions.length,
        full_log_ref: `.ibr/context/decisions/${routeFilename}.jsonl`
      });
    }
  }
  const updated = {
    ...current,
    session_id: sessionId || current.session_id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    decisions_summary: summaries
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function compactContext(outputDir, request) {
  const current = await loadCompactContext(outputDir);
  const archiveDir = getArchiveDir(outputDir);
  await (0, import_promises13.mkdir)(archiveDir, { recursive: true });
  const archiveFilename = `compact_${Date.now()}.json`;
  const archivePath = (0, import_path12.join)(archiveDir, archiveFilename);
  await (0, import_promises13.writeFile)(archivePath, JSON.stringify(current, null, 2));
  const decisionsCompacted = current.decisions_summary.reduce(
    (sum, s) => sum + s.decision_count,
    0
  );
  const hasPreserves = (request.preserve_decisions || []).length > 0;
  const preserved = hasPreserves ? current.decisions_summary : [];
  const newContext = {
    version: 1,
    session_id: current.session_id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    active_route: current.active_route,
    decisions_summary: preserved,
    current_ui_state: {
      last_snapshot_ref: current.current_ui_state.last_snapshot_ref,
      pending_verifications: 0,
      known_issues: []
    },
    preferences_active: current.preferences_active
  };
  await saveCompactContext(outputDir, newContext);
  return {
    compact_context: newContext,
    archived_to: archivePath,
    decisions_compacted: decisionsCompacted,
    decisions_preserved: preserved.length
  };
}
async function setActiveRoute(outputDir, route) {
  const current = await loadCompactContext(outputDir);
  const updated = {
    ...current,
    active_route: route,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function addKnownIssue(outputDir, issue) {
  const current = await loadCompactContext(outputDir);
  const issues = [...current.current_ui_state.known_issues, issue];
  const updated = {
    ...current,
    current_ui_state: {
      ...current.current_ui_state,
      known_issues: issues
    },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function isCompactContextOversize(outputDir) {
  const compactPath = getCompactPath(outputDir);
  if (!(0, import_fs4.existsSync)(compactPath)) return false;
  const content = await (0, import_promises13.readFile)(compactPath, "utf-8");
  return Buffer.byteLength(content, "utf-8") > 4096;
}
var import_promises13, import_path12, import_fs4, import_nanoid5, CONTEXT_DIR2, COMPACT_FILE, ARCHIVE_DIR2;
var init_compact = __esm({
  "src/context/compact.ts"() {
    "use strict";
    import_promises13 = require("fs/promises");
    import_path12 = require("path");
    import_fs4 = require("fs");
    import_nanoid5 = require("nanoid");
    init_types3();
    init_decision_tracker();
    CONTEXT_DIR2 = "context";
    COMPACT_FILE = "compact.json";
    ARCHIVE_DIR2 = "archive";
  }
});

// src/extract.ts
var extract_exports = {};
__export(extract_exports, {
  analyzeElements: () => analyzeElements,
  closeBrowser: () => closeBrowser2,
  extractFromURL: () => extractFromURL,
  extractInteractiveElements: () => extractInteractiveElements,
  getReferenceSessionPaths: () => getReferenceSessionPaths
});
async function closeBrowser2() {
  if (driver2) {
    await driver2.close();
    driver2 = null;
  }
}
async function checkLock(outputDir) {
  const lockPath = (0, import_path13.join)(outputDir, LOCK_FILE);
  if (!(0, import_fs5.existsSync)(lockPath)) {
    return false;
  }
  try {
    const content = await (0, import_promises14.readFile)(lockPath, "utf-8");
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;
    if (age > LOCK_TIMEOUT_MS) {
      await (0, import_promises14.unlink)(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
async function createLock(outputDir) {
  const lockPath = (0, import_path13.join)(outputDir, LOCK_FILE);
  await (0, import_promises14.writeFile)(lockPath, Date.now().toString());
}
async function releaseLock(outputDir) {
  const lockPath = (0, import_path13.join)(outputDir, LOCK_FILE);
  try {
    await (0, import_promises14.unlink)(lockPath);
  } catch {
  }
}
async function extractElementStyles(page, selector) {
  return page.evaluate(
    ({ sel, props }) => {
      const elements = document.querySelectorAll(sel);
      const results = [];
      elements.forEach((el, index) => {
        const htmlEl = el;
        const rect = htmlEl.getBoundingClientRect();
        const computed = window.getComputedStyle(htmlEl);
        const styles = {};
        props.forEach((prop) => {
          const value = computed.getPropertyValue(
            prop.replace(/([A-Z])/g, "-$1").toLowerCase()
          );
          if (value && value !== "none" && value !== "normal" && value !== "0px") {
            styles[prop] = value;
          }
        });
        results.push({
          selector: `${sel}:nth-of-type(${index + 1})`,
          tagName: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || void 0,
          className: htmlEl.className || void 0,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          computedStyles: styles
        });
      });
      return results;
    },
    { sel: selector, props: CSS_PROPERTIES_TO_EXTRACT }
  );
}
async function extractInteractiveElements(page) {
  return page.evaluate((selectors) => {
    const seen = /* @__PURE__ */ new Set();
    const elements = [];
    const generateSelector = (el) => {
      if (el.id) return `#${el.id}`;
      const path2 = [];
      let current = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path2.unshift(selector);
          break;
        } else if (current.className && typeof current.className === "string") {
          const classes = current.className.split(" ").filter((c) => c.trim() && !c.includes(":"));
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
        path2.unshift(selector);
        current = current.parentElement;
      }
      return path2.join(" > ").slice(0, 200);
    };
    const detectHandlers = (el) => {
      const keys = Object.keys(el);
      const reactPropsKey = keys.find((k) => k.startsWith("__reactProps$"));
      let hasReactHandler = false;
      if (reactPropsKey) {
        const props = el[reactPropsKey];
        hasReactHandler = !!(props?.onClick || props?.onSubmit || props?.onMouseDown);
      }
      const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
      if (!hasReactHandler && fiberKey) {
        const fiber = el[fiberKey];
        hasReactHandler = !!(fiber?.pendingProps?.onClick || fiber?.memoizedProps?.onClick);
      }
      const hasVueHandler = !!(el.__vue__?.$listeners?.click || el.__vnode?.props?.onClick);
      const hasAngularHandler = !!el.__ngContext__ || el.hasAttribute("ng-click");
      const hasVanillaHandler = typeof el.onclick === "function" || el.hasAttribute("onclick");
      return {
        hasReactHandler,
        hasVueHandler,
        hasAngularHandler,
        hasVanillaHandler,
        hasAnyHandler: hasReactHandler || hasVueHandler || hasAngularHandler || hasVanillaHandler
      };
    };
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          const htmlEl = el;
          const rect = htmlEl.getBoundingClientRect();
          const computed = window.getComputedStyle(htmlEl);
          const handlers = detectHandlers(htmlEl);
          const href = htmlEl.getAttribute("href");
          const hasValidHref = href !== null && href !== "#" && href !== "" && !href.startsWith("javascript:");
          elements.push({
            selector: generateSelector(htmlEl),
            tagName: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || void 0,
            className: typeof htmlEl.className === "string" ? htmlEl.className : void 0,
            text: (htmlEl.textContent || "").trim().slice(0, 100) || void 0,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            computedStyles: {
              cursor: computed.cursor,
              color: computed.color,
              backgroundColor: computed.backgroundColor
            },
            interactive: {
              hasOnClick: handlers.hasAnyHandler,
              hasHref: hasValidHref,
              isDisabled: htmlEl.hasAttribute("disabled") || htmlEl.getAttribute("aria-disabled") === "true" || computed.pointerEvents === "none",
              tabIndex: parseInt(htmlEl.getAttribute("tabindex") || "0", 10),
              cursor: computed.cursor,
              hasReactHandler: handlers.hasReactHandler || void 0,
              hasVueHandler: handlers.hasVueHandler || void 0,
              hasAngularHandler: handlers.hasAngularHandler || void 0
            },
            a11y: {
              role: htmlEl.getAttribute("role"),
              ariaLabel: htmlEl.getAttribute("aria-label"),
              ariaDescribedBy: htmlEl.getAttribute("aria-describedby"),
              ariaHidden: htmlEl.getAttribute("aria-hidden") === "true" || void 0
            },
            sourceHint: {
              dataTestId: htmlEl.getAttribute("data-testid")
            }
          });
        });
      } catch {
      }
    }
    return elements;
  }, INTERACTIVE_SELECTORS);
}
function analyzeElements(elements, isMobile = false) {
  const issues = [];
  let withHandlers = 0;
  let withoutHandlers = 0;
  const interactiveElements = elements.filter((el) => {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a";
    const isInput = ["input", "select", "textarea"].includes(el.tagName);
    const looksClickable = el.interactive.cursor === "pointer";
    return isButton || isLink || isInput || looksClickable;
  });
  for (const el of interactiveElements) {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a";
    const hasHandler = el.interactive.hasOnClick || el.interactive.hasHref;
    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
    }
    if (isButton && !el.interactive.hasOnClick && !el.interactive.isDisabled) {
      issues.push({
        type: "NO_HANDLER",
        severity: "error",
        message: `Button "${el.text || el.selector}" has no click handler`
      });
    }
    if (isLink && !el.interactive.hasHref && !el.interactive.hasOnClick) {
      issues.push({
        type: "PLACEHOLDER_LINK",
        severity: "error",
        message: `Link "${el.text || el.selector}" has placeholder href and no handler`
      });
    }
    const minSize = isMobile ? 44 : 24;
    if (el.bounds.width < minSize || el.bounds.height < minSize) {
      issues.push({
        type: "TOUCH_TARGET_SMALL",
        severity: isMobile ? "error" : "warning",
        message: `"${el.text || el.selector}" touch target is ${el.bounds.width}x${el.bounds.height}px (min: ${minSize}px)`
      });
    }
    if (hasHandler && !el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: "MISSING_ARIA_LABEL",
        severity: "warning",
        message: `"${el.selector}" is interactive but has no text or aria-label`
      });
    }
  }
  return {
    totalElements: elements.length,
    interactiveCount: interactiveElements.length,
    withHandlers,
    withoutHandlers,
    issues
  };
}
async function extractCSSVariables(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const variables = {};
    const sheets = Array.from(document.styleSheets);
    sheets.forEach((sheet) => {
      try {
        const rules2 = Array.from(sheet.cssRules || []);
        rules2.forEach((rule) => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith("--")) {
                variables[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        });
      } catch {
      }
    });
    const rootStyles = getComputedStyle(root);
    ["--primary", "--secondary", "--accent", "--background", "--foreground", "--border", "--radius", "--spacing"].forEach((prefix) => {
      for (let i = 0; i < 20; i++) {
        const variations = [
          prefix,
          `${prefix}-${i}`,
          `${prefix}-color`,
          `${prefix}-bg`
        ];
        variations.forEach((varName) => {
          const value = rootStyles.getPropertyValue(varName).trim();
          if (value && !variables[varName]) {
            variables[varName] = value;
          }
        });
      }
    });
    return variables;
  });
}
async function extractFromURL(options) {
  const {
    url,
    outputDir,
    sessionId,
    viewport = VIEWPORTS.desktop,
    timeout = EXTRACTION_TIMEOUT_MS,
    selectors = DEFAULT_SELECTORS
  } = options;
  if (await checkLock(outputDir)) {
    throw new Error("Another extraction is in progress. Please wait.");
  }
  const sessionDir = (0, import_path13.join)(outputDir, "sessions", sessionId);
  await (0, import_promises14.mkdir)(sessionDir, { recursive: true });
  await createLock(outputDir);
  let timeoutHandle = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeout}ms`));
      }, timeout);
    });
    const extractionPromise = async () => {
      const driverInstance = new EngineDriver();
      await driverInstance.launch({
        headless: true,
        viewport: { width: viewport.width, height: viewport.height }
      });
      const page = new CompatPage(driverInstance);
      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        await page.waitForTimeout(500);
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `
        });
        const html = await page.content();
        const elements = [];
        for (const selector of selectors) {
          const extracted = await extractElementStyles(page, selector);
          elements.push(...extracted);
        }
        const cssVariables = await extractCSSVariables(page);
        const screenshotPath = (0, import_path13.join)(sessionDir, "reference.png");
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: "png"
        });
        const result2 = {
          url,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          viewport,
          html,
          elements,
          cssVariables,
          screenshotPath
        };
        await (0, import_promises14.writeFile)(
          (0, import_path13.join)(sessionDir, "reference.json"),
          JSON.stringify(result2, null, 2)
        );
        await (0, import_promises14.writeFile)((0, import_path13.join)(sessionDir, "reference.html"), html);
        return result2;
      } finally {
        await driverInstance.close();
      }
    };
    const result = await Promise.race([extractionPromise(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    await releaseLock(outputDir);
  }
}
function getReferenceSessionPaths(outputDir, sessionId) {
  const root = (0, import_path13.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path13.join)(root, "session.json"),
    reference: (0, import_path13.join)(root, "reference.png"),
    referenceHtml: (0, import_path13.join)(root, "reference.html"),
    referenceData: (0, import_path13.join)(root, "reference.json"),
    current: (0, import_path13.join)(root, "current.png"),
    diff: (0, import_path13.join)(root, "diff.png")
  };
}
var import_promises14, import_fs5, import_path13, LOCK_FILE, LOCK_TIMEOUT_MS, EXTRACTION_TIMEOUT_MS, DEFAULT_SELECTORS, CSS_PROPERTIES_TO_EXTRACT, driver2, INTERACTIVE_SELECTORS;
var init_extract2 = __esm({
  "src/extract.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_promises14 = require("fs/promises");
    import_fs5 = require("fs");
    import_path13 = require("path");
    init_schemas();
    LOCK_FILE = ".extracting";
    LOCK_TIMEOUT_MS = 18e4;
    EXTRACTION_TIMEOUT_MS = 12e4;
    DEFAULT_SELECTORS = [
      "header",
      "nav",
      "main",
      "section",
      "article",
      "aside",
      "footer",
      "h1",
      "h2",
      "h3",
      "button",
      "a[href]",
      "form",
      "input",
      "img"
    ];
    CSS_PROPERTIES_TO_EXTRACT = [
      "display",
      "position",
      "width",
      "height",
      "padding",
      "margin",
      "backgroundColor",
      "color",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "lineHeight",
      "textAlign",
      "borderRadius",
      "border",
      "boxShadow",
      "gap",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "gridTemplateColumns",
      "gridTemplateRows"
    ];
    driver2 = null;
    INTERACTIVE_SELECTORS = [
      "button",
      "a[href]",
      "a:not([href])",
      // Links without href (potential issues)
      'input[type="submit"]',
      'input[type="button"]',
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      "select",
      "textarea",
      '[role="button"]',
      '[role="link"]',
      "[onclick]",
      '[tabindex]:not([tabindex="-1"])'
    ];
  }
});

// src/layout-collision.ts
function detectLayoutCollisions(elements) {
  const textElements = elements.filter(
    (el) => el.text && el.text.trim().length > 0 && el.bounds.width > 0 && el.bounds.height > 0
  );
  textElements.sort((a, b) => a.bounds.y !== b.bounds.y ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x);
  const collisions = [];
  for (let i = 0; i < textElements.length; i++) {
    const a = textElements[i];
    const aBottom = a.bounds.y + a.bounds.height;
    for (let j = i + 1; j < textElements.length; j++) {
      const b = textElements[j];
      if (b.bounds.y > aBottom + 2) break;
      if (b.selector.startsWith(a.selector) || a.selector.startsWith(b.selector)) continue;
      const ix = Math.max(a.bounds.x, b.bounds.x);
      const iy = Math.max(a.bounds.y, b.bounds.y);
      const ix2 = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width);
      const iy2 = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height);
      const overlapW = ix2 - ix;
      const overlapH = iy2 - iy;
      if (overlapW <= 0 || overlapH <= 0) continue;
      const overlapArea = overlapW * overlapH;
      if (overlapW < 4 || overlapH < 4) continue;
      const areaA = a.bounds.width * a.bounds.height;
      const areaB = b.bounds.width * b.bounds.height;
      const smallerArea = Math.min(areaA, areaB);
      const overlapPercent = smallerArea > 0 ? overlapArea / smallerArea * 100 : 0;
      if (overlapPercent < 5) continue;
      collisions.push({
        element1: {
          selector: a.selector,
          text: a.text,
          bounds: { x: a.bounds.x, y: a.bounds.y, width: a.bounds.width, height: a.bounds.height }
        },
        element2: {
          selector: b.selector,
          text: b.text,
          bounds: { x: b.bounds.x, y: b.bounds.y, width: b.bounds.width, height: b.bounds.height }
        },
        overlapArea,
        overlapPercent
      });
    }
  }
  return {
    collisions,
    hasCollisions: collisions.length > 0
  };
}
var init_layout_collision = __esm({
  "src/layout-collision.ts"() {
    "use strict";
  }
});

// src/design-system/config.ts
async function loadDesignSystemConfig(projectDir) {
  let configPath = (0, import_path14.join)(projectDir, ".ibr", "design-system.json");
  if (!(0, import_fs6.existsSync)(configPath)) {
    configPath = (0, import_path14.join)(projectDir, "design-system.json");
    if (!(0, import_fs6.existsSync)(configPath)) {
      return void 0;
    }
  }
  const content = await (0, import_promises15.readFile)(configPath, "utf-8");
  const raw = JSON.parse(content);
  return DesignSystemConfigSchema.parse(raw);
}
function getDefaultSeverity(principleId, config) {
  const explicit = config.principles.calmPrecision.severity[principleId];
  if (explicit) return explicit;
  if (config.principles.calmPrecision.core.includes(principleId)) return "error";
  if (config.principles.calmPrecision.stylistic.includes(principleId)) return "warn";
  return "warn";
}
var import_zod3, import_promises15, import_fs6, import_path14, CustomCheckSchema, CustomPrincipleSchema, CalmPrecisionConfigSchema, TypographyTokensSchema, DesignSystemConfigSchema;
var init_config = __esm({
  "src/design-system/config.ts"() {
    "use strict";
    import_zod3 = require("zod");
    import_promises15 = require("fs/promises");
    import_fs6 = require("fs");
    import_path14 = require("path");
    CustomCheckSchema = import_zod3.z.object({
      property: import_zod3.z.string(),
      operator: import_zod3.z.enum(["equals", "in-set", "not-in-set", "gte", "lte", "contains"]),
      values: import_zod3.z.array(import_zod3.z.union([import_zod3.z.string(), import_zod3.z.number()]))
    });
    CustomPrincipleSchema = import_zod3.z.object({
      id: import_zod3.z.string(),
      name: import_zod3.z.string(),
      description: import_zod3.z.string(),
      category: import_zod3.z.string(),
      severity: import_zod3.z.enum(["error", "warn", "off"]),
      checks: import_zod3.z.array(CustomCheckSchema)
    });
    CalmPrecisionConfigSchema = import_zod3.z.object({
      core: import_zod3.z.array(import_zod3.z.string()).default(["gestalt", "signal-noise", "content-chrome", "cognitive-load"]),
      stylistic: import_zod3.z.array(import_zod3.z.string()).default(["fitts", "hick"]),
      severity: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.enum(["error", "warn", "off"])).default({})
    });
    TypographyTokensSchema = import_zod3.z.object({
      fontFamilies: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.string()).optional(),
      fontSizes: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number()).optional(),
      fontWeights: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number()).optional(),
      lineHeights: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number()).optional()
    });
    DesignSystemConfigSchema = import_zod3.z.object({
      version: import_zod3.z.literal(1),
      name: import_zod3.z.string(),
      principles: import_zod3.z.object({
        calmPrecision: CalmPrecisionConfigSchema.default({}),
        custom: import_zod3.z.array(CustomPrincipleSchema).default([])
      }).default({}),
      tokens: import_zod3.z.object({
        colors: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.string()).optional(),
        typography: TypographyTokensSchema.optional(),
        spacing: import_zod3.z.array(import_zod3.z.number()).optional(),
        borderRadius: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number()).optional(),
        shadows: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.string()).optional(),
        transitions: import_zod3.z.record(import_zod3.z.string(), import_zod3.z.string()).optional(),
        touchTargets: import_zod3.z.object({ min: import_zod3.z.number() }).optional()
      }).default({})
    });
  }
});

// src/design-system/tokens/schema.ts
function toDesignTokenSpec(extended, name) {
  return {
    name,
    tokens: {
      colors: extended.colors,
      spacing: extended.spacing ? Object.fromEntries(extended.spacing.map((v, i) => [`${i}`, v])) : void 0,
      fontSizes: extended.typography?.fontSizes,
      touchTargets: extended.touchTargets,
      cornerRadius: extended.borderRadius
    }
  };
}
var import_zod4, ExtendedTokenSpecSchema;
var init_schema = __esm({
  "src/design-system/tokens/schema.ts"() {
    "use strict";
    import_zod4 = require("zod");
    ExtendedTokenSpecSchema = import_zod4.z.object({
      colors: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.string()).optional(),
      typography: import_zod4.z.object({
        fontFamilies: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.string()).optional(),
        fontSizes: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.number()).optional(),
        fontWeights: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.number()).optional(),
        lineHeights: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.number()).optional()
      }).optional(),
      spacing: import_zod4.z.array(import_zod4.z.number()).optional(),
      borderRadius: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.number()).optional(),
      shadows: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.string()).optional(),
      transitions: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.string()).optional(),
      touchTargets: import_zod4.z.object({ min: import_zod4.z.number() }).optional()
    });
  }
});

// src/tokens.ts
function loadTokenSpec(specPath) {
  if (!(0, import_fs7.existsSync)(specPath)) {
    throw new Error(`Token spec not found: ${specPath}`);
  }
  let spec;
  try {
    const content = (0, import_fs7.readFileSync)(specPath, "utf-8");
    spec = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse token spec: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
  const { tokens } = spec;
  const hasAnyTokens = tokens.colors || tokens.spacing || tokens.fontSizes || tokens.touchTargets || tokens.cornerRadius;
  if (!hasAnyTokens) {
    throw new Error("Token spec must define at least one token category (colors, spacing, fontSizes, touchTargets, or cornerRadius)");
  }
  return spec;
}
function normalizeColor(color) {
  if (!color) return "";
  if (color.startsWith("#")) {
    return color.toLowerCase();
  }
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return color.toLowerCase();
}
function parsePx(value) {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}
function getStyle(styles, kebab) {
  if (!styles) return void 0;
  const val = styles[kebab];
  if (val !== void 0) return val;
  const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return styles[camel];
}
function validateAgainstTokens(elements, spec) {
  const violations = [];
  for (const [key, validator] of tokenValidators) {
    if (spec.tokens[key]) {
      violations.push(...validator.validate(elements, spec));
    }
  }
  return violations;
}
var import_fs7, touchTargetValidator, fontSizeValidator, colorValidator, cornerRadiusValidator, spacingValidator, tokenValidators;
var init_tokens = __esm({
  "src/tokens.ts"() {
    "use strict";
    import_fs7 = require("fs");
    touchTargetValidator = {
      name: "touchTargets",
      validate(elements, spec) {
        const violations = [];
        if (!spec.tokens.touchTargets) return violations;
        const minSize = spec.tokens.touchTargets.min;
        for (const element of elements) {
          const selector = element.selector || element.tagName || "unknown";
          const isInteractive = element.interactive?.hasOnClick || element.interactive?.hasHref;
          if (!isInteractive) continue;
          const actualSize = Math.min(element.bounds.width, element.bounds.height);
          if (actualSize < minSize) {
            violations.push({
              element: selector,
              property: "touch-target",
              expected: minSize,
              actual: actualSize,
              severity: "error",
              message: `Touch target too small: ${actualSize}px < ${minSize}px (${selector})`
            });
          }
        }
        return violations;
      }
    };
    fontSizeValidator = {
      name: "fontSizes",
      validate(elements, spec) {
        const violations = [];
        if (!spec.tokens.fontSizes) return violations;
        const tokenValues = Object.values(spec.tokens.fontSizes);
        for (const element of elements) {
          const selector = element.selector || element.tagName || "unknown";
          if (!element.computedStyles) continue;
          const fontSize = parsePx(getStyle(element.computedStyles, "font-size"));
          if (fontSize === null) continue;
          if (!tokenValues.includes(fontSize)) {
            violations.push({
              element: selector,
              property: "font-size",
              expected: `one of ${tokenValues.join(", ")}px`,
              actual: fontSize,
              severity: "warning",
              message: `Non-token font size: ${fontSize}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
            });
          }
        }
        return violations;
      }
    };
    colorValidator = {
      name: "colors",
      validate(elements, spec) {
        const violations = [];
        if (!spec.tokens.colors) return violations;
        const tokenColors = new Set(
          Object.values(spec.tokens.colors).map(normalizeColor)
        );
        for (const element of elements) {
          const selector = element.selector || element.tagName || "unknown";
          if (!element.computedStyles) continue;
          const textColor = getStyle(element.computedStyles, "color");
          if (textColor) {
            const normalized = normalizeColor(textColor);
            if (!tokenColors.has(normalized)) {
              violations.push({
                element: selector,
                property: "color",
                expected: "token color",
                actual: textColor,
                severity: "warning",
                message: `Non-token text color: ${textColor} (${selector})`
              });
            }
          }
          const bgColor = getStyle(element.computedStyles, "background-color");
          if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
            const normalized = normalizeColor(bgColor);
            if (!tokenColors.has(normalized)) {
              violations.push({
                element: selector,
                property: "color",
                expected: "token color",
                actual: bgColor,
                severity: "warning",
                message: `Non-token background color: ${bgColor} (${selector})`
              });
            }
          }
        }
        return violations;
      }
    };
    cornerRadiusValidator = {
      name: "cornerRadius",
      validate(elements, spec) {
        const violations = [];
        if (!spec.tokens.cornerRadius) return violations;
        const tokenValues = Object.values(spec.tokens.cornerRadius);
        for (const element of elements) {
          const selector = element.selector || element.tagName || "unknown";
          if (!element.computedStyles) continue;
          const borderRadius = parsePx(getStyle(element.computedStyles, "border-radius"));
          if (borderRadius === null || borderRadius === 0) continue;
          if (!tokenValues.includes(borderRadius)) {
            violations.push({
              element: selector,
              property: "corner-radius",
              expected: `one of ${tokenValues.join(", ")}px`,
              actual: borderRadius,
              severity: "warning",
              message: `Non-token border radius: ${borderRadius}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
            });
          }
        }
        return violations;
      }
    };
    spacingValidator = {
      name: "spacing",
      validate(elements, spec) {
        const violations = [];
        if (!spec.tokens.spacing) return violations;
        const tokenValues = Object.values(spec.tokens.spacing);
        for (const element of elements) {
          const selector = element.selector || element.tagName || "unknown";
          if (!element.computedStyles) continue;
          for (const prop of ["gap", "padding", "margin"]) {
            const raw = element.computedStyles[prop];
            const value = parsePx(raw);
            if (value === null || value === 0) continue;
            if (!tokenValues.includes(value)) {
              violations.push({
                element: selector,
                property: "spacing",
                expected: `one of ${tokenValues.join(", ")}px`,
                actual: value,
                severity: "warning",
                message: `Non-token ${prop}: ${value}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
              });
            }
          }
        }
        return violations;
      }
    };
    tokenValidators = /* @__PURE__ */ new Map([
      ["touchTargets", touchTargetValidator],
      ["fontSizes", fontSizeValidator],
      ["colors", colorValidator],
      ["cornerRadius", cornerRadiusValidator],
      ["spacing", spacingValidator]
    ]);
  }
});

// src/design-system/tokens/validator.ts
function validateFontWeights(elements, weights) {
  const violations = [];
  const validWeights = new Set(Object.values(weights));
  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;
    const fw = getStyle(style, "font-weight");
    if (!fw) continue;
    const weight = parseInt(fw, 10);
    if (isNaN(weight)) continue;
    if (!validWeights.has(weight)) {
      violations.push({
        element: element.selector || element.tagName || "unknown",
        property: "font-weight",
        expected: `one of ${Array.from(validWeights).join(", ")}`,
        actual: weight,
        severity: "warning",
        message: `Non-token font weight: ${weight} (expected one of ${Array.from(validWeights).join(", ")}) (${element.selector || element.tagName})`
      });
    }
  }
  return violations;
}
function validateLineHeights(elements, lineHeights) {
  const violations = [];
  const validHeights = new Set(Object.values(lineHeights));
  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;
    const lh = getStyle(style, "line-height");
    if (!lh || lh === "normal") continue;
    let value;
    const pxVal = parsePx(lh);
    if (pxVal !== null) {
      const fontSize = parsePx(getStyle(style, "font-size"));
      if (fontSize && fontSize > 0) {
        value = Math.round(pxVal / fontSize * 100) / 100;
      } else {
        continue;
      }
    } else {
      value = parseFloat(lh);
      if (isNaN(value)) continue;
    }
    const isValid = Array.from(validHeights).some((vh) => Math.abs(vh - value) < 0.05);
    if (!isValid) {
      violations.push({
        element: element.selector || element.tagName || "unknown",
        property: "line-height",
        expected: `one of ${Array.from(validHeights).join(", ")}`,
        actual: value,
        severity: "warning",
        message: `Non-token line height: ${value} (expected one of ${Array.from(validHeights).join(", ")}) (${element.selector || element.tagName})`
      });
    }
  }
  return violations;
}
function validateExtendedTokens(elements, tokens, systemName) {
  const violations = [];
  const oldSpec = toDesignTokenSpec(tokens, systemName);
  violations.push(...validateAgainstTokens(elements, oldSpec));
  if (tokens.typography?.fontWeights) {
    violations.push(...validateFontWeights(elements, tokens.typography.fontWeights));
  }
  if (tokens.typography?.lineHeights) {
    violations.push(...validateLineHeights(elements, tokens.typography.lineHeights));
  }
  return violations;
}
function calculateComplianceScore(totalChecked, violationCount) {
  if (totalChecked === 0) return 100;
  const passing = totalChecked - violationCount;
  return Math.round(passing / totalChecked * 100);
}
var init_validator = __esm({
  "src/design-system/tokens/validator.ts"() {
    "use strict";
    init_tokens();
    init_schema();
  }
});

// src/design-system/tokens/index.ts
var init_tokens2 = __esm({
  "src/design-system/tokens/index.ts"() {
    "use strict";
    init_schema();
    init_validator();
  }
});

// src/design-system/principles/gestalt.ts
var gestaltRules;
var init_gestalt = __esm({
  "src/design-system/principles/gestalt.ts"() {
    "use strict";
    gestaltRules = [
      {
        id: "calm-precision/gestalt-grouping",
        name: "Gestalt: Border Grouping",
        description: "Related items should be grouped with a single border, not individually bordered",
        defaultSeverity: "error",
        check: (element, _context) => {
          const style = element.computedStyles;
          if (!style) return null;
          const hasBorder = style.border && style.border !== "none" && style.border !== "0px";
          const borderWidth = style["border-width"];
          const hasBorderWidth = borderWidth && borderWidth !== "0px";
          const isListItem = element.tagName === "li" || element.selector?.includes("item") && !element.selector?.includes("item-");
          if ((hasBorder || hasBorderWidth) && isListItem) {
            return {
              ruleId: "calm-precision/gestalt-grouping",
              ruleName: "Gestalt: Border Grouping",
              severity: "error",
              message: `List item "${(element.text || "").slice(0, 40)}" has individual border. Group related items with a single container border.`,
              element: element.selector,
              bounds: element.bounds,
              fix: "Use single border around the group container with dividers between items, not individual item borders."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/signal-noise.ts
var signalNoiseRules;
var init_signal_noise = __esm({
  "src/design-system/principles/signal-noise.ts"() {
    "use strict";
    signalNoiseRules = [
      {
        id: "calm-precision/signal-noise-status",
        name: "Signal-to-Noise: Status Indication",
        description: "Status should use text color only, not background badges",
        defaultSeverity: "error",
        check: (element, _context) => {
          const style = element.computedStyles;
          if (!style) return null;
          const text = (element.text || "").toLowerCase();
          const isStatus = /\b(success|error|warning|pending|active|inactive|status|failed|completed|approved|rejected)\b/i.test(text);
          if (!isStatus) return null;
          const bg = style.backgroundColor || style["background-color"];
          if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return null;
          const subtleMatch = bg.match(/rgba?\([^)]*,\s*(0\.(?:0[0-9]|1[0-4]))\)/);
          if (subtleMatch) return null;
          return {
            ruleId: "calm-precision/signal-noise-status",
            ruleName: "Signal-to-Noise: Status Indication",
            severity: "error",
            message: `Status element "${text.slice(0, 30)}" has heavy background (${bg}). Use text color only for status.`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Remove background color. Use text color (green for success, red for error, yellow for warning) instead of background badges."
          };
        }
      }
    ];
  }
});

// src/design-system/principles/fitts.ts
var fittsRules;
var init_fitts = __esm({
  "src/design-system/principles/fitts.ts"() {
    "use strict";
    fittsRules = [
      {
        id: "calm-precision/fitts-button-sizing",
        name: "Fitts' Law: Button Sizing",
        description: "Primary action buttons should be prominently sized",
        defaultSeverity: "warn",
        check: (element, _context) => {
          if (element.tagName !== "button" && element.a11y?.role !== "button") return null;
          const text = (element.text || "").toLowerCase();
          const isPrimary = /\b(submit|save|confirm|checkout|buy|sign.?up|log.?in|register|continue|create|publish|send)\b/i.test(text);
          if (!isPrimary) return null;
          const width = element.bounds?.width || 0;
          if (width > 0 && width < 120) {
            return {
              ruleId: "calm-precision/fitts-button-sizing",
              ruleName: "Fitts' Law: Button Sizing",
              severity: "warn",
              message: `Primary action "${text.slice(0, 30)}" is ${width}px wide. Primary actions should be more prominent.`,
              element: element.selector,
              bounds: element.bounds,
              fix: "Increase button width. Primary actions should be the most prominent interactive element."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/hick.ts
var hickRules;
var init_hick = __esm({
  "src/design-system/principles/hick.ts"() {
    "use strict";
    hickRules = [
      {
        id: "calm-precision/hick-choice-count",
        name: "Hick's Law: Choice Count",
        description: "Limit visible choices to reduce decision time",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (!element.interactive?.hasOnClick && !element.interactive?.hasHref) return null;
          const y = element.bounds?.y || 0;
          const siblings = context.allElements.filter((el) => {
            if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
            const elY = el.bounds?.y || 0;
            return Math.abs(elY - y) < 20;
          });
          if (siblings.length > 7 && siblings[0]?.selector === element.selector) {
            return {
              ruleId: "calm-precision/hick-choice-count",
              ruleName: "Hick's Law: Choice Count",
              severity: "warn",
              message: `${siblings.length} interactive elements in one visual row. Consider progressive disclosure (max 5-7 visible).`,
              element: element.selector,
              bounds: element.bounds,
              fix: 'Group less-used options behind a "More" menu or overflow. Show max 5-7 choices at once.'
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/content-chrome.ts
var contentChromeRules;
var init_content_chrome = __esm({
  "src/design-system/principles/content-chrome.ts"() {
    "use strict";
    contentChromeRules = [
      {
        id: "calm-precision/content-chrome-ratio",
        name: "Content >= Chrome",
        description: "Content area should be at least 70% of the viewport",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (context.allElements[0]?.selector !== element.selector) return null;
          const viewportArea = context.viewportWidth * context.viewportHeight;
          if (viewportArea === 0) return null;
          const chromeSelectors = /\b(nav|header|footer|sidebar|toolbar|menu|breadcrumb|tabs)\b/i;
          let chromeArea = 0;
          for (const el of context.allElements) {
            const isChrome = chromeSelectors.test(el.tagName) || chromeSelectors.test(el.selector || "") || chromeSelectors.test(el.a11y?.role || "");
            if (isChrome && el.bounds) {
              chromeArea += el.bounds.width * el.bounds.height;
            }
          }
          const chromePercent = chromeArea / viewportArea * 100;
          if (chromePercent > 30) {
            return {
              ruleId: "calm-precision/content-chrome-ratio",
              ruleName: "Content >= Chrome",
              severity: "warn",
              message: `Chrome elements occupy ~${Math.round(chromePercent)}% of viewport. Content should be >= 70%.`,
              fix: "Reduce navigation/toolbar/sidebar chrome. Consider collapsible panels or minimized navigation."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/cognitive-load.ts
var cognitiveLoadRules;
var init_cognitive_load = __esm({
  "src/design-system/principles/cognitive-load.ts"() {
    "use strict";
    cognitiveLoadRules = [
      {
        id: "calm-precision/cognitive-load-elements",
        name: "Cognitive Load: Element Count",
        description: "Visual groups should have 5-7 items max to stay within working memory limits",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (element.interactive?.hasOnClick || element.interactive?.hasHref) return null;
          if (!element.bounds) return null;
          const { x, y, width, height } = element.bounds;
          const children = context.allElements.filter((el) => {
            if (el.selector === element.selector) return false;
            if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
            if (!el.bounds) return false;
            return el.bounds.x >= x && el.bounds.y >= y && el.bounds.x + el.bounds.width <= x + width && el.bounds.y + el.bounds.height <= y + height;
          });
          if (children.length > 10) {
            return {
              ruleId: "calm-precision/cognitive-load-elements",
              ruleName: "Cognitive Load: Element Count",
              severity: "warn",
              message: `Container has ${children.length} interactive elements. Consider grouping or progressive disclosure (5-7 max per group).`,
              element: element.selector,
              bounds: element.bounds,
              fix: 'Group related actions. Use sections, tabs, or "Show more" to reduce visible elements per group.'
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/calm-precision.ts
var allCalmPrecisionRules, corePrincipleIds, stylisticPrincipleIds, principleToRules;
var init_calm_precision = __esm({
  "src/design-system/principles/calm-precision.ts"() {
    "use strict";
    init_gestalt();
    init_signal_noise();
    init_fitts();
    init_hick();
    init_content_chrome();
    init_cognitive_load();
    allCalmPrecisionRules = [
      ...gestaltRules,
      ...signalNoiseRules,
      ...fittsRules,
      ...hickRules,
      ...contentChromeRules,
      ...cognitiveLoadRules
    ];
    corePrincipleIds = ["gestalt", "signal-noise", "content-chrome", "cognitive-load"];
    stylisticPrincipleIds = ["fitts", "hick"];
    principleToRules = {
      "gestalt": gestaltRules.map((r) => r.id),
      "signal-noise": signalNoiseRules.map((r) => r.id),
      "fitts": fittsRules.map((r) => r.id),
      "hick": hickRules.map((r) => r.id),
      "content-chrome": contentChromeRules.map((r) => r.id),
      "cognitive-load": cognitiveLoadRules.map((r) => r.id)
    };
  }
});

// src/design-system/index.ts
async function runDesignSystemCheck(elements, context, projectDir) {
  const config = await loadDesignSystemConfig(projectDir);
  if (!config) return void 0;
  const principleViolations = [];
  for (const rule of allCalmPrecisionRules) {
    const principleId = Object.entries(principleToRules).find(
      ([, ruleIds]) => ruleIds.includes(rule.id)
    )?.[0];
    if (!principleId) continue;
    const severity = getDefaultSeverity(principleId, config);
    if (severity === "off") continue;
    for (const element of elements) {
      const violation = rule.check(element, context);
      if (violation) {
        principleViolations.push({
          principleId: rule.id,
          principleName: rule.name,
          severity: severity === "error" ? "error" : "warn",
          message: violation.message,
          element: violation.element,
          bounds: violation.bounds,
          fix: violation.fix
        });
      }
    }
  }
  const customViolations = [];
  for (const custom of config.principles.custom) {
    if (custom.severity === "off") continue;
    for (const element of elements) {
      for (const check of custom.checks) {
        const style = element.computedStyles;
        if (!style) continue;
        const actual = style[check.property];
        if (!actual) continue;
        let violated = false;
        switch (check.operator) {
          case "in-set":
            violated = !check.values.map(String).includes(actual);
            break;
          case "not-in-set":
            violated = check.values.map(String).includes(actual);
            break;
          case "equals":
            violated = actual !== String(check.values[0]);
            break;
          case "gte":
            violated = parseFloat(actual) < Number(check.values[0]);
            break;
          case "lte":
            violated = parseFloat(actual) > Number(check.values[0]);
            break;
          case "contains":
            violated = !String(check.values[0]).split(",").some((v) => actual.includes(v.trim()));
            break;
        }
        if (violated) {
          customViolations.push({
            principleId: custom.id,
            principleName: custom.name,
            severity: custom.severity,
            message: `${custom.name}: ${check.property} is "${actual}" (expected ${check.operator} ${check.values.join(", ")})`,
            element: element.selector,
            bounds: element.bounds,
            fix: custom.description
          });
        }
      }
    }
  }
  const tokenViolations = config.tokens ? validateExtendedTokens(elements, config.tokens, config.name) : [];
  const tokenCategories = Object.keys(config.tokens).filter(
    (k) => config.tokens[k] !== void 0
  ).length;
  const totalChecked = elements.length * Math.max(tokenCategories, 1);
  const complianceScore = calculateComplianceScore(totalChecked, tokenViolations.length);
  return {
    configName: config.name,
    principleViolations,
    tokenViolations,
    customViolations,
    complianceScore
  };
}
var init_design_system = __esm({
  "src/design-system/index.ts"() {
    "use strict";
    init_config();
    init_tokens2();
    init_calm_precision();
    init_config();
  }
});

// src/scan.ts
var scan_exports = {};
__export(scan_exports, {
  IssueCollector: () => IssueCollector,
  aggregateIssues: () => aggregateIssues,
  applyDesignSystemCheck: () => applyDesignSystemCheck,
  determineVerdict: () => determineVerdict2,
  extractAndAudit: () => extractAndAudit,
  formatScanResult: () => formatScanResult,
  generateSummary: () => generateSummary2,
  scan: () => scan
});
async function scan(url, options = {}) {
  const {
    viewport: viewportOpt = "desktop",
    timeout = 3e4,
    waitFor,
    screenshot,
    networkIdleTimeout,
    patience
  } = options;
  const resolvedViewport = typeof viewportOpt === "string" ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop : viewportOpt;
  const driver3 = new EngineDriver();
  await driver3.launch({
    headless: true,
    viewport: { width: resolvedViewport.width, height: resolvedViewport.height }
  });
  const page = new CompatPage(driver3);
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on?.("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    } else if (msg.type() === "warning") {
      consoleWarnings.push(msg.text());
    }
  });
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout
    });
    let networkIdleTimedOut = false;
    await page.waitForLoadState?.("networkidle", { timeout: patience ?? networkIdleTimeout ?? 1e4 }).catch(() => {
      networkIdleTimedOut = true;
    });
    let waitForTimedOut = false;
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: patience ?? networkIdleTimeout ?? 1e4 }).catch(() => {
        waitForTimedOut = true;
      });
    }
    const [elements, interactivity, semantic, coverage, themeAnalysis] = await Promise.all([
      extractAndAudit(page, resolvedViewport),
      testInteractivity(page),
      getSemanticOutput(page),
      driver3.getCoverage().catch(() => void 0),
      analyzeThemeConsistency(page).catch(() => void 0)
    ]);
    if (screenshot) {
      await page.screenshot({
        path: screenshot.path,
        fullPage: screenshot.fullPage ?? true
      });
    }
    let route;
    try {
      route = new URL(url).pathname;
    } catch {
      route = url;
    }
    const layoutCollisions = detectLayoutCollisions(elements.all);
    const issues = aggregateIssues(elements.audit, interactivity, semantic, consoleErrors, themeAnalysis);
    const designSystem = await applyDesignSystemCheck(
      elements.all,
      issues,
      resolvedViewport,
      url,
      options.outputDir || process.cwd()
    );
    const verdict = determineVerdict2(issues);
    const summary = generateSummary2(elements, interactivity, semantic, issues, consoleErrors);
    const baseResult = {
      url,
      route,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      viewport: resolvedViewport,
      elements,
      interactivity,
      semantic,
      console: {
        errors: consoleErrors,
        warnings: consoleWarnings
      },
      coverage,
      layoutCollisions,
      themeAnalysis,
      designSystem,
      verdict,
      issues,
      summary
    };
    if (patience && (networkIdleTimedOut || waitForTimedOut)) {
      return {
        ...baseResult,
        verdict: "PARTIAL",
        partialReason: `Page still loading after ${patience}ms \u2014 ${networkIdleTimedOut ? "network still active" : "selector not found"}. Re-scan when content has loaded.`
      };
    }
    return baseResult;
  } finally {
    await driver3.close();
  }
}
async function extractAndAudit(page, viewport) {
  const isMobile = viewport.width < 768;
  const elements = await extractInteractiveElements(page);
  const audit = analyzeElements(elements, isMobile);
  return { all: elements, audit };
}
function aggregateIssues(audit, interactivity, semantic, consoleErrors, themeAnalysis) {
  const collector = new IssueCollector();
  collector.addFrom("interactivity", audit.issues.map((i) => ({
    severity: i.severity,
    message: i.message,
    type: i.type
  })), (item) => item.type === "MISSING_ARIA_LABEL" ? "accessibility" : "interactivity");
  const auditMessages = new Set(audit.issues.map((i) => i.message));
  const interactivityFiltered = interactivity.issues.filter((i) => !auditMessages.has(i.description));
  collector.addFrom("interactivity", interactivityFiltered.map((i) => ({
    severity: i.severity,
    description: i.description,
    element: i.element,
    type: i.type,
    fix: getFixSuggestion(i.type)
  })), (item) => item.type === "MISSING_LABEL" ? "accessibility" : "interactivity");
  collector.addFrom("semantic", semantic.issues.map((i) => ({
    severity: i.severity,
    problem: i.problem
  })));
  collector.addThemeAnalysis(themeAnalysis);
  collector.addConsoleErrors(consoleErrors);
  return collector.getIssues();
}
async function applyDesignSystemCheck(elements, issues, viewport, url, outputDir) {
  const designSystem = await runDesignSystemCheck(
    elements,
    {
      isMobile: viewport.width < 768,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url,
      allElements: elements
    },
    outputDir
  ).catch(() => void 0);
  if (designSystem) {
    for (const v of designSystem.principleViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message,
        fix: v.fix
      });
    }
    for (const v of designSystem.tokenViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message
      });
    }
    for (const v of designSystem.customViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message,
        fix: v.fix
      });
    }
  }
  return designSystem;
}
function determineVerdict2(issues) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount >= 3) return "FAIL";
  if (errorCount > 0 || warningCount >= 5) return "ISSUES";
  return "PASS";
}
function generateSummary2(elements, interactivity, semantic, issues, consoleErrors) {
  const parts = [];
  parts.push(`${semantic.pageIntent.intent} page`);
  parts.push(`${elements.audit.totalElements} elements (${elements.audit.interactiveCount} interactive)`);
  const { buttons, links, forms } = interactivity;
  const interactiveParts = [];
  if (buttons.length > 0) interactiveParts.push(`${buttons.length} buttons`);
  if (links.length > 0) interactiveParts.push(`${links.length} links`);
  if (forms.length > 0) interactiveParts.push(`${forms.length} forms`);
  if (interactiveParts.length > 0) {
    parts.push(interactiveParts.join(", "));
  }
  if (interactivity.summary.withoutHandlers > 0) {
    parts.push(`${interactivity.summary.withoutHandlers} elements without handlers`);
  }
  if (semantic.state.auth.authenticated) {
    parts.push("authenticated");
  }
  if (semantic.state.loading.loading) {
    parts.push(`loading (${semantic.state.loading.type})`);
  }
  if (semantic.state.errors.hasErrors) {
    parts.push(`${semantic.state.errors.errors.length} page errors`);
  }
  if (consoleErrors.length > 0) {
    parts.push(`${consoleErrors.length} console errors`);
  }
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(", "));
  }
  return parts.join(", ");
}
function getFixSuggestion(type) {
  switch (type) {
    case "NO_HANDLER":
      return "Add an onClick handler or remove the interactive appearance";
    case "PLACEHOLDER_LINK":
      return "Add a real href or an onClick handler";
    case "MISSING_LABEL":
      return "Add aria-label or visible text content";
    case "FORM_NO_SUBMIT":
      return "Add a submit handler or action attribute to the form";
    case "ORPHAN_SUBMIT":
      return "Ensure the submit button is inside a form";
    case "SMALL_TOUCH_TARGET":
      return "Increase element size to at least 44x44px for touch targets";
    default:
      return void 0;
  }
}
function formatScanResult(result) {
  const lines = [];
  const verdictIcon2 = result.verdict === "PASS" ? "\x1B[32m\u2713\x1B[0m" : result.verdict === "ISSUES" ? "\x1B[33m!\x1B[0m" : result.verdict === "PARTIAL" ? "\x1B[33m~\x1B[0m" : "\x1B[31m\u2717\x1B[0m";
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  IBR UI SCAN");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("");
  lines.push(`  URL:      ${result.url}`);
  lines.push(`  Route:    ${result.route}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon2} ${result.verdict}`);
  lines.push("");
  lines.push(`  ${result.summary}`);
  lines.push("");
  lines.push("  PAGE UNDERSTANDING");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Intent:   ${result.semantic.pageIntent.intent} (${(result.semantic.confidence * 100).toFixed(0)}% confidence)`);
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated ? "Authenticated" : "Not authenticated"}`);
  lines.push(`  Loading:  ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : "Complete"}`);
  lines.push(`  Errors:   ${result.semantic.state.errors.hasErrors ? result.semantic.state.errors.errors.map((e) => e.message).join(", ") : "None"}`);
  lines.push("");
  lines.push("  ELEMENTS");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Total:              ${result.elements.audit.totalElements}`);
  lines.push(`  Interactive:        ${result.elements.audit.interactiveCount}`);
  lines.push(`  With handlers:      ${result.elements.audit.withHandlers}`);
  lines.push(`  Without handlers:   ${result.elements.audit.withoutHandlers}`);
  lines.push("");
  const { buttons, links, forms } = result.interactivity;
  lines.push("  INTERACTIVITY");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`);
  if (forms.length > 0) {
    for (const form of forms) {
      const icon = form.hasSubmitHandler ? "\u2713" : "\u2717";
      lines.push(`    ${icon} Form ${form.selector}: ${form.fields.length} fields${form.hasValidation ? ", validated" : ""}`);
    }
  }
  lines.push("");
  if (result.console.errors.length > 0 || result.console.warnings.length > 0) {
    lines.push("  CONSOLE");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    if (result.console.errors.length > 0) {
      lines.push(`  Errors: ${result.console.errors.length}`);
      for (const err of result.console.errors.slice(0, 3)) {
        lines.push(`    \u2717 ${err.slice(0, 100)}`);
      }
    }
    if (result.console.warnings.length > 0) {
      lines.push(`  Warnings: ${result.console.warnings.length}`);
    }
    lines.push("");
  }
  if (result.layoutCollisions?.hasCollisions) {
    const { collisions } = result.layoutCollisions;
    lines.push("  LAYOUT");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500");
    lines.push(`  Collisions: ${collisions.length}`);
    for (const c of collisions) {
      const overlapPx = Math.round(Math.sqrt(c.overlapArea));
      const pct = Math.round(c.overlapPercent);
      const t1 = c.element1.text.slice(0, 30);
      const t2 = c.element2.text.slice(0, 30);
      lines.push(`    \x1B[31m\u2717\x1B[0m "${t1}" overlaps "${t2}" by ${pct}% (${overlapPx}px overlap)`);
    }
    lines.push("");
  }
  if (result.issues.length > 0) {
    lines.push("  ISSUES");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500");
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "\u2139";
      lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`    \u2192 ${issue.fix}`);
      }
    }
  } else {
    lines.push("  No issues detected.");
  }
  if (result.verdict === "PARTIAL" && result.partialReason) {
    lines.push("");
    lines.push("  PARTIAL SCAN");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    lines.push(`  \x1B[33m!\x1B[0m ${result.partialReason}`);
    lines.push("  Re-scan when the page has finished loading.");
  }
  lines.push("");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}
var IssueCollector;
var init_scan = __esm({
  "src/scan.ts"() {
    "use strict";
    init_driver();
    init_compat();
    init_schemas();
    init_extract2();
    init_interactivity();
    init_semantic();
    init_layout_collision();
    init_consistency();
    init_design_system();
    IssueCollector = class {
      issues = [];
      add(issue) {
        this.issues.push(issue);
      }
      /**
       * Add issues from a source array with varying shapes.
       * Handles the different field names used across audit, interactivity, and semantic results.
       */
      addFrom(category, items, overrideCategory) {
        for (const item of items) {
          const description = item.message ?? item.description ?? item.problem ?? "";
          const severity = item.severity ?? "info";
          const resolvedCategory = overrideCategory ? overrideCategory(item) : category;
          this.issues.push({
            category: resolvedCategory,
            severity,
            element: item.element,
            description,
            fix: item.fix
          });
        }
      }
      /**
       * Add console errors, skipping favicon/manifest noise.
       */
      addConsoleErrors(errors) {
        for (const error of errors) {
          if (error.includes("favicon") || error.includes("manifest")) continue;
          this.issues.push({
            category: "console",
            severity: "error",
            description: `Console error: ${error.slice(0, 200)}`
          });
        }
      }
      /**
       * Add theme mismatch issue if present.
       */
      addThemeAnalysis(analysis) {
        if (analysis?.themeMismatch) {
          this.issues.push({
            category: "semantic",
            severity: "warning",
            description: analysis.mismatchDetails ?? "Content card has different theme than page background",
            fix: "Ensure content containers match the page theme (dark/light)"
          });
        }
      }
      /**
       * Remove issues with identical descriptions, preserving first occurrence.
       */
      deduplicate() {
        const seen = /* @__PURE__ */ new Set();
        this.issues = this.issues.filter((issue) => {
          if (seen.has(issue.description)) return false;
          seen.add(issue.description);
          return true;
        });
      }
      getIssues() {
        return [...this.issues];
      }
    };
  }
});

// src/design-system/principles/index.ts
var init_principles = __esm({
  "src/design-system/principles/index.ts"() {
    "use strict";
    init_calm_precision();
    init_gestalt();
    init_signal_noise();
    init_fitts();
    init_hick();
    init_content_chrome();
    init_cognitive_load();
  }
});

// src/native/viewports.ts
function getDeviceViewport(device) {
  for (const [pattern, key] of DEVICE_NAME_PATTERNS) {
    if (pattern.test(device.name)) {
      return NATIVE_VIEWPORTS[key];
    }
  }
  if (device.platform === "watchos") {
    return NATIVE_VIEWPORTS["watch-series-10-42mm"];
  }
  return NATIVE_VIEWPORTS["iphone-16-pro"];
}
var NATIVE_VIEWPORTS, DEVICE_NAME_PATTERNS;
var init_viewports = __esm({
  "src/native/viewports.ts"() {
    "use strict";
    NATIVE_VIEWPORTS = {
      // iPhone 16 series
      "iphone-16": { name: "iphone-16", width: 393, height: 852 },
      "iphone-16-plus": { name: "iphone-16-plus", width: 430, height: 932 },
      "iphone-16-pro": { name: "iphone-16-pro", width: 402, height: 874 },
      "iphone-16-pro-max": { name: "iphone-16-pro-max", width: 440, height: 956 },
      // Apple Watch Series 10
      "watch-series-10-42mm": { name: "watch-series-10-42mm", width: 176, height: 215 },
      "watch-series-10-46mm": { name: "watch-series-10-46mm", width: 198, height: 242 },
      // Apple Watch Ultra 2
      "watch-ultra-2-49mm": { name: "watch-ultra-2-49mm", width: 205, height: 251 }
    };
    DEVICE_NAME_PATTERNS = [
      [/iPhone 16 Pro Max/i, "iphone-16-pro-max"],
      [/iPhone 16 Pro/i, "iphone-16-pro"],
      [/iPhone 16 Plus/i, "iphone-16-plus"],
      [/iPhone 16/i, "iphone-16"],
      [/Apple Watch.*Ultra.*49/i, "watch-ultra-2-49mm"],
      [/Apple Watch.*46/i, "watch-series-10-46mm"],
      [/Apple Watch.*42/i, "watch-series-10-42mm"],
      // Fallbacks for generic watch/phone
      [/Apple Watch Ultra/i, "watch-ultra-2-49mm"],
      [/Apple Watch/i, "watch-series-10-42mm"],
      [/iPhone/i, "iphone-16-pro"]
    ];
  }
});

// src/native/simulator.ts
function parseRuntime(runtime) {
  if (/watchOS/i.test(runtime)) return "watchos";
  return "ios";
}
async function listDevices() {
  const { stdout } = await execFileAsync("xcrun", ["simctl", "list", "devices", "--json"]);
  const data = JSON.parse(stdout);
  const devices = [];
  for (const [runtime, deviceList] of Object.entries(data.devices)) {
    if (!Array.isArray(deviceList)) continue;
    for (const dev of deviceList) {
      devices.push({
        udid: dev.udid,
        name: dev.name,
        state: dev.state,
        runtime,
        platform: parseRuntime(runtime),
        isAvailable: dev.isAvailable
      });
    }
  }
  return devices;
}
async function findDevice(nameOrUdid) {
  const devices = await listDevices();
  const search = nameOrUdid.toLowerCase();
  const byUdid = devices.find((d) => d.udid.toLowerCase() === search);
  if (byUdid) return byUdid;
  const matches = devices.filter((d) => d.name.toLowerCase().includes(search) && d.isAvailable).sort((a, b) => {
    if (a.state === "Booted" && b.state !== "Booted") return -1;
    if (b.state === "Booted" && a.state !== "Booted") return 1;
    return 0;
  });
  return matches[0] || null;
}
async function getBootedDevices() {
  const devices = await listDevices();
  return devices.filter((d) => d.state === "Booted");
}
async function bootDevice(udid) {
  const devices = await listDevices();
  const device = devices.find((d) => d.udid === udid);
  if (!device) {
    throw new Error(`Device not found: ${udid}`);
  }
  if (device.state === "Booted") {
    return;
  }
  await execFileAsync("xcrun", ["simctl", "boot", udid]);
  await new Promise((resolve5) => setTimeout(resolve5, 2e3));
}
function formatDevice(device) {
  const runtimeVersion = device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".");
  const stateIcon = device.state === "Booted" ? "\x1B[32m\u25CF\x1B[0m" : "\x1B[90m\u25CB\x1B[0m";
  return `${stateIcon} ${device.name} (${runtimeVersion}) [${device.udid.slice(0, 8)}...]`;
}
var import_child_process2, import_util, execFileAsync;
var init_simulator = __esm({
  "src/native/simulator.ts"() {
    "use strict";
    import_child_process2 = require("child_process");
    import_util = require("util");
    execFileAsync = (0, import_util.promisify)(import_child_process2.execFile);
  }
});

// src/native/capture.ts
async function captureNativeScreenshot(options) {
  const { device, outputPath, mask } = options;
  const start = Date.now();
  try {
    await (0, import_promises16.mkdir)((0, import_path15.dirname)(outputPath), { recursive: true });
    const args = ["simctl", "io", device.udid, "screenshot", "--type=png"];
    const effectiveMask = mask ?? (device.platform === "watchos" ? "black" : void 0);
    if (effectiveMask) {
      args.push(`--mask=${effectiveMask}`);
    }
    args.push(outputPath);
    await execFileAsync2("xcrun", args, { timeout: 15e3 });
    const viewport = getDeviceViewport(device);
    return {
      success: true,
      outputPath,
      device,
      viewport,
      timing: Date.now() - start
    };
  } catch (err) {
    return {
      success: false,
      device,
      viewport: getDeviceViewport(device),
      timing: Date.now() - start,
      error: err instanceof Error ? err.message : "Screenshot capture failed"
    };
  }
}
var import_child_process3, import_util2, import_promises16, import_path15, execFileAsync2;
var init_capture2 = __esm({
  "src/native/capture.ts"() {
    "use strict";
    import_child_process3 = require("child_process");
    import_util2 = require("util");
    import_promises16 = require("fs/promises");
    import_path15 = require("path");
    init_viewports();
    execFileAsync2 = (0, import_util2.promisify)(import_child_process3.execFile);
  }
});

// src/native/role-map.ts
function mapRoleToTag(role) {
  return TAG_MAP[role] || role.replace(/^AX/, "").toLowerCase();
}
function mapRoleToAriaRole(role) {
  return ARIA_MAP[role] || null;
}
function isInteractiveRole(role) {
  return INTERACTIVE_ROLES.has(role);
}
var TAG_MAP, ARIA_MAP, INTERACTIVE_ROLES;
var init_role_map = __esm({
  "src/native/role-map.ts"() {
    "use strict";
    TAG_MAP = {
      "AXButton": "button",
      "AXLink": "a",
      "AXTextField": "input",
      "AXTextArea": "textarea",
      "AXSecureTextField": "input",
      "AXStaticText": "span",
      "AXImage": "img",
      "AXGroup": "div",
      "AXSplitGroup": "div",
      "AXList": "ul",
      "AXCell": "li",
      "AXTable": "table",
      "AXScrollArea": "div",
      "AXToolbar": "nav",
      "AXMenuBar": "nav",
      "AXMenu": "nav",
      "AXMenuItem": "li",
      "AXCheckBox": "input",
      "AXRadioButton": "input",
      "AXSlider": "input",
      "AXSwitch": "input",
      "AXPopUpButton": "select",
      "AXComboBox": "select",
      "AXTabGroup": "div",
      "AXTab": "button",
      "AXNavigationBar": "nav",
      "AXHeader": "header",
      "AXWindow": "main"
    };
    ARIA_MAP = {
      "AXButton": "button",
      "AXLink": "link",
      "AXTextField": "textbox",
      "AXTextArea": "textbox",
      "AXSecureTextField": "textbox",
      "AXStaticText": "text",
      "AXImage": "img",
      "AXGroup": "group",
      "AXList": "list",
      "AXCell": "listitem",
      "AXTable": "table",
      "AXCheckBox": "checkbox",
      "AXRadioButton": "radio",
      "AXSlider": "slider",
      "AXSwitch": "switch",
      "AXTab": "tab",
      "AXTabGroup": "tablist",
      "AXNavigationBar": "navigation",
      "AXToolbar": "toolbar",
      "AXMenuItem": "menuitem",
      "AXMenu": "menu",
      "AXScrollArea": "scrollbar",
      "AXWindow": "main"
    };
    INTERACTIVE_ROLES = /* @__PURE__ */ new Set([
      "AXButton",
      "AXLink",
      "AXTextField",
      "AXTextArea",
      "AXSecureTextField",
      "AXCheckBox",
      "AXRadioButton",
      "AXSlider",
      "AXSwitch",
      "AXPopUpButton",
      "AXComboBox",
      "AXMenuItem",
      "AXTab"
    ]);
  }
});

// src/native/extract.ts
async function ensureExtractor() {
  if ((0, import_fs8.existsSync)(EXTRACTOR_PATH)) {
    return EXTRACTOR_PATH;
  }
  await (0, import_promises17.mkdir)(EXTRACTOR_DIR, { recursive: true });
  try {
    await execFileAsync3("swift", ["build", "-c", "release"], {
      cwd: SWIFT_SOURCE_DIR,
      timeout: 12e4
      // 2 minutes for first compile
    });
    const buildPath = (0, import_path16.join)(SWIFT_SOURCE_DIR, ".build", "release", "ibr-ax-extract");
    if (!(0, import_fs8.existsSync)(buildPath)) {
      throw new Error("Swift build succeeded but binary not found at expected path");
    }
    await execFileAsync3("cp", [buildPath, EXTRACTOR_PATH]);
    await execFileAsync3("chmod", ["+x", EXTRACTOR_PATH]);
    return EXTRACTOR_PATH;
  } catch (err) {
    throw new Error(
      `Failed to compile Swift extractor: ${err instanceof Error ? err.message : "Unknown error"}. Ensure Xcode Command Line Tools are installed: xcode-select --install`
    );
  }
}
function isExtractorAvailable() {
  if ((0, import_fs8.existsSync)(EXTRACTOR_PATH)) return true;
  return (0, import_fs8.existsSync)((0, import_path16.join)(SWIFT_SOURCE_DIR, "Package.swift"));
}
async function extractNativeElements(device) {
  const extractorPath = await ensureExtractor();
  try {
    const { stdout } = await execFileAsync3(extractorPath, [
      "--device-name",
      device.name
    ], {
      timeout: 3e4
    });
    const elements = JSON.parse(stdout);
    return elements;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("permission") || message.includes("accessibility")) {
      throw new Error(
        "Accessibility permission required. Grant Terminal/IDE access in System Settings > Privacy & Security > Accessibility"
      );
    }
    throw new Error(`Element extraction failed: ${message}`);
  }
}
function mapToEnhancedElements(nativeElements) {
  const enhanced = [];
  function flatten(elements, depth = 0) {
    for (const el of elements) {
      const tagName = mapRoleToTag(el.role);
      const isInteractive = isInteractiveRole(el.role) && el.isEnabled;
      enhanced.push({
        selector: el.identifier || `[role="${el.role}"][label="${el.label}"]`,
        tagName,
        text: el.label || void 0,
        bounds: {
          x: el.frame.x,
          y: el.frame.y,
          width: el.frame.width,
          height: el.frame.height
        },
        interactive: {
          hasOnClick: isInteractive,
          hasHref: false,
          isDisabled: !el.isEnabled,
          tabIndex: isInteractive ? 0 : -1,
          cursor: isInteractive ? "pointer" : "default"
        },
        a11y: {
          role: mapRoleToAriaRole(el.role),
          ariaLabel: el.label || null,
          ariaDescribedBy: null
        }
      });
      if (el.children.length > 0) {
        flatten(el.children, depth + 1);
      }
    }
  }
  flatten(nativeElements);
  return enhanced;
}
var import_child_process4, import_util3, import_fs8, import_promises17, import_path16, execFileAsync3, EXTRACTOR_DIR, EXTRACTOR_PATH, SWIFT_SOURCE_DIR;
var init_extract3 = __esm({
  "src/native/extract.ts"() {
    "use strict";
    import_child_process4 = require("child_process");
    import_util3 = require("util");
    import_fs8 = require("fs");
    import_promises17 = require("fs/promises");
    import_path16 = require("path");
    init_role_map();
    execFileAsync3 = (0, import_util3.promisify)(import_child_process4.execFile);
    EXTRACTOR_DIR = (0, import_path16.join)(process.cwd(), ".ibr", "bin");
    EXTRACTOR_PATH = (0, import_path16.join)(EXTRACTOR_DIR, "ibr-ax-extract");
    SWIFT_SOURCE_DIR = (0, import_path16.join)(__dirname, "..", "..", "src", "native", "swift", "ibr-ax-extract");
  }
});

// src/native/rules.ts
function auditNativeElements(elements, platform, viewport) {
  const issues = [];
  const interactive = elements.filter(
    (e) => e.interactive.hasOnClick && !e.interactive.isDisabled
  );
  if (platform === "watchos" && interactive.length > 7) {
    issues.push({
      type: "TOUCH_TARGET_SMALL",
      // Reuse closest existing type
      severity: "warning",
      message: `watchOS screen has ${interactive.length} interactive elements (recommended max: 7). Reduce choices to avoid cognitive overload on small displays.`
    });
  }
  for (const el of interactive) {
    const minDimension = Math.min(el.bounds.width, el.bounds.height);
    if (minDimension < 44) {
      issues.push({
        type: "TOUCH_TARGET_SMALL",
        severity: "error",
        message: `Touch target too small: "${el.text || el.selector}" is ${el.bounds.width}x${el.bounds.height}pt (minimum: 44x44pt)`
      });
    }
  }
  if (platform === "watchos") {
    for (const el of elements) {
      const rightEdge = el.bounds.x + el.bounds.width;
      if (rightEdge > viewport.width) {
        issues.push({
          type: "TOUCH_TARGET_SMALL",
          // Closest existing type
          severity: "warning",
          message: `Element "${el.text || el.selector}" overflows watchOS viewport (right edge: ${rightEdge}pt, viewport width: ${viewport.width}pt)`
        });
      }
    }
  }
  for (const el of interactive) {
    if (!el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: "MISSING_ARIA_LABEL",
        severity: "error",
        message: `Interactive element "${el.selector}" has no accessibility label`
      });
    }
  }
  return issues;
}
var init_rules = __esm({
  "src/native/rules.ts"() {
    "use strict";
  }
});

// src/native/macos.ts
async function findProcess(appNameOrBundleId) {
  try {
    const { stdout } = await execAsync(
      `lsappinfo info -only pid "${appNameOrBundleId}" 2>/dev/null || true`
    );
    const pidMatch = stdout.match(/"pid"\s*=\s*(\d+)/);
    if (pidMatch) {
      return parseInt(pidMatch[1], 10);
    }
  } catch {
  }
  try {
    const { stdout } = await execAsync(
      `pgrep -f "${appNameOrBundleId}" 2>/dev/null | head -1`
    );
    const pid = parseInt(stdout.trim(), 10);
    if (!isNaN(pid) && pid > 0) {
      return pid;
    }
  } catch {
  }
  throw new Error(
    `No running process found for "${appNameOrBundleId}". Ensure the app is running and try again.`
  );
}
async function extractMacOSElements(options) {
  const extractorPath = await ensureExtractor();
  const args = [];
  if (options.pid) {
    args.push("--pid", String(options.pid));
  } else if (options.app) {
    args.push("--app", options.app);
  } else {
    throw new Error("Either pid or app must be provided");
  }
  try {
    const { stdout, stderr } = await execFileAsync4(extractorPath, args, {
      timeout: 3e4
    });
    if (stderr && stderr.includes("Error:")) {
      throw new Error(stderr.trim());
    }
    const lines = stdout.split("\n");
    const headerLine = lines[0];
    const jsonStr = lines.slice(1).join("\n");
    let window2 = { windowId: 0, width: 800, height: 600, title: "Unknown" };
    if (headerLine.startsWith("WINDOW:")) {
      const parts = headerLine.slice(7).split(":");
      const windowId = parseInt(parts[0], 10);
      const dims = (parts[1] || "800x600").split("x");
      const title = parts.slice(2).join(":");
      window2 = {
        windowId,
        width: parseInt(dims[0], 10) || 800,
        height: parseInt(dims[1], 10) || 600,
        title
      };
    }
    const elements = JSON.parse(jsonStr);
    return { elements, window: window2 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Accessibility permission")) {
      throw new Error(
        "Accessibility permission required. Grant Terminal/IDE access in System Settings > Privacy & Security > Accessibility"
      );
    }
    if (message.includes("No running app")) {
      throw err;
    }
    throw new Error(`macOS element extraction failed: ${message}`);
  }
}
function mapMacOSToEnhancedElements(nativeElements, parentPath = "") {
  const enhanced = [];
  function flatten(elements, path2, depth) {
    const roleCounts = {};
    for (const el of elements) {
      const roleCount = roleCounts[el.role] || 0;
      roleCounts[el.role] = roleCount + 1;
      const currentPath = path2 ? `${path2} > ${el.role}[${roleCount}]` : `${el.role}[${roleCount}]`;
      const tagName = mapRoleToTag(el.role);
      const isInteractive = isInteractiveRole(el.role) && el.enabled;
      const hasPress = el.actions.includes("AXPress");
      const text = el.title || el.description || el.value || void 0;
      const bounds = {
        x: el.position?.x ?? 0,
        y: el.position?.y ?? 0,
        width: el.size?.width ?? 0,
        height: el.size?.height ?? 0
      };
      if (bounds.width > 0 || bounds.height > 0 || text || isInteractive || depth <= 1) {
        enhanced.push({
          selector: el.identifier || currentPath,
          tagName,
          id: el.identifier || void 0,
          text: text ? text.slice(0, 100) : void 0,
          bounds,
          interactive: {
            hasOnClick: hasPress || isInteractive,
            hasHref: el.role === "AXLink",
            isDisabled: !el.enabled,
            tabIndex: el.focused || isInteractive ? 0 : -1,
            cursor: isInteractive ? "pointer" : "default"
          },
          a11y: {
            role: mapRoleToAriaRole(el.role),
            ariaLabel: el.title || el.description || null,
            ariaDescribedBy: null
          },
          sourceHint: el.identifier ? { dataTestId: el.identifier } : void 0
        });
      }
      if (el.children.length > 0) {
        flatten(el.children, currentPath, depth + 1);
      }
    }
  }
  flatten(nativeElements, parentPath, 0);
  return enhanced;
}
async function captureMacOSScreenshot(windowId, outputPath) {
  await (0, import_promises18.mkdir)((0, import_path17.dirname)(outputPath), { recursive: true });
  await execFileAsync4("screencapture", ["-l", String(windowId), "-x", outputPath], {
    timeout: 1e4
  });
}
var import_child_process5, import_util4, import_promises18, import_path17, execFileAsync4, execAsync;
var init_macos = __esm({
  "src/native/macos.ts"() {
    "use strict";
    import_child_process5 = require("child_process");
    import_util4 = require("util");
    import_promises18 = require("fs/promises");
    import_path17 = require("path");
    init_extract3();
    init_role_map();
    execFileAsync4 = (0, import_util4.promisify)(import_child_process5.execFile);
    execAsync = (0, import_util4.promisify)(import_child_process5.exec);
  }
});

// src/native/interactivity.ts
function buildNativeInteractivity(elements) {
  const buttons = [];
  const links = [];
  const forms = [];
  const issues = [];
  for (const el of elements) {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a" || el.a11y.role === "link";
    if (isButton) {
      const btn = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || void 0,
          ariaLabel: el.a11y.ariaLabel || void 0,
          tabIndex: el.interactive.tabIndex
        },
        buttonType: "button"
      };
      buttons.push(btn);
      if (!btn.hasHandler && !btn.isDisabled) {
        issues.push({
          type: "NO_HANDLER",
          element: el.selector,
          severity: "warning",
          description: `Button "${el.text || el.selector}" has no press action`
        });
      }
      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: "MISSING_LABEL",
          element: el.selector,
          severity: "error",
          description: `Button has no accessible label (no text or accessibility label)`
        });
      }
    }
    if (isLink) {
      const link = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick || el.interactive.hasHref,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || void 0,
          ariaLabel: el.a11y.ariaLabel || void 0,
          tabIndex: el.interactive.tabIndex
        },
        href: "",
        // Native links don't have traditional hrefs
        isPlaceholder: false,
        opensNewTab: false,
        isExternal: false
      };
      links.push(link);
      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: "MISSING_LABEL",
          element: el.selector,
          severity: "error",
          description: `Link has no accessible label (no text or accessibility label)`
        });
      }
    }
  }
  const inputs = elements.filter(
    (e) => ["input", "textarea", "select"].includes(e.tagName) || e.a11y.role === "textbox"
  );
  if (inputs.length > 0) {
    const submitButton = buttons.find(
      (b) => b.text?.toLowerCase().includes("submit") || b.text?.toLowerCase().includes("save") || b.text?.toLowerCase().includes("login") || b.text?.toLowerCase().includes("sign") || b.text?.toLowerCase().includes("unlock") || b.text?.toLowerCase().includes("confirm")
    );
    if (inputs.length >= 1) {
      forms.push({
        selector: "native-form",
        hasSubmitHandler: !!submitButton,
        fields: inputs.map((inp) => ({
          selector: inp.selector,
          name: inp.id || void 0,
          type: inp.a11y.role === "textbox" ? "text" : inp.tagName,
          label: inp.a11y.ariaLabel || inp.text || void 0,
          required: false,
          hasValidation: false
        })),
        hasValidation: false,
        submitButton
      });
    }
  }
  const allInteractive = [...buttons, ...links];
  const withHandlers = allInteractive.filter((e) => e.hasHandler).length;
  return {
    buttons,
    links,
    forms,
    issues,
    summary: {
      totalInteractive: allInteractive.length,
      withHandlers,
      withoutHandlers: allInteractive.length - withHandlers,
      issueCount: {
        error: issues.filter((i) => i.severity === "error").length,
        warning: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length
      }
    }
  };
}
var init_interactivity2 = __esm({
  "src/native/interactivity.ts"() {
    "use strict";
  }
});

// src/native/semantic.ts
function buildNativeSemantic(elements, window2) {
  const intent = classifyNativeIntent(elements, window2.title);
  const issues = [];
  const hasPasswordField = elements.some(
    (e) => e.a11y.role === "textbox" && (e.text?.toLowerCase().includes("password") || e.a11y.ariaLabel?.toLowerCase().includes("password") || e.selector.toLowerCase().includes("secure"))
  );
  const hasLockIcon = elements.some(
    (e) => e.text?.toLowerCase().includes("lock") || e.a11y.ariaLabel?.toLowerCase().includes("lock")
  );
  const hasUnlockButton = elements.some(
    (e) => (e.tagName === "button" || e.a11y.role === "button") && (e.text?.toLowerCase().includes("unlock") || e.text?.toLowerCase().includes("sign in") || e.text?.toLowerCase().includes("log in"))
  );
  const isAuthScreen = hasPasswordField || hasLockIcon && hasUnlockButton;
  const errorElements = elements.filter(
    (e) => e.text?.toLowerCase().includes("error") || e.text?.toLowerCase().includes("failed") || e.a11y.ariaLabel?.toLowerCase().includes("error")
  );
  const hasErrors = errorElements.length > 0;
  if (hasErrors) {
    for (const el of errorElements.slice(0, 3)) {
      issues.push({
        severity: "major",
        type: "error-indicator",
        problem: `Error detected: "${el.text || el.a11y.ariaLabel}"`,
        fix: "Investigate the error state in the native app"
      });
    }
  }
  const verdict = hasErrors ? "FAIL" : "PASS";
  const availableActions = elements.filter((e) => e.interactive.hasOnClick && !e.interactive.isDisabled && e.text).slice(0, 10).map((e) => ({
    action: e.text.toLowerCase().replace(/\s+/g, "-"),
    selector: e.selector,
    description: e.text
  }));
  const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
  const authSignals = [];
  if (hasPasswordField) authSignals.push("password-field");
  if (hasLockIcon) authSignals.push("lock-icon");
  if (hasUnlockButton) authSignals.push("unlock-button");
  const summaryParts = [
    `${intent.intent} window`,
    `${elements.length} elements (${interactive} interactive)`,
    isAuthScreen ? "auth required" : "ready"
  ];
  return {
    verdict,
    confidence: intent.confidence,
    pageIntent: intent,
    state: {
      auth: {
        authenticated: isAuthScreen ? false : null,
        confidence: isAuthScreen ? 0.8 : 0.3,
        signals: authSignals,
        socialLoginProviders: [],
        hasForgotPassword: false,
        hasSignupLink: false,
        hasPasswordToggle: false
      },
      loading: {
        loading: false,
        type: "none",
        elements: 0
      },
      errors: {
        hasErrors,
        errors: errorElements.map((e) => ({
          type: "unknown",
          message: e.text || "Error"
        })),
        severity: hasErrors ? "error" : "none"
      },
      ready: !hasErrors
    },
    availableActions,
    issues,
    summary: summaryParts.join(", "),
    url: `macos://${window2.title}`,
    title: window2.title,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function classifyNativeIntent(elements, windowTitle) {
  const titleLower = windowTitle.toLowerCase();
  const hasPasswordInput = elements.some(
    (e) => e.selector.toLowerCase().includes("secure") || e.text?.toLowerCase().includes("password")
  );
  const hasLoginButton = elements.some(
    (e) => e.tagName === "button" && (e.text?.toLowerCase().includes("login") || e.text?.toLowerCase().includes("sign in") || e.text?.toLowerCase().includes("unlock"))
  );
  if (hasPasswordInput || hasLoginButton) {
    return { intent: "auth", confidence: 0.9, signals: ["password-field", "login-button"] };
  }
  if (titleLower.includes("settings") || titleLower.includes("preferences")) {
    return { intent: "form", confidence: 0.85, signals: ["title-settings"] };
  }
  const listElements = elements.filter(
    (e) => e.a11y.role === "list" || e.a11y.role === "listitem" || e.tagName === "ul" || e.tagName === "li"
  );
  if (listElements.length > 3) {
    return { intent: "listing", confidence: 0.75, signals: ["list-elements"] };
  }
  const inputElements = elements.filter(
    (e) => e.tagName === "input" || e.tagName === "textarea" || e.a11y.role === "textbox"
  );
  if (inputElements.length >= 2) {
    return { intent: "form", confidence: 0.7, signals: ["multiple-inputs"] };
  }
  const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
  if (interactive > 5) {
    return { intent: "dashboard", confidence: 0.6, signals: ["many-interactive"] };
  }
  return { intent: "detail", confidence: 0.5, signals: ["default"] };
}
var init_semantic2 = __esm({
  "src/native/semantic.ts"() {
    "use strict";
  }
});

// src/native/scan.ts
async function scanNative(options = {}) {
  const { device: deviceQuery, screenshot = true, outputDir = ".ibr" } = options;
  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
    if (!device) {
      throw new Error(
        `No simulator found matching "${deviceQuery}". Run \`xcrun simctl list devices available\` to see available simulators.`
      );
    }
  } else {
    const booted = await getBootedDevices();
    if (booted.length === 0) {
      throw new Error(
        "No booted simulators found. Boot one with: xcrun simctl boot <device-name>"
      );
    }
    device = booted[0];
  }
  if (device.state !== "Booted") {
    await bootDevice(device.udid);
    const refreshed = await findDevice(device.udid);
    if (refreshed) device = refreshed;
  }
  const viewport = getDeviceViewport(device);
  const url = `simulator://${device.name}/${options.bundleId || "current"}`;
  let screenshotPath;
  if (screenshot) {
    const timestamp = Date.now();
    const ssPath = (0, import_path18.join)(outputDir, "native", `${device.udid.slice(0, 8)}-${timestamp}.png`);
    const captureResult = await captureNativeScreenshot({
      device,
      outputPath: ssPath
    });
    if (captureResult.success) {
      screenshotPath = captureResult.outputPath;
    }
  }
  let elements = [];
  let audit = {
    totalElements: 0,
    interactiveCount: 0,
    withHandlers: 0,
    withoutHandlers: 0,
    issues: []
  };
  let extractionSucceeded = false;
  if (isExtractorAvailable()) {
    try {
      const nativeElements = await extractNativeElements(device);
      elements = mapToEnhancedElements(nativeElements);
      audit = analyzeElements(elements, true);
      extractionSucceeded = true;
    } catch {
    }
  }
  const nativeIssues = extractionSucceeded ? auditNativeElements(elements, device.platform, viewport) : [];
  const issues = [];
  for (const issue of audit.issues) {
    issues.push({
      category: issue.type === "MISSING_ARIA_LABEL" ? "accessibility" : "interactivity",
      severity: issue.severity,
      description: issue.message
    });
  }
  for (const issue of nativeIssues) {
    issues.push({
      category: issue.type === "MISSING_ARIA_LABEL" ? "accessibility" : "structure",
      severity: issue.severity,
      description: issue.message
    });
  }
  const designSystem = options.outputDir ? await applyDesignSystemCheck(
    elements,
    issues,
    viewport,
    url,
    options.outputDir
  ) : void 0;
  const verdict = determineVerdict2(issues);
  const summary = generateNativeSummary(device, elements, issues, extractionSucceeded);
  return {
    url,
    route: `/${device.name}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport,
    platform: device.platform,
    device: {
      name: device.name,
      udid: device.udid,
      runtime: device.runtime
    },
    elements: { all: elements, audit },
    nativeIssues,
    screenshotPath,
    designSystem,
    verdict,
    issues,
    summary
  };
}
function generateNativeSummary(device, elements, issues, extractionSucceeded) {
  const parts = [];
  parts.push(`${device.platform} simulator (${device.name})`);
  if (extractionSucceeded) {
    const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
    parts.push(`${elements.length} elements (${interactive} interactive)`);
  } else {
    parts.push("screenshot-only mode (element extraction unavailable)");
  }
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(", "));
  }
  return parts.join(", ");
}
async function scanMacOS(options) {
  if (process.platform !== "darwin") {
    throw new Error("macOS native scanning is only available on macOS");
  }
  const { app, bundleId, pid: directPid, screenshot } = options;
  if (!app && !bundleId && !directPid) {
    throw new Error("Provide --app, --bundle-id, or --pid to identify the target app");
  }
  let pid;
  if (directPid) {
    pid = directPid;
  } else {
    pid = await findProcess(app || bundleId);
  }
  const { elements: nativeElements, window: window2 } = await extractMacOSElements({
    pid,
    app: app || bundleId
  });
  const elements = mapMacOSToEnhancedElements(nativeElements);
  const audit = analyzeElements(elements, false);
  const interactivity = buildNativeInteractivity(elements);
  const semantic = buildNativeSemantic(elements, window2);
  if (screenshot && window2.windowId > 0) {
    await captureMacOSScreenshot(window2.windowId, screenshot.path);
  }
  const url = `macos://${app || bundleId || `pid-${pid}`}/${window2.title}`;
  const route = `/${window2.title}`;
  const viewport = {
    name: "native",
    width: window2.width,
    height: window2.height
  };
  const issues = aggregateIssues(audit, interactivity, semantic, []);
  const designSystem = options.outputDir ? await applyDesignSystemCheck(
    elements,
    issues,
    viewport,
    url,
    options.outputDir
  ) : void 0;
  const verdict = determineVerdict2(issues);
  const summary = generateSummary2(
    { all: elements, audit },
    interactivity,
    semantic,
    issues,
    []
  );
  return {
    url,
    route,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport,
    elements: { all: elements, audit },
    interactivity,
    semantic,
    console: { errors: [], warnings: [] },
    designSystem,
    verdict,
    issues,
    summary
  };
}
function verdictIcon(verdict) {
  return verdict === "PASS" ? "\x1B[32m\u2713\x1B[0m" : verdict === "ISSUES" ? "\x1B[33m!\x1B[0m" : "\x1B[31m\u2717\x1B[0m";
}
function formatElementsSection(audit) {
  return [
    "  ELEMENTS",
    "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    `  Total:              ${audit.totalElements}`,
    `  Interactive:        ${audit.interactiveCount}`,
    `  With handlers:      ${audit.withHandlers}`,
    `  Without handlers:   ${audit.withoutHandlers}`,
    ""
  ];
}
function formatIssuesSection(issues) {
  if (issues.length === 0) return ["  No issues detected."];
  const lines = ["  ISSUES", "  \u2500\u2500\u2500\u2500\u2500\u2500"];
  for (const issue of issues) {
    const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "\u2139";
    lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
    if (issue.fix) lines.push(`    \u2192 ${issue.fix}`);
  }
  return lines;
}
function formatMacOSScanResult(result) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "  IBR NATIVE macOS SCAN",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "",
    `  App:      ${result.url}`,
    `  Window:   ${result.route.slice(1)}`,
    `  Viewport: ${result.viewport.width}x${result.viewport.height}`,
    `  Verdict:  ${verdictIcon(result.verdict)} ${result.verdict}`,
    "",
    `  ${result.summary}`,
    "",
    "  PAGE UNDERSTANDING",
    "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    `  Intent:   ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `  Auth:     ${result.semantic.state.auth.authenticated === false ? "Not authenticated" : result.semantic.state.auth.authenticated ? "Authenticated" : "Unknown"}`,
    "",
    ...formatElementsSection(result.elements.audit)
  ];
  const { buttons, links, forms } = result.interactivity;
  lines.push("  INTERACTIVITY", "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`, "");
  lines.push(...formatIssuesSection(result.issues));
  lines.push("", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}
function formatNativeScanResult(result) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "  IBR NATIVE SCAN",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "",
    `  Device:   ${result.device.name}`,
    `  Platform: ${result.platform}`,
    `  Runtime:  ${result.device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".")}`,
    `  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `  Verdict:  ${verdictIcon(result.verdict)} ${result.verdict}`,
    "",
    `  ${result.summary}`,
    "",
    ...formatElementsSection(result.elements.audit)
  ];
  if (result.screenshotPath) {
    lines.push(`  Screenshot: ${result.screenshotPath}`, "");
  }
  lines.push(...formatIssuesSection(result.issues));
  lines.push("", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}
var import_path18;
var init_scan2 = __esm({
  "src/native/scan.ts"() {
    "use strict";
    import_path18 = require("path");
    init_scan();
    init_extract2();
    init_simulator();
    init_capture2();
    init_viewports();
    init_extract3();
    init_rules();
    init_macos();
    init_interactivity2();
    init_semantic2();
  }
});

// src/native/annotate.ts
var annotate_exports = {};
__export(annotate_exports, {
  annotateScreenshot: () => annotateScreenshot
});
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}
function drawRect(png, x, y, w, h, r, g, b, thickness = 2) {
  for (let t = 0; t < thickness; t++) {
    for (let i = x; i < x + w; i++) {
      setPixel(png, i, y + t, r, g, b);
      setPixel(png, i, y + h - 1 - t, r, g, b);
    }
    for (let j = y; j < y + h; j++) {
      setPixel(png, x + t, j, r, g, b);
      setPixel(png, x + w - 1 - t, j, r, g, b);
    }
  }
}
function drawFilledCircle(png, cx, cy, radius, r, g, b) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, cx + dx, cy + dy, r, g, b);
    }
  }
}
function drawDigit(png, cx, cy, digit, r, g, b) {
  const rows = DIGITS[digit] ?? DIGITS[0];
  const scale = 2;
  const offX = cx - Math.floor(5 * scale / 2);
  const offY = cy - Math.floor(7 * scale / 2);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & 16 >> col) {
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            setPixel(png, offX + col * scale + sx, offY + row * scale + sy, r, g, b);
      }
    }
  }
}
function drawLabel(png, cx, cy, id) {
  drawFilledCircle(png, cx, cy, 10, 220, 30, 30);
  const tens = Math.floor(id / 10);
  const ones = id % 10;
  if (tens > 0) {
    drawDigit(png, cx - 5, cy, tens, 255, 255, 255);
    drawDigit(png, cx + 5, cy, ones, 255, 255, 255);
  } else {
    drawDigit(png, cx, cy, ones, 255, 255, 255);
  }
}
async function annotateScreenshot(screenshotPath, issues) {
  let png;
  try {
    const buf = (0, import_fs9.readFileSync)(screenshotPath);
    png = import_pngjs3.PNG.sync.read(buf);
  } catch {
    return null;
  }
  for (const issue of issues) {
    const { x, y, width: w, height: h } = issue.bounds;
    drawRect(png, x, y, w, h, 220, 30, 30, 2);
    drawLabel(png, x, y, issue.id);
  }
  const outPath = screenshotPath.replace(/\.png$/i, "-annotated.png");
  try {
    (0, import_fs9.writeFileSync)(outPath, import_pngjs3.PNG.sync.write(png));
  } catch {
    return null;
  }
  return outPath;
}
var import_pngjs3, import_fs9, DIGITS;
var init_annotate = __esm({
  "src/native/annotate.ts"() {
    "use strict";
    import_pngjs3 = require("pngjs");
    import_fs9 = require("fs");
    DIGITS = [
      [31, 17, 17, 17, 17, 17, 31],
      // 0
      [4, 6, 4, 4, 4, 4, 14],
      // 1
      [31, 16, 16, 31, 1, 1, 31],
      // 2
      [31, 16, 16, 31, 16, 16, 31],
      // 3
      [17, 17, 17, 31, 16, 16, 16],
      // 4
      [31, 1, 1, 31, 16, 16, 31],
      // 5
      [31, 1, 1, 31, 17, 17, 31],
      // 6
      [31, 16, 16, 8, 4, 4, 4],
      // 7
      [31, 17, 17, 31, 17, 17, 31],
      // 8
      [31, 17, 17, 31, 16, 16, 31]
      // 9
    ];
  }
});

// src/native/fix-guide.ts
var fix_guide_exports = {};
__export(fix_guide_exports, {
  generateFixGuide: () => generateFixGuide
});
function isSimulatorChrome(selector, label) {
  const text = `${selector} ${label}`.toLowerCase();
  return SIMULATOR_CHROME_PATTERNS.some((p) => text.includes(p.toLowerCase()));
}
function computeScreenRegion(bounds, viewport) {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const col = cx < viewport.width / 3 ? "left" : cx < viewport.width * 2 / 3 ? "center" : "right";
  const row = cy < viewport.height / 3 ? "top" : cy < viewport.height * 2 / 3 ? "middle" : "bottom";
  return `${row}-${col}`;
}
function buildSuggestedFix(issueType, elementLabel) {
  switch (issueType) {
    case "TOUCH_TARGET_SMALL":
      return ".frame(minWidth: 44, minHeight: 44) or wrap in a larger tap area with .contentShape(Rectangle())";
    case "MISSING_ARIA_LABEL": {
      const desc = elementLabel && elementLabel.length > 0 && !elementLabel.startsWith("[role") ? elementLabel : "descriptive text for this control";
      return `Add .accessibilityLabel("${desc}")`;
    }
    case "NO_HANDLER":
      return "Add tap action or remove interactive appearance";
    case "PLACEHOLDER_LINK":
      return 'Replace href="#" with a real destination or add an onTapGesture handler';
    case "DISABLED_NO_VISUAL":
      return "Add .opacity(0.5) or .foregroundColor(.gray) to visually indicate disabled state";
    default:
      return "Review and fix accessibility issue";
  }
}
function issueTypeToCategory(issueType) {
  if (issueType === "TOUCH_TARGET_SMALL") return "touch-target";
  if (issueType === "MISSING_ARIA_LABEL" || issueType === "DISABLED_NO_VISUAL") return "accessibility";
  if (issueType === "NO_HANDLER" || issueType === "PLACEHOLDER_LINK") return "accessibility";
  return "accessibility";
}
function buildSearchPattern(correlation, elementSelector, elementLabel) {
  if (!correlation) {
    if (elementLabel) {
      const escaped = elementLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `Button.*${escaped}|Text.*${escaped}`;
    }
    return elementSelector;
  }
  switch (correlation.matchType) {
    case "identifier":
      return correlation.elementSelector;
    case "label":
      return `.accessibilityLabel("${correlation.elementLabel}")`;
    case "view-name":
      return `struct ${correlation.viewName}: View`;
    case "text": {
      const label = correlation.elementLabel || elementLabel;
      if (label) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return `Button.*${escaped}|Image.*${escaped}`;
      }
      return elementSelector;
    }
    default:
      return elementSelector;
  }
}
function generateFixGuide(scanResult, bridgeResult, annotatedScreenshot) {
  const viewport = scanResult.viewport;
  const correlationMap = /* @__PURE__ */ new Map();
  if (bridgeResult) {
    for (const c of bridgeResult.correlations) {
      correlationMap.set(c.elementSelector.toLowerCase(), c);
      if (c.elementLabel) {
        correlationMap.set(c.elementLabel.toLowerCase(), c);
      }
    }
  }
  const boundsMap = /* @__PURE__ */ new Map();
  const unlabeledButtons = [];
  for (const el of scanResult.elements.all) {
    const bounds = { x: el.bounds.x, y: el.bounds.y, width: el.bounds.width, height: el.bounds.height };
    if (el.selector) boundsMap.set(el.selector.toLowerCase(), bounds);
    if (el.a11y?.ariaLabel) boundsMap.set(el.a11y.ariaLabel.toLowerCase(), bounds);
    if (el.text) boundsMap.set(el.text.toLowerCase(), bounds);
    if (el.interactive?.hasOnClick && (!el.a11y?.ariaLabel || el.a11y.ariaLabel === "") && (!el.text || el.text === "")) {
      unlabeledButtons.push(bounds);
    }
  }
  let unlabeledIdx = 0;
  function extractLabel(text) {
    const m = text.match(/"([^"]+)"/);
    return m ? m[1] : "";
  }
  const seen = /* @__PURE__ */ new Set();
  function dedupKey(label, issueType) {
    return `${label.toLowerCase()}:${issueType}`;
  }
  const fixableIssues = [];
  let idCounter = 1;
  for (const issue of scanResult.nativeIssues) {
    const elementLabel = extractLabel(issue.message);
    const elementSelector = elementLabel || issue.type;
    if (isSimulatorChrome(elementSelector, issue.message)) continue;
    const key = dedupKey(elementLabel || elementSelector, issue.type);
    if (seen.has(key)) continue;
    seen.add(key);
    let bounds = boundsMap.get(elementLabel.toLowerCase()) ?? boundsMap.get(elementSelector.toLowerCase()) ?? null;
    if (!bounds && elementLabel === "" && unlabeledIdx < unlabeledButtons.length) {
      bounds = unlabeledButtons[unlabeledIdx++];
    }
    bounds = bounds ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = bounds.x > 0 || bounds.y > 0 ? computeScreenRegion(bounds, viewport) : "unknown";
    const correlation = correlationMap.get(elementLabel.toLowerCase()) ?? correlationMap.get(elementSelector.toLowerCase());
    fixableIssues.push({
      id: idCounter++,
      category: issueTypeToCategory(issue.type),
      severity: issue.severity === "info" ? "warning" : issue.severity,
      what: issue.message,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.message,
      required: buildSuggestedFix(issue.type, elementLabel),
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel)
      } : void 0,
      suggestedFix: buildSuggestedFix(issue.type, elementLabel)
    });
  }
  for (const issue of scanResult.issues) {
    if (issue.severity === "info") continue;
    const elementLabel = extractLabel(issue.description);
    const elementSelector = issue.element ?? elementLabel;
    if (isSimulatorChrome(elementSelector, issue.description)) continue;
    const issueType = issue.description.includes("touch target") || issue.description.includes("Touch target") ? "TOUCH_TARGET_SMALL" : issue.description.includes("accessibility label") || issue.description.includes("aria-label") ? "MISSING_ARIA_LABEL" : issue.category;
    const key = dedupKey(elementLabel || elementSelector, issueType);
    if (seen.has(key)) continue;
    seen.add(key);
    const bounds = boundsMap.get(elementLabel.toLowerCase()) ?? boundsMap.get(elementSelector.toLowerCase()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = bounds.x > 0 || bounds.y > 0 ? computeScreenRegion(bounds, viewport) : "unknown";
    const correlation = correlationMap.get(elementLabel.toLowerCase()) ?? correlationMap.get(elementSelector.toLowerCase());
    fixableIssues.push({
      id: idCounter++,
      category: issue.category === "interactivity" ? "touch-target" : issue.category,
      severity: issue.severity,
      what: issue.description,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.description,
      required: issue.fix ?? buildSuggestedFix(issueType, elementLabel),
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel)
      } : void 0,
      suggestedFix: issue.fix ?? buildSuggestedFix(issueType, elementLabel)
    });
  }
  const uniqueFiles = new Set(
    fixableIssues.filter((i) => i.source).map((i) => i.source.file)
  );
  const fileCount = uniqueFiles.size;
  const issueCount = fixableIssues.length;
  const summary = issueCount === 0 ? "No issues found" : fileCount > 0 ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""}` : `${issueCount} issue${issueCount !== 1 ? "s" : ""}`;
  return {
    screenshot: annotatedScreenshot ?? scanResult.screenshotPath ?? "",
    screenshotRaw: scanResult.screenshotPath ?? "",
    issues: fixableIssues,
    summary
  };
}
var SIMULATOR_CHROME_PATTERNS;
var init_fix_guide = __esm({
  "src/native/fix-guide.ts"() {
    "use strict";
    SIMULATOR_CHROME_PATTERNS = [
      "Save Screen",
      "Rotate",
      "Sheet Grabber",
      "Home Indicator",
      "Status Bar",
      "Side Button",
      "Volume",
      "Mute Switch"
    ];
  }
});

// src/native/index.ts
var native_exports = {};
__export(native_exports, {
  NATIVE_VIEWPORTS: () => NATIVE_VIEWPORTS,
  annotateScreenshot: () => annotateScreenshot,
  auditNativeElements: () => auditNativeElements,
  bootDevice: () => bootDevice,
  buildNativeInteractivity: () => buildNativeInteractivity,
  buildNativeSemantic: () => buildNativeSemantic,
  captureMacOSScreenshot: () => captureMacOSScreenshot,
  captureNativeScreenshot: () => captureNativeScreenshot,
  ensureExtractor: () => ensureExtractor,
  extractMacOSElements: () => extractMacOSElements,
  extractNativeElements: () => extractNativeElements,
  findDevice: () => findDevice,
  findProcess: () => findProcess,
  formatDevice: () => formatDevice,
  formatMacOSScanResult: () => formatMacOSScanResult,
  formatNativeScanResult: () => formatNativeScanResult,
  generateFixGuide: () => generateFixGuide,
  getBootedDevices: () => getBootedDevices,
  getDeviceViewport: () => getDeviceViewport,
  isExtractorAvailable: () => isExtractorAvailable,
  listDevices: () => listDevices,
  mapMacOSToEnhancedElements: () => mapMacOSToEnhancedElements,
  mapToEnhancedElements: () => mapToEnhancedElements,
  scanMacOS: () => scanMacOS,
  scanNative: () => scanNative
});
var init_native = __esm({
  "src/native/index.ts"() {
    "use strict";
    init_viewports();
    init_simulator();
    init_capture2();
    init_extract3();
    init_rules();
    init_scan2();
    init_macos();
    init_interactivity2();
    init_semantic2();
    init_annotate();
    init_fix_guide();
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  A11yAttributesSchema: () => A11yAttributesSchema,
  ActivePreferenceSchema: () => ActivePreferenceSchema,
  AnalysisSchema: () => AnalysisSchema,
  AuditResultSchema: () => AuditResultSchema,
  BoundsSchema: () => BoundsSchema,
  ChangedRegionSchema: () => ChangedRegionSchema,
  CompactContextSchema: () => CompactContextSchema,
  CompactionRequestSchema: () => CompactionRequestSchema,
  CompactionResultSchema: () => CompactionResultSchema,
  ComparisonReportSchema: () => ComparisonReportSchema,
  ComparisonResultSchema: () => ComparisonResultSchema,
  ConfigSchema: () => ConfigSchema,
  CurrentUIStateSchema: () => CurrentUIStateSchema,
  DEFAULT_DYNAMIC_SELECTORS: () => DEFAULT_DYNAMIC_SELECTORS,
  DEFAULT_RETENTION: () => DEFAULT_RETENTION,
  DecisionEntrySchema: () => DecisionEntrySchema,
  DecisionEntryWithChecksSchema: () => DecisionEntryWithChecksSchema,
  DecisionStateSchema: () => DecisionStateSchema,
  DecisionSummarySchema: () => DecisionSummarySchema,
  DecisionTypeSchema: () => DecisionTypeSchema,
  DesignChangeSchema: () => DesignChangeSchema,
  DesignCheckOperatorSchema: () => DesignCheckOperatorSchema,
  DesignCheckSchema: () => DesignCheckSchema,
  DesignSystemResultSchema: () => DesignSystemResultSchema,
  DesignSystemViolationSchema: () => DesignSystemViolationSchema,
  ElementIssueSchema: () => ElementIssueSchema,
  EnhancedElementSchema: () => EnhancedElementSchema,
  ExpectationOperatorSchema: () => ExpectationOperatorSchema,
  ExpectationSchema: () => ExpectationSchema,
  IBRSession: () => IBRSession,
  InteractiveStateSchema: () => InteractiveStateSchema,
  InterfaceBuiltRight: () => InterfaceBuiltRight,
  LANDMARK_SELECTORS: () => LANDMARK_SELECTORS,
  LandmarkElementSchema: () => LandmarkElementSchema,
  LearnedExpectationSchema: () => LearnedExpectationSchema,
  MemorySourceSchema: () => MemorySourceSchema,
  MemorySummarySchema: () => MemorySummarySchema,
  NATIVE_VIEWPORTS: () => NATIVE_VIEWPORTS,
  ObservationSchema: () => ObservationSchema,
  PERFORMANCE_THRESHOLDS: () => PERFORMANCE_THRESHOLDS,
  PreferenceCategorySchema: () => PreferenceCategorySchema,
  PreferenceSchema: () => PreferenceSchema,
  RuleAuditResultSchema: () => RuleAuditResultSchema,
  RuleSettingSchema: () => RuleSettingSchema,
  RuleSeveritySchema: () => RuleSeveritySchema,
  RulesConfigSchema: () => RulesConfigSchema,
  SessionQuerySchema: () => SessionQuerySchema,
  SessionSchema: () => SessionSchema,
  SessionStatusSchema: () => SessionStatusSchema,
  VIEWPORTS: () => VIEWPORTS,
  VerdictSchema: () => VerdictSchema,
  ViewportSchema: () => ViewportSchema,
  ViolationSchema: () => ViolationSchema,
  addKnownIssue: () => addKnownIssue,
  addPreference: () => addPreference,
  aiSearchFlow: () => aiSearchFlow,
  allCalmPrecisionRules: () => allCalmPrecisionRules,
  analyzeComparison: () => analyzeComparison,
  analyzeForObviousIssues: () => analyzeForObviousIssues,
  annotateScreenshot: () => annotateScreenshot,
  applyDesignSystemCheck: () => applyDesignSystemCheck,
  archiveSummary: () => archiveSummary,
  auditNativeElements: () => auditNativeElements,
  bootDevice: () => bootDevice,
  buildNativeInteractivity: () => buildNativeInteractivity,
  buildNativeSemantic: () => buildNativeSemantic,
  calculateComplianceScore: () => calculateComplianceScore,
  captureMacOSScreenshot: () => captureMacOSScreenshot,
  captureNativeScreenshot: () => captureNativeScreenshot,
  captureScreenshot: () => captureScreenshot,
  captureWithDiagnostics: () => captureWithDiagnostics,
  checkConsistency: () => checkConsistency,
  classifyPageIntent: () => classifyPageIntent,
  cleanSessions: () => cleanSessions,
  closeBrowser: () => closeBrowser,
  compactContext: () => compactContext,
  compare: () => compare,
  compareAll: () => compareAll,
  compareImages: () => compareImages,
  compareLandmarks: () => compareLandmarks,
  completeOperation: () => completeOperation,
  corePrincipleIds: () => corePrincipleIds,
  createApiTracker: () => createApiTracker,
  createMemoryPreset: () => createMemoryPreset,
  createSession: () => createSession,
  deleteSession: () => deleteSession,
  detectAuthState: () => detectAuthState,
  detectChangedRegions: () => detectChangedRegions,
  detectErrorState: () => detectErrorState,
  detectLandmarks: () => detectLandmarks,
  detectLoadingState: () => detectLoadingState,
  detectPageState: () => detectPageState,
  discoverApiRoutes: () => discoverApiRoutes,
  discoverPages: () => discoverPages,
  enforceRetentionPolicy: () => enforceRetentionPolicy,
  ensureExtractor: () => ensureExtractor,
  extractApiCalls: () => extractApiCalls,
  extractMacOSElements: () => extractMacOSElements,
  extractNativeElements: () => extractNativeElements,
  filePathToRoute: () => filePathToRoute,
  filterByEndpoint: () => filterByEndpoint,
  filterByMethod: () => filterByMethod,
  findButton: () => findButton,
  findDevice: () => findDevice,
  findFieldByLabel: () => findFieldByLabel,
  findOrphanEndpoints: () => findOrphanEndpoints,
  findProcess: () => findProcess,
  findSessions: () => findSessions,
  flows: () => flows,
  formFlow: () => formFlow,
  formatApiTimingResult: () => formatApiTimingResult,
  formatConsistencyReport: () => formatConsistencyReport,
  formatDevice: () => formatDevice,
  formatGlobalMemory: () => formatGlobalMemory,
  formatInteractivityResult: () => formatInteractivityResult,
  formatLandmarkComparison: () => formatLandmarkComparison,
  formatMacOSScanResult: () => formatMacOSScanResult,
  formatMemorySummary: () => formatMemorySummary,
  formatNativeScanResult: () => formatNativeScanResult,
  formatPendingOperations: () => formatPendingOperations,
  formatPerformanceResult: () => formatPerformanceResult,
  formatPreference: () => formatPreference,
  formatReportJson: () => formatReportJson,
  formatReportMinimal: () => formatReportMinimal,
  formatReportText: () => formatReportText,
  formatResponsiveResult: () => formatResponsiveResult,
  formatRetentionStatus: () => formatRetentionStatus,
  formatScanResult: () => formatScanResult,
  formatSemanticJson: () => formatSemanticJson,
  formatSemanticText: () => formatSemanticText,
  formatSessionSummary: () => formatSessionSummary,
  formatValidationResult: () => formatValidationResult,
  generateDevModePrompt: () => generateDevModePrompt,
  generateFixGuide: () => generateFixGuide,
  generateQuickSummary: () => generateQuickSummary,
  generateReport: () => generateReport,
  generateSessionId: () => generateSessionId,
  generateValidationContext: () => generateValidationContext,
  generateValidationPrompt: () => generateValidationPrompt,
  getBootedDevices: () => getBootedDevices,
  getDecision: () => getDecision,
  getDecisionStats: () => getDecisionStats,
  getDecisionsByRoute: () => getDecisionsByRoute,
  getDecisionsSize: () => getDecisionsSize,
  getDeviceViewport: () => getDeviceViewport,
  getExpectedLandmarksForIntent: () => getExpectedLandmarksForIntent,
  getExpectedLandmarksFromContext: () => getExpectedLandmarksFromContext,
  getIntentDescription: () => getIntentDescription,
  getMostRecentSession: () => getMostRecentSession,
  getNavigationLinks: () => getNavigationLinks,
  getPendingOperations: () => getPendingOperations,
  getPreference: () => getPreference,
  getRetentionStatus: () => getRetentionStatus,
  getSemanticOutput: () => getSemanticOutput,
  getSession: () => getSession,
  getSessionPaths: () => getSessionPaths,
  getSessionStats: () => getSessionStats,
  getSessionsByRoute: () => getSessionsByRoute,
  getTimeline: () => getTimeline,
  getTrackedRoutes: () => getTrackedRoutes,
  getVerdictDescription: () => getVerdictDescription,
  getViewport: () => getViewport,
  groupByEndpoint: () => groupByEndpoint,
  groupByFile: () => groupByFile,
  initMemory: () => initMemory,
  isCompactContextOversize: () => isCompactContextOversize,
  isExtractorAvailable: () => isExtractorAvailable,
  learnFromSession: () => learnFromSession,
  listDevices: () => listDevices,
  listGlobalPreferences: () => listGlobalPreferences,
  listLearned: () => listLearned,
  listPreferences: () => listPreferences,
  listSessions: () => listSessions,
  loadCompactContext: () => loadCompactContext,
  loadDesignSystemConfig: () => loadDesignSystemConfig,
  loadRetentionConfig: () => loadRetentionConfig,
  loadSummary: () => loadSummary,
  loadTokenSpec: () => loadTokenSpec,
  loginFlow: () => loginFlow,
  mapMacOSToEnhancedElements: () => mapMacOSToEnhancedElements,
  mapToEnhancedElements: () => mapToEnhancedElements,
  markSessionCompared: () => markSessionCompared,
  maybeAutoClean: () => maybeAutoClean,
  measureApiTiming: () => measureApiTiming,
  measurePerformance: () => measurePerformance,
  measureWebVitals: () => measureWebVitals,
  normalizeColor: () => normalizeColor,
  preferencesToRules: () => preferencesToRules,
  promoteToGlobal: () => promoteToGlobal,
  promoteToPreference: () => promoteToPreference,
  queryDecisions: () => queryDecisions,
  queryMemory: () => queryMemory,
  rebuildSummary: () => rebuildSummary,
  recordDecision: () => recordDecision,
  registerOperation: () => registerOperation,
  removeGlobalPreference: () => removeGlobalPreference,
  removePreference: () => removePreference,
  runDesignSystemCheck: () => runDesignSystemCheck,
  saveCompactContext: () => saveCompactContext,
  saveSummary: () => saveSummary,
  scan: () => scan,
  scanDirectoryForApiCalls: () => scanDirectoryForApiCalls,
  scanMacOS: () => scanMacOS,
  scanNative: () => scanNative,
  searchFlow: () => searchFlow,
  seedFromGlobal: () => seedFromGlobal,
  setActiveRoute: () => setActiveRoute,
  stylisticPrincipleIds: () => stylisticPrincipleIds,
  testInteractivity: () => testInteractivity,
  testResponsive: () => testResponsive,
  updateCompactContext: () => updateCompactContext,
  updateSession: () => updateSession,
  validateAgainstTokens: () => validateAgainstTokens,
  validateExtendedTokens: () => validateExtendedTokens,
  waitForCompletion: () => waitForCompletion,
  waitForNavigation: () => waitForNavigation,
  waitForPageReady: () => waitForPageReady,
  withOperationTracking: () => withOperationTracking
});
async function compare(options) {
  const {
    url,
    baselinePath,
    currentPath,
    threshold = 1,
    outputDir = (0, import_path19.join)((0, import_os3.tmpdir)(), "ibr-compare"),
    viewport = "desktop",
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4
  } = options;
  if (!baselinePath && !url) {
    throw new Error("Either baselinePath or url must be provided");
  }
  const resolvedViewport = typeof viewport === "string" ? VIEWPORTS[viewport] || VIEWPORTS.desktop : viewport;
  await (0, import_promises19.mkdir)(outputDir, { recursive: true });
  const timestamp = Date.now();
  const actualBaselinePath = baselinePath || (0, import_path19.join)(outputDir, `baseline-${timestamp}.png`);
  let actualCurrentPath = currentPath || (0, import_path19.join)(outputDir, `current-${timestamp}.png`);
  const diffPath = (0, import_path19.join)(outputDir, `diff-${timestamp}.png`);
  if (url && !baselinePath) {
    await captureScreenshot({
      url,
      outputPath: actualBaselinePath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout
    });
  }
  if (url && !currentPath) {
    await captureScreenshot({
      url,
      outputPath: actualCurrentPath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout
    });
  }
  try {
    await (0, import_promises19.access)(actualBaselinePath);
  } catch {
    throw new Error(`Baseline image not found: ${actualBaselinePath}`);
  }
  try {
    await (0, import_promises19.access)(actualCurrentPath);
  } catch {
    throw new Error(`Current image not found: ${actualCurrentPath}`);
  }
  const comparison = await compareImages({
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath,
    diffPath,
    threshold: threshold / 100
    // Convert percentage to 0-1 for pixelmatch
  });
  const analysis = analyzeComparison(comparison, threshold);
  await closeBrowser();
  return {
    match: comparison.match,
    diffPercent: comparison.diffPercent,
    diffPixels: comparison.diffPixels,
    totalPixels: comparison.totalPixels,
    verdict: analysis.verdict,
    summary: analysis.summary,
    changedRegions: analysis.changedRegions.map((r) => ({
      location: r.location,
      description: r.description,
      severity: r.severity
    })),
    recommendation: analysis.recommendation,
    diffPath: comparison.match ? void 0 : diffPath,
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath
  };
}
async function compareAll(options = {}) {
  const {
    sessionId,
    outputDir = "./.ibr",
    urlPattern,
    statuses = ["baseline"],
    limit = 50
  } = options;
  const results = [];
  if (sessionId) {
    const session = await getSession(outputDir, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const paths = getSessionPaths(outputDir, session.id);
    const result = await compare({
      url: session.url,
      baselinePath: paths.baseline,
      outputDir: (0, import_path19.dirname)(paths.diff),
      viewport: session.viewport
    });
    results.push(result);
  } else {
    let sessions = await listSessions(outputDir);
    sessions = sessions.filter((s) => statuses.includes(s.status));
    if (urlPattern) {
      const pattern = typeof urlPattern === "string" ? new RegExp(urlPattern) : urlPattern;
      sessions = sessions.filter((s) => pattern.test(s.url));
    }
    sessions = sessions.slice(0, limit);
    for (const session of sessions) {
      try {
        const paths = getSessionPaths(outputDir, session.id);
        const result = await compare({
          url: session.url,
          baselinePath: paths.baseline,
          outputDir: (0, import_path19.dirname)(paths.diff),
          viewport: session.viewport
        });
        results.push(result);
      } catch (err) {
        console.warn(`Failed to compare session ${session.id}: ${err}`);
      }
    }
  }
  await closeBrowser();
  return results;
}
var import_promises19, import_path19, import_os3, InterfaceBuiltRight, IBRSession;
var init_index = __esm({
  "src/index.ts"() {
    "use strict";
    init_schemas();
    init_capture();
    init_compare();
    init_session();
    init_report();
    init_semantic();
    init_flows();
    init_driver();
    init_compat();
    import_promises19 = require("fs/promises");
    import_path19 = require("path");
    import_os3 = require("os");
    init_cleanup();
    init_schemas();
    init_types();
    init_types();
    init_capture();
    init_consistency();
    init_compare();
    init_crawl();
    init_session();
    init_report();
    init_integration();
    init_operation_tracker();
    init_semantic();
    init_flows();
    init_cleanup();
    init_performance();
    init_interactivity();
    init_api_timing();
    init_responsive();
    init_memory();
    init_decision_tracker();
    init_compact();
    init_types3();
    init_scan();
    init_tokens();
    init_design_system();
    init_tokens2();
    init_principles();
    init_memory();
    init_native();
    InterfaceBuiltRight = class {
      config;
      constructor(options = {}) {
        this.config = ConfigSchema.parse(options);
      }
      /**
       * Start a visual session by capturing a baseline screenshot
       */
      async startSession(path2, options = {}) {
        const {
          name = this.generateSessionName(path2),
          viewport = this.config.viewport,
          fullPage = this.config.fullPage,
          selector,
          waitFor
        } = options;
        const url = this.resolveUrl(path2);
        const session = await createSession(this.config.outputDir, url, name, viewport);
        const paths = getSessionPaths(this.config.outputDir, session.id);
        const captureResult = await captureWithLandmarks({
          url,
          outputPath: paths.baseline,
          viewport,
          fullPage,
          waitForNetworkIdle: this.config.waitForNetworkIdle,
          timeout: this.config.timeout,
          outputDir: this.config.outputDir,
          selector,
          waitFor
        });
        const updatedSession = await updateSession(this.config.outputDir, session.id, {
          landmarkElements: captureResult.landmarkElements,
          pageIntent: captureResult.pageIntent
        });
        await maybeAutoClean(this.config.outputDir);
        return {
          sessionId: session.id,
          baseline: paths.baseline,
          session: updatedSession
        };
      }
      /**
       * Check current state against baseline
       */
      async check(sessionId) {
        const session = sessionId ? await getSession(this.config.outputDir, sessionId) : await getMostRecentSession(this.config.outputDir);
        if (!session) {
          throw new Error(sessionId ? `Session not found: ${sessionId}` : "No sessions found. Run startSession first.");
        }
        const paths = getSessionPaths(this.config.outputDir, session.id);
        await captureScreenshot({
          url: session.url,
          outputPath: paths.current,
          viewport: session.viewport,
          fullPage: this.config.fullPage,
          waitForNetworkIdle: this.config.waitForNetworkIdle,
          timeout: this.config.timeout,
          outputDir: this.config.outputDir
        });
        const comparison = await compareImages({
          baselinePath: paths.baseline,
          currentPath: paths.current,
          diffPath: paths.diff,
          threshold: this.config.threshold / 100
          // Convert percentage to 0-1 range for pixelmatch
        });
        const analysis = analyzeComparison(comparison, this.config.threshold);
        await markSessionCompared(this.config.outputDir, session.id, comparison, analysis);
        return generateReport(session, comparison, analysis, this.config.outputDir);
      }
      /**
       * Get a session by ID
       */
      async getSession(sessionId) {
        return getSession(this.config.outputDir, sessionId);
      }
      /**
       * Get the most recent session
       */
      async getMostRecentSession() {
        return getMostRecentSession(this.config.outputDir);
      }
      /**
       * List all sessions
       */
      async listSessions() {
        return listSessions(this.config.outputDir);
      }
      /**
       * Delete a session
       */
      async deleteSession(sessionId) {
        return deleteSession(this.config.outputDir, sessionId);
      }
      /**
       * Clean old sessions
       */
      async clean(options = {}) {
        return cleanSessions(this.config.outputDir, options);
      }
      /**
       * Find sessions matching query criteria
       */
      async find(query = {}) {
        return findSessions(this.config.outputDir, query);
      }
      /**
       * Get timeline of sessions for a specific route
       * Returns sessions in chronological order (oldest first)
       */
      async getTimeline(route, limit = 10) {
        return getTimeline(this.config.outputDir, route, limit);
      }
      /**
       * Get sessions grouped by route
       */
      async getSessionsByRoute() {
        return getSessionsByRoute(this.config.outputDir);
      }
      /**
       * Get session statistics
       */
      async getStats() {
        return getSessionStats(this.config.outputDir);
      }
      /**
       * Update baseline with current screenshot
       */
      async updateBaseline(sessionId) {
        const session = sessionId ? await getSession(this.config.outputDir, sessionId) : await getMostRecentSession(this.config.outputDir);
        if (!session) {
          throw new Error(sessionId ? `Session not found: ${sessionId}` : "No sessions found.");
        }
        const paths = getSessionPaths(this.config.outputDir, session.id);
        await captureScreenshot({
          url: session.url,
          outputPath: paths.baseline,
          viewport: session.viewport,
          fullPage: this.config.fullPage,
          waitForNetworkIdle: this.config.waitForNetworkIdle,
          timeout: this.config.timeout,
          outputDir: this.config.outputDir
        });
        return updateSession(this.config.outputDir, session.id, {
          status: "baseline",
          comparison: void 0,
          analysis: void 0
        });
      }
      /**
       * Start a simplified session with semantic understanding
       *
       * This is the new simpler API - one line to start:
       * ```typescript
       * const session = await ibr.start('http://localhost:3000');
       * const understanding = await session.understand();
       * ```
       */
      async start(url, options = {}) {
        const fullUrl = this.resolveUrl(url);
        const viewportName = options.viewport || "desktop";
        const viewport = VIEWPORTS[viewportName];
        const driver3 = new EngineDriver();
        await driver3.launch({ headless: true, viewport: { width: viewport.width, height: viewport.height } });
        const page = new CompatPage(driver3);
        await page.goto(fullUrl, {
          waitUntil: "domcontentloaded",
          timeout: options.timeout || this.config.timeout
        });
        if (this.config.waitForNetworkIdle) {
          await page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
          });
        }
        if (options.waitFor) {
          await page.waitForSelector(options.waitFor, { timeout: 1e4 }).catch(() => {
          });
        }
        return new IBRSession(page, driver3, this.config);
      }
      /**
       * Close the browser instance
       */
      async close() {
        await closeBrowser();
      }
      /**
       * Get configuration
       */
      getConfig() {
        return { ...this.config };
      }
      /**
       * Resolve a path to full URL
       */
      resolveUrl(path2) {
        if (path2.startsWith("http://") || path2.startsWith("https://")) {
          return path2;
        }
        return `${this.config.baseUrl}${path2.startsWith("/") ? path2 : `/${path2}`}`;
      }
      /**
       * Generate a session name from path
       */
      generateSessionName(path2) {
        return path2.replace(/^\/+/, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9-_]/g, "") || "homepage";
      }
    };
    IBRSession = class {
      /** Page interface for browser interaction */
      page;
      driver;
      config;
      constructor(page, driver3, config) {
        this.page = page;
        this.driver = driver3;
        this.config = config;
      }
      /**
       * Get semantic understanding of the current page
       */
      async understand() {
        return getSemanticOutput(this.page);
      }
      /**
       * Get semantic understanding as formatted text
       */
      async understandText() {
        const result = await getSemanticOutput(this.page);
        return formatSemanticText(result);
      }
      /**
       * Click an element by selector
       */
      async click(selector) {
        await this.page.click(selector);
      }
      /**
       * Type text into an element
       */
      async type(selector, text) {
        await this.page.fill(selector, text);
      }
      /**
       * Navigate to a new URL
       */
      async goto(url) {
        await this.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: this.config.timeout
        });
      }
      /**
       * Wait for a selector to appear
       */
      async waitFor(selector, timeout = 1e4) {
        await this.page.waitForSelector(selector, { timeout });
      }
      /**
       * Take a screenshot
       */
      async screenshot(path2) {
        return this.page.screenshot({
          path: path2,
          fullPage: this.config.fullPage
        });
      }
      /**
       * Mock a network request.
       * NOTE: Network mocking requires CDP Fetch domain support (not yet implemented).
       * This is a placeholder that throws until CDP Fetch is added to the engine.
       */
      async mock(_pattern, _response) {
        throw new Error(
          "Network mocking not yet supported by CDP engine. This requires the CDP Fetch domain which is planned for a future update."
        );
      }
      /**
       * Built-in flows for common automation patterns
       */
      flow = {
        /**
         * Login with email/password
         * @example
         * const result = await session.flow.login({ email: 'test@test.com', password: 'secret' });
         */
        login: (options) => loginFlow(this.page, { ...options, timeout: this.config.timeout }),
        /**
         * Search for content
         * @example
         * const result = await session.flow.search({ query: 'test' });
         */
        search: (options) => searchFlow(this.page, { ...options, timeout: this.config.timeout }),
        /**
         * Fill and submit a form
         * @example
         * const result = await session.flow.form({
         *   fields: [{ name: 'email', value: 'test@test.com' }]
         * });
         */
        form: (options) => formFlow(this.page, { ...options, timeout: this.config.timeout })
      };
      /**
       * Measure Web Vitals performance metrics
       * @example
       * const result = await session.measurePerformance();
       * console.log(result.ratings.LCP); // { value: 1200, rating: 'good' }
       */
      async measurePerformance() {
        const { measurePerformance: mp } = await Promise.resolve().then(() => (init_performance(), performance_exports));
        return mp(this.page);
      }
      /**
       * Test interactivity of buttons, links, and forms
       * @example
       * const result = await session.testInteractivity();
       * console.log(result.issues); // List of issues with buttons/links
       */
      async testInteractivity() {
        const { testInteractivity: ti } = await Promise.resolve().then(() => (init_interactivity(), interactivity_exports));
        return ti(this.page);
      }
      /**
       * Start tracking API request timing
       * Call before actions, then call stop() to get results
       * @example
       * const tracker = session.trackApiTiming({ filter: /\/api\// });
       * tracker.start();
       * await session.click('button');
       * const result = tracker.stop();
       */
      trackApiTiming(options) {
        const createTracker = async () => {
          const { createApiTracker: createApiTracker2 } = await Promise.resolve().then(() => (init_api_timing(), api_timing_exports));
          return createApiTracker2(this.page, options);
        };
        return createTracker();
      }
      /**
       * Close the session and browser
       */
      async close() {
        await this.driver.close();
      }
    };
  }
});

// src/engine/safari/webdriver.ts
var WebDriverClient;
var init_webdriver = __esm({
  "src/engine/safari/webdriver.ts"() {
    "use strict";
    WebDriverClient = class {
      baseUrl;
      sessionId = null;
      constructor(port) {
        this.baseUrl = `http://localhost:${port}`;
      }
      // ─── Internal HTTP helpers ───────────────────────────────
      async post(path2, body) {
        const res = await fetch(`${this.baseUrl}${path2}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "(no body)");
          throw new Error(`WebDriver POST ${path2} failed: HTTP ${res.status} \u2014 ${text}`);
        }
        const json = await res.json();
        return json.value;
      }
      async get(path2) {
        const res = await fetch(`${this.baseUrl}${path2}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "(no body)");
          throw new Error(`WebDriver GET ${path2} failed: HTTP ${res.status} \u2014 ${text}`);
        }
        const json = await res.json();
        return json.value;
      }
      async delete(path2) {
        const res = await fetch(`${this.baseUrl}${path2}`, { method: "DELETE" });
        if (!res.ok) {
          const text = await res.text().catch(() => "(no body)");
          throw new Error(`WebDriver DELETE ${path2} failed: HTTP ${res.status} \u2014 ${text}`);
        }
        const json = await res.json();
        return json.value;
      }
      session(path2 = "") {
        if (!this.sessionId) throw new Error("No active WebDriver session");
        return `/session/${this.sessionId}${path2}`;
      }
      // ─── Session management ──────────────────────────────────
      /**
       * Create a new WebDriver session.
       * Returns the session ID.
       */
      async createSession(capabilities = {}) {
        const body = {
          capabilities: {
            alwaysMatch: {
              browserName: "safari",
              ...capabilities
            }
          }
        };
        const value = await this.post("/session", body);
        if (typeof value === "string") {
          this.sessionId = value;
        } else if (value && typeof value === "object" && "sessionId" in value) {
          this.sessionId = value.sessionId;
        } else {
          throw new Error(`Unexpected createSession response: ${JSON.stringify(value)}`);
        }
        return this.sessionId;
      }
      /** Delete the current WebDriver session. */
      async deleteSession() {
        if (!this.sessionId) return;
        await this.delete(this.session()).catch(() => {
        });
        this.sessionId = null;
      }
      get activeSessionId() {
        return this.sessionId;
      }
      // ─── Navigation ──────────────────────────────────────────
      async navigateTo(url) {
        await this.post(this.session("/url"), { url });
      }
      async getCurrentUrl() {
        return this.get(this.session("/url"));
      }
      // ─── Screenshots ─────────────────────────────────────────
      /**
       * Take a full-page screenshot.
       * Returns a PNG buffer decoded from the base64 response.
       */
      async takeScreenshot() {
        const b64 = await this.get(this.session("/screenshot"));
        return Buffer.from(b64, "base64");
      }
      // ─── Element interaction ─────────────────────────────────
      /**
       * Find a single element using the given strategy and value.
       * Returns the WebDriver element ID string.
       */
      async findElement(strategy, value) {
        const result = await this.post(
          this.session("/element"),
          { using: strategy, value }
        );
        const W3C_KEY = "element-6066-11e4-a52e-4f735466cecf";
        const elementId = result[W3C_KEY] ?? result["ELEMENT"];
        if (!elementId) {
          throw new Error(`findElement: no element ID in response: ${JSON.stringify(result)}`);
        }
        return elementId;
      }
      async clickElement(elementId) {
        await this.post(this.session(`/element/${elementId}/click`), {});
      }
      async sendKeys(elementId, text) {
        await this.post(this.session(`/element/${elementId}/value`), { text });
      }
      async clearElement(elementId) {
        await this.post(this.session(`/element/${elementId}/clear`), {});
      }
      async getElementRect(elementId) {
        return this.get(this.session(`/element/${elementId}/rect`));
      }
      async getElementText(elementId) {
        return this.get(this.session(`/element/${elementId}/text`));
      }
      // ─── JavaScript execution ────────────────────────────────
      async executeScript(script, args = []) {
        return this.post(this.session("/execute/sync"), { script, args });
      }
      // ─── Window management ───────────────────────────────────
      async setWindowRect(rect) {
        await this.post(this.session("/window/rect"), rect);
      }
      // ─── Health check ────────────────────────────────────────
      async status() {
        try {
          await this.get("/status");
          return true;
        } catch {
          return false;
        }
      }
    };
  }
});

// src/engine/safari/session.ts
var session_exports2 = {};
__export(session_exports2, {
  SafariSession: () => SafariSession
});
var import_child_process6, import_util5, execFileAsync5, PORT_RANGE_START, PORT_RANGE_END, READY_POLL_INTERVAL_MS, READY_TIMEOUT_MS, SafariSession;
var init_session2 = __esm({
  "src/engine/safari/session.ts"() {
    "use strict";
    import_child_process6 = require("child_process");
    import_util5 = require("util");
    execFileAsync5 = (0, import_util5.promisify)(import_child_process6.execFile);
    PORT_RANGE_START = 9500;
    PORT_RANGE_END = 9599;
    READY_POLL_INTERVAL_MS = 200;
    READY_TIMEOUT_MS = 15e3;
    SafariSession = class {
      process = null;
      port = PORT_RANGE_START;
      // ─── Start ──────────────────────────────────────────────
      /**
       * Start safaridriver on the given port (or auto-find a free one).
       * Returns the port it's listening on.
       */
      async start(port) {
        if (this.process) {
          return this.port;
        }
        this.port = port ?? await this.findFreePort();
        this.process = (0, import_child_process6.spawn)("safaridriver", ["--port", String(this.port)], {
          stdio: ["ignore", "pipe", "pipe"]
        });
        this.process.on("exit", (code) => {
          if (code !== null && code !== 0) {
            console.error(`[SafariSession] safaridriver exited with code ${code}`);
          }
          this.process = null;
        });
        await this.waitUntilReady();
        return this.port;
      }
      // ─── Stop ───────────────────────────────────────────────
      async stop() {
        if (!this.process) return;
        this.process.kill("SIGTERM");
        await new Promise((resolve5) => {
          const timeout = setTimeout(() => {
            this.process?.kill("SIGKILL");
            resolve5();
          }, 2e3);
          this.process.once("exit", () => {
            clearTimeout(timeout);
            resolve5();
          });
        });
        this.process = null;
      }
      isRunning() {
        return this.process !== null && !this.process.killed;
      }
      // ─── Static: capability check ────────────────────────────
      /**
       * Returns true if safaridriver is enabled (one-time sudo setup was done).
       * Tests by trying to get safaridriver version — fails if not enabled.
       */
      static async isEnabled() {
        try {
          await execFileAsync5("safaridriver", ["--version"], { timeout: 5e3 });
          return true;
        } catch {
          return false;
        }
      }
      // ─── Internals ───────────────────────────────────────────
      async waitUntilReady() {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        const url = `http://localhost:${this.port}/status`;
        while (Date.now() < deadline) {
          try {
            const res = await fetch(url);
            if (res.ok) return;
          } catch {
          }
          await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
        }
        throw new Error(
          `safaridriver did not become ready on port ${this.port} within ${READY_TIMEOUT_MS}ms. Ensure "sudo safaridriver --enable" has been run.`
        );
      }
      async findFreePort() {
        const { createServer: createServer2 } = await import("net");
        for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
          const available = await new Promise((resolve5) => {
            const server = createServer2();
            server.once("error", () => resolve5(false));
            server.once("listening", () => {
              server.close();
              resolve5(true);
            });
            server.listen(p, "127.0.0.1");
          });
          if (available) return p;
        }
        throw new Error(
          `No free port found in range ${PORT_RANGE_START}-${PORT_RANGE_END} for safaridriver`
        );
      }
    };
  }
});

// src/engine/safari/driver.ts
var driver_exports2 = {};
__export(driver_exports2, {
  SafariDriver: () => SafariDriver
});
var import_child_process7, import_util6, execFileAsync6, SafariDriver;
var init_driver2 = __esm({
  "src/engine/safari/driver.ts"() {
    "use strict";
    import_child_process7 = require("child_process");
    import_util6 = require("util");
    init_webdriver();
    init_session2();
    init_extract3();
    init_serialize();
    execFileAsync6 = (0, import_util6.promisify)(import_child_process7.execFile);
    SafariDriver = class {
      client = null;
      session = null;
      _currentUrl = "";
      _axElements = [];
      // ─── Lifecycle ──────────────────────────────────────────
      async launch(options = {}) {
        this.session = new SafariSession();
        const port = await this.session.start();
        this.client = new WebDriverClient(port);
        await this.client.createSession();
        const vp = options.viewport ?? { width: 1920, height: 1080 };
        await this.client.setWindowRect({ ...vp, x: -9999, y: -9999 });
        (0, import_child_process7.exec)(`osascript -e 'tell application "System Events" to set visible of process "Safari" to false'`, () => {
        });
      }
      async close() {
        if (this.client) {
          await this.client.deleteSession().catch(() => {
          });
          this.client = null;
        }
        if (this.session) {
          await this.session.stop();
          this.session = null;
        }
        this._currentUrl = "";
        this._axElements = [];
      }
      // ─── Navigation ─────────────────────────────────────────
      async navigate(url, options = {}) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this.client.navigateTo(url);
        const strategy = options.waitFor ?? "load";
        const timeout = options.timeout ?? 1e4;
        if (strategy !== "none") {
          const deadline = Date.now() + timeout;
          while (Date.now() < deadline) {
            try {
              const state = await this.client.executeScript(
                "return document.readyState"
              );
              if (state === "complete") break;
            } catch {
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          if (strategy === "stable") {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        this._currentUrl = await this.client.getCurrentUrl().catch(() => url);
        this._axElements = await this._fetchAXElements().catch(() => []);
      }
      get currentUrl() {
        return this._currentUrl;
      }
      // ─── Screenshots ─────────────────────────────────────────
      async screenshot(options) {
        if (!this.client) throw new Error("SafariDriver not launched");
        const buf = await this.client.takeScreenshot();
        if (options?.clip) {
          return this._cropScreenshot(buf, options.clip);
        }
        return buf;
      }
      // ─── Element discovery ───────────────────────────────────
      /**
       * Discover elements via macOS AX API.
       * Falls back to WebDriver JS query if AX extraction unavailable.
       */
      async discover(options = {}) {
        const filter = options.filter ?? "interactive";
        this._axElements = await this._fetchAXElements();
        let filtered;
        switch (filter) {
          case "interactive":
            filtered = this._axElements.filter((e) => e.actions.length > 0);
            break;
          case "leaf":
            filtered = this._axElements.filter((e) => e.label && e.role !== "group");
            break;
          case "all":
          default:
            filtered = this._axElements;
        }
        if (options.serialize) {
          const snap = {
            url: this._currentUrl,
            platform: "web",
            elements: filtered,
            timestamp: Date.now()
          };
          return serializeSnapshot(snap);
        }
        return filtered;
      }
      /**
       * Find an element by name + optional role in the AX tree.
       */
      async find(name, options = {}) {
        if (this._axElements.length === 0) {
          this._axElements = await this._fetchAXElements().catch(() => []);
        }
        const nameLower = name.toLowerCase();
        const match = this._axElements.find((e) => {
          const nameMatch = e.label?.toLowerCase().includes(nameLower) || e.value?.toString().toLowerCase().includes(nameLower);
          const roleMatch = !options.role || e.role === options.role;
          return nameMatch && roleMatch;
        });
        return match ?? null;
      }
      // ─── Interactions ────────────────────────────────────────
      /**
       * Click an element. The elementId is either:
       * - An AX element ID (from discover/find) — resolved via JS querySelector by label
       * - A CSS selector passed directly
       */
      async click(elementId) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this._executeElementAction(elementId, "click");
      }
      async type(elementId, text) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this._executeElementAction(elementId, "focus");
        await this.client.executeScript(
          `(function(text) {
        const el = document.activeElement;
        if (el) {
          el.value = (el.value || '') + text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })(arguments[0])`,
          [text]
        );
      }
      async fill(elementId, value) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this._executeElementAction(elementId, "focus");
        await this.client.executeScript(
          `(function(value) {
        const el = document.activeElement;
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })(arguments[0])`,
          [value]
        );
      }
      async hover(elementId) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this._executeElementAction(elementId, "mouseover");
      }
      async pressKey(key) {
        if (!this.client) throw new Error("SafariDriver not launched");
        try {
          const activeElId = await this.client.executeScript(
            `return document.activeElement ? document.activeElement.tagName : ''`
          );
          if (activeElId) {
            await this.client.executeScript(
              `(function(key) {
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
            document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { key: key, bubbles: true }));
          })(arguments[0])`,
              [key]
            );
          }
        } catch {
        }
      }
      async scroll(deltaY, _x = 0, _y = 0) {
        if (!this.client) throw new Error("SafariDriver not launched");
        await this.client.executeScript(
          `window.scrollBy(0, arguments[0])`,
          [deltaY]
        );
      }
      // ─── Evaluation ─────────────────────────────────────────
      async evaluate(expression) {
        if (!this.client) throw new Error("SafariDriver not launched");
        return this.client.executeScript(`return (${expression})`);
      }
      // ─── Internals ───────────────────────────────────────────
      /**
       * Fetch the AX element tree for the running Safari window.
       * Uses the Swift ibr-ax-extract binary with Safari's PID.
       */
      async _fetchAXElements() {
        try {
          const extractorPath = await ensureExtractor();
          const { stdout } = await execFileAsync6(
            extractorPath,
            ["--app", "Safari"],
            { timeout: 15e3 }
          );
          const lines = stdout.split("\n");
          const jsonStr = lines.slice(1).join("\n").trim();
          if (!jsonStr) return [];
          const raw = JSON.parse(jsonStr);
          return this._mapAXToElements(raw);
        } catch {
          return [];
        }
      }
      /**
       * Map raw macOS AX JSON output to IBR Element format.
       */
      _mapAXToElements(rawElements, parentId = null) {
        const elements = [];
        let idx = 0;
        for (const raw of rawElements) {
          const id = `safari-ax-${parentId ? parentId + "-" : ""}${idx++}`;
          const role = this._mapAXRole(raw.role ?? "AXUnknown");
          const label = raw.title ?? raw.description ?? raw.value ?? "";
          const actions = (raw.actions ?? []).map(
            (a) => a.replace(/^AX/, "").toLowerCase()
          );
          elements.push({
            id,
            role,
            label,
            value: raw.value ?? null,
            enabled: raw.enabled ?? true,
            focused: raw.focused ?? false,
            actions,
            bounds: [
              raw.position?.x ?? 0,
              raw.position?.y ?? 0,
              raw.size?.width ?? 0,
              raw.size?.height ?? 0
            ],
            parent: parentId
          });
          if (raw.children && raw.children.length > 0) {
            const children = this._mapAXToElements(raw.children, id);
            elements.push(...children);
          }
        }
        return elements;
      }
      /** Map macOS AX role names to ARIA-style roles */
      _mapAXRole(axRole) {
        const map = {
          AXButton: "button",
          AXLink: "link",
          AXTextField: "textbox",
          AXTextArea: "textbox",
          AXCheckBox: "checkbox",
          AXRadioButton: "radio",
          AXComboBox: "combobox",
          AXPopUpButton: "combobox",
          AXSlider: "slider",
          AXImage: "img",
          AXStaticText: "text",
          AXHeading: "heading",
          AXList: "list",
          AXListItem: "listitem",
          AXTable: "table",
          AXRow: "row",
          AXCell: "cell",
          AXGroup: "group",
          AXScrollArea: "scrollbar",
          AXWebArea: "main",
          AXWindow: "dialog",
          AXMenuBar: "menubar",
          AXMenu: "menu",
          AXMenuItem: "menuitem",
          AXToolbar: "toolbar"
        };
        return map[axRole] ?? axRole.replace(/^AX/, "").toLowerCase();
      }
      /**
       * Execute a DOM action on an element.
       * Resolution order:
       *   1. CSS selector (if elementId looks like one: starts with . # [ or is a tag)
       *   2. ARIA label match via querySelector [aria-label="..."]
       *   3. Text content match via TreeWalker
       */
      async _executeElementAction(elementId, action) {
        const script = `
      (function(eid, action) {
        let el = null;

        // Strategy 1: treat as CSS selector
        const looksLikeCss = /^[.#\\[a-zA-Z]/.test(eid);
        if (looksLikeCss) {
          try { el = document.querySelector(eid); } catch(e) {}
        }

        // Strategy 2: aria-label match (use CSS.escape to prevent selector injection)
        if (!el) {
          try { el = document.querySelector('[aria-label="' + CSS.escape(eid) + '"]'); } catch(e) {}
        }

        // Strategy 3: button/link text content
        if (!el) {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null
          );
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent && node.textContent.trim() === eid) {
              if (['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(node.tagName)) {
                el = node;
                break;
              }
            }
          }
        }

        if (!el) return false;

        if (action === 'click') {
          el.click();
        } else if (action === 'focus') {
          el.focus();
        } else if (action === 'mouseover') {
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        }

        return true;
      })(arguments[0], arguments[1])
    `;
        const found = await this.client.executeScript(script, [elementId, action]);
        if (!found) {
          throw new Error(`SafariDriver: element not found for action "${action}": ${elementId}`);
        }
      }
      /**
       * Crop a PNG buffer to a clip region using pngjs.
       * Gracefully returns the full buffer if pngjs unavailable or clip fails.
       */
      async _cropScreenshot(buf, clip) {
        try {
          const { PNG: PNG5 } = await import("pngjs");
          const src = PNG5.sync.read(buf);
          const dst = new PNG5({ width: clip.width, height: clip.height });
          for (let y = 0; y < clip.height; y++) {
            for (let x = 0; x < clip.width; x++) {
              const srcIdx = ((clip.y + y) * src.width + (clip.x + x)) * 4;
              const dstIdx = (y * clip.width + x) * 4;
              dst.data[dstIdx] = src.data[srcIdx];
              dst.data[dstIdx + 1] = src.data[srcIdx + 1];
              dst.data[dstIdx + 2] = src.data[srcIdx + 2];
              dst.data[dstIdx + 3] = src.data[srcIdx + 3];
            }
          }
          return PNG5.sync.write(dst);
        } catch {
          return buf;
        }
      }
    };
  }
});

// src/rules/presets/minimal.ts
var minimal_exports = {};
__export(minimal_exports, {
  register: () => register,
  rules: () => rules
});
function register() {
  registerPreset(minimalPreset);
}
var noHandlerRule, placeholderLinkRule, touchTargetRule, missingAriaLabelRule, disabledNoVisualRule, minimalPreset, rules;
var init_minimal = __esm({
  "src/rules/presets/minimal.ts"() {
    "use strict";
    init_engine();
    noHandlerRule = {
      id: "no-handler",
      name: "No Click Handler",
      description: "Interactive elements like buttons must have click handlers",
      defaultSeverity: "error",
      check: (element, _context) => {
        const isButton = element.tagName === "button" || element.a11y.role === "button";
        const isDisabled = element.interactive.isDisabled;
        const hasHandler = element.interactive.hasOnClick;
        if (isButton && !isDisabled && !hasHandler) {
          return {
            ruleId: "no-handler",
            ruleName: "No Click Handler",
            severity: "error",
            message: `Button "${element.text || element.selector}" has no click handler`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add an onClick handler or make the button disabled"
          };
        }
        return null;
      }
    };
    placeholderLinkRule = {
      id: "placeholder-link",
      name: "Placeholder Link",
      description: "Links must have valid hrefs or click handlers",
      defaultSeverity: "error",
      check: (element, _context) => {
        const isLink = element.tagName === "a";
        const hasValidHref = element.interactive.hasHref;
        const hasHandler = element.interactive.hasOnClick;
        if (isLink && !hasValidHref && !hasHandler) {
          return {
            ruleId: "placeholder-link",
            ruleName: "Placeholder Link",
            severity: "error",
            message: `Link "${element.text || element.selector}" has placeholder href and no handler`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add a valid href or onClick handler"
          };
        }
        return null;
      }
    };
    touchTargetRule = {
      id: "touch-target-small",
      name: "Touch Target Too Small",
      description: "Interactive elements must meet minimum touch target size",
      defaultSeverity: "warn",
      check: (element, context, options) => {
        const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive) return null;
        const minSize = context.isMobile ? options?.mobileMinSize ?? 44 : options?.desktopMinSize ?? 24;
        const { width, height } = element.bounds;
        if (width < minSize || height < minSize) {
          return {
            ruleId: "touch-target-small",
            ruleName: "Touch Target Too Small",
            severity: "warn",
            message: `"${element.text || element.selector}" touch target is ${width}x${height}px (min: ${minSize}px)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase element size to at least ${minSize}x${minSize}px`
          };
        }
        return null;
      }
    };
    missingAriaLabelRule = {
      id: "missing-aria-label",
      name: "Missing Accessible Label",
      description: "Interactive elements without text need aria-label",
      defaultSeverity: "warn",
      check: (element, _context) => {
        const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive) return null;
        const hasText = element.text && element.text.trim().length > 0;
        const hasAriaLabel = element.a11y.ariaLabel && element.a11y.ariaLabel.trim().length > 0;
        if (!hasText && !hasAriaLabel) {
          return {
            ruleId: "missing-aria-label",
            ruleName: "Missing Accessible Label",
            severity: "warn",
            message: `"${element.selector}" is interactive but has no text or aria-label`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add visible text or aria-label attribute"
          };
        }
        return null;
      }
    };
    disabledNoVisualRule = {
      id: "disabled-no-visual",
      name: "Disabled Without Visual",
      description: "Disabled elements should have visual indication",
      defaultSeverity: "warn",
      check: (element, _context) => {
        if (!element.interactive.isDisabled) return null;
        const cursor = element.interactive.cursor;
        const hasDisabledCursor = cursor === "not-allowed" || cursor === "default";
        const bgColor = element.computedStyles?.backgroundColor;
        const hasGrayedBg = bgColor?.includes("gray") || bgColor?.includes("rgb(200") || bgColor?.includes("rgb(220");
        if (!hasDisabledCursor && !hasGrayedBg) {
          return {
            ruleId: "disabled-no-visual",
            ruleName: "Disabled Without Visual",
            severity: "warn",
            message: `"${element.text || element.selector}" is disabled but has no visual indication`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add cursor: not-allowed and/or gray background to disabled state"
          };
        }
        return null;
      }
    };
    minimalPreset = {
      name: "minimal",
      description: "Basic interactivity and accessibility checks",
      rules: [
        noHandlerRule,
        placeholderLinkRule,
        touchTargetRule,
        missingAriaLabelRule,
        disabledNoVisualRule
      ],
      defaults: {
        "no-handler": "error",
        "placeholder-link": "error",
        "touch-target-small": "warn",
        "missing-aria-label": "warn",
        "disabled-no-visual": "warn"
      }
    };
    rules = {
      noHandlerRule,
      placeholderLinkRule,
      touchTargetRule,
      missingAriaLabelRule,
      disabledNoVisualRule
    };
  }
});

// src/rules/presets/calm-precision.ts
var calm_precision_exports = {};
__export(calm_precision_exports, {
  register: () => register2
});
function register2() {
  const defaults = {};
  for (const rule of allCalmPrecisionRules) {
    const isCore = corePrincipleIds.some(
      (pid) => principleToRules[pid]?.includes(rule.id)
    );
    defaults[rule.id] = isCore ? "error" : "warn";
  }
  registerPreset({
    name: "calm-precision",
    description: "Calm Precision design principles \u2014 Gestalt, Signal-to-Noise, Fitts, Hick, Content-Chrome, Cognitive Load",
    rules: allCalmPrecisionRules,
    defaults
  });
}
var init_calm_precision2 = __esm({
  "src/rules/presets/calm-precision.ts"() {
    "use strict";
    init_engine();
    init_calm_precision();
  }
});

// src/rules/engine.ts
var engine_exports = {};
__export(engine_exports, {
  createAuditResult: () => createAuditResult,
  formatAuditResult: () => formatAuditResult,
  getPreset: () => getPreset,
  listPresets: () => listPresets,
  loadMemoryPreset: () => loadMemoryPreset,
  loadRulesConfig: () => loadRulesConfig,
  registerPreset: () => registerPreset,
  runRules: () => runRules
});
function registerPreset(preset) {
  presets.set(preset.name, preset);
}
function getPreset(name) {
  return presets.get(name);
}
function listPresets() {
  return Array.from(presets.keys());
}
async function loadRulesConfig(projectDir) {
  const configPath = (0, import_path20.join)(projectDir, ".ibr", "rules.json");
  if (!(0, import_fs10.existsSync)(configPath)) {
    return { extends: [], rules: {} };
  }
  try {
    const content = await (0, import_promises20.readFile)(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to parse rules.json: ${error}`);
    return { extends: [], rules: {} };
  }
}
function mergeRuleSettings(presetNames, userRules = {}) {
  const allRules = [];
  const settings = /* @__PURE__ */ new Map();
  const seenRuleIds = /* @__PURE__ */ new Set();
  for (const presetName of presetNames) {
    const preset = presets.get(presetName);
    if (!preset) {
      console.warn(`Unknown preset: ${presetName}`);
      continue;
    }
    for (const rule of preset.rules) {
      if (!seenRuleIds.has(rule.id)) {
        allRules.push(rule);
        seenRuleIds.add(rule.id);
        const defaultSetting = preset.defaults[rule.id] ?? rule.defaultSeverity;
        if (typeof defaultSetting === "string") {
          settings.set(rule.id, { severity: defaultSetting });
        } else {
          settings.set(rule.id, { severity: defaultSetting[0], options: defaultSetting[1] });
        }
      }
    }
  }
  for (const [ruleId, setting] of Object.entries(userRules)) {
    if (typeof setting === "string") {
      settings.set(ruleId, { severity: setting });
    } else {
      settings.set(ruleId, { severity: setting[0], options: setting[1] });
    }
  }
  return { rules: allRules, settings };
}
function runRules(elements, context, config) {
  const { rules: rules2, settings } = mergeRuleSettings(config.extends ?? [], config.rules);
  const violations = [];
  for (const element of elements) {
    for (const rule of rules2) {
      const setting = settings.get(rule.id);
      if (!setting || setting.severity === "off") {
        continue;
      }
      const violation = rule.check(element, context, setting.options);
      if (violation) {
        violations.push({
          ...violation,
          severity: setting.severity
        });
      }
    }
  }
  return violations;
}
function createAuditResult(url, elements, violations) {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warn").length;
  return {
    url,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    elementsScanned: elements.length,
    violations,
    summary: {
      errors,
      warnings,
      passed: elements.length - errors - warnings
    }
  };
}
function formatAuditResult(result) {
  const lines = [];
  lines.push(`IBR Audit: ${result.url}`);
  lines.push(`Scanned: ${result.elementsScanned} elements`);
  lines.push("");
  if (result.violations.length === 0) {
    lines.push("No violations found.");
  } else {
    lines.push(`Found ${result.summary.errors} errors, ${result.summary.warnings} warnings:`);
    lines.push("");
    for (const v of result.violations) {
      const icon = v.severity === "error" ? "\u2717" : "!";
      lines.push(`  ${icon} [${v.ruleId}] ${v.message}`);
      if (v.element) {
        lines.push(`    Element: ${v.element.slice(0, 60)}${v.element.length > 60 ? "..." : ""}`);
      }
      if (v.fix) {
        lines.push(`    Fix: ${v.fix}`);
      }
    }
  }
  lines.push("");
  lines.push(`Summary: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.passed} passed`);
  return lines.join("\n");
}
async function loadMemoryPreset(outputDir) {
  try {
    const { loadSummary: loadSummary2, createMemoryPreset: createMemoryPreset2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
    const summary = await loadSummary2(outputDir);
    if (summary.activePreferences.length > 0) {
      const preset = createMemoryPreset2(summary.activePreferences);
      registerPreset(preset);
    }
  } catch {
  }
}
var import_promises20, import_fs10, import_path20, presets;
var init_engine = __esm({
  "src/rules/engine.ts"() {
    "use strict";
    import_promises20 = require("fs/promises");
    import_fs10 = require("fs");
    import_path20 = require("path");
    presets = /* @__PURE__ */ new Map();
    Promise.resolve().then(() => (init_minimal(), minimal_exports)).then((m) => m.register()).catch(() => {
    });
    Promise.resolve().then(() => (init_calm_precision2(), calm_precision_exports)).then((m) => m.register()).catch(() => {
    });
  }
});

// src/framework-parser.ts
function parseDesignFramework(content, sourcePath) {
  const frameworkInfo = detectFrameworkName(content);
  if (!frameworkInfo) {
    const principles2 = extractPrinciples(content);
    if (principles2.length >= 3) {
      return {
        name: "Custom Design Framework",
        principles: principles2,
        source: sourcePath,
        rawContent: content
      };
    }
    return null;
  }
  const principles = extractPrinciples(content);
  if (principles.length === 0) {
    return null;
  }
  return {
    name: frameworkInfo.name,
    version: frameworkInfo.version,
    principles,
    source: sourcePath,
    rawContent: content
  };
}
function detectFrameworkName(content) {
  for (const pattern of FRAMEWORK_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const name = match[1].trim();
      const version = match[2]?.trim();
      if (!name.toLowerCase().includes("instructions") && !name.toLowerCase().includes("readme") && !name.toLowerCase().includes("overview")) {
        return { name, version };
      }
    }
  }
  const knownFrameworks = [
    "calm precision",
    "material design",
    "human interface guidelines",
    "fluent design",
    "ant design",
    "carbon design",
    "atlassian design"
  ];
  const contentLower = content.toLowerCase();
  for (const framework of knownFrameworks) {
    if (contentLower.includes(framework)) {
      const regex = new RegExp(framework, "i");
      const match = content.match(regex);
      if (match) {
        return { name: match[0] };
      }
    }
  }
  return null;
}
function extractPrinciples(content) {
  const principles = [];
  let principlesSection = content;
  for (const pattern of PRINCIPLES_SECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const startIndex = match.index || 0;
      const afterMatch = content.slice(startIndex);
      const nextMajorSection = afterMatch.match(/^##\s+[A-Z]/m);
      if (nextMajorSection && nextMajorSection.index) {
        principlesSection = afterMatch.slice(0, nextMajorSection.index);
      } else {
        principlesSection = afterMatch;
      }
      break;
    }
  }
  const numberedMatches = principlesSection.matchAll(
    /###\s*(\d+)\.\s*(.+?)(?:\n|\r\n)([\s\S]*?)(?=###\s*\d+\.|##\s|$)/g
  );
  for (const match of numberedMatches) {
    const number = match[1];
    const name = match[2].trim();
    const body = match[3].trim();
    const principle = parsePrincipleBody(number, name, body);
    if (principle) {
      principles.push(principle);
    }
  }
  if (principles.length === 0) {
    const bulletMatches = principlesSection.matchAll(
      /[-*]\s*\*\*(.+?)\*\*[:\s]*(.+?)(?=\n[-*]|\n\n|$)/gs
    );
    let index = 1;
    for (const match of bulletMatches) {
      const name = match[1].trim();
      const description = match[2].trim();
      principles.push({
        id: `principle-${index}`,
        name,
        description,
        implementation: extractImplementationRules(description)
      });
      index++;
    }
  }
  return principles;
}
function parsePrincipleBody(number, name, body) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const foundationMatch = body.match(
    /\*\*(?:Foundation|Based on|Principle):\*\*\s*(.+?)(?:\n|$)/i
  );
  const foundation = foundationMatch ? foundationMatch[1].split(/[,+]/).map((f) => f.trim()).filter(Boolean) : void 0;
  const lines = body.split("\n").filter((l) => l.trim());
  let description = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes("foundation:")) continue;
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
    description = trimmed;
    break;
  }
  const implementation = extractImplementationRules(body);
  return {
    id: `${number}-${id}`,
    name,
    description: description || name,
    foundation,
    implementation
  };
}
function extractImplementationRules(body) {
  const rules2 = [];
  const bulletMatches = body.matchAll(/^[-*]\s+(.+?)$/gm);
  for (const match of bulletMatches) {
    const rule = match[1].trim();
    if (rule && rule.length > 5) {
      rules2.push(rule);
    }
  }
  if (rules2.length === 0) {
    const sentences = body.split(/[.!]\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && (trimmed.match(/^(use|don't|never|always|avoid|prefer|ensure)/i) || trimmed.match(/should|must|need to|better to/i))) {
        rules2.push(trimmed);
      }
    }
  }
  return rules2;
}
var FRAMEWORK_PATTERNS, PRINCIPLES_SECTION_PATTERNS;
var init_framework_parser = __esm({
  "src/framework-parser.ts"() {
    "use strict";
    FRAMEWORK_PATTERNS = [
      /^#\s*(.+?)\s*(\d+\.?\d*)?$/m,
      // "# CALM PRECISION 6.1"
      /^\*\*(.+?)\*\*\s*v?(\d+\.?\d*)?/m,
      // "**Framework Name** v1.0"
      /^##?\s*(?:Design\s+)?Framework:\s*(.+?)(?:\s+v?(\d+\.?\d*))?$/im
    ];
    PRINCIPLES_SECTION_PATTERNS = [
      /^##\s*(?:CORE\s+)?PRINCIPLES?/im,
      /^##\s*DESIGN\s+PRINCIPLES?/im,
      /^##\s*GUIDELINES?/im,
      /^##\s*RULES?/im
    ];
  }
});

// src/context-loader.ts
var context_loader_exports = {};
__export(context_loader_exports, {
  discoverUserContext: () => discoverUserContext,
  formatContextSummary: () => formatContextSummary
});
async function discoverUserContext(projectDir) {
  const sources = [];
  let framework;
  const projectClaudePath = (0, import_path21.join)(projectDir, ".claude", "CLAUDE.md");
  const projectClaudeResult = await tryLoadFramework(projectClaudePath, "project-claude");
  sources.push(projectClaudeResult.source);
  if (projectClaudeResult.framework && !framework) {
    framework = projectClaudeResult.framework;
  }
  const rootClaudePath = (0, import_path21.join)(projectDir, "CLAUDE.md");
  const rootClaudeResult = await tryLoadFramework(rootClaudePath, "root-claude");
  sources.push(rootClaudeResult.source);
  if (rootClaudeResult.framework && !framework) {
    framework = rootClaudeResult.framework;
  }
  const userClaudePath = (0, import_path21.join)((0, import_os4.homedir)(), ".claude", "CLAUDE.md");
  const userClaudeResult = await tryLoadFramework(userClaudePath, "user-claude");
  sources.push(userClaudeResult.source);
  if (userClaudeResult.framework && !framework) {
    framework = userClaudeResult.framework;
  }
  const config = await loadIBRConfig(projectDir);
  let memory;
  const outputDir = config.outputDir || "./.ibr";
  const memoryPath = (0, import_path21.join)(outputDir, "memory", "summary.json");
  if ((0, import_fs11.existsSync)(memoryPath)) {
    try {
      const memContent = await (0, import_promises21.readFile)(memoryPath, "utf-8");
      memory = JSON.parse(memContent);
    } catch {
    }
  }
  return {
    projectDir,
    framework,
    sources,
    config,
    memory
  };
}
async function tryLoadFramework(filePath, type) {
  const source = {
    path: filePath,
    type,
    found: false,
    hasFramework: false
  };
  if (!(0, import_fs11.existsSync)(filePath)) {
    return { source };
  }
  source.found = true;
  try {
    const content = await (0, import_promises21.readFile)(filePath, "utf-8");
    const framework = parseDesignFramework(content, filePath);
    if (framework) {
      source.hasFramework = true;
      return { source, framework };
    }
  } catch (error) {
  }
  return { source };
}
async function loadIBRConfig(projectDir) {
  const configPath = (0, import_path21.join)(projectDir, ".ibrrc.json");
  if (!(0, import_fs11.existsSync)(configPath)) {
    return {};
  }
  try {
    const content = await (0, import_promises21.readFile)(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
function formatContextSummary(context) {
  const lines = [];
  if (context.framework) {
    lines.push(`Design Framework: ${context.framework.name}`);
    lines.push(`Source: ${context.framework.source}`);
    lines.push(`Principles: ${context.framework.principles.length}`);
  } else {
    lines.push("No design framework detected.");
    lines.push("");
    lines.push("To enable design validation, add your framework to CLAUDE.md.");
    lines.push("IBR will parse principles and generate validation rules automatically.");
  }
  if (context.memory && context.memory.stats.totalPreferences > 0) {
    lines.push("");
    lines.push(`Memory: ${context.memory.stats.totalPreferences} preferences, ${context.memory.stats.totalLearned} learned`);
  }
  lines.push("");
  lines.push("Context sources checked:");
  for (const source of context.sources) {
    const status = !source.found ? "(not found)" : source.hasFramework ? "(framework detected)" : "(no framework)";
    lines.push(`  ${source.type}: ${source.path} ${status}`);
  }
  return lines.join("\n");
}
var import_fs11, import_promises21, import_path21, import_os4;
var init_context_loader = __esm({
  "src/context-loader.ts"() {
    "use strict";
    import_fs11 = require("fs");
    import_promises21 = require("fs/promises");
    import_path21 = require("path");
    import_os4 = require("os");
    init_framework_parser();
  }
});

// src/rules/dynamic-rules.ts
var dynamic_rules_exports = {};
__export(dynamic_rules_exports, {
  createPresetFromFramework: () => createPresetFromFramework,
  generateRulesFromFramework: () => generateRulesFromFramework,
  getRulesSummary: () => getRulesSummary
});
function generateRulesFromFramework(framework) {
  const rules2 = [];
  for (let i = 0; i < framework.principles.length; i++) {
    const principle = framework.principles[i];
    const principleRules = generateRulesForPrinciple(principle, framework.name, i);
    rules2.push(...principleRules);
  }
  return rules2;
}
function createPresetFromFramework(framework) {
  const rules2 = generateRulesFromFramework(framework);
  const defaults = {};
  for (const rule of rules2) {
    defaults[rule.id] = rule.defaultSeverity;
  }
  return {
    name: framework.name.toLowerCase().replace(/\s+/g, "-"),
    description: `Rules generated from ${framework.name}`,
    rules: rules2,
    defaults
  };
}
function generateRulesForPrinciple(principle, frameworkName, index) {
  const rules2 = [];
  const keywords = extractKeywords(principle);
  if (keywords.has("group") || keywords.has("border") || keywords.has("isolate")) {
    rules2.push(createBorderGroupingRule(principle, frameworkName, index));
  }
  if (keywords.has("size") || keywords.has("importance") || keywords.has("button") || keywords.has("fitts")) {
    rules2.push(createButtonSizingRule(principle, frameworkName, index));
  }
  if (keywords.has("touch") || keywords.has("target") || keywords.has("44px") || keywords.has("mobile")) {
    rules2.push(createTouchTargetRule(principle, frameworkName, index));
  }
  if (keywords.has("status") || keywords.has("color") || keywords.has("background")) {
    rules2.push(createStatusColorRule(principle, frameworkName, index));
  }
  return rules2;
}
function extractKeywords(principle) {
  const text = [
    principle.name,
    principle.description,
    ...principle.foundation || [],
    ...principle.implementation
  ].join(" ").toLowerCase();
  return new Set(text.match(/\b\w+\b/g) || []);
}
function createBorderGroupingRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-border`,
    name: `${principle.name}: Border Usage`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const hasBorder = style.border && style.border !== "none" && style.border !== "0px";
      const isListItem = element.tagName === "li" || element.selector?.includes("item");
      if (hasBorder && isListItem) {
        return {
          ruleId: `${principle.id}-border`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Individual borders on list items may isolate rather than group. Consider single group border per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: "Use single border around group with dividers between items."
        };
      }
      return null;
    }
  };
}
function createButtonSizingRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-button-size`,
    name: `${principle.name}: Button Sizing`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, _context) => {
      if (element.tagName !== "button" && element.a11y?.role !== "button") return null;
      const width = element.bounds?.width || 0;
      const text = (element.text || "").toLowerCase();
      const isPrimaryAction = /submit|save|confirm|checkout|buy|sign|login|register|continue/i.test(text);
      if (isPrimaryAction && width < 120) {
        return {
          ruleId: `${principle.id}-button-size`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Primary action button "${text}" is ${width}px wide. Per "${principle.name}", primary actions should be more prominent.`,
          element: element.selector,
          bounds: element.bounds,
          fix: "Increase button width to match importance of the action."
        };
      }
      return null;
    }
  };
}
function createTouchTargetRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-touch-target`,
    name: `${principle.name}: Touch Targets`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, context) => {
      if (!element.interactive?.hasOnClick && !element.interactive?.hasHref) return null;
      const width = element.bounds?.width || 0;
      const height = element.bounds?.height || 0;
      const minSize = context.isMobile ? 44 : 24;
      if (width < minSize || height < minSize) {
        return {
          ruleId: `${principle.id}-touch-target`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Interactive element is ${width}x${height}px, below ${minSize}px minimum per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase to at least ${minSize}x${minSize}px for ${context.isMobile ? "mobile" : "desktop"}.`
        };
      }
      return null;
    }
  };
}
function createStatusColorRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-status`,
    name: `${principle.name}: Status Indication`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const text = (element.text || "").toLowerCase();
      const isStatusText = /success|error|warning|pending|active|inactive|status/i.test(text);
      if (isStatusText && style.backgroundColor && style.backgroundColor !== "transparent") {
        const bgColor = style.backgroundColor;
        if (bgColor && !bgColor.includes("rgba") && !bgColor.includes("0.1") && !bgColor.includes("0.05")) {
          return {
            ruleId: `${principle.id}-status`,
            ruleName: `${frameworkName}: ${principle.name}`,
            severity: "warn",
            message: `Status element "${text}" has heavy background. Per "${principle.name}", consider text color only.`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Use text color only for status indication, not background."
          };
        }
      }
      return null;
    }
  };
}
function getRulesSummary(rules2) {
  const byPrinciple = /* @__PURE__ */ new Map();
  for (const rule of rules2) {
    const existing = byPrinciple.get(rule.principleId) || [];
    existing.push(rule);
    byPrinciple.set(rule.principleId, existing);
  }
  const lines = [];
  lines.push(`Generated ${rules2.length} rules from ${byPrinciple.size} principles:`);
  lines.push("");
  for (const [principleId, principleRules] of byPrinciple) {
    lines.push(`  ${principleId}: ${principleRules.length} rules`);
    for (const rule of principleRules) {
      lines.push(`    - ${rule.name}`);
    }
  }
  return lines.join("\n");
}
var init_dynamic_rules = __esm({
  "src/rules/dynamic-rules.ts"() {
    "use strict";
  }
});

// src/browser-server.ts
var browser_server_exports = {};
__export(browser_server_exports, {
  PersistentSession: () => PersistentSession,
  connectToBrowserServer: () => connectToBrowserServer,
  isServerRunning: () => isServerRunning,
  listActiveSessions: () => listActiveSessions,
  startBrowserServer: () => startBrowserServer,
  stopBrowserServer: () => stopBrowserServer
});
function getPaths(outputDir) {
  return {
    stateFile: (0, import_path22.join)(outputDir, SERVER_STATE_FILE),
    profileDir: (0, import_path22.join)(outputDir, ISOLATED_PROFILE_DIR),
    sessionsDir: (0, import_path22.join)(outputDir, "sessions")
  };
}
async function isServerRunning(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs12.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises22.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    if (!state.cdpUrl) {
      return false;
    }
    const res = await fetch(`${state.cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(2e3)
    });
    return res.ok;
  } catch {
    await cleanupServerState(outputDir);
    return false;
  }
}
async function cleanupServerState(outputDir) {
  const { stateFile } = getPaths(outputDir);
  try {
    await (0, import_promises22.unlink)(stateFile);
  } catch {
  }
}
async function resolveWsEndpoint(cdpUrl) {
  const res = await fetch(`${cdpUrl}/json/version`);
  const data = await res.json();
  return data.webSocketDebuggerUrl;
}
async function startBrowserServer(outputDir, options = {}) {
  const { stateFile, profileDir } = getPaths(outputDir);
  const headless = options.headless ?? !options.debug;
  const isolated = options.isolated ?? true;
  if (await isServerRunning(outputDir)) {
    throw new Error("Browser server already running. Use session:close all to stop it first.");
  }
  await (0, import_promises22.mkdir)(outputDir, { recursive: true });
  if (isolated) {
    await (0, import_promises22.mkdir)(profileDir, { recursive: true });
  }
  const extraArgs = [];
  if (options.lowMemory) {
    extraArgs.push(
      "--disable-gpu",
      // Disable GPU acceleration
      "--disable-dev-shm-usage",
      // Use /tmp instead of /dev/shm
      "--disable-extensions",
      // No extensions
      "--disable-background-networking",
      // Reduce background activity
      "--disable-default-apps",
      // No default Chrome apps
      "--disable-sync",
      // No Chrome sync
      "--no-first-run",
      // Skip first run tasks
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--memory-pressure-off",
      // Don't respond to memory pressure
      "--js-flags=--max-old-space-size=256"
      // Limit V8 heap to 256MB
    );
  }
  const driver3 = new EngineDriver();
  await driver3.launch({
    headless,
    userDataDir: isolated ? profileDir : void 0
  });
  const debugPort = driver3.debugPort;
  const cdpUrl = `http://127.0.0.1:${debugPort}`;
  const wsEndpoint = await resolveWsEndpoint(cdpUrl);
  const state = {
    wsEndpoint,
    cdpUrl,
    pid: process.pid,
    chromePid: driver3.chromePid,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    headless,
    isolatedProfile: isolated ? profileDir : "",
    lowMemory: options.lowMemory
  };
  await (0, import_promises22.writeFile)(stateFile, JSON.stringify(state, null, 2));
  return { driver: driver3, wsEndpoint };
}
async function connectToBrowserServer(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs12.existsSync)(stateFile)) {
    return null;
  }
  try {
    const content = await (0, import_promises22.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    let wsUrl;
    if (state.cdpUrl) {
      wsUrl = await resolveWsEndpoint(state.cdpUrl);
    } else {
      wsUrl = state.wsEndpoint;
    }
    const driver3 = new EngineDriver();
    await driver3.connectExisting(wsUrl);
    return driver3;
  } catch (error) {
    await cleanupServerState(outputDir);
    return null;
  }
}
async function stopBrowserServer(outputDir) {
  const { stateFile, profileDir: _profileDir } = getPaths(outputDir);
  if (!(0, import_fs12.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises22.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    const wsUrl = state.cdpUrl ? await resolveWsEndpoint(state.cdpUrl) : state.wsEndpoint;
    const driver3 = new EngineDriver();
    await driver3.connectExisting(wsUrl);
    await driver3.close();
    await (0, import_promises22.unlink)(stateFile);
    return true;
  } catch {
    try {
      const content = await (0, import_promises22.readFile)(stateFile, "utf-8");
      const state = JSON.parse(content);
      if (state.chromePid) {
        process.kill(state.chromePid, "SIGKILL");
      }
    } catch {
    }
    await cleanupServerState(outputDir);
    return false;
  }
}
async function listActiveSessions(outputDir) {
  const { sessionsDir } = getPaths(outputDir);
  if (!(0, import_fs12.existsSync)(sessionsDir)) {
    return [];
  }
  const { readdir: readdir6 } = await import("fs/promises");
  const entries = await readdir6(sessionsDir, { withFileTypes: true });
  const liveSessions = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("live_")) {
      const statePath = (0, import_path22.join)(sessionsDir, entry.name, "live-session.json");
      if ((0, import_fs12.existsSync)(statePath)) {
        liveSessions.push(entry.name);
      }
    }
  }
  return liveSessions;
}
var import_promises22, import_fs12, import_path22, import_nanoid6, SERVER_STATE_FILE, ISOLATED_PROFILE_DIR, PersistentSession;
var init_browser_server = __esm({
  "src/browser-server.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_promises22 = require("fs/promises");
    import_fs12 = require("fs");
    import_path22 = require("path");
    import_nanoid6 = require("nanoid");
    init_schemas();
    init_extract2();
    init_scan();
    init_interactivity();
    init_semantic();
    SERVER_STATE_FILE = "browser-server.json";
    ISOLATED_PROFILE_DIR = "browser-profile";
    PersistentSession = class _PersistentSession {
      driver;
      page;
      state;
      sessionDir;
      outputDir;
      constructor(driver3, page, state, sessionDir, outputDir) {
        this.driver = driver3;
        this.page = page;
        this.state = state;
        this.sessionDir = sessionDir;
        this.outputDir = outputDir;
      }
      /**
       * Create a new session using the browser server
       */
      static async create(outputDir, options) {
        const { url, name, viewport = VIEWPORTS.desktop, waitFor, timeout = 3e4 } = options;
        const driver3 = await connectToBrowserServer(outputDir);
        if (!driver3) {
          throw new Error(
            "No browser server running.\nStart one with: npx ibr session:start <url>\nThe first session:start launches the server and keeps it alive."
          );
        }
        const sessionId = `live_${(0, import_nanoid6.nanoid)(10)}`;
        const sessionsDir = (0, import_path22.join)(outputDir, "sessions");
        const sessionDir = (0, import_path22.join)(sessionsDir, sessionId);
        await (0, import_promises22.mkdir)(sessionDir, { recursive: true });
        await driver3.setViewport({
          width: viewport.width,
          height: viewport.height
        });
        await driver3.emulationDomain.setReducedMotion(true);
        const page = new CompatPage(driver3);
        const navStart = Date.now();
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        if (waitFor) {
          await page.waitForSelector(waitFor, { timeout });
        }
        const navDuration = Date.now() - navStart;
        const state = {
          id: sessionId,
          url,
          name: name || new URL(url).pathname,
          viewport,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          pageIndex: 0,
          actions: [{
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url, waitFor },
            success: true,
            duration: navDuration
          }]
        };
        await (0, import_promises22.writeFile)(
          (0, import_path22.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path22.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        return new _PersistentSession(driver3, page, state, sessionDir, outputDir);
      }
      /**
       * Get session from browser server by ID
       */
      static async get(outputDir, sessionId) {
        const sessionDir = (0, import_path22.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path22.join)(sessionDir, "live-session.json");
        if (!(0, import_fs12.existsSync)(statePath)) {
          return null;
        }
        const driver3 = await connectToBrowserServer(outputDir);
        if (!driver3) {
          return null;
        }
        const content = await (0, import_promises22.readFile)(statePath, "utf-8");
        const state = JSON.parse(content);
        const page = new CompatPage(driver3);
        await driver3.setViewport({
          width: state.viewport.width,
          height: state.viewport.height
        });
        await page.goto(state.url, { waitUntil: "networkidle" });
        return new _PersistentSession(driver3, page, state, sessionDir, outputDir);
      }
      get id() {
        return this.state.id;
      }
      get url() {
        return this.page?.url() || this.state.url;
      }
      get actions() {
        return [...this.state.actions];
      }
      async recordAction(action) {
        this.state.actions.push(action);
        await this.saveState();
      }
      async saveState() {
        await (0, import_promises22.writeFile)(
          (0, import_path22.join)(this.sessionDir, "live-session.json"),
          JSON.stringify(this.state, null, 2)
        );
      }
      async navigate(url, options) {
        const start = Date.now();
        try {
          await this.page.goto(url, {
            waitUntil: "networkidle",
            timeout: options?.timeout || 3e4
          });
          if (options?.waitFor) {
            await this.page.waitForSelector(options.waitFor, { timeout: options?.timeout || 3e4 });
          }
          this.state.url = url;
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url, waitFor: options?.waitFor },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async click(selector, options) {
        const start = Date.now();
        const timeout = options?.timeout || 5e3;
        try {
          const locator = this.page.locator(selector).filter({ visible: true }).first();
          await locator.click({ timeout, force: options?.force });
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async type(selector, text, options) {
        const start = Date.now();
        const timeout = options?.timeout || 5e3;
        try {
          const locator = this.page.locator(selector).filter({ visible: true }).first();
          if (!options?.append) {
            await locator.fill("", { timeout });
          }
          if (options?.delay && options.delay > 0) {
            if (options?.append) {
              await locator.focus({ timeout });
            }
            await locator.pressSequentially(text, { delay: options.delay, timeout });
          } else if (options?.append) {
            await locator.focus({ timeout });
            await locator.pressSequentially(text, { timeout });
          } else {
            await locator.fill(text, { timeout });
          }
          if (options?.submit) {
            await locator.press("Enter", { timeout });
            if (options?.waitAfter) {
              await this.page.waitForTimeout(options.waitAfter);
            } else {
              await this.page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
              });
            }
          } else if (options?.waitAfter) {
            await this.page.waitForTimeout(options.waitAfter);
          }
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text, submit: options?.submit },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async waitFor(selectorOrTime, options) {
        const start = Date.now();
        try {
          if (typeof selectorOrTime === "number") {
            await this.page.waitForTimeout(selectorOrTime);
          } else {
            const locator = this.page.locator(selectorOrTime).filter({ visible: true }).first();
            await locator.waitFor({
              state: "visible",
              timeout: options?.timeout || 3e4
            });
          }
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async screenshot(options) {
        const start = Date.now();
        const screenshotName = options?.name || `screenshot-${Date.now()}`;
        const outputPath = (0, import_path22.join)(this.sessionDir, `${screenshotName}.png`);
        try {
          await this.page.addStyleTag({
            content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
          });
          if (options?.selector) {
            const element = await this.page.waitForSelector(options.selector, { timeout: 5e3 });
            if (!element) {
              throw new Error(`Element not found: ${options.selector}`);
            }
            await element.screenshot({ path: outputPath, type: "png" });
          } else {
            await this.page.screenshot({
              path: outputPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            });
          }
          const elements = await extractInteractiveElements(this.page);
          const isMobile = this.state.viewport.width < 768;
          const audit = analyzeElements(elements, isMobile);
          this.state.elements = elements;
          this.state.audit = audit;
          await this.saveState();
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: {
              name: screenshotName,
              path: outputPath,
              selector: options?.selector,
              elementsCount: elements.length,
              issuesCount: audit.issues.length
            },
            success: true,
            duration: Date.now() - start
          });
          return { path: outputPath, elements, audit };
        } catch (error) {
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, selector: options?.selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async press(key) {
        await this.page.keyboard.press(key);
      }
      /**
       * Scroll the page or a specific container
       * @param direction - 'up', 'down', 'left', 'right'
       * @param amount - pixels to scroll (default: 500)
       * @param options - optional selector to scroll within a container
       */
      async scroll(direction, amount = 500, options) {
        const scrollMap = {
          up: { x: 0, y: -amount },
          down: { x: 0, y: amount },
          left: { x: -amount, y: 0 },
          right: { x: amount, y: 0 }
        };
        const { x, y } = scrollMap[direction];
        if (options?.selector) {
          const position2 = await this.page.evaluate(
            `(function(sel, deltaX, deltaY) {
          var el = document.querySelector(sel);
          if (!el) throw new Error('Container not found: ' + sel);
          el.scrollBy(deltaX, deltaY);
          return { x: el.scrollLeft, y: el.scrollTop };
        })(${JSON.stringify(options.selector)}, ${x}, ${y})`
          );
          return position2;
        }
        const position = await this.page.evaluate(
          `(function(deltaX, deltaY) {
        window.scrollBy(deltaX, deltaY);
        return { x: window.scrollX, y: window.scrollY };
      })(${x}, ${y})`
        );
        return position;
      }
      async evaluate(script) {
        return this.page.evaluate(script);
      }
      /**
       * Detect if a modal is currently open and how to dismiss it
       */
      async detectModal() {
        return this.page.evaluate(() => {
          const modalSelectors = [
            '[role="dialog"]',
            '[role="alertdialog"]',
            '[aria-modal="true"]',
            ".modal.show",
            ".modal.open",
            '.modal[style*="display: block"]',
            '[data-state="open"][data-modal]',
            ".fixed.inset-0"
            // Tailwind modal pattern
          ];
          for (const sel of modalSelectors) {
            const modal = document.querySelector(sel);
            if (modal && getComputedStyle(modal).display !== "none") {
              const closeSelectors = [
                '[aria-label="Close"]',
                '[aria-label="close"]',
                ".close",
                ".btn-close",
                '[data-dismiss="modal"]',
                'button[type="button"]:has(svg)'
                // Icon-only close button
              ];
              let closeButtonSelector;
              for (const closeSel of closeSelectors) {
                const closeBtn = modal.querySelector(closeSel);
                if (closeBtn) {
                  closeButtonSelector = `${sel} ${closeSel}`;
                  break;
                }
              }
              return {
                hasModal: true,
                selector: sel,
                dismissMethod: closeButtonSelector ? "close-button" : "escape",
                closeButtonSelector
              };
            }
          }
          return { hasModal: false };
        });
      }
      async content() {
        return this.page.content();
      }
      async title() {
        return this.page.title();
      }
      /**
       * Get text content from a specific selector
       */
      async textContent(selector) {
        return this.page.textContent(selector);
      }
      /**
       * Get inner text from a specific selector (visible text only)
       */
      async innerText(selector) {
        return this.page.innerText(selector);
      }
      /**
       * Get all matching elements' text content
       */
      async allTextContent(selector) {
        const elements = await this.page.$$(selector);
        const texts = [];
        for (const el of elements) {
          const text = await el.textContent();
          if (text) texts.push(text.trim());
        }
        return texts;
      }
      // ============================================================================
      // SCAN + CAPTURE
      // ============================================================================
      consoleErrors = [];
      consoleWarnings = [];
      stepCounter = 0;
      consoleListenerAttached = false;
      /**
       * Ensure console listener is attached (lazy — attaches on first scan/capture)
       */
      attachConsoleListener() {
        if (this.consoleListenerAttached) return;
        this.page.on("console", (msg) => {
          if (msg.type() === "error") this.consoleErrors.push(msg.text());
          else if (msg.type() === "warning") this.consoleWarnings.push(msg.text());
        });
        this.consoleListenerAttached = true;
      }
      /**
       * Run a full IBR scan against the current page state.
       * No new browser — uses the session's live page directly.
       */
      async scanPage() {
        this.attachConsoleListener();
        const start = Date.now();
        const errorsSnapshot = [...this.consoleErrors];
        const warningsSnapshot = [...this.consoleWarnings];
        try {
          const [elements, interactivity, semantic] = await Promise.all([
            extractAndAudit(this.page, this.state.viewport),
            testInteractivity(this.page),
            getSemanticOutput(this.page)
          ]);
          const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
          const designSystem = await applyDesignSystemCheck(
            elements.all,
            issues,
            this.state.viewport,
            this.url,
            this.outputDir
          );
          const verdict = determineVerdict2(issues);
          const summary = generateSummary2(elements, interactivity, semantic, issues, errorsSnapshot);
          let route;
          try {
            route = new URL(this.url).pathname;
          } catch {
            route = this.url;
          }
          const result = {
            url: this.url,
            route,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            viewport: this.state.viewport,
            elements,
            interactivity,
            semantic,
            console: { errors: errorsSnapshot, warnings: warningsSnapshot },
            designSystem,
            verdict,
            issues,
            summary
          };
          await this.recordAction({
            type: "scan",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url: this.url },
            success: true,
            duration: Date.now() - start
          });
          return result;
        } catch (error) {
          await this.recordAction({
            type: "scan",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url: this.url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Combined capture: screenshot + scan in parallel.
       * @param options.keep - If true, screenshot retained after session close. Default: false.
       * @param options.label - Human-readable label for this step.
       * @param options.fullPage - Full page screenshot. Default: true.
       */
      async capture(options) {
        this.attachConsoleListener();
        const start = Date.now();
        const keep = options?.keep ?? false;
        const label = options?.label || "";
        this.stepCounter++;
        const stepNum = this.stepCounter;
        const stepLabel = label || `step-${String(stepNum).padStart(3, "0")}`;
        const screenshotFile = `${stepLabel}.png`;
        const screenshotPath = (0, import_path22.join)(this.sessionDir, screenshotFile);
        try {
          await this.page.addStyleTag({
            content: `*, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }`
          });
          const errorsSnapshot = [...this.consoleErrors];
          const warningsSnapshot = [...this.consoleWarnings];
          const [, elements, interactivity, semantic] = await Promise.all([
            this.page.screenshot({
              path: screenshotPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            }),
            extractAndAudit(this.page, this.state.viewport),
            testInteractivity(this.page),
            getSemanticOutput(this.page)
          ]);
          const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
          const designSystem = await applyDesignSystemCheck(
            elements.all,
            issues,
            this.state.viewport,
            this.url,
            this.outputDir
          );
          const verdict = determineVerdict2(issues);
          const summary = generateSummary2(elements, interactivity, semantic, issues, errorsSnapshot);
          let route;
          try {
            route = new URL(this.url).pathname;
          } catch {
            route = this.url;
          }
          const scanResult = {
            url: this.url,
            route,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            viewport: this.state.viewport,
            elements,
            interactivity,
            semantic,
            console: { errors: errorsSnapshot, warnings: warningsSnapshot },
            designSystem,
            verdict,
            issues,
            summary
          };
          const stepCapture = {
            step: stepNum,
            action: label || this.lastActionLabel(),
            screenshot: screenshotFile,
            scan: scanResult,
            keep,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (!this.state.captures) this.state.captures = [];
          this.state.captures.push(stepCapture);
          await this.recordAction({
            type: "capture",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { step: stepNum, label: stepLabel, keep, screenshot: screenshotFile },
            success: true,
            duration: Date.now() - start,
            captureIndex: this.state.captures.length - 1
          });
          await this.saveState();
          return stepCapture;
        } catch (error) {
          await this.recordAction({
            type: "capture",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { step: stepNum, label: stepLabel, keep },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      lastActionLabel() {
        const last = this.state.actions[this.state.actions.length - 1];
        if (!last) return "unknown";
        const params = last.params;
        if (last.type === "click") return `click-${String(params.selector || "").slice(0, 30)}`;
        if (last.type === "type") return `type-${String(params.selector || "").slice(0, 30)}`;
        if (last.type === "navigate") return "navigate";
        if (last.type === "wait") return `wait-${String(params.target || "").slice(0, 30)}`;
        return last.type;
      }
      /**
       * Close just this session (not the browser server)
       */
      async close() {
        if (this.state.captures && this.state.captures.length > 0) {
          const ephemeral = this.state.captures.filter((c) => !c.keep);
          if (ephemeral.length > 0) {
            const archiveDir = (0, import_path22.join)(this.sessionDir, "archive");
            await (0, import_promises22.mkdir)(archiveDir, { recursive: true });
            const { rename: rename2 } = await import("fs/promises");
            for (const cap of ephemeral) {
              const src = (0, import_path22.join)(this.sessionDir, cap.screenshot);
              const dest = (0, import_path22.join)(archiveDir, cap.screenshot);
              try {
                if ((0, import_fs12.existsSync)(src)) {
                  await rename2(src, dest);
                  cap.screenshot = `archive/${cap.screenshot}`;
                }
              } catch {
              }
            }
            await this.saveState();
          }
        }
        await this.driver.close();
        const liveSessionPath = (0, import_path22.join)(this.sessionDir, "live-session.json");
        try {
          if ((0, import_fs12.existsSync)(liveSessionPath)) {
            await (0, import_promises22.unlink)(liveSessionPath);
          }
        } catch {
        }
      }
      /**
       * Release the driver's WebSocket and spawned tab without terminating the
       * shared browser-server Chrome process.
       *
       * Every one-shot CLI command (session:click, session:wait, session:scan,
       * session:screenshot, etc.) creates a new PersistentSession via get(), which
       * in turn spawns a fresh tab via connectExisting() and opens a new CDP
       * WebSocket. If we don't release those at the end of the command, the node
       * process hangs on the open socket and the shared Chrome accumulates tabs.
       *
       * Safe to call multiple times; no-op if driver is already disconnected.
       */
      async disconnect() {
        await this.driver.disconnect().catch(() => {
        });
      }
      /**
       * Get raw CompatPage (engine-backed page adapter)
       */
      getPage() {
        return this.page;
      }
    };
  }
});

// src/live-session.ts
var live_session_exports = {};
__export(live_session_exports, {
  LiveSession: () => LiveSession,
  liveSessionManager: () => liveSessionManager
});
var import_promises23, import_fs13, import_path23, import_nanoid7, LiveSession, LiveSessionManager, liveSessionManager;
var init_live_session = __esm({
  "src/live-session.ts"() {
    "use strict";
    init_driver();
    init_compat();
    import_promises23 = require("fs/promises");
    import_fs13 = require("fs");
    import_path23 = require("path");
    import_nanoid7 = require("nanoid");
    init_schemas();
    init_scan();
    init_interactivity();
    init_semantic();
    LiveSession = class _LiveSession {
      driver = null;
      page = null;
      state;
      outputDir;
      sessionDir;
      stepCounter = 0;
      consoleErrors = [];
      consoleWarnings = [];
      constructor(state, outputDir, driver3, page) {
        this.state = state;
        this.outputDir = outputDir;
        this.sessionDir = (0, import_path23.join)(outputDir, "sessions", state.id);
        this.driver = driver3;
        this.page = page;
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            this.consoleErrors.push(msg.text());
          } else if (msg.type() === "warning") {
            this.consoleWarnings.push(msg.text());
          }
        });
      }
      /**
       * Create a new live session
       */
      static async create(outputDir, options) {
        const {
          url,
          name,
          viewport = VIEWPORTS.desktop,
          sandbox = false,
          debug = false,
          timeout = 3e4,
          autoCapture = false
        } = options;
        const sessionId = `live_${(0, import_nanoid7.nanoid)(10)}`;
        const sessionDir = (0, import_path23.join)(outputDir, "sessions", sessionId);
        await (0, import_promises23.mkdir)(sessionDir, { recursive: true });
        const driver3 = new EngineDriver();
        await driver3.launch({
          headless: !sandbox && !debug,
          viewport: {
            width: viewport.width,
            height: viewport.height
          }
        });
        const page = new CompatPage(driver3);
        const navStart = Date.now();
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        const navDuration = Date.now() - navStart;
        const state = {
          id: sessionId,
          url,
          name: name || new URL(url).pathname,
          viewport,
          sandbox: sandbox || debug,
          autoCapture,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          actions: [{
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: true,
            duration: navDuration
          }],
          captures: []
        };
        await (0, import_promises23.writeFile)(
          (0, import_path23.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path23.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        const session = new _LiveSession(state, outputDir, driver3, page);
        if (autoCapture) {
          await session.capture({ keep: true, label: "initial" });
        }
        return session;
      }
      /**
       * Resume an existing live session (if browser still running)
       * Note: This only works within the same process - browser state is not persisted
       */
      static async resume(outputDir, sessionId) {
        const sessionDir = (0, import_path23.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path23.join)(sessionDir, "live-session.json");
        if (!(0, import_fs13.existsSync)(statePath)) {
          return null;
        }
        const content = await (0, import_promises23.readFile)(statePath, "utf-8");
        const state = JSON.parse(content);
        const driver3 = new EngineDriver();
        await driver3.launch({
          headless: !state.sandbox,
          viewport: {
            width: state.viewport.width,
            height: state.viewport.height
          }
        });
        const page = new CompatPage(driver3);
        await page.goto(state.url, { waitUntil: "networkidle" });
        const session = new _LiveSession(state, outputDir, driver3, page);
        session.stepCounter = state.captures.length;
        return session;
      }
      // ============================================================================
      // PROPERTIES
      // ============================================================================
      get id() {
        return this.state.id;
      }
      get url() {
        return this.page?.url() || this.state.url;
      }
      get actions() {
        return [...this.state.actions];
      }
      get captures() {
        return [...this.state.captures];
      }
      get isActive() {
        return this.driver !== null && this.page !== null;
      }
      // ============================================================================
      // SCAN + CAPTURE (NEW)
      // ============================================================================
      /**
       * Run a full IBR scan against the current page state.
       * No new browser — uses the session's live page directly.
       */
      async scanPage() {
        const page = this.ensurePage();
        const start = Date.now();
        const errorsSnapshot = [...this.consoleErrors];
        const warningsSnapshot = [...this.consoleWarnings];
        try {
          const [elements, interactivity, semantic] = await Promise.all([
            extractAndAudit(page, this.state.viewport),
            testInteractivity(page),
            getSemanticOutput(page)
          ]);
          const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
          const designSystem = await applyDesignSystemCheck(
            elements.all,
            issues,
            this.state.viewport,
            this.url,
            this.outputDir
          );
          const verdict = determineVerdict2(issues);
          const summary = generateSummary2(elements, interactivity, semantic, issues, errorsSnapshot);
          let route;
          try {
            route = new URL(this.url).pathname;
          } catch {
            route = this.url;
          }
          const result = {
            url: this.url,
            route,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            viewport: this.state.viewport,
            elements,
            interactivity,
            semantic,
            console: {
              errors: errorsSnapshot,
              warnings: warningsSnapshot
            },
            designSystem,
            verdict,
            issues,
            summary
          };
          await this.recordAction({
            type: "scan",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url: this.url },
            success: true,
            duration: Date.now() - start
          });
          return result;
        } catch (error) {
          await this.recordAction({
            type: "scan",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url: this.url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Combined capture: screenshot + scan in parallel.
       * Returns a StepCapture with both visual and structured data.
       *
       * @param options.keep - If true, screenshot is retained after session close.
       *                       If false (default), moved to archive/ on close.
       * @param options.label - Human-readable label for this step (e.g. "after-search")
       * @param options.fullPage - Capture full page screenshot (default: true)
       */
      async capture(options) {
        const page = this.ensurePage();
        const start = Date.now();
        const keep = options?.keep ?? false;
        const label = options?.label || "";
        this.stepCounter++;
        const stepNum = this.stepCounter;
        const stepLabel = label || `step-${String(stepNum).padStart(3, "0")}`;
        const screenshotFile = `${stepLabel}.png`;
        const screenshotPath = (0, import_path23.join)(this.sessionDir, screenshotFile);
        try {
          await page.addStyleTag({
            content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
          });
          const [, scanResult] = await Promise.all([
            page.screenshot({
              path: screenshotPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            }),
            this.runScanAnalysis()
          ]);
          const stepCapture = {
            step: stepNum,
            action: label || this.lastActionLabel(),
            screenshot: screenshotFile,
            scan: scanResult,
            keep,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.state.captures.push(stepCapture);
          await this.recordAction({
            type: "capture",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { step: stepNum, label: stepLabel, keep, screenshot: screenshotFile },
            success: true,
            duration: Date.now() - start,
            captureIndex: this.state.captures.length - 1
          });
          await this.saveState();
          return stepCapture;
        } catch (error) {
          await this.recordAction({
            type: "capture",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { step: stepNum, label: stepLabel, keep },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Internal scan analysis without recording a separate action.
       * Used by capture() to run scan in parallel with screenshot.
       */
      async runScanAnalysis() {
        const page = this.ensurePage();
        const errorsSnapshot = [...this.consoleErrors];
        const warningsSnapshot = [...this.consoleWarnings];
        const [elements, interactivity, semantic] = await Promise.all([
          extractAndAudit(page, this.state.viewport),
          testInteractivity(page),
          getSemanticOutput(page)
        ]);
        const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
        const designSystem = await applyDesignSystemCheck(
          elements.all,
          issues,
          this.state.viewport,
          this.url,
          this.outputDir
        );
        const verdict = determineVerdict2(issues);
        const summary = generateSummary2(elements, interactivity, semantic, issues, errorsSnapshot);
        let route;
        try {
          route = new URL(this.url).pathname;
        } catch {
          route = this.url;
        }
        return {
          url: this.url,
          route,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          viewport: this.state.viewport,
          elements,
          interactivity,
          semantic,
          console: { errors: errorsSnapshot, warnings: warningsSnapshot },
          designSystem,
          verdict,
          issues,
          summary
        };
      }
      /**
       * Get the label of the last recorded action (for auto-capture naming)
       */
      lastActionLabel() {
        const last = this.state.actions[this.state.actions.length - 1];
        if (!last) return "unknown";
        const params = last.params;
        if (last.type === "click") return `click-${String(params.selector || "").slice(0, 30)}`;
        if (last.type === "type") return `type-${String(params.selector || "").slice(0, 30)}`;
        if (last.type === "navigate") return `navigate`;
        if (last.type === "wait") return `wait-${String(params.target || "").slice(0, 30)}`;
        return last.type;
      }
      /**
       * Auto-capture after a successful action (when autoCapture is enabled)
       */
      async autoCapAfterAction() {
        if (!this.state.autoCapture) return;
        try {
          await this.page?.waitForLoadState("networkidle", { timeout: 3e3 }).catch(() => {
          });
          await this.capture({ keep: false });
        } catch {
        }
      }
      // ============================================================================
      // INTERACTION METHODS (with auto-capture support)
      // ============================================================================
      /**
       * Navigate to a new URL
       */
      async navigate(url, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: options?.timeout || 3e4
          });
          this.state.url = url;
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: true,
            duration: Date.now() - start
          });
          await this.autoCapAfterAction();
        } catch (error) {
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Click an element
       */
      async click(selector, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.click(selector, { timeout: options?.timeout || 5e3 });
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
          await this.autoCapAfterAction();
        } catch (error) {
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Type text into an element (clears existing content first)
       */
      async type(selector, text, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.fill(selector, "");
          await page.type(selector, text, { delay: options?.delay || 0 });
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: true,
            duration: Date.now() - start
          });
          await this.autoCapAfterAction();
        } catch (error) {
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Fill a form with multiple fields
       */
      async fill(fields) {
        const page = this.ensurePage();
        const start = Date.now();
        const results = [];
        for (const field of fields) {
          try {
            if (field.type === "checkbox") {
              if (field.value === "true" || field.value === "1") {
                await page.check(field.selector);
              } else {
                await page.uncheck(field.selector);
              }
            } else if (field.type === "select") {
              await page.selectOption(field.selector, field.value);
            } else {
              await page.fill(field.selector, field.value);
            }
            results.push({ selector: field.selector, success: true });
          } catch (error) {
            results.push({
              selector: field.selector,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        const allSuccess = results.every((r) => r.success);
        await this.recordAction({
          type: "fill",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          params: { fields: fields.map((f) => ({ selector: f.selector, type: f.type || "text" })), results },
          success: allSuccess,
          error: allSuccess ? void 0 : `Failed to fill ${results.filter((r) => !r.success).length} field(s)`,
          duration: Date.now() - start
        });
        if (!allSuccess) {
          const failed = results.filter((r) => !r.success);
          throw new Error(`Failed to fill fields: ${failed.map((f) => f.selector).join(", ")}`);
        }
        await this.autoCapAfterAction();
      }
      /**
       * Hover over an element
       */
      async hover(selector, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.hover(selector, { timeout: options?.timeout || 5e3 });
          await this.recordAction({
            type: "hover",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
          await this.autoCapAfterAction();
        } catch (error) {
          await this.recordAction({
            type: "hover",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Execute JavaScript in the page context
       */
      async evaluate(script) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          const result = await page.evaluate(script);
          await this.recordAction({
            type: "evaluate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { script: typeof script === "string" ? script.slice(0, 100) : "[function]" },
            success: true,
            duration: Date.now() - start
          });
          return result;
        } catch (error) {
          await this.recordAction({
            type: "evaluate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { script: typeof script === "string" ? script.slice(0, 100) : "[function]" },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Wait for a selector or timeout
       */
      async waitFor(selectorOrTime, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          if (typeof selectorOrTime === "number") {
            await page.waitForTimeout(selectorOrTime);
          } else {
            await page.waitForSelector(selectorOrTime, { timeout: options?.timeout || 3e4 });
          }
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: true,
            duration: Date.now() - start
          });
          await this.autoCapAfterAction();
        } catch (error) {
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Take a screenshot (standalone, without scan)
       */
      async screenshot(options) {
        const page = this.ensurePage();
        const start = Date.now();
        const screenshotName = options?.name || `screenshot-${Date.now()}`;
        const outputPath = (0, import_path23.join)(this.sessionDir, `${screenshotName}.png`);
        try {
          await page.addStyleTag({
            content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
          });
          if (options?.selector) {
            const element = await page.waitForSelector(options.selector, { timeout: 5e3 });
            if (!element) {
              throw new Error(`Element not found: ${options.selector}`);
            }
            await element.screenshot({ path: outputPath, type: "png" });
          } else {
            await page.screenshot({
              path: outputPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            });
          }
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, path: outputPath, selector: options?.selector },
            success: true,
            duration: Date.now() - start
          });
          return outputPath;
        } catch (error) {
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, selector: options?.selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      // ============================================================================
      // PAGE INSPECTION
      // ============================================================================
      async content() {
        const page = this.ensurePage();
        return page.content();
      }
      async title() {
        const page = this.ensurePage();
        return page.title();
      }
      async exists(selector) {
        const page = this.ensurePage();
        const element = await page.$(selector);
        return element !== null;
      }
      async textContent(selector) {
        const page = this.ensurePage();
        return page.textContent(selector);
      }
      async getAttribute(selector, attribute) {
        const page = this.ensurePage();
        return page.getAttribute(selector, attribute);
      }
      async press(key) {
        const page = this.ensurePage();
        await page.keyboard.press(key);
      }
      async select(selector, values) {
        const page = this.ensurePage();
        await page.selectOption?.(selector, Array.isArray(values) ? values[0] : values);
      }
      /**
       * Get underlying CompatPage (for advanced use)
       */
      getPage() {
        return this.ensurePage();
      }
      // ============================================================================
      // SESSION LIFECYCLE
      // ============================================================================
      /**
       * Close the session and browser.
       * Ephemeral screenshots (keep: false) are moved to archive/ folder.
       * Kept screenshots (keep: true) and baseline.png stay in session dir.
       * Scan data in live-session.json is always preserved.
       */
      async close() {
        if (this.page && this.state.autoCapture && this.state.captures.length > 0) {
          try {
            await this.capture({ keep: true, label: "final" });
          } catch {
          }
        }
        await this.archiveEphemeralScreenshots();
        if (this.driver) {
          await this.driver.close();
          this.driver = null;
        }
        this.page = null;
        await this.saveState();
      }
      /**
       * Move ephemeral screenshots to archive/ subfolder.
       * User can delete archive/ whenever they want.
       */
      async archiveEphemeralScreenshots() {
        const ephemeral = this.state.captures.filter((c) => !c.keep);
        if (ephemeral.length === 0) return;
        const archiveDir = (0, import_path23.join)(this.sessionDir, "archive");
        await (0, import_promises23.mkdir)(archiveDir, { recursive: true });
        for (const cap of ephemeral) {
          const src = (0, import_path23.join)(this.sessionDir, cap.screenshot);
          const dest = (0, import_path23.join)(archiveDir, cap.screenshot);
          try {
            if ((0, import_fs13.existsSync)(src)) {
              await (0, import_promises23.rename)(src, dest);
              cap.screenshot = `archive/${cap.screenshot}`;
            }
          } catch {
          }
        }
      }
      // ============================================================================
      // INTERNAL
      // ============================================================================
      async recordAction(action) {
        this.state.actions.push(action);
        await this.saveState();
      }
      async saveState() {
        await (0, import_promises23.writeFile)(
          (0, import_path23.join)(this.sessionDir, "live-session.json"),
          JSON.stringify(this.state, null, 2)
        );
      }
      ensurePage() {
        if (!this.page) {
          throw new Error("Session is closed. Create a new session.");
        }
        return this.page;
      }
    };
    LiveSessionManager = class {
      sessions = /* @__PURE__ */ new Map();
      async create(outputDir, options) {
        const session = await LiveSession.create(outputDir, options);
        this.sessions.set(session.id, session);
        return session;
      }
      get(sessionId) {
        return this.sessions.get(sessionId);
      }
      async close(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
          await session.close();
          this.sessions.delete(sessionId);
          return true;
        }
        return false;
      }
      async closeAll() {
        for (const session of this.sessions.values()) {
          await session.close();
        }
        this.sessions.clear();
      }
      list() {
        return Array.from(this.sessions.keys());
      }
    };
    liveSessionManager = new LiveSessionManager();
  }
});

// src/screenshot-manager.ts
var screenshot_manager_exports = {};
__export(screenshot_manager_exports, {
  ScreenshotManager: () => ScreenshotManager,
  formatAge: () => formatAge,
  formatBytes: () => formatBytes2
});
function formatBytes2(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function formatAge(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
var import_promises24, import_fs14, import_path24, DEFAULT_CONFIG, ScreenshotManager;
var init_screenshot_manager = __esm({
  "src/screenshot-manager.ts"() {
    "use strict";
    import_promises24 = require("fs/promises");
    import_fs14 = require("fs");
    import_path24 = require("path");
    DEFAULT_CONFIG = {
      maxAgeDays: 7,
      maxSizeBytes: 500 * 1024 * 1024,
      // 500MB
      retentionPolicy: "both"
    };
    ScreenshotManager = class {
      outputDir;
      config;
      constructor(outputDir, config = {}) {
        this.outputDir = outputDir;
        this.config = { ...DEFAULT_CONFIG, ...config };
      }
      /**
       * Capture a screenshot from a Playwright page
       */
      async capture(page, name, options = {}) {
        const { sessionId, fullPage = false, selector } = options;
        let outputPath;
        if (sessionId) {
          const sessionDir = (0, import_path24.join)(this.outputDir, "sessions", sessionId);
          await (0, import_promises24.mkdir)(sessionDir, { recursive: true });
          outputPath = (0, import_path24.join)(sessionDir, `${name}.png`);
        } else {
          await (0, import_promises24.mkdir)(this.outputDir, { recursive: true });
          outputPath = (0, import_path24.join)(this.outputDir, `${name}.png`);
        }
        await page.addStyleTag({
          content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
        });
        if (selector) {
          const element = await page.$(selector);
          if (!element) {
            throw new Error(`Element not found: ${selector}`);
          }
          await element.screenshot({ path: outputPath, type: "png" });
        } else {
          await page.screenshot({
            path: outputPath,
            fullPage,
            type: "png"
          });
        }
        return outputPath;
      }
      /**
       * List all screenshots for a session
       */
      async list(sessionId) {
        const sessionDir = (0, import_path24.join)(this.outputDir, "sessions", sessionId);
        if (!(0, import_fs14.existsSync)(sessionDir)) {
          return [];
        }
        const screenshots = [];
        await this.scanDirectory(sessionDir, sessionId, screenshots);
        screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return screenshots;
      }
      /**
       * List all screenshots across all sessions
       */
      async listAll() {
        const sessionsDir = (0, import_path24.join)(this.outputDir, "sessions");
        if (!(0, import_fs14.existsSync)(sessionsDir)) {
          return [];
        }
        const screenshots = [];
        const sessions = await (0, import_promises24.readdir)(sessionsDir);
        for (const sessionId of sessions) {
          const sessionDir = (0, import_path24.join)(sessionsDir, sessionId);
          const stats = await (0, import_promises24.stat)(sessionDir);
          if (stats.isDirectory()) {
            await this.scanDirectory(sessionDir, sessionId, screenshots);
          }
        }
        screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return screenshots;
      }
      /**
       * Scan a directory for PNG files
       */
      async scanDirectory(dir, sessionId, results) {
        const entries = await (0, import_promises24.readdir)(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = (0, import_path24.join)(dir, entry.name);
          if (entry.isDirectory()) {
            await this.scanDirectory(fullPath, sessionId, results);
          } else if (entry.name.endsWith(".png")) {
            const stats = await (0, import_promises24.stat)(fullPath);
            const now = Date.now();
            const stepMatch = entry.name.match(/^\d+-(.+)\.png$/);
            const step = stepMatch ? stepMatch[1] : void 0;
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              createdAt: stats.birthtime,
              ageMs: now - stats.birthtime.getTime(),
              sessionId,
              step
            });
          }
        }
      }
      /**
       * Get metadata for a specific screenshot
       */
      async getMetadata(path2) {
        if (!(0, import_fs14.existsSync)(path2)) {
          return null;
        }
        const stats = await (0, import_promises24.stat)(path2);
        const name = (0, import_path24.basename)(path2);
        const dir = (0, import_path24.dirname)(path2);
        const stepMatch = name.match(/^\d+-(.+)\.png$/);
        const step = stepMatch ? stepMatch[1] : void 0;
        const sessionMatch = dir.match(/sessions[/\\]([^/\\]+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : void 0;
        let query;
        let userIntent;
        const resultsPath = (0, import_path24.join)(dir, "results.json");
        if ((0, import_fs14.existsSync)(resultsPath)) {
          try {
            const resultsContent = await (0, import_promises24.readFile)(resultsPath, "utf-8");
            const results = JSON.parse(resultsContent);
            query = results.query;
            userIntent = results.userIntent;
          } catch {
          }
        }
        return {
          path: path2,
          name,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          sessionId,
          step,
          query,
          userIntent
        };
      }
      /**
       * Cleanup old screenshots based on retention policy
       */
      async cleanup(options = {}) {
        const { dryRun = false } = options;
        const report = {
          scanned: 0,
          deleted: 0,
          bytesFreed: 0,
          kept: 0,
          errors: [],
          dryRun
        };
        const screenshots = await this.listAll();
        report.scanned = screenshots.length;
        if (screenshots.length === 0) {
          return report;
        }
        const toDelete = [];
        const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1e3;
        if (this.config.retentionPolicy === "age" || this.config.retentionPolicy === "both") {
          for (const shot of screenshots) {
            if (shot.ageMs > maxAgeMs && !toDelete.includes(shot)) {
              toDelete.push(shot);
            }
          }
        }
        if (this.config.retentionPolicy === "size" || this.config.retentionPolicy === "both") {
          let totalSize = screenshots.reduce((sum, s) => sum + s.size, 0);
          const sortedByAge = [...screenshots].sort((a, b) => b.ageMs - a.ageMs);
          for (const shot of sortedByAge) {
            if (totalSize <= this.config.maxSizeBytes) break;
            if (!toDelete.includes(shot)) {
              toDelete.push(shot);
              totalSize -= shot.size;
            }
          }
        }
        for (const shot of toDelete) {
          try {
            if (!dryRun) {
              await (0, import_promises24.unlink)(shot.path);
            }
            report.deleted++;
            report.bytesFreed += shot.size;
          } catch (error) {
            report.errors.push(`Failed to delete ${shot.path}: ${error}`);
          }
        }
        report.kept = report.scanned - report.deleted;
        return report;
      }
      /**
       * Get total storage used by screenshots
       */
      async getStorageUsage() {
        const screenshots = await this.listAll();
        if (screenshots.length === 0) {
          return { totalBytes: 0, fileCount: 0 };
        }
        const totalBytes = screenshots.reduce((sum, s) => sum + s.size, 0);
        const sorted = [...screenshots].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return {
          totalBytes,
          fileCount: screenshots.length,
          oldestFile: sorted[0].createdAt,
          newestFile: sorted[sorted.length - 1].createdAt
        };
      }
      /**
       * Update configuration
       */
      updateConfig(config) {
        this.config = { ...this.config, ...config };
      }
      /**
       * Save configuration to file
       */
      async saveConfig() {
        const configPath = (0, import_path24.join)(this.outputDir, "screenshot-config.json");
        await (0, import_promises24.writeFile)(configPath, JSON.stringify(this.config, null, 2));
      }
      /**
       * Load configuration from file
       */
      async loadConfig() {
        const configPath = (0, import_path24.join)(this.outputDir, "screenshot-config.json");
        if ((0, import_fs14.existsSync)(configPath)) {
          try {
            const content = await (0, import_promises24.readFile)(configPath, "utf-8");
            const loaded = JSON.parse(content);
            this.config = { ...DEFAULT_CONFIG, ...loaded };
          } catch {
          }
        }
      }
    };
  }
});

// src/native/bridge.ts
var bridge_exports = {};
__export(bridge_exports, {
  correlateToSource: () => correlateToSource,
  formatBridgeResult: () => formatBridgeResult
});
function findSwiftFiles(dir, rootDir) {
  const SKIP_DIRS = /* @__PURE__ */ new Set([
    "node_modules",
    ".build",
    "DerivedData",
    "Pods",
    ".git",
    "build",
    "Build",
    ".swiftpm"
  ]);
  const results = [];
  function walk(currentDir) {
    let entries;
    try {
      entries = (0, import_fs15.readdirSync)(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const fullPath = (0, import_path25.join)(currentDir, entry);
      let stat5;
      try {
        stat5 = (0, import_fs15.statSync)(fullPath);
      } catch {
        continue;
      }
      if (stat5.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".swift")) {
        results.push((0, import_path25.relative)(rootDir, fullPath));
      }
    }
  }
  walk(dir);
  return results;
}
function scanSwiftSources(projectRoot, swiftFiles) {
  const matches = [];
  const IDENTIFIER_RE = /\.accessibilityIdentifier\(\s*"([^"]+)"\s*\)/g;
  const LABEL_RE = /\.accessibilityLabel\(\s*"([^"]+)"\s*\)/g;
  const BUTTON_TEXT_RE = /Button\(\s*"([^"]+)"/g;
  const LABEL_TEXT_RE = /Label\(\s*"([^"]+)"/g;
  const TEXT_RE = /Text\(\s*"([^"]+)"/g;
  const VIEW_STRUCT_RE = /struct\s+(\w+)\s*:\s*(?:\w+,\s*)*View\b/g;
  for (const filePath of swiftFiles) {
    const fullPath = (0, import_path25.join)(projectRoot, filePath);
    let content;
    try {
      content = (0, import_fs15.readFileSync)(fullPath, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    let currentViewName = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const viewMatch = VIEW_STRUCT_RE.exec(line);
      if (viewMatch) {
        currentViewName = viewMatch[1];
        VIEW_STRUCT_RE.lastIndex = 0;
        matches.push({
          file: filePath,
          line: lineNum,
          type: "view-name",
          value: currentViewName,
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
      IDENTIFIER_RE.lastIndex = 0;
      LABEL_RE.lastIndex = 0;
      BUTTON_TEXT_RE.lastIndex = 0;
      LABEL_TEXT_RE.lastIndex = 0;
      TEXT_RE.lastIndex = 0;
      let m;
      while ((m = IDENTIFIER_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: "identifier",
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
      while ((m = LABEL_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: "label",
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
      while ((m = BUTTON_TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: "text",
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
      while ((m = LABEL_TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: "text",
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
      while ((m = TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: "text",
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName
        });
      }
    }
  }
  return matches;
}
function loadNavGatorFileMap(projectRoot) {
  for (const navPath of NAVGATOR_PATHS) {
    const fileMapPath = (0, import_path25.join)(projectRoot, navPath, "file_map.json");
    if (!(0, import_fs15.existsSync)(fileMapPath)) continue;
    try {
      const content = (0, import_fs15.readFileSync)(fileMapPath, "utf-8");
      const parsed = JSON.parse(content);
      return parsed.files || null;
    } catch {
      continue;
    }
  }
  return null;
}
function correlateToSource(elements, projectRoot) {
  const navFileMap = loadNavGatorFileMap(projectRoot);
  const navgatorAvailable = navFileMap !== null;
  let swiftFiles;
  if (navFileMap) {
    swiftFiles = Object.keys(navFileMap).filter((f) => f.endsWith(".swift"));
    const globbed = findSwiftFiles(projectRoot, projectRoot);
    const fileSet = new Set(swiftFiles);
    for (const f of globbed) {
      if (!fileSet.has(f)) swiftFiles.push(f);
    }
  } else {
    swiftFiles = findSwiftFiles(projectRoot, projectRoot);
  }
  const sourceMatches = scanSwiftSources(projectRoot, swiftFiles);
  const byIdentifier = /* @__PURE__ */ new Map();
  const byLabel = /* @__PURE__ */ new Map();
  const byText = /* @__PURE__ */ new Map();
  const byViewName = /* @__PURE__ */ new Map();
  for (const match of sourceMatches) {
    const key = match.value.toLowerCase();
    switch (match.type) {
      case "identifier": {
        if (!byIdentifier.has(key)) byIdentifier.set(key, []);
        byIdentifier.get(key).push(match);
        break;
      }
      case "label": {
        if (!byLabel.has(key)) byLabel.set(key, []);
        byLabel.get(key).push(match);
        break;
      }
      case "text": {
        if (!byText.has(key)) byText.set(key, []);
        byText.get(key).push(match);
        break;
      }
      case "view-name": {
        if (!byViewName.has(key)) byViewName.set(key, []);
        byViewName.get(key).push(match);
        break;
      }
    }
  }
  const correlations = [];
  const unmatchedElements = [];
  const matchedIds = /* @__PURE__ */ new Set();
  for (const el of elements) {
    const elId = el.selector || el.id || "";
    const elLabel = el.a11y?.ariaLabel || "";
    const elText = el.text || "";
    const elRole = el.a11y?.role || "";
    if (matchedIds.has(elId) && elId) continue;
    let bestMatch = null;
    const testId = el.sourceHint?.dataTestId;
    if (testId) {
      const idMatches = byIdentifier.get(testId.toLowerCase());
      if (idMatches && idMatches.length > 0) {
        bestMatch = { source: idMatches[0], type: "identifier" };
      }
    }
    if (!bestMatch && el.id) {
      const idMatches = byIdentifier.get(el.id.toLowerCase());
      if (idMatches && idMatches.length > 0) {
        bestMatch = { source: idMatches[0], type: "identifier" };
      }
    }
    if (!bestMatch && elLabel) {
      const labelMatches = byLabel.get(elLabel.toLowerCase());
      if (labelMatches && labelMatches.length > 0) {
        bestMatch = { source: labelMatches[0], type: "label" };
      }
    }
    if (!bestMatch && elText && elText.length >= 2 && elText.length <= 100) {
      const textMatches = byText.get(elText.toLowerCase());
      if (textMatches && textMatches.length > 0) {
        bestMatch = { source: textMatches[0], type: "text" };
      }
    }
    if (!bestMatch && elId) {
      const elIdLower = elId.toLowerCase();
      for (const [viewKey, viewMatches] of byViewName) {
        if (elIdLower.includes(viewKey) && viewMatches.length > 0) {
          bestMatch = { source: viewMatches[0], type: "view-name" };
          break;
        }
      }
    }
    if (bestMatch) {
      if (elId) matchedIds.add(elId);
      correlations.push({
        elementSelector: elId || elLabel || elText || "(unknown)",
        elementLabel: elLabel || elText || elRole || elId || "",
        sourceFile: bestMatch.source.file,
        sourceLine: bestMatch.source.line,
        viewName: bestMatch.source.viewName,
        matchedSnippet: bestMatch.source.snippet,
        matchType: bestMatch.type,
        confidence: CONFIDENCE[bestMatch.type]
      });
    } else {
      const desc = elLabel || elText || elId;
      if (desc && desc.length > 1) {
        unmatchedElements.push(desc);
      }
    }
  }
  correlations.sort((a, b) => b.confidence - a.confidence || a.sourceFile.localeCompare(b.sourceFile));
  return {
    projectRoot,
    navgatorAvailable,
    swiftFilesScanned: swiftFiles.length,
    correlations,
    unmatchedElements
  };
}
function formatBridgeResult(result) {
  const lines = [];
  lines.push(`Source Bridge: ${result.projectRoot}`);
  lines.push(`NavGator data: ${result.navgatorAvailable ? "available" : "not found (used file glob)"}`);
  lines.push(`Swift files scanned: ${result.swiftFilesScanned}`);
  lines.push(`Correlations: ${result.correlations.length}`);
  lines.push(`Unmatched elements: ${result.unmatchedElements.length}`);
  if (result.correlations.length > 0) {
    lines.push("");
    lines.push("Matched elements:");
    for (const c of result.correlations) {
      const conf = `${Math.round(c.confidence * 100)}%`;
      const view = c.viewName ? ` (in ${c.viewName})` : "";
      lines.push(`- ${c.elementSelector}`);
      lines.push(`  \u2192 ${c.sourceFile}:${c.sourceLine}${view} [${c.matchType}, ${conf}]`);
      lines.push(`  snippet: ${c.matchedSnippet.slice(0, 120)}`);
    }
  }
  if (result.unmatchedElements.length > 0) {
    lines.push("");
    const maxUnmatched = Math.min(result.unmatchedElements.length, 15);
    lines.push(`Unmatched (${result.unmatchedElements.length}):`);
    for (let i = 0; i < maxUnmatched; i++) {
      lines.push(`- ${result.unmatchedElements[i]}`);
    }
    if (result.unmatchedElements.length > 15) {
      lines.push(`  ... and ${result.unmatchedElements.length - 15} more`);
    }
  }
  return lines.join("\n");
}
var import_fs15, import_path25, NAVGATOR_PATHS, CONFIDENCE;
var init_bridge = __esm({
  "src/native/bridge.ts"() {
    "use strict";
    import_fs15 = require("fs");
    import_path25 = require("path");
    NAVGATOR_PATHS = [
      (0, import_path25.join)(".navgator", "architecture"),
      (0, import_path25.join)(".claude", "architecture")
      // legacy — NavGator < 0.3
    ];
    CONFIDENCE = {
      "identifier": 1,
      "label": 0.8,
      "text": 0.6,
      "view-name": 0.5
    };
  }
});

// src/interaction-test.ts
var interaction_test_exports = {};
__export(interaction_test_exports, {
  formatInteractionResult: () => formatInteractionResult,
  parseActionArg: () => parseActionArg,
  parseExpectArg: () => parseExpectArg,
  runInteractionTest: () => runInteractionTest
});
async function runInteractionTest(options) {
  const { url, steps, viewport, outputDir = ".ibr/interactions", headless = true } = options;
  const driver3 = new EngineDriver();
  const launchOpts = {
    headless,
    viewport: viewport ? { width: viewport.width, height: viewport.height } : void 0
  };
  try {
    await driver3.launch(launchOpts);
    await driver3.navigate(url);
    const results = [];
    for (const step of steps) {
      const result = await executeStep(driver3, step, url, outputDir);
      results.push(result);
    }
    return results;
  } finally {
    await driver3.close();
  }
}
async function executeStep(driver3, step, url, outputDir) {
  const { action, expect: expectation } = step;
  const actionStart = Date.now();
  let actionSuccess = true;
  let actionError;
  async function resolveTarget() {
    if (!action.target) return null;
    const el = await driver3.find(action.target);
    return el?.id ?? null;
  }
  let captureResult = null;
  try {
    captureResult = await driver3.actAndCapture(async () => {
      const elementId = await resolveTarget();
      if (!elementId) {
        if (action.type === "press") {
          await driver3.pressKey(action.value ?? "Enter");
          return;
        }
        if (action.type === "scroll") {
          const delta = action.value ? parseInt(action.value, 10) || 300 : 300;
          await driver3.scroll(delta);
          return;
        }
        throw new Error(`Element not found: "${action.target}"`);
      }
      switch (action.type) {
        case "click":
          await driver3.click(elementId);
          break;
        case "type":
          await driver3.type(elementId, action.value ?? "");
          break;
        case "fill":
          await driver3.fill(elementId, action.value ?? "");
          break;
        case "hover":
          await driver3.hover(elementId);
          break;
        case "press":
          await driver3.pressKey(action.value ?? "Enter");
          break;
        case "scroll": {
          const delta = action.value ? parseInt(action.value, 10) || 300 : 300;
          await driver3.scroll(delta);
          break;
        }
        case "select":
          await driver3.select(elementId, action.value ?? "");
          break;
        case "check":
          await driver3.check(elementId);
          break;
        case "doubleClick":
          await driver3.doubleClick(elementId);
          break;
        case "rightClick":
          await driver3.rightClick(elementId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    });
  } catch (err) {
    actionSuccess = false;
    actionError = err instanceof Error ? err.message : String(err);
    const emptyScreenshot = Buffer.alloc(0);
    captureResult = {
      before: { elements: [], screenshot: emptyScreenshot },
      after: { elements: [], screenshot: emptyScreenshot },
      diff: { addedElements: [], removedElements: [], pixelDiff: 0 }
    };
  }
  const actionDuration = Date.now() - actionStart;
  const assertions = [];
  if (expectation) {
    const afterElements = captureResult.after.elements;
    if (expectation.visible !== void 0) {
      const name = expectation.visible;
      const found = afterElements.some(
        (e) => e.label?.toLowerCase().includes(name.toLowerCase()) || e.value?.toString().toLowerCase().includes(name.toLowerCase())
      );
      assertions.push({
        check: `visible: "${name}"`,
        passed: found,
        detail: found ? `Element "${name}" found in after state` : `Element "${name}" not found in after state (${afterElements.length} elements)`
      });
    }
    if (expectation.hidden !== void 0) {
      const name = expectation.hidden;
      const found = afterElements.some(
        (e) => e.label?.toLowerCase().includes(name.toLowerCase()) || e.value?.toString().toLowerCase().includes(name.toLowerCase())
      );
      assertions.push({
        check: `hidden: "${name}"`,
        passed: !found,
        detail: found ? `Element "${name}" still present in after state (expected hidden)` : `Element "${name}" correctly absent in after state`
      });
    }
    if (expectation.text !== void 0) {
      const text = expectation.text.toLowerCase();
      const found = afterElements.some(
        (e) => e.label?.toLowerCase().includes(text) || e.value?.toString().toLowerCase().includes(text)
      );
      assertions.push({
        check: `text: "${expectation.text}"`,
        passed: found,
        detail: found ? `Text "${expectation.text}" found in after state` : `Text "${expectation.text}" not found in any element`
      });
    }
    if (expectation.count !== void 0) {
      if (expectation.visible !== void 0) {
        const name = expectation.visible.toLowerCase();
        const matching = afterElements.filter(
          (e) => e.label?.toLowerCase().includes(name) || e.value?.toString().toLowerCase().includes(name)
        );
        const passed = matching.length === expectation.count;
        assertions.push({
          check: `count: ${expectation.count} of "${expectation.visible}"`,
          passed,
          detail: `Found ${matching.length} elements matching "${expectation.visible}" (expected ${expectation.count})`
        });
      } else {
        const interactive = afterElements.filter((e) => e.actions && e.actions.length > 0);
        const passed = interactive.length === expectation.count;
        assertions.push({
          check: `count: ${expectation.count} interactive elements`,
          passed,
          detail: `Found ${interactive.length} interactive elements (expected ${expectation.count})`
        });
      }
    }
    if (expectation.screenshot !== void 0) {
      try {
        await (0, import_promises25.mkdir)(outputDir, { recursive: true });
        const screenshotPath = (0, import_path26.join)(outputDir, `${expectation.screenshot}.png`);
        await (0, import_promises25.writeFile)(screenshotPath, captureResult.after.screenshot);
        assertions.push({
          check: `screenshot: "${expectation.screenshot}"`,
          passed: true,
          detail: `Screenshot saved to ${screenshotPath}`
        });
      } catch (err) {
        assertions.push({
          check: `screenshot: "${expectation.screenshot}"`,
          passed: false,
          detail: `Failed to save screenshot: ${err instanceof Error ? err.message : String(err)}`
        });
      }
    }
  }
  return {
    url,
    step,
    action: { success: actionSuccess, duration: actionDuration, error: actionError },
    assertions,
    before: {
      screenshot: captureResult.before.screenshot,
      elementCount: captureResult.before.elements.length
    },
    after: {
      screenshot: captureResult.after.screenshot,
      elementCount: captureResult.after.elements.length
    },
    diff: {
      addedElements: captureResult.diff.addedElements.map((e) => e.label || e.id),
      removedElements: captureResult.diff.removedElements.map((e) => e.label || e.id),
      pixelDiff: captureResult.diff.pixelDiff
    }
  };
}
function parseActionArg(arg) {
  const ACTION_TYPES = /* @__PURE__ */ new Set([
    "click",
    "type",
    "fill",
    "hover",
    "press",
    "scroll",
    "select",
    "check",
    "doubleClick",
    "rightClick"
  ]);
  const parts = arg.split(":");
  if (parts.length < 1) throw new Error(`Invalid action arg: "${arg}"`);
  const type = parts[0];
  if (!ACTION_TYPES.has(type)) throw new Error(`Unknown action type: "${type}"`);
  if (type === "press") {
    return { type, value: parts[1] ?? "Enter" };
  }
  if (type === "scroll") {
    return { type, value: parts[1] ?? "300" };
  }
  const KNOWN_ROLES = /* @__PURE__ */ new Set([
    "button",
    "link",
    "textbox",
    "checkbox",
    "combobox",
    "heading",
    "listitem",
    "menuitem",
    "radio",
    "tab",
    "img",
    "input",
    "select"
  ]);
  let target;
  let value;
  if (parts.length === 2) {
    target = parts[1];
  } else if (parts.length === 3) {
    if (KNOWN_ROLES.has(parts[1].toLowerCase())) {
      target = parts[2];
    } else {
      target = parts[1];
      value = parts[2];
    }
  } else if (parts.length >= 4) {
    if (KNOWN_ROLES.has(parts[1].toLowerCase())) {
      target = parts[2];
      value = parts.slice(3).join(":");
    } else {
      target = parts[1];
      value = parts.slice(2).join(":");
    }
  } else {
    throw new Error(`Cannot parse action arg: "${arg}"`);
  }
  return { type, target, value };
}
function parseExpectArg(arg) {
  const parts = arg.split(":");
  if (parts.length < 2) throw new Error(`Invalid expect arg: "${arg}"`);
  const keyword = parts[0].toLowerCase();
  switch (keyword) {
    case "hidden":
      return { hidden: parts.slice(1).join(":") };
    case "text":
      return { text: parts.slice(1).join(":") };
    case "count":
      return { count: parseInt(parts[1], 10) };
    default:
      if (keyword === "visible") {
        return { visible: parts.slice(1).join(":") };
      }
      return { visible: parts.slice(1).join(":") };
  }
}
function formatInteractionResult(result) {
  const lines = [];
  const { step, action, assertions, before, after, diff } = result;
  const statusIcon = action.success ? "PASS" : "FAIL";
  lines.push(`[${statusIcon}] ${step.action.type} "${step.action.target ?? step.action.value}" (${action.duration}ms)`);
  if (action.error) {
    lines.push(`  Error: ${action.error}`);
  }
  lines.push(`  Before: ${before.elementCount} elements`);
  lines.push(`  After:  ${after.elementCount} elements`);
  if (diff.addedElements.length > 0) {
    lines.push(`  Added:   ${diff.addedElements.slice(0, 5).join(", ")}${diff.addedElements.length > 5 ? ` (+${diff.addedElements.length - 5} more)` : ""}`);
  }
  if (diff.removedElements.length > 0) {
    lines.push(`  Removed: ${diff.removedElements.slice(0, 5).join(", ")}${diff.removedElements.length > 5 ? ` (+${diff.removedElements.length - 5} more)` : ""}`);
  }
  if (diff.pixelDiff > 0) {
    lines.push(`  Visual:  ${diff.pixelDiff} pixels changed`);
  }
  if (assertions.length > 0) {
    lines.push("  Assertions:");
    for (const a of assertions) {
      const icon = a.passed ? "PASS" : "FAIL";
      lines.push(`    [${icon}] ${a.check}`);
      if (!a.passed) {
        lines.push(`         ${a.detail}`);
      }
    }
  }
  return lines.join("\n");
}
var import_promises25, import_path26;
var init_interaction_test = __esm({
  "src/interaction-test.ts"() {
    "use strict";
    import_promises25 = require("fs/promises");
    import_path26 = require("path");
    init_driver();
  }
});

// src/ssim.ts
function toLuminance(data, width, height) {
  const pixels = width * height;
  const luma = new Float64Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const offset = i * 4;
    luma[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  }
  return luma;
}
function extractWindow(luma, imgWidth, x, y, windowSize) {
  const win = new Float64Array(windowSize * windowSize);
  let idx = 0;
  for (let row = 0; row < windowSize; row++) {
    const rowOffset = (y + row) * imgWidth + x;
    for (let col = 0; col < windowSize; col++) {
      win[idx++] = luma[rowOffset + col];
    }
  }
  return win;
}
function mean(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}
function statsWithMeans(x, y, meanX, meanY) {
  const n = x.length;
  let varX = 0;
  let varY = 0;
  let covXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    varX += dx * dx;
    varY += dy * dy;
    covXY += dx * dy;
  }
  return { varX: varX / n, varY: varY / n, covXY: covXY / n };
}
function windowSSIM(winX, winY) {
  const muX = mean(winX);
  const muY = mean(winY);
  const { varX, varY, covXY } = statsWithMeans(winX, winY, muX, muY);
  const muX2 = muX * muX;
  const muY2 = muY * muY;
  const muXY = muX * muY;
  const numerator = (2 * muXY + C1) * (2 * covXY + C2);
  const denominator = (muX2 + muY2 + C1) * (varX + varY + C2);
  return numerator / denominator;
}
function computeSSIM(img1, img2, options = {}) {
  const windowSize = options.windowSize ?? 8;
  if (img1.width === 0 || img1.height === 0 || img2.width === 0 || img2.height === 0) {
    return { score: 1, verdict: "pass" };
  }
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `SSIM requires equal dimensions. img1: ${img1.width}x${img1.height}, img2: ${img2.width}x${img2.height}`
    );
  }
  const { width, height } = img1;
  if (width < windowSize || height < windowSize) {
    const luma12 = toLuminance(img1.data, width, height);
    const luma22 = toLuminance(img2.data, width, height);
    const score2 = Math.max(0, Math.min(1, windowSSIM(luma12, luma22)));
    return { score: score2, verdict: scoreToVerdict(score2) };
  }
  const luma1 = toLuminance(img1.data, width, height);
  const luma2 = toLuminance(img2.data, width, height);
  const maxX = width - windowSize;
  const maxY = height - windowSize;
  let totalSSIM = 0;
  let windowCount = 0;
  const step = Math.max(1, Math.floor(windowSize / 2));
  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      const win1 = extractWindow(luma1, width, x, y, windowSize);
      const win2 = extractWindow(luma2, width, x, y, windowSize);
      totalSSIM += windowSSIM(win1, win2);
      windowCount++;
    }
  }
  if (windowCount === 0) {
    return { score: 1, verdict: "pass" };
  }
  const score = Math.max(0, Math.min(1, totalSSIM / windowCount));
  return { score, verdict: scoreToVerdict(score) };
}
function scoreToVerdict(score) {
  if (score > 0.85) return "pass";
  if (score >= 0.7) return "review";
  return "fail";
}
var C1, C2;
var init_ssim = __esm({
  "src/ssim.ts"() {
    "use strict";
    C1 = (0.01 * 255) ** 2;
    C2 = (0.03 * 255) ** 2;
  }
});

// src/mockup-match.ts
var mockup_match_exports = {};
__export(mockup_match_exports, {
  matchMockup: () => matchMockup,
  saveDiffImage: () => saveDiffImage
});
async function readPng(filePath) {
  const buffer = await (0, import_promises26.readFile)(filePath);
  const png = import_pngjs4.PNG.sync.read(buffer);
  return { data: png.data, width: png.width, height: png.height };
}
function decodePng(buffer) {
  const png = import_pngjs4.PNG.sync.read(buffer);
  return { data: png.data, width: png.width, height: png.height };
}
function resizeNearest(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.allocUnsafe(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), srcW - 1);
      const srcY = Math.min(Math.floor(y * scaleY), srcH - 1);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return dst;
}
function paintRegionGray(data, width, x, y, regionW, regionH) {
  const gray = 128;
  for (let row = y; row < y + regionH; row++) {
    for (let col = x; col < x + regionW; col++) {
      const idx = (row * width + col) * 4;
      if (idx + 3 < data.length) {
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
  }
}
async function matchMockup(options) {
  const {
    mockupPath,
    url,
    selector,
    maskDynamic = false,
    headless = true
  } = options;
  let mockup = await readPng(mockupPath);
  const viewport = {
    width: options.viewport?.width ?? mockup.width,
    height: options.viewport?.height ?? mockup.height,
    deviceScaleFactor: 1,
    mobile: false
  };
  const driver3 = new EngineDriver();
  try {
    await driver3.launch({
      headless,
      normalize: true,
      viewport
    });
    await driver3.navigate(url, { waitFor: "stable", timeout: 15e3 });
    let screenshotBuffer;
    if (selector) {
      const nodeId = await driver3.querySelector(selector);
      if (nodeId === null) {
        throw new Error(`Selector not found: ${selector}`);
      }
      const bounds = await driver3.evaluate(
        `(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })`,
        selector
      );
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        throw new Error(`Selector "${selector}" has zero bounds or is not visible`);
      }
      screenshotBuffer = await driver3.screenshot({
        clip: {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        }
      });
    } else {
      screenshotBuffer = await driver3.screenshot();
    }
    let live = decodePng(screenshotBuffer);
    const maskedRegions = [];
    if (maskDynamic) {
      const dynamicRegions = await findDynamicRegions(driver3);
      if (dynamicRegions.length > 0) {
        const mockupData = Buffer.from(mockup.data);
        const liveData = Buffer.from(live.data);
        for (const region of dynamicRegions) {
          const scaleX = live.width / viewport.width;
          const scaleY = live.height / viewport.height;
          const liveX = Math.round(region.x * scaleX);
          const liveY = Math.round(region.y * scaleY);
          const liveW = Math.round(region.width * scaleX);
          const liveH = Math.round(region.height * scaleY);
          const mockX = Math.round(region.x * (mockup.width / viewport.width));
          const mockY = Math.round(region.y * (mockup.height / viewport.height));
          const mockW = Math.round(region.width * (mockup.width / viewport.width));
          const mockH = Math.round(region.height * (mockup.height / viewport.height));
          paintRegionGray(liveData, live.width, liveX, liveY, liveW, liveH);
          paintRegionGray(mockupData, mockup.width, mockX, mockY, mockW, mockH);
          maskedRegions.push(region.label);
        }
        live = { data: liveData, width: live.width, height: live.height };
        mockup = { data: mockupData, width: mockup.width, height: mockup.height };
      }
    }
    let compareData1 = mockup.data;
    let compareData2 = live.data;
    let compareWidth = mockup.width;
    let compareHeight = mockup.height;
    if (live.width !== mockup.width || live.height !== mockup.height) {
      compareData2 = resizeNearest(live.data, live.width, live.height, mockup.width, mockup.height);
    }
    const ssimResult = computeSSIM(
      { data: compareData1, width: compareWidth, height: compareHeight },
      { data: compareData2, width: compareWidth, height: compareHeight }
    );
    const diffPng = new import_pngjs4.PNG({ width: compareWidth, height: compareHeight });
    const diffPixelCount = (0, import_pixelmatch3.default)(
      compareData1,
      compareData2,
      diffPng.data,
      compareWidth,
      compareHeight,
      {
        threshold: 0.1,
        includeAA: false,
        alpha: 0.1,
        diffColor: [255, 0, 0]
      }
    );
    const totalPixels = compareWidth * compareHeight;
    const diffImage = import_pngjs4.PNG.sync.write(diffPng);
    return {
      ssim: ssimResult,
      pixelDiff: {
        count: diffPixelCount,
        percentage: Math.round(diffPixelCount / totalPixels * 1e4) / 100,
        diffImage
      },
      mockupDimensions: { width: mockup.width, height: mockup.height },
      liveDimensions: { width: live.width, height: live.height },
      maskedRegions
    };
  } finally {
    await driver3.close();
  }
}
async function findDynamicRegions(driver3) {
  const regions = [];
  const selectors = [
    '[role="timer"]',
    '[role="status"]',
    '[role="log"]',
    '[role="marquee"]',
    '[role="alert"]',
    "time[datetime]",
    "[data-timestamp]",
    "[data-time]",
    "[data-date]",
    ".timestamp",
    ".ad",
    ".advertisement",
    ".ad-banner",
    ".sponsored",
    "ins.adsbygoogle"
  ];
  for (const sel of selectors) {
    try {
      const boundsJson = await driver3.evaluate(
        `(sel => {
          const els = document.querySelectorAll(sel);
          const results = [];
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              results.push({ x: r.left, y: r.top, width: r.width, height: r.height, label: el.getAttribute('role') || el.className || sel });
            }
          }
          return JSON.stringify(results);
        })`,
        sel
      );
      if (boundsJson) {
        const parsed = JSON.parse(boundsJson);
        for (const item of parsed) {
          const isDuplicate = regions.some(
            (r) => Math.abs(r.x - item.x) < 2 && Math.abs(r.y - item.y) < 2
          );
          if (!isDuplicate) {
            const labelStr = typeof item.label === "string" ? item.label.split(" ")[0] : sel;
            regions.push({ x: item.x, y: item.y, width: item.width, height: item.height, label: labelStr });
          }
        }
      }
    } catch {
    }
  }
  return regions;
}
async function saveDiffImage(diffImage, outputPath) {
  await (0, import_promises26.writeFile)(outputPath, diffImage);
}
var import_promises26, import_pngjs4, import_pixelmatch3;
var init_mockup_match = __esm({
  "src/mockup-match.ts"() {
    "use strict";
    import_promises26 = require("fs/promises");
    import_pngjs4 = require("pngjs");
    import_pixelmatch3 = __toESM(require("pixelmatch"));
    init_driver();
    init_ssim();
  }
});

// src/design-verifier.ts
var design_verifier_exports = {};
__export(design_verifier_exports, {
  buildReconciliationMatrix: () => buildReconciliationMatrix,
  formatReconciliationMatrix: () => formatReconciliationMatrix,
  formatVerifyResult: () => formatVerifyResult,
  loadChanges: () => loadChanges,
  saveChange: () => saveChange,
  verifyAllChanges: () => verifyAllChanges,
  verifyChange: () => verifyChange
});
function applyOperator(actual, operator, expected) {
  if (actual === null) {
    if (operator === "exists" || operator === "truthy") {
      return { passed: false, detail: "element not found" };
    }
    return { passed: false, detail: "could not read property (element or value not found)" };
  }
  const actualStr = String(actual).trim();
  const expectedStr = String(expected).trim();
  switch (operator) {
    case "eq":
      return {
        passed: actualStr === expectedStr,
        detail: actualStr === expectedStr ? `"${actualStr}" equals "${expectedStr}"` : `"${actualStr}" !== "${expectedStr}"`
      };
    case "contains":
      return {
        passed: actualStr.toLowerCase().includes(expectedStr.toLowerCase()),
        detail: actualStr.toLowerCase().includes(expectedStr.toLowerCase()) ? `"${actualStr}" contains "${expectedStr}"` : `"${actualStr}" does not contain "${expectedStr}"`
      };
    case "not":
      return {
        passed: actualStr !== expectedStr,
        detail: actualStr !== expectedStr ? `"${actualStr}" is not "${expectedStr}"` : `"${actualStr}" equals "${expectedStr}" (expected not to)`
      };
    case "gt": {
      const a = parseFloat(actualStr);
      const e = parseFloat(expectedStr);
      if (isNaN(a) || isNaN(e)) {
        return { passed: false, detail: `cannot compare non-numeric values: "${actualStr}" > "${expectedStr}"` };
      }
      return {
        passed: a > e,
        detail: a > e ? `${a} > ${e}` : `${a} is not > ${e}`
      };
    }
    case "lt": {
      const a = parseFloat(actualStr);
      const e = parseFloat(expectedStr);
      if (isNaN(a) || isNaN(e)) {
        return { passed: false, detail: `cannot compare non-numeric values: "${actualStr}" < "${expectedStr}"` };
      }
      return {
        passed: a < e,
        detail: a < e ? `${a} < ${e}` : `${a} is not < ${e}`
      };
    }
    case "exists":
      return { passed: true, detail: "element exists in AX tree" };
    case "truthy": {
      const isTruthy = actualStr !== "" && actualStr !== "0" && actualStr !== "none" && actualStr !== "false";
      return {
        passed: isTruthy,
        detail: isTruthy ? `"${actualStr}" is truthy` : `"${actualStr}" is falsy`
      };
    }
    default:
      return { passed: false, detail: `unknown operator: ${operator}` };
  }
}
async function getComputedProperty(driver3, elementQuery, property) {
  try {
    const isSelector = /^[.#\[]/.test(elementQuery) || /[>+~]/.test(elementQuery);
    let jsExpression;
    if (isSelector) {
      jsExpression = `
        (function() {
          const el = document.querySelector(${JSON.stringify(elementQuery)});
          if (!el) return null;
          return getComputedStyle(el)[${JSON.stringify(property)}] || null;
        })()
      `;
    } else {
      jsExpression = `
        (function() {
          // Try aria-label match (CSS.escape prevents injection)
          const byAria = document.querySelector('[aria-label="' + CSS.escape(${JSON.stringify(elementQuery)}) + '"]');
          if (byAria) return getComputedStyle(byAria)[${JSON.stringify(property)}] || null;
          // Try text content match (first element with matching text)
          const all = document.querySelectorAll('*');
          for (const el of all) {
            if (el.children.length === 0 && el.textContent && el.textContent.trim() === ${JSON.stringify(elementQuery)}) {
              return getComputedStyle(el)[${JSON.stringify(property)}] || null;
            }
          }
          return null;
        })()
      `;
    }
    const result = await driver3.evaluate(jsExpression);
    return result === null || result === void 0 ? null : String(result);
  } catch {
    return null;
  }
}
async function checkSemanticProperty(driver3, elementQuery, property) {
  const element = await driver3.find(elementQuery);
  if (!element) return null;
  switch (property) {
    case "visible":
    case "exists":
      return "true";
    case "role":
      return element.role ?? null;
    case "label":
    case "name":
      return element.label ?? null;
    case "value":
      return element.value !== void 0 ? String(element.value) : null;
    default:
      return null;
  }
}
async function verifyChange(change, driver3) {
  const results = [];
  for (const check of change.checks) {
    const result = await verifyCheck(driver3, change.element, check);
    results.push(result);
  }
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const ambiguous = results.filter((r) => !r.passed && r.actual === null).length;
  const failed = results.filter((r) => !r.passed && r.actual !== null).length;
  const overallPassed = passed === total;
  const parts = [`Verified ${passed}/${total} properties`];
  if (ambiguous > 0) parts.push(`${ambiguous} ambiguous`);
  if (failed > 0) parts.push(`${failed} failed`);
  return {
    change,
    results,
    overallPassed,
    summary: parts.join(", ")
  };
}
async function verifyCheck(driver3, elementQuery, check) {
  const { property, operator, value, confidence } = check;
  let actual = null;
  if (operator === "exists" || operator === "truthy" || property === "role" || property === "label" || property === "name") {
    actual = await checkSemanticProperty(driver3, elementQuery, property);
  }
  if (actual === null && operator !== "exists") {
    actual = await getComputedProperty(driver3, elementQuery, property);
  }
  const { passed, detail } = applyOperator(actual, operator, value);
  return {
    property,
    expected: value,
    actual,
    passed,
    confidence,
    detail
  };
}
async function verifyAllChanges(changes, driver3) {
  const results = [];
  for (const change of changes) {
    results.push(await verifyChange(change, driver3));
  }
  return results;
}
function buildReconciliationMatrix(spec, platformResults) {
  const rowMap = /* @__PURE__ */ new Map();
  for (const [platform, verifyResults] of Object.entries(platformResults)) {
    for (const vr of verifyResults) {
      for (const checkResult of vr.results) {
        const key = `${vr.change.element}::${checkResult.property}`;
        if (!rowMap.has(key)) {
          rowMap.set(key, {
            property: `${vr.change.element} \u2014 ${checkResult.property}`,
            expected: checkResult.expected,
            platforms: {}
          });
        }
        const row = rowMap.get(key);
        row.platforms[platform] = {
          actual: checkResult.actual,
          passed: checkResult.passed
        };
      }
    }
  }
  const rows = Array.from(rowMap.values());
  const platformNames = Object.keys(platformResults);
  let allPass = 0;
  let anyFail = 0;
  for (const row of rows) {
    const platformStatuses = platformNames.map((p) => row.platforms[p]?.passed ?? null);
    const hasFail = platformStatuses.some((s) => s === false);
    if (hasFail) anyFail++;
    else allPass++;
  }
  return {
    spec,
    rows,
    summary: `${allPass} properties pass on all platforms, ${anyFail} have platform-specific failures`
  };
}
function formatVerifyResult(result) {
  const lines = [];
  const status = result.overallPassed ? "PASS" : "FAIL";
  lines.push(`[${status}] ${result.change.description}`);
  lines.push(`  Element: ${result.change.element}`);
  lines.push(`  ${result.summary}`);
  for (const r of result.results) {
    const icon = r.passed ? "ok" : "fail";
    const conf = `(confidence: ${(r.confidence * 100).toFixed(0)}%)`;
    lines.push(`    [${icon}] ${r.property}: ${r.detail} ${conf}`);
  }
  return lines.join("\n");
}
function formatReconciliationMatrix(matrix) {
  const lines = [];
  lines.push(`Reconciliation: ${matrix.spec}`);
  lines.push(matrix.summary);
  lines.push("");
  if (matrix.rows.length === 0) {
    lines.push("  No properties to compare.");
    return lines.join("\n");
  }
  const allPlatforms = Array.from(
    new Set(matrix.rows.flatMap((r) => Object.keys(r.platforms)))
  );
  const colWidth = 30;
  const platWidth = 20;
  const header = "Property".padEnd(colWidth) + allPlatforms.map((p) => p.padEnd(platWidth)).join("");
  lines.push(header);
  lines.push("-".repeat(colWidth + allPlatforms.length * platWidth));
  for (const row of matrix.rows) {
    const label = row.property.slice(0, colWidth - 1).padEnd(colWidth);
    const platformCols = allPlatforms.map((p) => {
      const cell = row.platforms[p];
      if (!cell) return "n/a".padEnd(platWidth);
      const icon = cell.passed ? "ok" : "fail";
      const val = cell.actual !== null ? String(cell.actual).slice(0, 12) : "(null)";
      return `[${icon}] ${val}`.padEnd(platWidth);
    });
    lines.push(label + platformCols.join(""));
  }
  return lines.join("\n");
}
async function loadChanges(outputDir) {
  const filePath = (0, import_path27.join)(outputDir, CHANGES_FILE);
  if (!(0, import_fs16.existsSync)(filePath)) return [];
  try {
    const raw = await (0, import_promises27.readFile)(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
async function saveChange(outputDir, change) {
  await (0, import_promises27.mkdir)(outputDir, { recursive: true });
  const existing = await loadChanges(outputDir);
  existing.push(change);
  const filePath = (0, import_path27.join)(outputDir, CHANGES_FILE);
  await (0, import_promises27.writeFile)(filePath, JSON.stringify(existing, null, 2), "utf-8");
}
var import_promises27, import_fs16, import_path27, CHANGES_FILE;
var init_design_verifier = __esm({
  "src/design-verifier.ts"() {
    "use strict";
    import_promises27 = require("fs/promises");
    import_fs16 = require("fs");
    import_path27 = require("path");
    CHANGES_FILE = "design-changes.json";
  }
});

// src/test-generator.ts
var test_generator_exports = {};
__export(test_generator_exports, {
  generateTest: () => generateTest
});
function guessInputValue(label) {
  const lower = label.toLowerCase();
  for (const [key, val] of Object.entries(INPUT_SAMPLE_VALUES)) {
    if (lower.includes(key)) return val;
  }
  return "test value";
}
function isInputLike(el) {
  return ["textbox", "searchbox", "combobox", "spinbutton", "slider"].includes(el.role);
}
function isClickable(el) {
  return ["button", "link", "menuitem", "tab", "checkbox", "radio", "switch", "option"].includes(el.role) || el.actions.includes("click");
}
function scenarioRelevance(el, keywords) {
  if (!el.label) return 0;
  const label = el.label.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (label.includes(kw)) score += 2;
    else if (kw.includes(label) || label.startsWith(kw.slice(0, 3))) score += 1;
  }
  return score;
}
async function generateTest(options) {
  const { url, scenario, outputPath = ".ibr-test.json" } = options;
  const driver3 = new EngineDriver();
  let elements = [];
  let pageTitle = "page";
  try {
    await driver3.launch({ headless: true });
    await driver3.navigate(url);
    try {
      const title = await driver3.title();
      if (title) pageTitle = title;
    } catch {
    }
    const discovered = await driver3.discover({ filter: "interactive" });
    elements = discovered;
  } finally {
    await driver3.close();
  }
  let pageName;
  try {
    const pathname = new URL(url).pathname;
    pageName = pathname === "/" ? "home" : pathname.replace(/\//g, "-").replace(/^-/, "");
  } catch {
    pageName = pageTitle.toLowerCase().replace(/\s+/g, "-").slice(0, 32) || "page";
  }
  const tests = [];
  if (scenario) {
    tests.push(buildScenarioTest(scenario, elements));
  } else {
    tests.push(buildSmokeTest(elements, url));
  }
  const suite = {
    [pageName]: { url, tests }
  };
  const dir = (0, import_path28.dirname)(outputPath);
  if (dir && dir !== ".") {
    await (0, import_promises28.mkdir)(dir, { recursive: true });
  }
  await (0, import_promises28.writeFile)(outputPath, JSON.stringify(suite, null, 2), "utf-8");
  console.log(`[test-generator] wrote ${outputPath}`);
  return suite;
}
function buildSmokeTest(elements, _url) {
  const steps = [];
  steps.push({ screenshot: "initial-state" });
  for (const el of elements) {
    if (!el.label) continue;
    if (isInputLike(el)) {
      const value = guessInputValue(el.label);
      steps.push({ fill: { target: el.label, value } });
      steps.push({ assert: { visible: el.label } });
    } else if (isClickable(el)) {
      const label = el.label.toLowerCase();
      const isNav = ["logout", "sign out", "delete", "remove", "close"].some((w) => label.includes(w));
      if (!isNav) {
        steps.push({ click: el.label });
        steps.push({ wait: 500 });
        steps.push({ screenshot: `after-click-${el.label.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}` });
      }
    }
  }
  steps.push({ assert: { count: elements.filter((e) => e.actions.length > 0).length } });
  return {
    name: "smoke test",
    steps
  };
}
function buildScenarioTest(scenario, elements) {
  const keywords = scenario.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const scored = elements.filter((el) => el.label && (isInputLike(el) || isClickable(el))).map((el) => ({ el, score: scenarioRelevance(el, keywords) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const steps = [];
  steps.push({ screenshot: "scenario-start" });
  const inputs = scored.filter((x) => isInputLike(x.el));
  const clickables = scored.filter((x) => isClickable(x.el));
  for (const { el } of inputs) {
    const value = guessInputValue(el.label);
    steps.push({ fill: { target: el.label, value } });
  }
  for (const { el } of clickables.slice(0, 3)) {
    steps.push({ click: el.label });
    steps.push({ wait: 800 });
  }
  for (const kw of keywords.slice(0, 2)) {
    if (kw.length > 3) {
      steps.push({ assert: { text: kw } });
    }
  }
  steps.push({ screenshot: "scenario-end" });
  return {
    name: scenario,
    steps
  };
}
var import_promises28, import_path28, INPUT_SAMPLE_VALUES;
var init_test_generator = __esm({
  "src/test-generator.ts"() {
    "use strict";
    import_promises28 = require("fs/promises");
    import_path28 = require("path");
    init_driver();
    INPUT_SAMPLE_VALUES = {
      email: "test@example.com",
      password: "Test1234!",
      search: "test query",
      query: "test query",
      name: "Test User",
      username: "testuser",
      phone: "555-0100",
      message: "Hello world",
      comment: "This is a comment",
      title: "Test Title",
      description: "Test description"
    };
  }
});

// src/test-runner.ts
var test_runner_exports = {};
__export(test_runner_exports, {
  formatRunResult: () => formatRunResult,
  runTests: () => runTests
});
async function runTests(options = {}) {
  const {
    filePath = ".ibr-test.json",
    outputDir = ".ibr/test-results",
    headless = true,
    viewport
  } = options;
  const raw = await (0, import_promises29.readFile)((0, import_path29.resolve)(filePath), "utf-8");
  const suite = JSON.parse(raw);
  await (0, import_promises29.mkdir)(outputDir, { recursive: true });
  const allResults = [];
  const runStart = Date.now();
  for (const [pageName, pageSuite] of Object.entries(suite)) {
    console.log(`[test-runner] page: ${pageName} (${pageSuite.url})`);
    const driver3 = new EngineDriver();
    try {
      await driver3.launch({
        headless,
        viewport: viewport ?? { width: 1280, height: 720 }
      });
      await driver3.navigate(pageSuite.url);
      const testResults = [];
      for (const testCase of pageSuite.tests) {
        console.log(`[test-runner]   test: ${testCase.name}`);
        const testStart = Date.now();
        const stepResults = [];
        for (const step of testCase.steps) {
          const stepResult = await executeStep2(driver3, step, outputDir);
          stepResults.push(stepResult);
          if (!stepResult.passed) {
            console.log(`[test-runner]     FAIL: ${stepResult.step} \u2014 ${stepResult.error}`);
          }
        }
        const allPassed = stepResults.every((s) => s.passed);
        testResults.push({
          name: testCase.name,
          passed: allPassed,
          steps: stepResults,
          duration: Date.now() - testStart
        });
      }
      const passed = testResults.filter((t) => t.passed).length;
      const failed = testResults.filter((t) => !t.passed).length;
      const runResult = {
        url: pageSuite.url,
        total: testResults.length,
        passed,
        failed,
        tests: testResults,
        duration: Date.now() - runStart
      };
      allResults.push(runResult);
      const resultPath = (0, import_path29.join)(outputDir, `${pageName}-results.json`);
      await (0, import_promises29.writeFile)(resultPath, JSON.stringify(runResult, null, 2), "utf-8");
      console.log(`[test-runner]   results: ${resultPath}`);
    } finally {
      await driver3.close();
    }
  }
  return allResults;
}
async function executeStep2(driver3, step, outputDir) {
  const start = Date.now();
  const stepDesc = describeStep(step);
  try {
    if ("click" in step) {
      const el = await driver3.find(step.click);
      if (!el) throw new Error(`Element not found: "${step.click}"`);
      await driver3.click(el.id);
      await new Promise((r) => setTimeout(r, 200));
    } else if ("fill" in step) {
      const el = await driver3.find(step.fill.target);
      if (!el) throw new Error(`Element not found: "${step.fill.target}"`);
      await driver3.fill(el.id, step.fill.value);
    } else if ("type" in step) {
      const el = await driver3.find(step.type.target);
      if (!el) throw new Error(`Element not found: "${step.type.target}"`);
      await driver3.type(el.id, step.type.value);
    } else if ("assert" in step) {
      await runAssert(driver3, step.assert);
    } else if ("screenshot" in step) {
      await (0, import_promises29.mkdir)(outputDir, { recursive: true });
      const screenshotPath = (0, import_path29.join)(outputDir, `${step.screenshot}.png`);
      const buf = await driver3.screenshot();
      await (0, import_promises29.writeFile)(screenshotPath, buf);
      return {
        step: stepDesc,
        passed: true,
        duration: Date.now() - start,
        screenshot: screenshotPath
      };
    } else if ("wait" in step) {
      const waitVal = step.wait;
      if (typeof waitVal === "number") {
        await new Promise((r) => setTimeout(r, waitVal));
      } else {
        await driver3.waitForElement(waitVal, { timeout: 1e4 });
      }
    }
    return { step: stepDesc, passed: true, duration: Date.now() - start };
  } catch (err) {
    return {
      step: stepDesc,
      passed: false,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
async function runAssert(driver3, assertion) {
  const elements = await driver3.getSnapshot();
  if (assertion.visible !== void 0) {
    const name = assertion.visible.toLowerCase();
    const found = elements.some(
      (e) => e.label?.toLowerCase().includes(name) || e.value?.toString().toLowerCase().includes(name)
    );
    if (!found) {
      throw new Error(`assert.visible: "${assertion.visible}" not found in AX tree (${elements.length} elements)`);
    }
  }
  if (assertion.hidden !== void 0) {
    const name = assertion.hidden.toLowerCase();
    const found = elements.some(
      (e) => e.label?.toLowerCase().includes(name) || e.value?.toString().toLowerCase().includes(name)
    );
    if (found) {
      throw new Error(`assert.hidden: "${assertion.hidden}" still present in AX tree (expected absent)`);
    }
  }
  if (assertion.text !== void 0) {
    const text = assertion.text.toLowerCase();
    const found = elements.some(
      (e) => e.label?.toLowerCase().includes(text) || e.value?.toString().toLowerCase().includes(text)
    );
    if (!found) {
      throw new Error(`assert.text: "${assertion.text}" not found in any element`);
    }
  }
  if (assertion.count !== void 0) {
    const interactive = elements.filter((e) => e.actions && e.actions.length > 0);
    if (interactive.length !== assertion.count) {
      throw new Error(
        `assert.count: expected ${assertion.count} interactive elements, got ${interactive.length}`
      );
    }
  }
}
function describeStep(step) {
  if ("click" in step) return `click "${step.click}"`;
  if ("fill" in step) return `fill "${step.fill.target}" with "${step.fill.value}"`;
  if ("type" in step) return `type "${step.type.value}" into "${step.type.target}"`;
  if ("assert" in step) {
    const parts = [];
    if (step.assert.visible) parts.push(`visible: "${step.assert.visible}"`);
    if (step.assert.hidden) parts.push(`hidden: "${step.assert.hidden}"`);
    if (step.assert.text) parts.push(`text: "${step.assert.text}"`);
    if (step.assert.count !== void 0) parts.push(`count: ${step.assert.count}`);
    return `assert { ${parts.join(", ")} }`;
  }
  if ("screenshot" in step) return `screenshot "${step.screenshot}"`;
  if ("wait" in step) {
    return typeof step.wait === "number" ? `wait ${step.wait}ms` : `wait for "${step.wait}"`;
  }
  return "unknown step";
}
function formatRunResult(result) {
  const lines = [];
  const verdict = result.failed === 0 ? "PASS" : "FAIL";
  lines.push(`[${verdict}] ${result.url}  (${result.total} tests, ${result.passed} passed, ${result.failed} failed, ${result.duration}ms)`);
  for (const test of result.tests) {
    const icon = test.passed ? "PASS" : "FAIL";
    lines.push(`  [${icon}] ${test.name} (${test.duration}ms)`);
    for (const step of test.steps) {
      if (!step.passed) {
        lines.push(`    [FAIL] ${step.step}`);
        if (step.error) lines.push(`           ${step.error}`);
      }
    }
  }
  return lines.join("\n");
}
var import_promises29, import_path29;
var init_test_runner = __esm({
  "src/test-runner.ts"() {
    "use strict";
    import_promises29 = require("fs/promises");
    import_path29 = require("path");
    init_driver();
  }
});

// src/script-runner.ts
var script_runner_exports = {};
__export(script_runner_exports, {
  formatScriptResult: () => formatScriptResult,
  runScript: () => runScript
});
function buildWrapper(scriptPath, cpuSeconds, memoryMB) {
  return `
import sys, os, resource, importlib.util

def _set_limits():
    cpu = ${cpuSeconds}
    mem = ${memoryMB} * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    except (ValueError, resource.error):
        pass
    try:
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    except (ValueError, resource.error):
        pass

_set_limits()

# Execute the user script in its own namespace
_script = ${JSON.stringify(scriptPath)}
_spec = importlib.util.spec_from_file_location("user_script", _script)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["user_script"] = _mod
_spec.loader.exec_module(_mod)
`;
}
async function runScript(options) {
  const {
    scriptPath,
    url,
    timeout = 6e4,
    memoryMB = 512,
    cpuSeconds = 30,
    env = {}
  } = options;
  const tmpId = (0, import_crypto2.randomBytes)(8).toString("hex");
  const tmpDir = (0, import_path30.join)((0, import_os5.tmpdir)(), `ibr-script-${tmpId}`);
  await (0, import_promises30.mkdir)(tmpDir, { recursive: true });
  const copiedScript = (0, import_path30.join)(tmpDir, "user_script.py");
  const wrapperPath = (0, import_path30.join)(tmpDir, "wrapper.py");
  try {
    await (0, import_promises30.copyFile)(scriptPath, copiedScript);
    await (0, import_promises30.writeFile)(wrapperPath, buildWrapper(copiedScript, cpuSeconds, memoryMB), "utf-8");
    const start = Date.now();
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    await new Promise((resolvePromise) => {
      const child = (0, import_child_process8.spawn)("python3", [wrapperPath], {
        cwd: tmpDir,
        detached: true,
        shell: false,
        env: {
          ...process.env,
          ...url ? { IBR_URL: url } : {},
          IBR_SESSION_DIR: tmpDir,
          ...env
        }
      });
      const killTimer = setTimeout(() => {
        timedOut = true;
        try {
          if (child.pid !== void 0) {
            process.kill(-child.pid, "SIGKILL");
          }
        } catch {
          child.kill("SIGKILL");
        }
      }, timeout);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => {
        clearTimeout(killTimer);
        exitCode = code ?? (timedOut ? 124 : 1);
        resolvePromise();
      });
      child.on("error", (err) => {
        clearTimeout(killTimer);
        stderr += `
Process error: ${err.message}`;
        exitCode = 1;
        resolvePromise();
      });
    });
    const duration = Date.now() - start;
    let output = null;
    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        output = JSON.parse(trimmed);
      } catch {
        output = null;
      }
    }
    return { exitCode, stdout, stderr, output, duration, timedOut };
  } finally {
    await (0, import_promises30.rm)(tmpDir, { recursive: true, force: true }).catch(() => {
    });
  }
}
function formatScriptResult(result) {
  const lines = [];
  const verdict = result.exitCode === 0 ? "PASS" : result.timedOut ? "TIMEOUT" : "FAIL";
  lines.push(`[${verdict}] exit=${result.exitCode} duration=${result.duration}ms${result.timedOut ? " (timed out)" : ""}`);
  if (result.stdout.trim()) {
    lines.push("stdout:");
    lines.push(result.stdout.trimEnd());
  }
  if (result.stderr.trim()) {
    lines.push("stderr:");
    lines.push(result.stderr.trimEnd());
  }
  return lines.join("\n");
}
var import_child_process8, import_promises30, import_path30, import_os5, import_crypto2;
var init_script_runner = __esm({
  "src/script-runner.ts"() {
    "use strict";
    import_child_process8 = require("child_process");
    import_promises30 = require("fs/promises");
    import_path30 = require("path");
    import_os5 = require("os");
    import_crypto2 = require("crypto");
  }
});

// src/iterate.ts
var iterate_exports = {};
__export(iterate_exports, {
  analyzeIssues: () => analyzeIssues,
  classifyIssue: () => classifyIssue,
  iterate: () => iterate,
  resetIterateState: () => resetIterateState
});
async function loadState(statePath) {
  try {
    const raw = await (0, import_promises31.readFile)(statePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function saveState(statePath, state) {
  await (0, import_promises31.mkdir)((0, import_path31.resolve)(statePath, ".."), { recursive: true });
  await (0, import_promises31.writeFile)(statePath, JSON.stringify(state, null, 2), "utf-8");
}
function hashIssues(issues) {
  const sorted = [...issues].sort();
  return (0, import_crypto3.createHash)("sha256").update(sorted.join("\n")).digest("hex").slice(0, 16);
}
function extractIssueFingerprints(scanResult) {
  return scanResult.issues.map((i) => `${i.category}:${i.severity}:${i.description.slice(0, 80)}`);
}
function testRunFingerprints(results) {
  const fps = [];
  for (const run of results) {
    for (const test of run.tests) {
      if (!test.passed) {
        fps.push(`test:fail:${test.name}`);
        for (const step of test.steps) {
          if (!step.passed) fps.push(`step:fail:${step.step.slice(0, 60)}`);
        }
      }
    }
  }
  return fps;
}
function detectConvergence(states) {
  const n = states.length;
  if (n < 2) return { converged: false };
  const last = states[n - 1];
  const prev = states[n - 2];
  if (last.issueCount === 0) {
    return { converged: true, reason: "resolved" };
  }
  if (last.scanHash === prev.scanHash) {
    return { converged: true, reason: "stagnant" };
  }
  if (n >= 3) {
    const beforePrev = states[n - 3];
    if (last.scanHash === beforePrev.scanHash) {
      return { converged: true, reason: "oscillating" };
    }
  }
  if (n >= 3) {
    const beforePrev = states[n - 3];
    if (last.issueCount > prev.issueCount && prev.issueCount > beforePrev.issueCount) {
      return { converged: true, reason: "regressing" };
    }
  }
  return { converged: false };
}
function classifyIssue(issue) {
  const text = (issue?.description || issue?.message || "").toLowerCase();
  if (/margin|padding|gap|spacing|indent/.test(text)) return "spacing";
  if (/color|contrast|background|foreground|hue|saturation/.test(text)) return "color";
  if (/font|text|typography|letter-spacing|line-height/.test(text)) return "typography";
  if (/aria|label|role|accessible|screen.?reader|tab.?index/.test(text)) return "accessibility";
  if (/click|handler|event|disabled|interactive|focus/.test(text)) return "interactivity";
  if (/display.?none|visibility.?hidden/.test(text)) return "visibility";
  if (/flex|grid|display|position|float|overflow|z-index/.test(text)) return "layout";
  if (/hidden|visible|opacity/.test(text)) return "visibility";
  if (/width|height|size|min|max|resize/.test(text)) return "size";
  return "other";
}
function analyzeIssues(iterations) {
  const latest = iterations[iterations.length - 1];
  if (!latest?.issues) {
    return { repeatedCategories: [], suggestedApproaches: [], shouldEscalate: false, affectedElements: [] };
  }
  const categories = /* @__PURE__ */ new Map();
  const elements = [];
  for (const issue of latest.issues) {
    const cat = classifyIssue(issue);
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
    elements.push({
      id: issue.element,
      issue: issue.description ?? String(issue)
    });
  }
  const repeatedCategories = [];
  for (const [cat] of categories) {
    const appearedIn = iterations.filter(
      (it) => it.issues?.some((i) => classifyIssue(i) === cat)
    ).length;
    if (appearedIn >= 2) repeatedCategories.push(cat);
  }
  const suggestedApproaches = [];
  for (const cat of repeatedCategories) {
    if (APPROACH_MAP[cat]) {
      suggestedApproaches.push(APPROACH_MAP[cat]);
    }
  }
  const shouldEscalate = repeatedCategories.length > 0 && iterations.length >= 3;
  const escalationReason = shouldEscalate ? `${repeatedCategories.join(", ")} issues persist after ${iterations.length} iterations. Consider a different approach or manual review.` : void 0;
  return {
    repeatedCategories,
    suggestedApproaches,
    shouldEscalate,
    escalationReason,
    affectedElements: elements.slice(0, 20)
    // Cap at 20
  };
}
async function runOneIteration(url, testFile, outputDir, iterationNumber, prevIssueCount) {
  const start = Date.now();
  let fingerprints = [];
  let issueCount = 0;
  let approachHint = "";
  let issues;
  if (testFile) {
    try {
      const results = await runTests({
        filePath: testFile,
        outputDir: (0, import_path31.join)(outputDir, `iter-${iterationNumber}`)
      });
      fingerprints = testRunFingerprints(results);
      issueCount = fingerprints.length;
      const total = results.reduce((s, r) => s + r.total, 0);
      const failed = results.reduce((s, r) => s + r.failed, 0);
      approachHint = `${total - failed}/${total} tests passing`;
    } catch (err) {
      fingerprints = [`runner-error:${err instanceof Error ? err.message.slice(0, 60) : String(err)}`];
      issueCount = 1;
      approachHint = "test runner error";
    }
  } else {
    try {
      const result = await scan(url, { outputDir: (0, import_path31.join)(outputDir, `iter-${iterationNumber}`) });
      fingerprints = extractIssueFingerprints(result);
      issueCount = result.issues.length;
      issues = result.issues;
      approachHint = `verdict=${result.verdict} issues=${issueCount}`;
    } catch (err) {
      fingerprints = [`scan-error:${err instanceof Error ? err.message.slice(0, 60) : String(err)}`];
      issueCount = 1;
      approachHint = "scan error";
    }
  }
  const scanHash = hashIssues(fingerprints);
  const netDelta = prevIssueCount - issueCount;
  return {
    iteration: iterationNumber,
    scanHash,
    issueCount,
    netDelta,
    approachHint,
    durationMs: Date.now() - start,
    converged: false,
    issues
  };
}
async function verifyResolved(url, outputDir, iterationNumber) {
  try {
    const verifyResult = await scan(url, {
      outputDir: (0, import_path31.join)(outputDir, `iter-${iterationNumber}-verify`)
    });
    return { confirmed: verifyResult.issues.length === 0, verifyIssueCount: verifyResult.issues.length };
  } catch {
    return { confirmed: false, verifyIssueCount: -1 };
  }
}
async function iterate(options) {
  const {
    url,
    testFile,
    maxIterations = 7,
    outputDir = ".ibr/iterate",
    autoApprove = false
  } = options;
  const statePath = (0, import_path31.join)(outputDir, "iterate-state.json");
  await (0, import_promises31.mkdir)(outputDir, { recursive: true });
  let persisted = await loadState(statePath);
  if (!persisted || persisted.url !== url) {
    persisted = {
      url,
      iterations: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const allIterations = persisted.iterations;
  if (allIterations.length >= maxIterations) {
    return buildResult(allIterations, "budget_exceeded");
  }
  const iterationNumber = allIterations.length + 1;
  const prevIssueCount = allIterations.length > 0 ? allIterations[allIterations.length - 1].issueCount : Infinity;
  console.log(`[iterate] iteration ${iterationNumber}/${maxIterations}...`);
  const state = await runOneIteration(url, testFile, outputDir, iterationNumber, prevIssueCount === Infinity ? 0 : prevIssueCount);
  allIterations.push(state);
  const { converged, reason } = detectConvergence(allIterations);
  let finalState = null;
  let verificationPassed;
  if (converged && reason) {
    state.converged = true;
    state.reason = reason;
    if (reason === "resolved" && !testFile) {
      console.log(`[iterate] issueCount=0 detected, running verification pass...`);
      const { confirmed, verifyIssueCount } = await verifyResolved(url, outputDir, iterationNumber);
      if (confirmed) {
        finalState = "resolved";
        verificationPassed = true;
        console.log(`[iterate] verification passed \u2014 0 issues confirmed`);
      } else {
        finalState = "false_positive";
        verificationPassed = false;
        state.converged = false;
        state.reason = void 0;
        console.log(`[iterate] false positive \u2014 verification found ${verifyIssueCount} issue(s). Continuing iteration.`);
      }
    } else {
      finalState = reason;
    }
  } else if (allIterations.length >= maxIterations) {
    finalState = "budget_exceeded";
  } else if (!autoApprove && CHECKPOINT_ITERATIONS.has(iterationNumber)) {
    finalState = null;
  }
  persisted.iterations = allIterations;
  persisted.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveState(statePath, persisted);
  let analysis;
  const analysisStates = ["stagnant", "oscillating", "regressing", "budget_exceeded", "false_positive", "in_progress"];
  const targetState = finalState ?? "in_progress";
  if (analysisStates.includes(targetState) && !testFile) {
    analysis = analyzeIssues(allIterations);
    const analysisDir = (0, import_path31.join)(outputDir);
    await (0, import_promises31.mkdir)(analysisDir, { recursive: true }).catch(() => {
    });
    await (0, import_promises31.writeFile)(
      (0, import_path31.join)(analysisDir, "analysis.json"),
      JSON.stringify(analysis, null, 2)
    ).catch(() => {
    });
  }
  if (finalState) {
    const result = buildResult(allIterations, finalState, verificationPassed, analysis);
    console.log(`[iterate] ${finalState}: ${result.summary}`);
    return result;
  }
  return buildResult(allIterations, "in_progress", void 0, analysis);
}
function buildResult(iterations, finalState, verificationPassed, analysis) {
  const last = iterations[iterations.length - 1];
  const totalMs = iterations.reduce((s, i) => s + i.durationMs, 0);
  let summary;
  switch (finalState) {
    case "resolved":
      summary = `All issues resolved after ${iterations.length} iteration(s) (${totalMs}ms total)`;
      break;
    case "false_positive":
      summary = `Scan reported 0 issues but verification found more \u2014 false positive detected after ${iterations.length} iteration(s). Continuing.`;
      break;
    case "stagnant":
      summary = `No change detected after ${iterations.length} iteration(s) \u2014 same ${last?.issueCount ?? 0} issue(s). Try a different approach.`;
      break;
    case "oscillating":
      summary = `Oscillating fix detected (A\u2192B\u2192A pattern) after ${iterations.length} iteration(s). Manual investigation needed.`;
      break;
    case "regressing":
      summary = `Issue count increased 2 consecutive iterations (now ${last?.issueCount ?? 0}). Reverting last change recommended.`;
      break;
    case "budget_exceeded":
      summary = `Reached ${iterations.length} iteration(s). ${last?.issueCount ?? 0} issue(s) remaining. Approach: ${last?.approachHint ?? "unknown"}.`;
      break;
    case "in_progress":
      summary = `Iteration ${iterations.length} complete. ${last?.issueCount ?? 0} issue(s) remaining. Ready for next iteration.`;
      break;
  }
  return { iterations, finalState, summary, verificationPassed, analysis };
}
async function resetIterateState(outputDir = ".ibr/iterate") {
  const statePath = (0, import_path31.join)(outputDir, "iterate-state.json");
  await (0, import_promises31.writeFile)(statePath, JSON.stringify({ iterations: [] }, null, 2), "utf-8").catch(() => {
  });
}
var import_crypto3, import_promises31, import_path31, CHECKPOINT_ITERATIONS, APPROACH_MAP;
var init_iterate = __esm({
  "src/iterate.ts"() {
    "use strict";
    import_crypto3 = require("crypto");
    import_promises31 = require("fs/promises");
    import_path31 = require("path");
    init_test_runner();
    init_scan();
    CHECKPOINT_ITERATIONS = /* @__PURE__ */ new Set([3, 7, 15, 20]);
    APPROACH_MAP = {
      spacing: "Check CSS layout properties (flex, grid, gap, margin, padding). Look for hardcoded values that should use design tokens.",
      color: "Check design tokens or theme variables. Verify contrast ratios meet WCAG requirements.",
      typography: "Check font-family, font-size, line-height, font-weight declarations. Look for CSS specificity conflicts.",
      accessibility: "Add aria-label, role, tabindex attributes. Ensure interactive elements have accessible names.",
      interactivity: "Check event handlers (onClick, onChange) and disabled state logic. Verify form submission handlers.",
      layout: "Check CSS display, position, flex/grid properties. Look for overflow, z-index, and stacking context issues.",
      visibility: "Check display:none, visibility:hidden, opacity:0, and conditional rendering logic.",
      size: "Check width, height, min/max constraints. Verify responsive breakpoints."
    };
  }
});

// src/bin/ibr.ts
var import_commander = require("commander");
var import_promises32 = require("fs/promises");
var import_path32 = require("path");
var import_fs17 = require("fs");
init_driver();
init_compat();
init_index();
init_operation_tracker();
function formatFixGuide(guide) {
  const lines = [];
  const count = guide.issues.length;
  const files = new Set(guide.issues.map((i) => i.source?.file).filter(Boolean));
  const fileCount = files.size;
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push(`  IBR FIX GUIDE \u2014 ${count} ${count === 1 ? "issue" : "issues"}${fileCount > 0 ? ` in ${fileCount} ${fileCount === 1 ? "file" : "files"}` : ""}`);
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  if (guide.screenshot) {
    lines.push("");
    lines.push(`  Annotated: ${guide.screenshot}`);
  }
  const CIRCLED = [
    "\u2460",
    "\u2461",
    "\u2462",
    "\u2463",
    "\u2464",
    "\u2465",
    "\u2466",
    "\u2467",
    "\u2468",
    "\u2469",
    "\u246A",
    "\u246B",
    "\u246C",
    "\u246D",
    "\u246E",
    "\u246F",
    "\u2470",
    "\u2471",
    "\u2472",
    "\u2473"
  ];
  for (let idx = 0; idx < guide.issues.length; idx++) {
    const i = guide.issues[idx];
    const num = idx < CIRCLED.length ? CIRCLED[idx] : `(${idx + 1})`;
    lines.push("");
    lines.push(`  ${num} [${i.severity}] ${i.what} (${i.where.screenRegion})`);
    lines.push(`     Element: ${i.where.element} \u2014 ${i.current}`);
    if (i.source) {
      const conf = Math.round(i.source.confidence * 10) / 10;
      lines.push(`     Source:  ${i.source.file}${i.source.line != null ? `:${i.source.line}` : ""} (${conf})`);
      if (i.source.searchPattern) {
        lines.push(`     Search:  ${i.source.searchPattern}`);
      }
    }
    lines.push(`     Fix:     ${i.suggestedFix}`);
  }
  if (count === 0) {
    lines.push("");
    lines.push("  No issues found.");
  }
  lines.push("");
  return lines.join("\n");
}
var program = new import_commander.Command();
var activeSession = null;
function setActiveSession(session) {
  activeSession = session;
}
program.hook("postAction", async (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  if (!name.startsWith("session:")) return;
  if (activeSession) {
    try {
      await activeSession.disconnect();
    } catch {
    }
    activeSession = null;
  }
  const code = typeof process.exitCode === "number" ? process.exitCode : 0;
  setImmediate(() => process.exit(code));
});
async function loadConfig() {
  const configPath = (0, import_path32.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs17.existsSync)(configPath)) {
    try {
      const content = await (0, import_promises32.readFile)(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
    }
  }
  return {};
}
var IBR_DEFAULT_PORT = 4200;
async function isPortAvailable(port) {
  return new Promise((resolve5) => {
    import("net").then(({ createServer: createServer2 }) => {
      const server = createServer2();
      server.once("error", () => resolve5(false));
      server.once("listening", () => {
        server.close();
        resolve5(true);
      });
      server.listen(port, "127.0.0.1");
    });
  });
}
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
}
async function createIBR(options = {}) {
  const config = await loadConfig();
  const merged = {
    ...config,
    ...options.baseUrl ? { baseUrl: String(options.baseUrl) } : {},
    ...options.output ? { outputDir: String(options.output) } : {},
    ...options.viewport ? { viewport: VIEWPORTS[options.viewport] } : {},
    ...options.threshold ? { threshold: Number(options.threshold) } : {},
    ...options.fullPage !== void 0 ? { fullPage: Boolean(options.fullPage) } : {}
  };
  return new InterfaceBuiltRight(merged);
}
async function createDriver(browser) {
  if (browser === "safari") {
    const { SafariDriver: SafariDriver2 } = await Promise.resolve().then(() => (init_driver2(), driver_exports2));
    return new SafariDriver2();
  }
  return new EngineDriver();
}
function withChromePath(opts) {
  const globalOpts = program.opts();
  if (globalOpts.chromePath) {
    return { ...opts, chromePath: globalOpts.chromePath };
  }
  return opts;
}
program.name("ibr").description("Design validation for Claude Code").version("0.8.0");
program.option("-b, --base-url <url>", "Base URL for the application").option("-o, --output <dir>", "Output directory", "./.ibr").option("-v, --viewport <name>", "Viewport: desktop, mobile, tablet", "desktop").option("-t, --threshold <percent>", "Diff threshold percentage", "1.0").option("--browser <browser>", "Browser to use: chrome or safari", "chrome").option("--chrome-path <path>", "Path to Chrome/Chromium executable");
program.command("start [url]").description("Capture a baseline screenshot (auto-detects dev server if no URL)").option("-n, --name <name>", "Session name").option("-s, --selector <css>", "CSS selector to capture specific element").option("-w, --wait-for <selector>", "Wait for selector before screenshot").option("--no-full-page", "Capture only the viewport, not full page").option("--sandbox", "Show visible browser window (default: headless)").option("--debug", "Visible browser + slow motion + devtools").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const ibr = await createIBR(program.opts());
    const result = await ibr.startSession(resolvedUrl, {
      name: options.name,
      fullPage: options.fullPage,
      selector: options.selector,
      waitFor: options.waitFor
    });
    console.log(`Session started: ${result.sessionId}`);
    console.log(`Baseline: ${result.baseline}`);
    console.log(`URL: ${result.session.url}`);
    console.log("");
    console.log("Next: Make your changes, then run:");
    console.log(`  npx ibr check ${result.sessionId}`);
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("auto").description("Zero-config: detect server, scan pages, open viewer").option("-n, --max-pages <count>", "Maximum pages to scan", "5").option("--nav-only", "Only scan navigation links (faster)").option("--no-open", "Do not open browser automatically").action(async (options) => {
  try {
    const baseUrl = await detectDevServer();
    if (!baseUrl) {
      console.log("No dev server detected.");
      console.log("");
      console.log("Start your dev server, then run:");
      console.log("  npx ibr auto");
      console.log("");
      console.log("Or specify a URL:");
      console.log("  npx ibr scan-start http://localhost:3000");
      return;
    }
    console.log(`Detected: ${baseUrl}`);
    console.log("");
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const ibr = await createIBR(program.opts());
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(baseUrl);
      console.log(`Found ${pages.length} navigation links.`);
    } else {
      const result = await discoverPages2({
        url: baseUrl,
        maxPages: parseInt(options.maxPages, 10)
      });
      pages = result.pages;
      console.log(`Discovered ${pages.length} pages.`);
    }
    if (pages.length === 0) {
      console.log("No pages found to capture.");
      await ibr.close();
      return;
    }
    console.log("Capturing baselines...");
    console.log("");
    let captured = 0;
    for (const page of pages) {
      try {
        const result = await ibr.startSession(page.url, {
          name: page.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 50)
        });
        captured++;
        console.log(`  ${page.path} -> ${result.sessionId}`);
      } catch {
        console.log(`  ${page.path} -> failed`);
      }
    }
    await ibr.close();
    console.log("");
    console.log(`Captured ${captured}/${pages.length} pages.`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Make your UI changes");
    console.log("  2. Run: npx ibr scan-check");
    console.log("  3. View: npx ibr serve");
    if (options.open !== false && captured > 0) {
      console.log("");
      console.log("Opening viewer...");
      const { spawn: spawn4 } = await import("child_process");
      spawn4("npx", ["ibr", "serve"], {
        stdio: "inherit",
        shell: true,
        detached: true
      }).unref();
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("check [sessionId]").description("Compare current state against baseline").option("-f, --format <format>", "Output format: json, text, minimal", "text").action(async (sessionId, options) => {
  try {
    const ibr = await createIBR(program.opts());
    const report = await ibr.check(sessionId);
    switch (options.format) {
      case "json":
        console.log(formatReportJson(report));
        break;
      case "minimal":
        console.log(formatReportMinimal(report));
        break;
      default:
        console.log(formatReportText(report));
    }
    if (options.format === "text") {
      console.log("");
      if (report.analysis.verdict === "MATCH") {
        console.log("All good! To capture more pages: npx ibr scan");
      } else if (report.analysis.verdict === "EXPECTED_CHANGE") {
        console.log("To accept as new baseline: npx ibr update");
      } else if (report.analysis.verdict === "UNEXPECTED_CHANGE" || report.analysis.verdict === "LAYOUT_BROKEN") {
        console.log("View diff in browser: npx ibr serve");
      }
    }
    await ibr.close();
    if (!report.comparison.match && (report.analysis.verdict === "UNEXPECTED_CHANGE" || report.analysis.verdict === "LAYOUT_BROKEN")) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("audit [url]").description("Full audit: functional checks + visual comparison + semantic verification").option("-r, --rules <preset>", "Override with preset (minimal). Auto-detects from CLAUDE.md by default").option("--show-framework", "Display detected design framework").option("--check-apis [dir]", "Cross-reference UI API calls against backend routes").option("--visual", "Include visual comparison against most recent baseline").option("--baseline <session>", "Compare against specific baseline session").option("--semantic", "Include semantic verification (expected elements, page intent)").option("--full", "Run all checks: functional + visual + semantic (default)").option("--json", "Output as JSON").option("--fail-on <level>", "Exit non-zero on errors/warnings", "error").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const { loadRulesConfig: loadRulesConfig2, runRules: runRules2, createAuditResult: createAuditResult2, formatAuditResult: formatAuditResult2, registerPreset: registerPreset2 } = await Promise.resolve().then(() => (init_engine(), engine_exports));
    const { register: register3 } = await Promise.resolve().then(() => (init_minimal(), minimal_exports));
    const { extractInteractiveElements: extractInteractiveElements2 } = await Promise.resolve().then(() => (init_extract2(), extract_exports));
    const { discoverUserContext: discoverUserContext2, formatContextSummary: formatContextSummary2 } = await Promise.resolve().then(() => (init_context_loader(), context_loader_exports));
    const { createPresetFromFramework: createPresetFromFramework2 } = await Promise.resolve().then(() => (init_dynamic_rules(), dynamic_rules_exports));
    register3();
    const userContext = await discoverUserContext2(process.cwd());
    if (options.showFramework) {
      console.log(formatContextSummary2(userContext));
      console.log("");
      if (!url) return;
    }
    const rulesConfig = await loadRulesConfig2(process.cwd());
    if (options.rules) {
      rulesConfig.extends = [options.rules];
      console.log(`Using preset: ${options.rules}`);
    } else if (rulesConfig.extends && rulesConfig.extends.length > 0) {
      console.log(`Using configured presets: ${rulesConfig.extends.join(", ")}`);
    } else if (userContext.framework) {
      const preset = createPresetFromFramework2(userContext.framework);
      registerPreset2(preset);
      rulesConfig.extends = [preset.name];
      console.log(`Detected: ${userContext.framework.name}`);
      console.log(`Source: ${userContext.framework.source}`);
      console.log(`Generated ${preset.rules.length} rules from ${userContext.framework.principles.length} principles`);
    } else {
      console.log("No design framework detected in CLAUDE.md.");
      console.log("Running basic interactivity checks only.");
      console.log("");
      console.log("To enable design validation:");
      console.log("  Add your framework to ~/.claude/CLAUDE.md or .claude/CLAUDE.md");
      console.log("  Or use --rules minimal for basic checks");
      rulesConfig.extends = ["minimal"];
    }
    console.log("");
    console.log(`Auditing ${resolvedUrl}...`);
    console.log("");
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const driver3 = new EngineDriver();
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    const page = new CompatPage(driver3);
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    await page.waitForTimeout(1e3);
    const elements = await extractInteractiveElements2(page);
    const isMobile = viewport.width < 768;
    const violations = runRules2(elements, {
      isMobile,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url: resolvedUrl,
      allElements: elements
    }, rulesConfig);
    const result = createAuditResult2(resolvedUrl, elements, violations);
    const runVisual = options.full || options.visual || options.baseline || !options.semantic && !options.checkApis;
    const runSemantic = options.full || options.semantic || !options.visual && !options.baseline && !options.checkApis;
    let visualResult = null;
    if (runVisual) {
      const { compareImages: compareImages2, analyzeComparison: analyzeComparison2 } = await Promise.resolve().then(() => (init_compare(), compare_exports));
      const { listSessions: listSessions2, getSessionPaths: getSessionPaths2 } = await Promise.resolve().then(() => (init_session(), session_exports));
      const { mkdir: mkdir26, access: access4 } = await import("fs/promises");
      const { join: join29 } = await import("path");
      const outputDir = globalOpts.outputDir || ".ibr";
      const sessions = await listSessions2(outputDir);
      const urlPath = new URL(resolvedUrl).pathname;
      let baselineSession = options.baseline ? sessions.find((s) => s.id === options.baseline) : sessions.filter((s) => new URL(s.url).pathname === urlPath && s.status !== "compared").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (baselineSession) {
        const paths = getSessionPaths2(outputDir, baselineSession.id);
        const currentPath = paths.current;
        await mkdir26(join29(outputDir, "sessions", baselineSession.id), { recursive: true });
        await page.screenshot({ path: currentPath, fullPage: true });
        try {
          await access4(paths.baseline);
          const comparison = await compareImages2({
            baselinePath: paths.baseline,
            currentPath,
            diffPath: paths.diff,
            threshold: 0.01
          });
          const analysis = analyzeComparison2(comparison, 1);
          visualResult = {
            hasBaseline: true,
            verdict: analysis.verdict,
            diffPercent: comparison.diffPercent,
            baselineSession: baselineSession.id,
            currentPath,
            diffPath: comparison.diffPercent > 0 ? paths.diff : void 0
          };
        } catch {
          visualResult = { hasBaseline: false };
        }
      } else {
        visualResult = { hasBaseline: false };
      }
    }
    let semanticResult = null;
    if (runSemantic) {
      const { getSemanticOutput: getSemanticOutput2, detectLandmarks: detectLandmarks2, compareLandmarks: compareLandmarks2, getExpectedLandmarksForIntent: getExpectedLandmarksForIntent2, getExpectedLandmarksFromContext: getExpectedLandmarksFromContext2, LANDMARK_SELECTORS: LANDMARK_SELECTORS2 } = await Promise.resolve().then(() => (init_semantic(), semantic_exports));
      const { listSessions: listSessions2 } = await Promise.resolve().then(() => (init_session(), session_exports));
      const { readFile: readFile23 } = await import("fs/promises");
      const { join: join29 } = await import("path");
      const semantic = await getSemanticOutput2(page);
      const outputDir = globalOpts.outputDir || ".ibr";
      const sessions = await listSessions2(outputDir);
      const urlPath = new URL(resolvedUrl).pathname;
      const baselineSession = sessions.filter((s) => new URL(s.url).pathname === urlPath && s.landmarkElements && s.landmarkElements.length > 0).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      let elementChecks = [];
      if (baselineSession && baselineSession.landmarkElements) {
        const currentLandmarks = await detectLandmarks2(page);
        void compareLandmarks2(baselineSession.landmarkElements, currentLandmarks);
        for (const landmark of baselineSession.landmarkElements) {
          if (landmark.found) {
            const stillExists = currentLandmarks.find((l) => l.name === landmark.name && l.found);
            elementChecks.push({
              element: landmark.name.charAt(0).toUpperCase() + landmark.name.slice(1),
              found: !!stillExists,
              source: "baseline"
            });
          }
        }
      } else {
        const pageIntent = semantic.pageIntent.intent;
        const intentLandmarks = getExpectedLandmarksForIntent2(pageIntent);
        let contextLandmarks = [];
        try {
          const claudeMdPath = join29(process.cwd(), "CLAUDE.md");
          const content = await readFile23(claudeMdPath, "utf-8");
          contextLandmarks = getExpectedLandmarksFromContext2({ principles: [content] });
        } catch {
        }
        const expectedLandmarkTypes = [.../* @__PURE__ */ new Set([...intentLandmarks, ...contextLandmarks])];
        for (const landmarkType of expectedLandmarkTypes) {
          const selector = LANDMARK_SELECTORS2[landmarkType];
          if (selector) {
            const found = await page.$(selector);
            elementChecks.push({
              element: landmarkType.charAt(0).toUpperCase() + landmarkType.slice(1),
              found: !!found,
              source: "inferred"
            });
          }
        }
      }
      const semanticIssues = [];
      for (const check of elementChecks) {
        if (!check.found) {
          semanticIssues.push({
            type: "missing-element",
            problem: `Expected ${check.element} not found (${check.source} from ${check.source === "baseline" ? "previous capture" : "page intent"})`
          });
        }
      }
      for (const issue of semantic.issues) {
        semanticIssues.push({
          type: issue.type,
          problem: issue.problem
        });
      }
      semanticResult = {
        pageIntent: semantic.pageIntent.intent,
        confidence: semantic.confidence,
        authenticated: semantic.state.auth.authenticated,
        loading: semantic.state.loading.loading,
        hasErrors: semantic.state.errors.hasErrors,
        ready: semantic.state.ready,
        expectedElements: elementChecks.map((e) => ({ element: e.element, found: e.found })),
        issues: semanticIssues
      };
    }
    await driver3.close();
    let integrationResult = null;
    if (options.checkApis) {
      const { scanDirectoryForApiCalls: scanDirectoryForApiCalls2, discoverApiRoutes: discoverApiRoutes2, findOrphanEndpoints: findOrphanEndpoints2 } = await Promise.resolve().then(() => (init_integration(), integration_exports));
      const projectDir = typeof options.checkApis === "string" ? options.checkApis : process.cwd();
      const [apiCalls, apiRoutes] = await Promise.all([
        scanDirectoryForApiCalls2(projectDir),
        discoverApiRoutes2(projectDir)
      ]);
      const orphans = findOrphanEndpoints2(apiCalls, apiRoutes);
      integrationResult = {
        orphanCount: orphans.length,
        orphans: orphans.map((o) => ({
          endpoint: o.call.endpoint,
          method: o.call.method,
          file: o.call.sourceFile,
          line: o.call.lineNumber
        }))
      };
    }
    if (options.json) {
      console.log(JSON.stringify({
        ...result,
        visual: visualResult,
        semantic: semanticResult,
        integration: integrationResult
      }, null, 2));
    } else {
      console.log(formatAuditResult2(result));
      if (visualResult) {
        console.log("");
        console.log("Visual Comparison:");
        if (visualResult.hasBaseline) {
          const verdictColor = visualResult.verdict === "MATCH" ? "\x1B[32m" : (
            // green
            visualResult.verdict === "EXPECTED_CHANGE" ? "\x1B[33m" : (
              // yellow
              "\x1B[31m"
            )
          );
          console.log(`  Verdict: ${verdictColor}${visualResult.verdict}\x1B[0m`);
          console.log(`  Diff: ${visualResult.diffPercent?.toFixed(2)}%`);
          console.log(`  Baseline: ${visualResult.baselineSession}`);
          if (visualResult.diffPath) {
            console.log(`  Diff image: ${visualResult.diffPath}`);
          }
        } else {
          console.log("  No baseline found for this URL.");
          console.log('  Run: npx ibr start <url> --name "feature" to capture baseline first.');
        }
      }
      if (semanticResult) {
        console.log("");
        console.log("Semantic Verification:");
        console.log(`  Page type: ${semanticResult.pageIntent} (${Math.round(semanticResult.confidence * 100)}% confidence)`);
        console.log(`  Ready: ${semanticResult.ready ? "Yes" : "No"}`);
        const missing = semanticResult.expectedElements.filter((e) => !e.found);
        const found = semanticResult.expectedElements.filter((e) => e.found);
        if (missing.length > 0) {
          console.log("");
          console.log("  Missing expected elements:");
          for (const el of missing) {
            console.log(`    \x1B[31m!\x1B[0m ${el.element}`);
          }
        }
        if (found.length > 0) {
          console.log("");
          console.log("  Found elements:");
          for (const el of found) {
            console.log(`    \x1B[32m\u2713\x1B[0m ${el.element}`);
          }
        }
        if (semanticResult.issues.length > 0) {
          console.log("");
          console.log("  Semantic issues:");
          for (const issue of semanticResult.issues) {
            console.log(`    ! ${issue.problem}`);
          }
        }
      }
      if (integrationResult && integrationResult.orphanCount > 0) {
        console.log("");
        console.log("Integration Issues:");
        console.log(`  ${integrationResult.orphanCount} orphan API calls (UI calls backend that doesn't exist):`);
        console.log("");
        for (const orphan of integrationResult.orphans) {
          console.log(`  ! ${orphan.method} ${orphan.endpoint}`);
          console.log(`    Called from: ${orphan.file}${orphan.line ? `:${orphan.line}` : ""}`);
        }
      } else if (integrationResult) {
        console.log("");
        console.log("Integration: All API calls have matching backend routes.");
      }
    }
    const hasIntegrationErrors = integrationResult && integrationResult.orphanCount > 0;
    const hasVisualRegression = visualResult?.hasBaseline && visualResult.verdict !== "MATCH" && visualResult.verdict !== "EXPECTED_CHANGE";
    const hasSemanticIssues = semanticResult && semanticResult.issues.length > 0;
    const hasMissingElements = semanticResult && semanticResult.expectedElements.some((e) => !e.found);
    if (options.failOn === "error" && (result.summary.errors > 0 || hasIntegrationErrors || hasVisualRegression || hasMissingElements)) {
      process.exit(1);
    } else if (options.failOn === "warning" && (result.summary.errors > 0 || result.summary.warnings > 0 || hasIntegrationErrors || hasVisualRegression || hasSemanticIssues)) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan <url>").description("Full UI scan: elements + interactivity + semantic + console errors").option("-v, --viewport <preset>", "Viewport preset (desktop, mobile, tablet)", "desktop").option("--wait-for <selector>", "Wait for selector before scanning").option("--screenshot <path>", "Save screenshot to path").option("--json", "Output as JSON").option("--timeout <ms>", "Page load timeout in ms", "30000").option("--patience <ms>", "Wait longer for slow async content (AI search, LLM results)").option("--network-idle-timeout <ms>", "Network idle timeout in ms (default: 10000)").action(async (url, options) => {
  try {
    const { scan: scan2, formatScanResult: formatScanResult2 } = await Promise.resolve().then(() => (init_scan(), scan_exports));
    const resolvedUrl = await resolveBaseUrl(url);
    console.log(`Scanning ${resolvedUrl}...`);
    const result = await scan2(resolvedUrl, {
      viewport: options.viewport,
      waitFor: options.waitFor,
      timeout: parseInt(options.timeout, 10),
      patience: options.patience ? parseInt(options.patience, 10) : void 0,
      networkIdleTimeout: options.networkIdleTimeout ? parseInt(options.networkIdleTimeout, 10) : void 0,
      screenshot: options.screenshot ? { path: options.screenshot } : void 0
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatScanResult2(result));
    }
    if (result.verdict === "FAIL") {
      process.exit(1);
    }
  } catch (error) {
    console.error("Scan error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("status").description("Show sessions awaiting comparison (baselines without checks)").action(async () => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    const pending = sessions.filter((s) => s.status === "baseline");
    if (pending.length === 0) {
      console.log("No pending visual checks.");
      console.log("");
      console.log("To capture a baseline:");
      console.log('  npx ibr start <url> --name "feature-name"');
      return;
    }
    console.log("Pending visual checks:");
    console.log("");
    for (const session of pending) {
      const age = Date.now() - new Date(session.createdAt).getTime();
      const ageStr = age < 6e4 ? "just now" : age < 36e5 ? `${Math.floor(age / 6e4)}m ago` : age < 864e5 ? `${Math.floor(age / 36e5)}h ago` : `${Math.floor(age / 864e5)}d ago`;
      const urlPath = new URL(session.url).pathname;
      console.log(`  ${session.id}  ${urlPath.padEnd(20)}  ${ageStr.padEnd(10)}  ${session.name || ""}`);
    }
    console.log("");
    console.log("Run comparison:");
    console.log("  npx ibr check              # checks most recent");
    console.log("  npx ibr check <session-id> # checks specific session");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("list").description("List all sessions").option("-f, --format <format>", "Output format: json, text", "text").option("--by-app", "Group sessions by app/branch (git context)").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    if (sessions.length === 0) {
      console.log("No sessions found.");
      return;
    }
    if (options.format === "json") {
      console.log(JSON.stringify(sessions, null, 2));
    } else if (options.byApp) {
      const { getAppContext: getAppContext2 } = await Promise.resolve().then(() => (init_git_context(), git_context_exports));
      const context = await getAppContext2(process.cwd()).catch(() => null);
      const currentApp = context?.appName || "unknown";
      const currentBranch = context?.branch || "unknown";
      const groups = /* @__PURE__ */ new Map();
      for (const session of sessions) {
        let groupKey = "Other";
        try {
          if (session.url) {
            const url = new URL(session.url);
            groupKey = url.hostname;
          }
        } catch {
          groupKey = "Other";
        }
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(session);
      }
      console.log(`Current App: ${currentApp} (${currentBranch})`);
      console.log("");
      for (const [groupName, groupSessions] of groups) {
        console.log(`${groupName} (${groupSessions.length} sessions)`);
        console.log("-".repeat(50));
        for (const session of groupSessions) {
          console.log(`  ${formatSessionSummary(session)}`);
        }
        console.log("");
      }
    } else {
      console.log("Sessions:");
      console.log("");
      console.log("ID              STATUS    VIEWPORT  DATE        NAME");
      console.log("-".repeat(70));
      for (const session of sessions) {
        console.log(formatSessionSummary(session));
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("update [sessionId]").alias("approve").description("Update baseline with current screenshot (alias: approve)").action(async (sessionId) => {
  try {
    const ibr = await createIBR(program.opts());
    const session = await ibr.updateBaseline(sessionId);
    console.log(`Baseline updated for session: ${session.id}`);
    console.log(`URL: ${session.url}`);
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("clean").description("Clean old sessions").option("--older-than <duration>", "Delete sessions older than duration (e.g., 7d, 24h)").option("--keep-last <count>", "Keep the last N sessions", "0").option("--dry-run", "Show what would be deleted without deleting").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const result = await ibr.clean({
      olderThan: options.olderThan,
      keepLast: parseInt(options.keepLast, 10),
      dryRun: options.dryRun
    });
    if (options.dryRun) {
      console.log("Dry run - would delete:");
    } else {
      console.log("Cleaned:");
    }
    if (result.deleted.length === 0) {
      console.log("  No sessions to delete.");
    } else {
      for (const id of result.deleted) {
        console.log(`  - ${id}`);
      }
    }
    console.log(`
Kept: ${result.kept.length} sessions`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("delete <sessionId>").description("Delete a specific session").action(async (sessionId) => {
  try {
    const ibr = await createIBR(program.opts());
    const deleted = await ibr.deleteSession(sessionId);
    if (deleted) {
      console.log(`Deleted session: ${sessionId}`);
    } else {
      console.log(`Session not found: ${sessionId}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("serve").description("Start the comparison viewer web UI").option("-p, --port <port>", `Port number (default: ${IBR_DEFAULT_PORT}, auto-scans for available)`).option("--no-open", "Do not open browser automatically").action(async (options) => {
  const { spawn: spawn4 } = await import("child_process");
  const { resolve: resolve5 } = await import("path");
  const packageRoot = resolve5(process.cwd());
  let webUiDir = (0, import_path32.join)(packageRoot, "web-ui");
  if (!(0, import_fs17.existsSync)(webUiDir)) {
    const possiblePaths = [
      (0, import_path32.join)(packageRoot, "node_modules", "interface-built-right", "web-ui"),
      (0, import_path32.join)(packageRoot, "..", "interface-built-right", "web-ui")
    ];
    for (const p of possiblePaths) {
      if ((0, import_fs17.existsSync)(p)) {
        webUiDir = p;
        break;
      }
    }
  }
  if (!(0, import_fs17.existsSync)(webUiDir)) {
    console.log("Web UI not found. Please ensure web-ui directory exists.");
    console.log("");
    console.log("For now, you can view the comparison images directly:");
    try {
      const ibr = await createIBR(program.opts());
      const session = await ibr.getMostRecentSession();
      if (session) {
        const config = ibr.getConfig();
        console.log(`  Baseline: ${config.outputDir}/sessions/${session.id}/baseline.png`);
        console.log(`  Current:  ${config.outputDir}/sessions/${session.id}/current.png`);
        console.log(`  Diff:     ${config.outputDir}/sessions/${session.id}/diff.png`);
      }
    } catch {
    }
    return;
  }
  let port;
  if (options.port) {
    port = parseInt(options.port, 10);
    if (!await isPortAvailable(port)) {
      console.log(`Port ${port} is already in use.`);
      try {
        port = await findAvailablePort(port + 1);
        console.log(`Using next available port: ${port}`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Failed to find available port");
        process.exit(1);
      }
    }
  } else {
    try {
      port = await findAvailablePort(IBR_DEFAULT_PORT);
      if (port !== IBR_DEFAULT_PORT) {
        console.log(`Default port ${IBR_DEFAULT_PORT} in use, using port ${port}`);
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : "Failed to find available port");
      process.exit(1);
    }
  }
  console.log(`Starting web UI on http://localhost:${port}`);
  console.log("Press Ctrl+C to stop the server.");
  console.log("");
  const server = spawn4("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd: webUiDir,
    stdio: "inherit",
    shell: true
  });
  if (options.open !== false) {
    setTimeout(async () => {
      const open = (await import("child_process")).exec;
      const url = `http://localhost:${port}`;
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      open(`${cmd} ${url}`);
    }, 3e3);
  }
  server.on("close", (code) => {
    if (code !== 0) {
      console.log(`Web UI server exited with code ${code}`);
    }
  });
});
program.command("login <url>").description("Open browser for manual login, then save auth state for future captures").option("--timeout <ms>", "Timeout in milliseconds (default: 5 minutes)", "300000").action(async (url, options) => {
  try {
    const { performLogin: performLogin2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    await performLogin2({
      url,
      outputDir,
      timeout: parseInt(options.timeout, 10)
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("logout").description("Clear saved authentication state").action(async () => {
  try {
    const { clearAuthState: clearAuthState2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    await clearAuthState2(outputDir);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
var flowCmd = program.command("flow").description("Execute pre-built interaction flows");
flowCmd.command("search <url>").description("Execute search flow").requiredOption("--query <text>", "Search query").option("--session <id>", "Use existing session").action(async (url, options) => {
  try {
    const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
    const { CompatPage: CompatPage2 } = await Promise.resolve().then(() => (init_compat(), compat_exports));
    const { searchFlow: searchFlow2 } = await Promise.resolve().then(() => (init_search(), search_exports));
    const driver3 = new EngineDriver2();
    await driver3.launch(withChromePath({}));
    await driver3.navigate(url);
    const page = new CompatPage2(driver3);
    const result = await searchFlow2(page, { query: options.query });
    console.log(result.success ? "Search flow succeeded" : "Search flow failed");
    console.log(`Query: "${options.query}"`);
    console.log(`Results found: ${result.resultCount}`);
    if (result.error) console.log(`Error: ${result.error}`);
    result.steps.forEach((s) => {
      console.log(`  ${s.success ? "\u2713" : "\u2717"} ${s.action}`);
    });
    await driver3.close().catch(() => {
    });
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
flowCmd.command("form <url>").description("Fill and submit a form").requiredOption("--fields <json>", `Field values as JSON, e.g. '{"Email":"test@example.com"}'`).option("--no-submit", "Fill without submitting").option("--session <id>", "Use existing session").action(async (url, options) => {
  try {
    const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
    const { CompatPage: CompatPage2 } = await Promise.resolve().then(() => (init_compat(), compat_exports));
    const { formFlow: formFlow2 } = await Promise.resolve().then(() => (init_form(), form_exports));
    let fieldMap;
    try {
      fieldMap = JSON.parse(options.fields);
    } catch {
      console.error(`--fields must be valid JSON, e.g. '{"Email":"test@example.com"}'`);
      process.exit(1);
      return;
    }
    const driver3 = new EngineDriver2();
    await driver3.launch(withChromePath({}));
    await driver3.navigate(url);
    const page = new CompatPage2(driver3);
    const formFields = Object.entries(fieldMap).map(([name, value]) => ({ name, value }));
    const result = await formFlow2(page, {
      fields: formFields,
      submitButton: options.submit ? void 0 : "__NO_SUBMIT__"
    });
    console.log(result.success ? "Form flow succeeded" : "Form flow failed");
    console.log(`Filled: ${result.filledFields.join(", ") || "none"}`);
    if (result.failedFields.length > 0) {
      console.log(`Failed: ${result.failedFields.join(", ")}`);
    }
    if (result.error) console.log(`Error: ${result.error}`);
    await driver3.close().catch(() => {
    });
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
flowCmd.command("login <url>").description("Execute login flow").requiredOption("--username <text>", "Username or email").requiredOption("--password <text>", "Password").option("--session <id>", "Use existing session").action(async (url, options) => {
  try {
    const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
    const { CompatPage: CompatPage2 } = await Promise.resolve().then(() => (init_compat(), compat_exports));
    const { loginFlow: loginFlow2 } = await Promise.resolve().then(() => (init_login(), login_exports));
    const driver3 = new EngineDriver2();
    await driver3.launch(withChromePath({}));
    await driver3.navigate(url);
    const page = new CompatPage2(driver3);
    const result = await loginFlow2(page, { email: options.username, password: options.password });
    console.log(result.success ? "Login flow succeeded" : "Login flow failed");
    console.log(`Logged in: ${result.authenticated}`);
    if (result.username) console.log(`Username detected: ${result.username}`);
    if (result.error) console.log(`Error: ${result.error}`);
    result.steps.forEach((s) => {
      console.log(`  ${s.success ? "\u2713" : "\u2717"} ${s.action}`);
    });
    await driver3.close().catch(() => {
    });
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:start [url]").description("Start an interactive browser session (browser persists across commands)").option("-n, --name <name>", "Session name").option("-w, --wait-for <selector>", "Wait for selector before considering page ready").option("--sandbox", "Show visible browser window (default: headless)").option("--debug", "Visible browser + slow motion + devtools").option("--low-memory", "Reduce memory usage for lower-powered machines (4GB RAM)").option("--auto-capture", "Auto-capture screenshot + scan after every interaction").action(async (url, options) => {
  try {
    const {
      startBrowserServer: startBrowserServer2,
      isServerRunning: isServerRunning2,
      PersistentSession: PersistentSession2
    } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const resolvedUrl = await resolveBaseUrl(url);
    const headless = !options.sandbox && !options.debug;
    const serverRunning = await isServerRunning2(outputDir);
    if (!serverRunning) {
      const modeLabel = options.lowMemory ? " (low-memory mode)" : "";
      console.log(headless ? `Starting headless browser server${modeLabel}...` : `Starting visible browser server${modeLabel}...`);
      const { driver: driver3 } = await startBrowserServer2(outputDir, {
        headless,
        debug: options.debug,
        isolated: true,
        // Prevents conflicts with Playwright MCP
        lowMemory: options.lowMemory
      });
      const session = await PersistentSession2.create(outputDir, {
        url: resolvedUrl,
        name: options.name,
        waitFor: options.waitFor,
        viewport: VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop
      });
      console.log("");
      console.log(`Session started: ${session.id}`);
      console.log(`URL: ${session.url}`);
      console.log("");
      console.log("Available commands (run in another terminal):");
      console.log(`  npx ibr session:click ${session.id} "<selector>"`);
      console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
      console.log(`  npx ibr session:screenshot ${session.id}`);
      console.log(`  npx ibr session:scan ${session.id}          # structured scan data`);
      console.log(`  npx ibr session:capture ${session.id}        # screenshot + scan together`);
      console.log(`  npx ibr session:wait ${session.id} "<selector>"`);
      console.log("");
      if (options.autoCapture) {
        console.log("Auto-capture: ON (screenshot + scan after every interaction)");
        console.log("");
      }
      console.log("To close: npx ibr session:close all");
      console.log("");
      console.log("Browser server running. Press Ctrl+C to stop.");
      await new Promise((resolve5) => {
        const cleanup = async () => {
          console.log("\nShutting down browser server...");
          await driver3.close();
          resolve5();
        };
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
      });
    } else {
      console.log("Connecting to existing browser server...");
      const session = await PersistentSession2.create(outputDir, {
        url: resolvedUrl,
        name: options.name,
        waitFor: options.waitFor,
        viewport: VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop
      });
      console.log("");
      console.log(`Session started: ${session.id}`);
      console.log(`URL: ${session.url}`);
      console.log("");
      console.log("Use session commands to interact:");
      console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
      console.log(`  npx ibr session:click ${session.id} "<selector>"`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
async function getSession2(outputDir, sessionId) {
  const { PersistentSession: PersistentSession2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
  if (!await isServerRunning2(outputDir)) {
    console.error("No browser server running.");
    console.log("");
    console.log("Start one with:");
    console.log("  npx ibr session:start <url>");
    console.log("");
    console.log("The first session:start launches the server and keeps it alive.");
    console.log("Run session commands in a separate terminal.");
    process.exit(1);
  }
  const session = await PersistentSession2.get(outputDir, sessionId);
  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    console.log("");
    console.log("This can happen if:");
    console.log("  1. The session ID is incorrect");
    console.log("  2. The session was created with a different browser server");
    console.log("");
    console.log("List sessions with: npx ibr session:list");
    process.exit(1);
  }
  return session;
}
program.command("session:click <sessionId> <selector>").description("Click an element in an active session (auto-targets visible elements)").option("--force", "Force click, bypassing overlay interception checks").action(async (sessionId, selector, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "click",
    sessionId,
    command: `session:click ${sessionId} "${selector}"${options.force ? " --force" : ""}`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    await session.click(selector, { force: options.force });
    console.log(`Clicked: ${selector}${options.force ? " (forced)" : ""}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    if (msg.includes("intercept") || msg.includes("pointer-events")) {
      console.log("Tip: Element is blocked by an overlay (modal, backdrop, etc.)");
      console.log("     Use --force to click through, or dismiss the overlay first");
      console.log("     npx ibr session:click " + sessionId + ' "' + selector + '" --force');
    } else if (msg.includes("not visible") || msg.includes("Timeout")) {
      console.log("Tip: IBR auto-filters to visible elements. Element may be:");
      console.log("     - Hidden by CSS (display:none, visibility:hidden)");
      console.log("     - Off-screen or zero-sized");
      console.log('     Use session:html --selector "' + selector + '" to inspect');
    } else {
      console.log("Tip: Session is still active. Use session:html to inspect the DOM.");
    }
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:type <sessionId> <selector> <text>").description("Type text into an element in an active session").option("--delay <ms>", "Delay between keystrokes", "0").option("--submit", "Press Enter after typing (waits for network idle)").option("--wait-after <ms>", "Wait this long after typing/submitting before next command").option("--append", "Append to existing content without clearing").action(async (sessionId, selector, text, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "type",
    sessionId,
    command: `session:type ${sessionId} "${selector}" "${text.slice(0, 20)}..."`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    await session.type(selector, text, {
      delay: parseInt(options.delay, 10),
      submit: options.submit,
      waitAfter: options.waitAfter ? parseInt(options.waitAfter, 10) : void 0,
      append: options.append
    });
    const action = options.append ? "Appended" : options.submit ? "Typed and submitted" : "Typed";
    console.log(`${action}: "${text.length > 20 ? text.slice(0, 20) + "..." : text}" into: ${selector}`);
    if (options.submit) {
      console.log("Waited for network idle after submit");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    if (msg.includes("not visible") || msg.includes("multiple elements")) {
      console.log("Tip: IBR auto-filters to visible elements. If still failing:");
      console.log("     - Use session:html to inspect the DOM");
      console.log("     - Try a more specific selector (add class, id, or attribute)");
    } else {
      console.log("Tip: Session is still active. Use session:html to inspect the page.");
    }
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:press <sessionId> <key>").description("Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)").action(async (sessionId, key) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    await session.press(key);
    console.log(`Pressed: ${key}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    console.log("Tip: Valid keys include: Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Space");
  }
});
program.command("session:scroll <sessionId> <direction> [amount]").description("Scroll the page or a container (direction: up, down, left, right)").option("-s, --selector <css>", "Scroll within a specific container (modal, sidebar, etc.)").action(async (sessionId, direction, amount, options) => {
  const validDirections = ["up", "down", "left", "right"];
  if (!validDirections.includes(direction)) {
    console.error(`Error: Invalid direction "${direction}"`);
    console.log(`Valid directions: ${validDirections.join(", ")}`);
    process.exit(1);
  }
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const pixels = amount ? parseInt(amount, 10) : 500;
    const position = await session.scroll(direction, pixels, { selector: options?.selector });
    if (options?.selector) {
      console.log(`Scrolled ${direction} ${pixels}px in: ${options.selector}`);
    } else {
      console.log(`Scrolled ${direction} ${pixels}px`);
    }
    console.log(`Position: x=${position.x}, y=${position.y}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    if (options?.selector) {
      console.log("");
      console.log("Tip: The container may not exist or may not be scrollable.");
      console.log("     Check: overflow-y: auto/scroll, or that content exceeds container bounds.");
    }
  }
});
program.command("session:screenshot <sessionId>").description("Take a screenshot and audit interactive elements").option("-n, --name <name>", "Screenshot name").option("-s, --selector <css>", "CSS selector to capture specific element").option("--no-full-page", "Capture only the viewport").option("--viewport-only", "Capture only viewport (alias for --no-full-page)").option("--json", "Output audit results as JSON").action(async (sessionId, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "screenshot",
    sessionId,
    command: `session:screenshot ${sessionId}${options.name ? ` --name ${options.name}` : ""}`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const fullPage = options.viewportOnly ? false : options.fullPage;
    const { path: path2, elements, audit } = await session.screenshot({
      name: options.name,
      selector: options.selector,
      fullPage
    });
    if (options.json) {
      console.log(JSON.stringify({ path: path2, elements, audit }, null, 2));
    } else {
      console.log(`Screenshot saved: ${path2}`);
      console.log("");
      console.log("Element Audit:");
      console.log(`  Total elements: ${audit.totalElements}`);
      console.log(`  Interactive: ${audit.interactiveCount}`);
      console.log(`  With handlers: ${audit.withHandlers}`);
      console.log(`  Without handlers: ${audit.withoutHandlers}`);
      if (audit.issues.length > 0) {
        console.log("");
        console.log("Issues detected:");
        for (const issue of audit.issues) {
          const icon = issue.severity === "error" ? "\u2717" : issue.severity === "warning" ? "!" : "i";
          console.log(`  ${icon} [${issue.type}] ${issue.message}`);
        }
      } else {
        console.log("");
        console.log("No issues detected.");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Try without --selector for full page.");
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:scan <sessionId>").description("Run full IBR scan against the live session page (no new browser)").option("--json", "Output as JSON").action(async (sessionId, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const result = await session.scanPage();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const { formatScanResult: formatScanResult2 } = await Promise.resolve().then(() => (init_scan(), scan_exports));
      console.log(formatScanResult2(result));
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
});
program.command("session:capture <sessionId>").description("Combined screenshot + scan capture (visual + structured data together)").option("-l, --label <label>", "Label for this capture step").option("-k, --keep", "Keep screenshot after session close (default: archive)").option("--json", "Output as JSON").action(async (sessionId, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const result = await session.capture({
      label: options.label,
      keep: options.keep || false
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Capture #${result.step}: ${result.action}`);
      console.log(`  Screenshot: ${result.screenshot}${result.keep ? " (kept)" : " (ephemeral)"}`);
      console.log(`  Verdict:    ${result.scan.verdict}`);
      console.log(`  Elements:   ${result.scan.elements.audit.totalElements} (${result.scan.elements.audit.interactiveCount} interactive)`);
      console.log(`  Handlers:   ${result.scan.elements.audit.withHandlers}/${result.scan.elements.audit.interactiveCount} wired`);
      console.log(`  Page:       ${result.scan.semantic.pageIntent.intent} (${(result.scan.semantic.confidence * 100).toFixed(0)}%)`);
      if (result.scan.console.errors.length > 0) {
        console.log(`  Console:    ${result.scan.console.errors.length} errors`);
      }
      if (result.scan.issues.length > 0) {
        console.log("");
        console.log("  Issues:");
        for (const issue of result.scan.issues.slice(0, 5)) {
          const icon = issue.severity === "error" ? "  \u2717" : issue.severity === "warning" ? "  !" : "  i";
          console.log(`  ${icon} [${issue.category}] ${issue.description}`);
        }
        if (result.scan.issues.length > 5) {
          console.log(`    ... and ${result.scan.issues.length - 5} more`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
});
program.command("session:wait <sessionId> <selectorOrMs>").description("Wait for a selector to appear or a duration (in ms)").action(async (sessionId, selectorOrMs) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "wait",
    sessionId,
    command: `session:wait ${sessionId} "${selectorOrMs}"`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const isNumber = /^\d+$/.test(selectorOrMs);
    if (isNumber) {
      await session.waitFor(parseInt(selectorOrMs, 10));
      console.log(`Waited ${selectorOrMs}ms`);
    } else {
      await session.waitFor(selectorOrMs);
      console.log(`Found: ${selectorOrMs}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Element may not exist yet or selector is wrong.");
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:navigate <sessionId> <url>").description("Navigate to a new URL in an active session").option("-w, --wait-for <selector>", "Wait for selector after navigation").action(async (sessionId, url, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "navigate",
    sessionId,
    command: `session:navigate ${sessionId} "${url}"`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    await session.navigate(url, { waitFor: options.waitFor });
    console.log(`Navigated to: ${url}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Check URL or try without --wait-for.");
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:list").description("List all active interactive sessions").action(async () => {
  try {
    const { isServerRunning: isServerRunning2, listActiveSessions: listActiveSessions2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const serverRunning = await isServerRunning2(outputDir);
    const sessions = await listActiveSessions2(outputDir);
    console.log(`Browser server: ${serverRunning ? "running" : "not running"}`);
    console.log("");
    if (sessions.length === 0) {
      console.log("No sessions found.");
      console.log("");
      console.log("Start one with:");
      console.log("  npx ibr session:start <url>");
      return;
    }
    console.log("Sessions:");
    for (const id of sessions) {
      console.log(`  ${id}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:pending").description("List pending operations (useful before session:close all)").option("--json", "Output as JSON").action(async (options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const pending = await getPendingOperations(outputDir);
    if (options.json) {
      console.log(JSON.stringify(pending, null, 2));
      return;
    }
    if (pending.length === 0) {
      console.log("No pending operations.");
      console.log("");
      console.log("Safe to close browser server:");
      console.log("  npx ibr session:close all");
      return;
    }
    console.log(`${pending.length} pending operation(s):`);
    console.log("");
    console.log(formatPendingOperations(pending));
    console.log("");
    console.log("Wait for these to complete, or use:");
    console.log("  npx ibr session:close all --force");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:close <sessionId>").description('Close a session (use "all" to stop browser server)').option("--force", "Skip waiting for pending operations").option("--wait-timeout <ms>", "Max wait time for pending operations (default: 30000)", "30000").action(async (sessionId, options) => {
  try {
    const { stopBrowserServer: stopBrowserServer2, PersistentSession: PersistentSession2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    if (sessionId === "all") {
      const pending = await getPendingOperations(outputDir);
      if (pending.length > 0 && !options.force) {
        console.log(`Found ${pending.length} pending operation(s):`);
        console.log(formatPendingOperations(pending));
        console.log("");
        console.log(`Waiting for completion (timeout: ${options.waitTimeout}ms)...`);
        console.log("Use --force to skip waiting");
        console.log("");
        const completed = await waitForCompletion(outputDir, {
          timeout: parseInt(options.waitTimeout, 10),
          onProgress: (remaining) => {
            process.stdout.write(`\rWaiting for ${remaining} operation(s)...`);
          }
        });
        console.log("");
        if (!completed) {
          const remaining = await getPendingOperations(outputDir);
          console.log(`Timeout reached. ${remaining.length} operation(s) still pending.`);
          console.log("Use --force to close anyway, or wait for operations to complete.");
          process.exit(1);
        }
        console.log("All operations completed.");
      }
      const stopped = await stopBrowserServer2(outputDir);
      if (stopped) {
        console.log("Browser server stopped. All sessions closed.");
      } else {
        console.log("No browser server running.");
      }
      return;
    }
    if (!await isServerRunning2(outputDir)) {
      console.log("No browser server running.");
      return;
    }
    const session = await PersistentSession2.get(outputDir, sessionId);
    if (session) {
      await session.close();
      console.log(`Session closed: ${sessionId}`);
    } else {
      console.log(`Session not found: ${sessionId}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:html <sessionId>").description("Get the full page HTML/DOM structure").option("-s, --selector <css>", "Get HTML of specific element only").action(async (sessionId, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    if (options.selector) {
      const escapedSelector = options.selector.replace(/'/g, "\\'");
      const html = await session.evaluate(`(() => {
          const el = document.querySelector('${escapedSelector}');
          return el ? el.outerHTML : null;
        })()`);
      if (html) {
        console.log(html);
      } else {
        console.error(`Element not found: ${options.selector}`);
        process.exit(1);
      }
    } else {
      const html = await session.content();
      console.log(html);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:text <sessionId> <selector>").description("Get text content from a specific element").option("-a, --all", "Get text from all matching elements").action(async (sessionId, selector, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    if (options.all) {
      const texts = await session.allTextContent(selector);
      if (texts.length === 0) {
        console.error(`No elements found: ${selector}`);
        process.exit(1);
      }
      texts.forEach((text, i) => {
        console.log(`[${i + 1}] ${text}`);
      });
    } else {
      const text = await session.textContent(selector);
      if (text === null) {
        console.error(`Element not found: ${selector}`);
        process.exit(1);
      }
      console.log(text.trim());
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:eval <sessionId> <script>").description("Execute JavaScript in the browser context").option("--json", "Output result as JSON").action(async (sessionId, script, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const result = await session.evaluate(script);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result === void 0) {
      console.log("[undefined]");
    } else if (result === null) {
      console.log("[null]");
    } else if (typeof result === "object") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    console.log("Tip: Script must be valid JavaScript. Examples:");
    console.log('  npx ibr session:eval <id> "document.title"');
    console.log(`  npx ibr session:eval <id> "document.querySelectorAll('.item').length"`);
    console.log('  npx ibr session:eval <id> "window.scrollY"');
    process.exit(1);
  }
});
program.command("session:actions <sessionId>").description("Show action history for a session").action(async (sessionId) => {
  try {
    const { liveSessionManager: liveSessionManager2 } = await Promise.resolve().then(() => (init_live_session(), live_session_exports));
    const session = liveSessionManager2.get(sessionId);
    if (!session) {
      console.error(`Session not found or not active: ${sessionId}`);
      process.exit(1);
    }
    const actions = session.actions;
    console.log(`Actions for ${sessionId}:`);
    console.log("");
    for (const action of actions) {
      const icon = action.success ? "\u2713" : "\u2717";
      const duration = action.duration ? `(${action.duration}ms)` : "";
      console.log(`  ${icon} ${action.type} ${duration}`);
      if (action.params) {
        const params = Object.entries(action.params).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ");
        console.log(`      ${params}`);
      }
      if (!action.success && action.error) {
        console.log(`      Error: ${action.error}`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:modal <sessionId>").description("Detect and optionally dismiss active modals").option("--dismiss", "Attempt to dismiss the modal").action(async (sessionId, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    setActiveSession(session);
    const modal = await session.detectModal();
    if (!modal.hasModal) {
      console.log("No modal detected");
      return;
    }
    console.log(`Modal detected: ${modal.selector}`);
    console.log(`Dismiss method: ${modal.dismissMethod}`);
    if (modal.closeButtonSelector) {
      console.log(`Close button: ${modal.closeButtonSelector}`);
    }
    if (options.dismiss) {
      console.log("");
      console.log("Attempting to dismiss...");
      if (modal.dismissMethod === "close-button" && modal.closeButtonSelector) {
        await session.click(modal.closeButtonSelector, { force: true });
      } else {
        await session.press("Escape");
      }
      await session.waitFor(300);
      const stillOpen = await session.detectModal();
      if (stillOpen.hasModal) {
        console.log("Warning: Modal may still be open. Try:");
        console.log(`  npx ibr session:press ${sessionId} Escape`);
        console.log(`  npx ibr session:click ${sessionId} ".backdrop" --force`);
      } else {
        console.log("Modal dismissed successfully");
      }
    } else {
      console.log("");
      console.log("To dismiss, run:");
      console.log(`  npx ibr session:modal ${sessionId} --dismiss`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:list [sessionId]").description("List screenshots for a session or all sessions").option("--json", "Output as JSON").action(async (sessionId, options) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3, formatAge: formatAge2 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir);
    const screenshots = sessionId ? await manager.list(sessionId) : await manager.listAll();
    if (screenshots.length === 0) {
      console.log("No screenshots found.");
      return;
    }
    if (options.json) {
      console.log(JSON.stringify(screenshots, null, 2));
      return;
    }
    console.log(`Found ${screenshots.length} screenshot(s):`);
    console.log("");
    console.log("PATH                                           SIZE       AGE");
    console.log("-".repeat(70));
    for (const shot of screenshots) {
      const shortPath = shot.path.length > 45 ? "..." + shot.path.slice(-42) : shot.path.padEnd(45);
      console.log(`${shortPath} ${formatBytes3(shot.size).padStart(10)} ${formatAge2(shot.ageMs).padStart(10)}`);
    }
    const usage = await manager.getStorageUsage();
    console.log("");
    console.log(`Total: ${formatBytes3(usage.totalBytes)} across ${usage.fileCount} files`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:cleanup").description("Clean up old screenshots based on retention policy").option("--max-age <days>", "Delete screenshots older than N days", "7").option("--max-size <mb>", "Max total storage in MB", "500").option("--dry-run", "Show what would be deleted without deleting").action(async (options) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir, {
      maxAgeDays: parseInt(options.maxAge, 10),
      maxSizeBytes: parseInt(options.maxSize, 10) * 1024 * 1024,
      retentionPolicy: "both"
    });
    console.log(`Cleanup policy: max ${options.maxAge} days, max ${options.maxSize}MB`);
    console.log("");
    const report = await manager.cleanup({ dryRun: options.dryRun });
    if (options.dryRun) {
      console.log("DRY RUN - no files deleted");
      console.log("");
    }
    console.log(`Scanned: ${report.scanned} files`);
    console.log(`${options.dryRun ? "Would delete" : "Deleted"}: ${report.deleted} files`);
    console.log(`Space ${options.dryRun ? "to be freed" : "freed"}: ${formatBytes3(report.bytesFreed)}`);
    console.log(`Kept: ${report.kept} files`);
    if (report.errors.length > 0) {
      console.log("");
      console.log("Errors:");
      for (const err of report.errors) {
        console.log(`  ${err}`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:view <path>").description("View a screenshot with metadata").action(async (path2) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir);
    const metadata = await manager.getMetadata(path2);
    if (!metadata) {
      console.error(`Screenshot not found: ${path2}`);
      process.exit(1);
    }
    console.log("Screenshot Metadata:");
    console.log(`  Path: ${metadata.path}`);
    console.log(`  Size: ${formatBytes3(metadata.size)}`);
    console.log(`  Created: ${metadata.createdAt}`);
    if (metadata.sessionId) console.log(`  Session: ${metadata.sessionId}`);
    if (metadata.step) console.log(`  Step: ${metadata.step}`);
    if (metadata.query) console.log(`  Query: ${metadata.query}`);
    if (metadata.userIntent) console.log(`  Intent: ${metadata.userIntent}`);
    console.log("");
    const { exec: exec3 } = await import("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec3(`${cmd} "${path2}"`, (err) => {
      if (err) {
        console.log("Could not open image viewer. File path above.");
      }
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("search-test <url>").description("Run AI search test with screenshots and validation context").option("-q, --query <query>", "Search query to test", "test").option("-i, --intent <intent>", "User intent for validation").option("--results-selector <css>", "CSS selector for results").option("--no-screenshots", "Skip capturing screenshots").option("--json", "Output as JSON").action(async (url, options) => {
  try {
    const { aiSearchFlow: aiSearchFlow2 } = await Promise.resolve().then(() => (init_search(), search_exports));
    const { generateValidationContext: generateValidationContext2, generateValidationPrompt: generateValidationPrompt2, analyzeForObviousIssues: analyzeForObviousIssues2 } = await Promise.resolve().then(() => (init_search_validation(), search_validation_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const { mkdir: mkdir26 } = await import("fs/promises");
    console.log(`Testing search on ${url}...`);
    console.log(`Query: "${options.query}"`);
    if (options.intent) console.log(`Intent: ${options.intent}`);
    console.log("");
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const driver3 = new EngineDriver();
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    const page = new CompatPage(driver3);
    await page.goto(url, { waitUntil: "networkidle", timeout: 3e4 });
    const sessionDir = (0, import_path32.join)(outputDir, "sessions", `search-${Date.now()}`);
    await mkdir26(sessionDir, { recursive: true });
    const result = await aiSearchFlow2(page, {
      query: options.query,
      userIntent: options.intent || `Find results related to: ${options.query}`,
      resultsSelector: options.resultsSelector,
      captureSteps: options.screenshots !== false,
      extractContent: true,
      sessionDir
    });
    await driver3.close();
    const validationContext = generateValidationContext2(result);
    const obvIssues = analyzeForObviousIssues2(validationContext);
    if (options.json) {
      console.log(JSON.stringify({
        result,
        validationContext,
        obviousIssues: obvIssues
      }, null, 2));
      return;
    }
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("  SEARCH TEST RESULTS");
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("");
    console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Results found: ${result.resultCount}`);
    console.log("");
    console.log("Timing:");
    console.log(`  Typing: ${result.timing.typing}ms`);
    console.log(`  Waiting: ${result.timing.waiting}ms`);
    console.log(`  Rendering: ${result.timing.rendering}ms`);
    console.log(`  Total: ${result.timing.total}ms`);
    if (result.screenshots.length > 0) {
      console.log("");
      console.log("Screenshots:");
      for (const shot of result.screenshots) {
        console.log(`  ${shot.step}: ${shot.path}`);
      }
    }
    if (result.extractedResults.length > 0) {
      console.log("");
      console.log(`Extracted Results (${result.extractedResults.length}):`);
      for (const r of result.extractedResults.slice(0, 5)) {
        const title = r.title || r.fullText.slice(0, 50);
        console.log(`  ${r.index + 1}. ${title}`);
      }
      if (result.extractedResults.length > 5) {
        console.log(`  ... and ${result.extractedResults.length - 5} more`);
      }
    }
    if (obvIssues.length > 0) {
      console.log("");
      console.log("Potential Issues:");
      for (const issue of obvIssues) {
        const severity = issue.severity.toUpperCase();
        console.log(`  [${severity}] ${issue.description}`);
      }
    }
    console.log("");
    console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.log("VALIDATION CONTEXT FOR CLAUDE CODE:");
    console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.log("");
    console.log(generateValidationPrompt2(validationContext));
    if (result.artifactDir) {
      console.log("");
      console.log(`Artifacts saved to: ${result.artifactDir}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("discover [url]").description("Discover pages (auto-detects dev server if no URL)").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").option("-f, --format <format>", "Output format: json, text", "text").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    console.log(`Scanning ${resolvedUrl}...`);
    console.log("");
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(resolvedUrl);
      console.log(`Found ${pages.length} navigation links:`);
    } else {
      const result = await discoverPages2({
        url: resolvedUrl,
        maxPages: parseInt(options.maxPages, 10),
        pathPrefix: options.prefix
      });
      pages = result.pages;
      console.log(`Discovered ${pages.length} pages (${result.crawlTime}ms):`);
    }
    console.log("");
    if (options.format === "json") {
      console.log(JSON.stringify(pages, null, 2));
    } else {
      for (const page of pages) {
        console.log(`  ${page.path}`);
        console.log(`    Title: ${page.title}`);
        if (page.linkText && page.linkText !== page.title) {
          console.log(`    Link: ${page.linkText}`);
        }
        console.log("");
      }
    }
    console.log("To capture baselines for these pages:");
    console.log(`  npx ibr scan-start`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan-start [url]").description("Discover pages and capture baselines (auto-detects dev server if no URL)").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const ibr = await createIBR(program.opts());
    console.log(`Scanning ${resolvedUrl}...`);
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(resolvedUrl);
    } else {
      const result = await discoverPages2({
        url: resolvedUrl,
        maxPages: parseInt(options.maxPages, 10),
        pathPrefix: options.prefix
      });
      pages = result.pages;
    }
    console.log(`Found ${pages.length} pages. Capturing baselines...`);
    console.log("");
    const sessions = [];
    for (const page of pages) {
      try {
        console.log(`Capturing: ${page.path}`);
        const result = await ibr.startSession(page.url, {
          name: page.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 50)
        });
        sessions.push({ page, sessionId: result.sessionId });
        console.log(`  Done: ${result.sessionId}`);
      } catch (error) {
        console.log(`  Failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log("");
    console.log(`Captured ${sessions.length}/${pages.length} pages.`);
    console.log("");
    console.log("Next: Make your changes, then run:");
    console.log("  npx ibr scan-check");
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan-check").description("Compare all sessions from the last scan-start").option("-f, --format <format>", "Output format: json, text, minimal", "text").action(async (_options) => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    const recentSessions = sessions.filter((s) => {
      const age = Date.now() - new Date(s.createdAt).getTime();
      return age < 60 * 60 * 1e3 && s.status === "baseline";
    });
    if (recentSessions.length === 0) {
      console.log("No recent baseline sessions found. Run scan-start first.");
      return;
    }
    console.log(`Checking ${recentSessions.length} sessions...`);
    console.log("");
    const results = [];
    for (const session of recentSessions) {
      try {
        console.log(`Checking: ${session.name}`);
        const report = await ibr.check(session.id);
        results.push({ session, report });
        const icon = report.analysis.verdict === "MATCH" ? "\u2713" : report.analysis.verdict === "EXPECTED_CHANGE" ? "~" : report.analysis.verdict === "UNEXPECTED_CHANGE" ? "!" : "\u2717";
        console.log(`  ${icon} ${report.analysis.verdict}: ${report.analysis.summary}`);
      } catch (error) {
        console.log(`  \u2717 Failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log("");
    const matches = results.filter((r) => r.report.analysis.verdict === "MATCH").length;
    const expected = results.filter((r) => r.report.analysis.verdict === "EXPECTED_CHANGE").length;
    const unexpected = results.filter((r) => r.report.analysis.verdict === "UNEXPECTED_CHANGE").length;
    const broken = results.filter((r) => r.report.analysis.verdict === "LAYOUT_BROKEN").length;
    console.log("Summary:");
    console.log(`  \u2713 Match: ${matches}`);
    console.log(`  ~ Expected: ${expected}`);
    console.log(`  ! Unexpected: ${unexpected}`);
    console.log(`  \u2717 Broken: ${broken}`);
    if (unexpected > 0 || broken > 0) {
      console.log("");
      console.log("Issues detected. View in UI:");
      console.log("  npx ibr serve");
    }
    await ibr.close();
    if (broken > 0) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("consistency <url>").description("Check UI consistency across multiple pages (opt-in)").option("-n, --max-pages <count>", "Maximum pages to check", "5").option("--nav-only", "Only check navigation links (faster)").option("--ignore <types>", "Ignore certain checks (layout,typography,color,spacing)", "").option("-f, --format <format>", "Output format: json, text", "text").option("--confirm", "Skip confirmation prompt (for automation/Claude Code)").action(async (url, options) => {
  try {
    if (!options.confirm) {
      console.log("");
      console.log("\u26A0\uFE0F  Consistency Check");
      console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
      console.log("This will analyze UI styles across multiple pages to");
      console.log("detect potential inconsistencies (fonts, colors, spacing).");
      console.log("");
      console.log("Note: Some style differences may be intentional.");
      console.log("");
      console.log("To proceed, run with --confirm flag:");
      console.log(`  npx ibr consistency ${url} --confirm`);
      console.log("");
      console.log("Or for Claude Code automation:");
      console.log(`  npx ibr consistency ${url} --confirm --format json`);
      return;
    }
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const { checkConsistency: checkConsistency2, formatConsistencyReport: formatConsistencyReport2 } = await Promise.resolve().then(() => (init_consistency(), consistency_exports));
    console.log(`Discovering pages from ${url}...`);
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(url);
    } else {
      const result2 = await discoverPages2({
        url,
        maxPages: parseInt(options.maxPages, 10)
      });
      pages = result2.pages;
    }
    if (pages.length < 2) {
      console.log("Need at least 2 pages to check consistency.");
      return;
    }
    console.log(`Found ${pages.length} pages. Analyzing styles...`);
    console.log("");
    const urls = pages.map((p) => p.url);
    const ignore = options.ignore ? options.ignore.split(",") : [];
    const result = await checkConsistency2({
      urls,
      ignore
    });
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatConsistencyReport2(result));
    }
    if (result.score < 50) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("diagnose [url]").description("Diagnose page load issues (auto-detects dev server if no URL)").option("--timeout <ms>", "Timeout in milliseconds", "30000").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { captureWithDiagnostics: captureWithDiagnostics2, closeBrowser: closeBrowser3 } = await Promise.resolve().then(() => (init_capture(), capture_exports));
    const { join: join29 } = await import("path");
    const outputDir = program.opts().output || "./.ibr";
    console.log(`Diagnosing ${resolvedUrl}...`);
    console.log("");
    const result = await captureWithDiagnostics2({
      url: resolvedUrl,
      outputPath: join29(outputDir, "diagnose", "test.png"),
      timeout: parseInt(options.timeout, 10),
      outputDir
    });
    await closeBrowser3();
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("  PAGE DIAGNOSTICS");
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("");
    if (result.success) {
      console.log("\u2713 Page loaded successfully");
      console.log("");
    } else {
      console.log("\u2717 Page failed to load");
      console.log(`  Error: ${result.error?.message}`);
      console.log(`  Suggestion: ${result.error?.suggestion}`);
      console.log("");
    }
    console.log("Timing:");
    console.log(`  Navigation: ${result.timing.navigationMs}ms`);
    console.log(`  Render: ${result.timing.renderMs}ms`);
    console.log(`  Total: ${result.timing.totalMs}ms`);
    console.log("");
    if (result.diagnostics.httpStatus) {
      console.log(`HTTP Status: ${result.diagnostics.httpStatus}`);
    }
    if (result.diagnostics.consoleErrors.length > 0) {
      console.log("");
      console.log("Console Errors:");
      for (const err of result.diagnostics.consoleErrors.slice(0, 5)) {
        console.log(`  \u2022 ${err.substring(0, 100)}${err.length > 100 ? "..." : ""}`);
      }
      if (result.diagnostics.consoleErrors.length > 5) {
        console.log(`  ... and ${result.diagnostics.consoleErrors.length - 5} more`);
      }
    }
    if (result.diagnostics.networkErrors.length > 0) {
      console.log("");
      console.log("Network Errors:");
      for (const err of result.diagnostics.networkErrors.slice(0, 5)) {
        console.log(`  \u2022 ${err.substring(0, 100)}${err.length > 100 ? "..." : ""}`);
      }
      if (result.diagnostics.networkErrors.length > 5) {
        console.log(`  ... and ${result.diagnostics.networkErrors.length - 5} more`);
      }
    }
    if (result.diagnostics.suggestions.length > 0) {
      console.log("");
      console.log("Suggestions:");
      for (const suggestion of result.diagnostics.suggestions) {
        console.log(`  \u2192 ${suggestion}`);
      }
    }
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
async function isPortInUse(port) {
  return new Promise((resolve5) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", () => resolve5(true));
    server.once("listening", () => {
      server.close();
      resolve5(false);
    });
    server.listen(port, "127.0.0.1");
  });
}
async function findAvailablePortFromList(ports) {
  for (const port of ports) {
    if (!await isPortInUse(port)) {
      return port;
    }
  }
  return null;
}
var DEV_SERVER_PORTS = [3e3, 3001, 5173, 5174, 4200, 8080, 8e3, 5e3, 3100, 4321];
async function detectDevServer() {
  for (const port of DEV_SERVER_PORTS) {
    if (await isPortInUse(port)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1e3);
        await fetch(`http://localhost:${port}`, {
          signal: controller.signal,
          method: "HEAD"
        });
        clearTimeout(timeout);
        return `http://localhost:${port}`;
      } catch {
        continue;
      }
    }
  }
  return null;
}
async function resolveBaseUrl(providedUrl) {
  if (providedUrl) {
    return providedUrl;
  }
  const config = await loadConfig();
  if (config.baseUrl) {
    return config.baseUrl;
  }
  const detected = await detectDevServer();
  if (detected) {
    console.log(`Auto-detected dev server: ${detected}`);
    return detected;
  }
  throw new Error("No URL provided and no dev server detected. Start your dev server or specify a URL.");
}
program.command("init").description("Initialize IBR config and optionally register Claude Code plugin").option("-p, --port <port>", "Port for baseUrl (auto-detects available port if not specified)").option("-u, --url <url>", "Full base URL (overrides port)").option("--skip-plugin", "Skip Claude Code plugin registration prompt").action(async (options) => {
  const { writeFile: writeFile20, readFile: readFile23, mkdir: mkdir26 } = await import("fs/promises");
  const configPath = (0, import_path32.join)(process.cwd(), ".ibrrc.json");
  const claudeSettingsPath = (0, import_path32.join)(process.cwd(), ".claude", "settings.json");
  let configCreated = false;
  if (!(0, import_fs17.existsSync)(configPath)) {
    let baseUrl;
    if (options.url) {
      baseUrl = options.url;
    } else if (options.port) {
      baseUrl = `http://localhost:${options.port}`;
    } else {
      const preferredPort = 5e3;
      const fallbackPorts = [5050, 5555, 4200, 4321, 6789, 7777];
      if (!await isPortInUse(preferredPort)) {
        baseUrl = `http://localhost:${preferredPort}`;
        console.log(`Using default port ${preferredPort}`);
      } else {
        console.log(`Port ${preferredPort} in use, finding alternative...`);
        const availablePort = await findAvailablePortFromList(fallbackPorts);
        if (availablePort) {
          baseUrl = `http://localhost:${availablePort}`;
          console.log(`Auto-selected port ${availablePort}`);
        } else {
          baseUrl = "http://localhost:YOUR_PORT";
          console.log("All candidate ports in use. Please edit baseUrl in .ibrrc.json");
        }
      }
    }
    const config = {
      baseUrl,
      outputDir: "./.ibr",
      viewport: "desktop",
      threshold: 1,
      fullPage: true,
      retention: {
        maxSessions: 20,
        maxAgeDays: 7,
        keepFailed: true,
        autoClean: true
      }
    };
    await writeFile20(configPath, JSON.stringify(config, null, 2));
    configCreated = true;
    console.log("");
    console.log("Created .ibrrc.json");
    console.log("");
    console.log("Configuration:");
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(".ibrrc.json already exists.");
  }
  if (options.skipPlugin) {
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl to match your dev server.");
    }
    return;
  }
  const claudeDirExists = (0, import_fs17.existsSync)((0, import_path32.join)(process.cwd(), ".claude"));
  const hasClaudeSettings = (0, import_fs17.existsSync)(claudeSettingsPath);
  const possiblePluginPaths = [
    "node_modules/@tyroneross/interface-built-right/plugin",
    "node_modules/interface-built-right/plugin",
    "./plugin"
    // if running from IBR repo
  ];
  let pluginPath = null;
  for (const p of possiblePluginPaths) {
    if ((0, import_fs17.existsSync)((0, import_path32.join)(process.cwd(), p))) {
      pluginPath = p;
      break;
    }
  }
  if (!pluginPath) {
    console.log("");
    console.log("IBR plugin path not found. Skipping Claude Code integration.");
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl to match your dev server.");
    }
    return;
  }
  let settings = { plugins: [] };
  if (hasClaudeSettings) {
    try {
      const content = await readFile23(claudeSettingsPath, "utf-8");
      settings = JSON.parse(content);
      if (!settings.plugins) {
        settings.plugins = [];
      }
    } catch {
      settings = { plugins: [] };
    }
    const alreadyRegistered = (settings.plugins ?? []).some(
      (p) => p.includes("interface-built-right/plugin") || p === pluginPath
    );
    if (alreadyRegistered) {
      console.log("");
      console.log("IBR plugin already registered in Claude Code.");
      if (configCreated) {
        console.log("");
        console.log("Edit baseUrl to match your dev server.");
      }
      return;
    }
  }
  console.log("");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  CLAUDE CODE PLUGIN");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("");
  console.log("IBR includes a Claude Code plugin for AI-assisted visual testing:");
  console.log("");
  console.log("  /ibr:snapshot  - Capture baseline with one command");
  console.log("  /ibr:compare   - Visual diff without leaving conversation");
  console.log("  /ibr:ui        - Open comparison viewer");
  console.log("");
  console.log("Benefits:");
  console.log("  \u2022 Validate UI matches user intent with structured data");
  console.log("  \u2022 AI understands page semantics (intent, state, landmarks)");
  console.log("  \u2022 Automatic suggestions when UI files change");
  console.log("");
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const answer = await new Promise((resolve5) => {
    rl.question("Register IBR plugin for Claude Code? [Y/n] ", (ans) => {
      rl.close();
      resolve5(ans.trim().toLowerCase());
    });
  });
  if (answer === "n" || answer === "no") {
    console.log("");
    console.log("Skipped plugin registration.");
    console.log("");
    console.log("To register later, add to .claude/settings.json:");
    console.log(`  "plugins": ["${pluginPath}"]`);
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl in .ibrrc.json to match your dev server.");
    }
    return;
  }
  try {
    if (!claudeDirExists) {
      await mkdir26((0, import_path32.join)(process.cwd(), ".claude"), { recursive: true });
    }
    settings.plugins = settings.plugins || [];
    settings.plugins.push(pluginPath);
    await writeFile20(claudeSettingsPath, JSON.stringify(settings, null, 2));
    console.log("");
    console.log("IBR plugin registered.");
    console.log("");
    console.log("Restart Claude Code to activate. Then use:");
    console.log("  /ibr:snapshot <url>  - Capture baseline");
    console.log("  /ibr:compare         - Compare after changes");
  } catch (err) {
    console.log("");
    console.log("Failed to register plugin:", err instanceof Error ? err.message : err);
    console.log("");
    console.log("To register manually, add to .claude/settings.json:");
    console.log(`  "plugins": ["${pluginPath}"]`);
  }
  if (configCreated) {
    console.log("");
    console.log("Edit baseUrl in .ibrrc.json to match your dev server.");
  }
});
var memoryCmd = program.command("memory").description("Manage UI/UX preferences and memory");
memoryCmd.command("add <description>").description("Add a UI/UX preference").option("--category <category>", "Category: color, layout, typography, navigation, component, spacing, interaction, content", "component").option("--component <type>", "Component type (e.g., button, nav, card)").option("--property <property>", "CSS property or semantic key", "background-color").option("--operator <op>", "Comparison: equals, contains, matches, gte, lte", "equals").option("--value <value>", "Expected value").option("--route <route>", "Scope to route pattern").action(async (description, opts) => {
  const { addPreference: addPreference2, formatPreference: formatPreference2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  if (!opts.value) {
    console.error("Error: --value is required");
    process.exit(1);
  }
  const pref = await addPreference2(program.opts().output || "./.ibr", {
    description,
    category: opts.category,
    componentType: opts.component,
    property: opts.property,
    operator: opts.operator,
    value: opts.value,
    route: opts.route
  });
  console.log("Preference added:");
  console.log(formatPreference2(pref));
});
memoryCmd.command("list").description("List all preferences").option("--category <category>", "Filter by category").option("--route <route>", "Filter by route").action(async (opts) => {
  const { listPreferences: listPreferences2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const prefs = await listPreferences2(program.opts().output || "./.ibr", {
    category: opts.category,
    route: opts.route
  });
  if (prefs.length === 0) {
    console.log("No preferences stored.");
    return;
  }
  for (const pref of prefs) {
    const scope = pref.route ? ` (${pref.route})` : " (global)";
    const conf = pref.confidence < 1 ? ` [${Math.round(pref.confidence * 100)}%]` : "";
    console.log(`  ${pref.id}: ${pref.description}${scope}${conf}`);
  }
});
memoryCmd.command("remove <id>").description("Remove a preference").action(async (id) => {
  const { removePreference: removePreference2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const removed = await removePreference2(program.opts().output || "./.ibr", id);
  console.log(removed ? `Removed: ${id}` : `Not found: ${id}`);
});
memoryCmd.command("show <id>").description("Show full preference detail").action(async (id) => {
  const { getPreference: getPreference2, formatPreference: formatPreference2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const pref = await getPreference2(program.opts().output || "./.ibr", id);
  if (!pref) {
    console.log(`Not found: ${id}`);
    return;
  }
  console.log(formatPreference2(pref));
});
memoryCmd.command("summary").description("Show memory summary and stats").action(async () => {
  const { loadSummary: loadSummary2, formatMemorySummary: formatMemorySummary2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const summary = await loadSummary2(program.opts().output || "./.ibr");
  console.log(formatMemorySummary2(summary));
});
memoryCmd.command("rebuild").description("Force rebuild summary from preference files").action(async () => {
  const { rebuildSummary: rebuildSummary2, formatMemorySummary: formatMemorySummary2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const summary = await rebuildSummary2(program.opts().output || "./.ibr");
  console.log("Summary rebuilt:");
  console.log(formatMemorySummary2(summary));
});
memoryCmd.command("learned").description("Show learned expectations pending promotion").action(async () => {
  const { listLearned: listLearned2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const items = await listLearned2(program.opts().output || "./.ibr");
  if (items.length === 0) {
    console.log("No learned expectations yet.");
    console.log("Approve sessions with ibr check to start learning.");
    return;
  }
  for (const item of items) {
    console.log(`  ${item.id} (from ${item.sessionId}):`);
    for (const obs of item.observations) {
      console.log(`    ${obs.category}: ${obs.description}`);
    }
  }
});
memoryCmd.command("promote <learnedId>").description("Promote learned expectation to preference").action(async (learnedId) => {
  const { promoteToPreference: promoteToPreference2, formatPreference: formatPreference2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
  const pref = await promoteToPreference2(program.opts().output || "./.ibr", learnedId);
  if (!pref) {
    console.log(`Not found or empty: ${learnedId}`);
    return;
  }
  console.log("Promoted to preference:");
  console.log(formatPreference2(pref));
});
program.command("native:devices").description("List available iOS/watchOS simulator devices").option("-p, --platform <platform>", "Filter by platform: ios, watchos").action(async (options) => {
  try {
    const { listDevices: listDevices2, formatDevice: formatDevice2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    let devices = await listDevices2();
    devices = devices.filter((d) => d.isAvailable);
    if (options.platform) {
      devices = devices.filter((d) => d.platform === options.platform);
    }
    if (devices.length === 0) {
      console.log("No available simulators found.");
      return;
    }
    const ios = devices.filter((d) => d.platform === "ios");
    const watchos = devices.filter((d) => d.platform === "watchos");
    if (ios.length > 0) {
      console.log(`iOS (${ios.length}):`);
      for (const d of ios) {
        console.log(`  ${formatDevice2(d)}`);
      }
    }
    if (watchos.length > 0) {
      if (ios.length > 0) console.log("");
      console.log(`watchOS (${watchos.length}):`);
      for (const d of watchos) {
        console.log(`  ${formatDevice2(d)}`);
      }
    }
    const booted = devices.filter((d) => d.state === "Booted");
    console.log("");
    console.log(`Total: ${devices.length} available, ${booted.length} booted`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("native:scan [device]").description("Scan a running simulator for accessibility and design issues").option("--no-screenshot", "Skip screenshot capture").option("--json", "Output as JSON").option("--fix-guide", "Generate actionable fix instructions with source mapping").action(async (device, options) => {
  try {
    const { scanNative: scanNative2, formatNativeScanResult: formatNativeScanResult2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const result = await scanNative2({
      device,
      screenshot: options.screenshot !== false,
      outputDir
    });
    if (options.fixGuide) {
      const { correlateToSource: correlateToSource2 } = await Promise.resolve().then(() => (init_bridge(), bridge_exports));
      const { generateFixGuide: generateFixGuide2 } = await Promise.resolve().then(() => (init_fix_guide(), fix_guide_exports));
      const { annotateScreenshot: annotateScreenshot2 } = await Promise.resolve().then(() => (init_annotate(), annotate_exports));
      const bridgeResult = correlateToSource2(result.elements.all, process.cwd());
      const fixGuide = generateFixGuide2(result, bridgeResult, null);
      if (result.screenshotPath && fixGuide.issues.length > 0) {
        const annotated = await annotateScreenshot2(
          result.screenshotPath,
          fixGuide.issues.map((i) => ({ id: i.id, bounds: i.where.bounds }))
        );
        if (annotated) fixGuide.screenshot = annotated;
      }
      const { mkdirSync, writeFileSync: writeFileSync2 } = await import("fs");
      const guidePath = (0, import_path32.join)(outputDir, "native", "fix-guide.json");
      mkdirSync((0, import_path32.join)(outputDir, "native"), { recursive: true });
      writeFileSync2(guidePath, JSON.stringify(fixGuide, null, 2));
      if (options.json) {
        console.log(JSON.stringify(fixGuide, null, 2));
      } else {
        console.log(formatFixGuide(fixGuide));
      }
    } else if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatNativeScanResult2(result));
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("native:start [device]").description("Capture a native simulator baseline screenshot").option("-n, --name <name>", "Baseline session name").action(async (device, options) => {
  try {
    const { findDevice: findDevice2, getBootedDevices: getBootedDevices2, captureNativeScreenshot: captureNativeScreenshot2, getDeviceViewport: getDeviceViewport2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    const { createSession: createSession2, getSessionPaths: getSessionPaths2 } = await Promise.resolve().then(() => (init_session(), session_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    let resolved;
    if (device) {
      resolved = await findDevice2(device);
      if (!resolved) {
        console.error(`No simulator found matching "${device}".`);
        process.exit(1);
      }
    } else {
      const booted = await getBootedDevices2();
      if (booted.length === 0) {
        console.error("No booted simulators. Boot one first.");
        process.exit(1);
      }
      resolved = booted[0];
    }
    const viewport = getDeviceViewport2(resolved);
    const name = options.name || `native-${resolved.name.replace(/\s+/g, "-").toLowerCase()}`;
    const session = await createSession2(
      outputDir,
      `simulator://${resolved.name}`,
      name,
      viewport,
      resolved.platform
    );
    const paths = getSessionPaths2(outputDir, session.id);
    const captureResult = await captureNativeScreenshot2({
      device: resolved,
      outputPath: paths.baseline
    });
    if (!captureResult.success) {
      console.error(`Screenshot failed: ${captureResult.error}`);
      process.exit(1);
    }
    console.log(`Baseline captured: ${session.id}`);
    console.log(`Device: ${resolved.name} (${resolved.platform})`);
    console.log(`Screenshot: ${paths.baseline}`);
    console.log("");
    console.log("After changes, run:");
    console.log(`  npx ibr native:check ${session.id}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("native:check [sessionId]").description("Compare current simulator state against native baseline").option("-d, --device <device>", "Device name or UDID").action(async (sessionId, options) => {
  try {
    const { findDevice: findDevice2, getBootedDevices: getBootedDevices2, captureNativeScreenshot: captureNativeScreenshot2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    const { listSessions: listSessions2, getSession: getSessionById, getSessionPaths: getSessionPaths2 } = await Promise.resolve().then(() => (init_session(), session_exports));
    const { compare: compareFn } = await Promise.resolve().then(() => (init_index(), index_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    let session;
    if (sessionId) {
      session = await getSessionById(outputDir, sessionId);
      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        process.exit(1);
      }
    } else {
      const sessions = await listSessions2(outputDir);
      session = sessions.find((s) => s.platform === "ios" || s.platform === "watchos");
      if (!session) {
        console.error("No native sessions found. Run native:start first.");
        process.exit(1);
      }
    }
    let resolved;
    if (options.device) {
      resolved = await findDevice2(options.device);
    } else {
      const booted = await getBootedDevices2();
      resolved = booted[0];
    }
    if (!resolved) {
      console.error("No booted simulator found.");
      process.exit(1);
    }
    const paths = getSessionPaths2(outputDir, session.id);
    const captureResult = await captureNativeScreenshot2({
      device: resolved,
      outputPath: paths.current
    });
    if (!captureResult.success) {
      console.error(`Screenshot failed: ${captureResult.error}`);
      process.exit(1);
    }
    const result = await compareFn({
      baselinePath: paths.baseline,
      currentPath: paths.current
    });
    const verdictIcon2 = result.verdict === "MATCH" ? "\u2713" : result.verdict === "EXPECTED_CHANGE" ? "~" : "\u2717";
    console.log(`${verdictIcon2} ${result.verdict}`);
    console.log(`Diff: ${result.diffPercent.toFixed(2)}% (${result.diffPixels} pixels)`);
    console.log(result.summary);
    if (result.recommendation) {
      console.log("");
      console.log(`Recommendation: ${result.recommendation}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan:macos").description("Scan a running macOS native app via Accessibility API").option("--app <name>", 'App name (e.g., "Secrets Vault")').option("--bundle-id <id>", 'Bundle identifier (e.g., "com.secretsvault.app")').option("--pid <pid>", "Process ID").option("--screenshot <path>", "Save screenshot to path").option("--json", "Output as JSON").action(async (options) => {
  try {
    if (process.platform !== "darwin") {
      console.error("Error: scan:macos is only available on macOS");
      process.exit(1);
    }
    if (!options.app && !options.bundleId && !options.pid) {
      console.error("Error: Provide --app, --bundle-id, or --pid to identify the target app");
      process.exit(1);
    }
    const { scanMacOS: scanMacOS2, formatMacOSScanResult: formatMacOSScanResult2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    if (!options.json) {
      console.log(`Scanning macOS app${options.app ? ` "${options.app}"` : ""}...`);
    }
    const result = await scanMacOS2({
      app: options.app,
      bundleId: options.bundleId,
      pid: options.pid ? parseInt(options.pid, 10) : void 0,
      screenshot: options.screenshot ? { path: options.screenshot } : void 0,
      outputDir: program.opts().output || ".ibr"
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatMacOSScanResult2(result));
    }
    if (result.verdict === "FAIL") {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("test-search <url>").description("Test search functionality on a page using the search flow").option("-q, --query <q>", "Search query", "test").option("--expect-count <n>", "Expected minimum result count", "0").option("--results-selector <css>", "CSS selector for result elements").option("--json", "Output as JSON").action(async (url, options) => {
  const driver3 = new EngineDriver();
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const { searchFlow: searchFlow2 } = await Promise.resolve().then(() => (init_search(), search_exports));
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    const page = new CompatPage(driver3);
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    const result = await searchFlow2(page, {
      query: options.query,
      resultsSelector: options.resultsSelector
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`Results found: ${result.resultCount}`);
      console.log(`Has results: ${result.hasResults}`);
      console.log(`Duration: ${result.duration}ms`);
      if (result.error) console.log(`Error: ${result.error}`);
      const expected = parseInt(options.expectCount, 10);
      if (expected > 0 && result.resultCount < expected) {
        console.log(`Expected at least ${expected} results, got ${result.resultCount}`);
      }
    }
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await driver3.close();
  }
});
program.command("test-form <url>").description("Test form submission on a page using the form flow").option("--fill <json>", `JSON object of field name to value pairs, e.g. '{"email":"user@example.com"}'`).option("--submit-button <text>", "Text of the submit button").option("--json", "Output as JSON").action(async (url, options) => {
  const driver3 = new EngineDriver();
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const { formFlow: formFlow2 } = await Promise.resolve().then(() => (init_form(), form_exports));
    let fields = [];
    if (options.fill) {
      try {
        const parsed = JSON.parse(options.fill);
        fields = Object.entries(parsed).map(([name, value]) => ({ name, value }));
      } catch {
        console.error(`Error: --fill must be valid JSON, e.g. '{"email":"user@example.com"}'`);
        process.exit(1);
      }
    }
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    const page = new CompatPage(driver3);
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    const result = await formFlow2(page, {
      fields,
      submitButton: options.submitButton
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`Fields filled: ${result.filledFields.join(", ") || "none"}`);
      if (result.failedFields.length > 0) {
        console.log(`Fields failed: ${result.failedFields.join(", ")}`);
      }
      console.log(`Duration: ${result.duration}ms`);
      if (result.error) console.log(`Error: ${result.error}`);
    }
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await driver3.close();
  }
});
program.command("test-login <url>").description("Test login flow on a page using the login flow").option("--email <email>", "Email or username to log in with").option("--password <password>", "Password to log in with").option("--success-indicator <text>", "Selector or text indicating successful login").option("--json", "Output as JSON").action(async (url, options) => {
  const driver3 = new EngineDriver();
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const { loginFlow: loginFlow2 } = await Promise.resolve().then(() => (init_login(), login_exports));
    if (!options.email || !options.password) {
      console.error("Error: --email and --password are required");
      process.exit(1);
    }
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    const page = new CompatPage(driver3);
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    const result = await loginFlow2(page, {
      email: options.email,
      password: options.password,
      successIndicator: options.successIndicator
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`Authenticated: ${result.authenticated}`);
      if (result.username) console.log(`Username: ${result.username}`);
      console.log(`Duration: ${result.duration}ms`);
      if (result.error) console.log(`Error: ${result.error}`);
    }
    if (!result.success) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await driver3.close();
  }
});
program.command("test-interact <url>").description("Run interaction assertions: click X, verify Y happened").option("-a, --action <spec>", "Action specification (repeatable). Format: type[:role]:target[:value]", (val, acc) => {
  acc.push(val);
  return acc;
}, []).option("-e, --expect <spec>", "Assertion specification (repeatable). Format: visible|hidden|text|count:value", (val, acc) => {
  acc.push(val);
  return acc;
}, []).option("--expect-screenshot <name>", "Capture screenshot after last action with this name").option("--json", "Output as JSON").option("--sandbox", "Show visible browser window (default: headless)").action(async (url, options) => {
  const {
    runInteractionTest: runInteractionTest2,
    parseActionArg: parseActionArg2,
    parseExpectArg: parseExpectArg2,
    formatInteractionResult: formatInteractionResult2
  } = await Promise.resolve().then(() => (init_interaction_test(), interaction_test_exports));
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
  if (!options.action || options.action.length === 0) {
    console.error("Error: at least one --action is required");
    console.error("");
    console.error("Usage:");
    console.error('  npx ibr interact <url> --action "click:button:Submit" --expect "heading:Success"');
    process.exit(1);
  }
  const steps = options.action.map((actionSpec, i) => {
    let action;
    try {
      action = parseActionArg2(actionSpec);
    } catch (err) {
      console.error(`Error parsing --action "${actionSpec}": ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    const isLastStep = i === options.action.length - 1;
    let expectObj = void 0;
    if (isLastStep && (options.expect.length > 0 || options.expectScreenshot)) {
      expectObj = {};
      for (const expectSpec of options.expect) {
        try {
          const parsed = parseExpectArg2(expectSpec);
          Object.assign(expectObj, parsed);
        } catch (err) {
          console.error(`Error parsing --expect "${expectSpec}": ${err instanceof Error ? err.message : err}`);
          process.exit(1);
        }
      }
      if (options.expectScreenshot) {
        expectObj.screenshot = options.expectScreenshot;
      }
    }
    return { action, expect: expectObj };
  });
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    if (!options.json) {
      console.log(`Interacting with ${resolvedUrl}...`);
      console.log(`${steps.length} step(s)`);
      console.log("");
    }
    const results = await runInteractionTest2({
      url: resolvedUrl,
      steps,
      viewport,
      outputDir: (0, import_path32.join)(outputDir, "interactions"),
      headless: !options.sandbox
    });
    if (options.json) {
      console.log(JSON.stringify(results.map((r) => ({
        ...r,
        before: { ...r.before, screenshot: void 0 },
        after: { ...r.after, screenshot: void 0 }
      })), null, 2));
    } else {
      for (const result of results) {
        console.log(formatInteractionResult2(result));
        console.log("");
      }
      const totalAssertions = results.flatMap((r) => r.assertions).length;
      const passedAssertions = results.flatMap((r) => r.assertions).filter((a) => a.passed).length;
      const failedActions = results.filter((r) => !r.action.success).length;
      if (totalAssertions > 0) {
        console.log(`Assertions: ${passedAssertions}/${totalAssertions} passed`);
      }
      if (failedActions > 0) {
        console.log(`Actions failed: ${failedActions}/${results.length}`);
      }
    }
    const anyFailed = results.some((r) => !r.action.success) || results.some((r) => r.assertions.some((a) => !a.passed));
    if (anyFailed) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("match <mockup> <url>").description("Compare a design mockup PNG against a live rendered page (SSIM + pixelmatch)").option("-s, --selector <css>", "Crop live page to this CSS selector before comparison").option("-m, --mask-dynamic", "Auto-mask dynamic content (timestamps, ads, live regions)").option("--json", "Output results as JSON").option("--save-diff <path>", "Save the pixel diff image to this file path").option("--headless", "Run browser headless (default: true)", true).action(async (mockup, url, options) => {
  try {
    const { matchMockup: matchMockup2, saveDiffImage: saveDiffImage2 } = await Promise.resolve().then(() => (init_mockup_match(), mockup_match_exports));
    const { basename: basename4 } = await import("path");
    const globalOpts = program.opts();
    const viewportName = globalOpts.viewport || "desktop";
    const viewportPreset = VIEWPORTS[viewportName];
    const result = await matchMockup2({
      mockupPath: mockup,
      url,
      selector: options.selector,
      maskDynamic: options.maskDynamic ?? false,
      headless: options.headless ?? true,
      ...viewportPreset ? { viewport: { width: viewportPreset.width, height: viewportPreset.height } } : {}
    });
    if (options.saveDiff) {
      await saveDiffImage2(result.pixelDiff.diffImage, options.saveDiff);
    }
    if (options.json) {
      const out = {
        ssim: result.ssim,
        pixelDiff: {
          count: result.pixelDiff.count,
          percentage: result.pixelDiff.percentage
        },
        mockupDimensions: result.mockupDimensions,
        liveDimensions: result.liveDimensions,
        maskedRegions: result.maskedRegions,
        ...options.saveDiff ? { diffSavedTo: options.saveDiff } : {}
      };
      console.log(JSON.stringify(out, null, 2));
    } else {
      const label = options.selector ? options.selector.replace(/^[.#]/, "") : basename4(mockup, ".png");
      const verdictSymbol = result.ssim.verdict === "pass" ? "PASS" : result.ssim.verdict === "review" ? "REVIEW" : "FAIL";
      console.log(`
Mockup Match: ${label}`);
      console.log(`  SSIM: ${result.ssim.score.toFixed(4)} (${verdictSymbol})`);
      console.log(`  Pixel diff: ${result.pixelDiff.percentage}% (${result.pixelDiff.count} pixels)`);
      console.log(`  Mockup: ${result.mockupDimensions.width}x${result.mockupDimensions.height}`);
      console.log(`  Live: ${result.liveDimensions.width}x${result.liveDimensions.height}`);
      if (result.maskedRegions.length > 0) {
        console.log(`  Masked: ${result.maskedRegions.length} regions (${result.maskedRegions.join(", ")})`);
      }
      if (options.saveDiff) {
        console.log(`  Diff saved: ${options.saveDiff}`);
      }
      console.log("");
    }
    if (result.ssim.verdict !== "pass") {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("record-change <url>").description("Record a design change specification for later verification").option("--element <name>", "Accessible name or CSS selector of the target element").option("--description <text>", "Human-readable description of the change").option("--checks <json>", "JSON array of check objects: [{property,operator,value,confidence}]").option("--platform <platform>", "Target platform: web, ios, macos", "web").action(async (url, options) => {
  try {
    const { saveChange: saveChange2 } = await Promise.resolve().then(() => (init_design_verifier(), design_verifier_exports));
    const { DesignChangeSchema: DesignChangeSchema2 } = await Promise.resolve().then(() => (init_types3(), types_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    if (!options.element) {
      console.error("Error: --element is required");
      process.exit(1);
    }
    if (!options.description) {
      console.error("Error: --description is required");
      process.exit(1);
    }
    let checks = [];
    if (options.checks) {
      try {
        checks = JSON.parse(options.checks);
        if (!Array.isArray(checks)) {
          console.error("Error: --checks must be a JSON array");
          process.exit(1);
        }
      } catch {
        console.error("Error: --checks is not valid JSON");
        process.exit(1);
      }
    }
    const changeRaw = {
      description: options.description,
      element: options.element,
      checks,
      source: "structured",
      platform: options.platform || "web",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const parseResult = DesignChangeSchema2.safeParse(changeRaw);
    if (!parseResult.success) {
      console.error("Error: invalid change specification");
      for (const issue of parseResult.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }
    await saveChange2(outputDir, parseResult.data);
    console.log("Design change recorded:");
    console.log(`  Element:     ${parseResult.data.element}`);
    console.log(`  Description: ${parseResult.data.description}`);
    console.log(`  Checks:      ${parseResult.data.checks.length}`);
    console.log(`  Platform:    ${parseResult.data.platform ?? "web"}`);
    console.log(`  Saved to:    ${outputDir}/design-changes.json`);
    console.log("");
    console.log("To verify:");
    console.log(`  npx ibr verify-changes ${url}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("verify-changes <url>").description("Verify all recorded design changes against the live page").option("--json", "Output results as JSON").action(async (url, options) => {
  const globalOpts = program.opts();
  const driver3 = await createDriver(globalOpts.browser);
  try {
    const { loadChanges: loadChanges2, verifyAllChanges: verifyAllChanges2, formatVerifyResult: formatVerifyResult2 } = await Promise.resolve().then(() => (init_design_verifier(), design_verifier_exports));
    const resolvedUrl = await resolveBaseUrl(url);
    const outputDir = globalOpts.output || "./.ibr";
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const changes = await loadChanges2(outputDir);
    if (changes.length === 0) {
      console.log("No design changes recorded.");
      console.log("");
      console.log("Record a change first:");
      console.log(`  npx ibr record-change <url> --element "header" --description "Blue header" --checks '[...]'`);
      return;
    }
    console.log(`Verifying ${changes.length} design change(s) against ${resolvedUrl}...`);
    console.log("");
    await driver3.launch(withChromePath({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
    await driver3.navigate(resolvedUrl);
    await new Promise((r) => setTimeout(r, 500));
    const results = await verifyAllChanges2(changes, driver3);
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const result of results) {
        console.log(formatVerifyResult2(result));
        console.log("");
      }
      const passed = results.filter((r) => r.overallPassed).length;
      const failed = results.filter((r) => !r.overallPassed).length;
      console.log(`Summary: ${passed} passed, ${failed} failed`);
    }
    await driver3.close();
    if (results.some((r) => !r.overallPassed)) {
      process.exit(1);
    }
  } catch (error) {
    await driver3.close().catch(() => {
    });
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("generate-test <url>").description("Generate a declarative .ibr-test.json file from page observation").option("--scenario <text>", "Natural language scenario description").option("--test-file <path>", "Output path for test file", ".ibr-test.json").action(async (url, options) => {
  try {
    const { generateTest: generateTest2 } = await Promise.resolve().then(() => (init_test_generator(), test_generator_exports));
    const suite = await generateTest2({
      url,
      scenario: options.scenario,
      outputPath: options.testFile
    });
    const pageNames = Object.keys(suite);
    const total = pageNames.reduce((s, k) => s + suite[k].tests.length, 0);
    console.log(`Generated ${total} test(s) for ${pageNames.length} page(s) \u2192 ${options.testFile}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("test").description("Run declarative .ibr-test.json test file").option("--file <path>", "Path to test file", ".ibr-test.json").option("--output-dir <dir>", "Directory to store screenshots/results", ".ibr/test-results").option("--headless", "Run headless (default: true)", true).option("--json", "Output results as JSON").action(async (options) => {
  try {
    const { runTests: runTests2, formatRunResult: formatRunResult2 } = await Promise.resolve().then(() => (init_test_runner(), test_runner_exports));
    const results = await runTests2({
      filePath: options.file,
      outputDir: options.outputDir,
      headless: options.headless
    });
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const result of results) {
        console.log(formatRunResult2(result));
        console.log("");
      }
      const totalPassed = results.reduce((s, r) => s + r.passed, 0);
      const totalFailed = results.reduce((s, r) => s + r.failed, 0);
      console.log(`Summary: ${totalPassed} passed, ${totalFailed} failed`);
    }
    const anyFailed = results.some((r) => r.failed > 0);
    process.exit(anyFailed ? 1 : 0);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("run-script <script>").description("Execute a Python test script with sandboxed resource limits").option("--url <url>", "URL passed to script as IBR_URL env var").option("--timeout <ms>", "Timeout in milliseconds", "60000").option("--memory <mb>", "Memory limit in MB", "512").option("--cpu <seconds>", "CPU time limit in seconds", "30").option("--json", "Output result as JSON").action(async (script, options) => {
  try {
    const { runScript: runScript2, formatScriptResult: formatScriptResult2 } = await Promise.resolve().then(() => (init_script_runner(), script_runner_exports));
    const result = await runScript2({
      scriptPath: script,
      url: options.url,
      timeout: parseInt(options.timeout, 10),
      memoryMB: parseInt(options.memory, 10),
      cpuSeconds: parseInt(options.cpu, 10)
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatScriptResult2(result));
    }
    process.exit(result.exitCode);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("iterate <url>").description("Run one iteration of the test-fix loop and report convergence state").option("--test <path>", "Path to .ibr-test.json (uses IBR scan if omitted)").option("--max-iterations <n>", "Maximum iterations before stopping", "7").option("--output-dir <dir>", "Directory for iteration state and results", ".ibr/iterate").option("--auto-approve", "Skip user approval at checkpoint iterations").option("--reset", "Reset iteration state and start fresh").option("--json", "Output result as JSON").action(async (url, options) => {
  try {
    const { iterate: iterate2, resetIterateState: resetIterateState2 } = await Promise.resolve().then(() => (init_iterate(), iterate_exports));
    if (options.reset) {
      await resetIterateState2(options.outputDir);
      console.log("Iteration state reset.");
      return;
    }
    const result = await iterate2({
      url,
      testFile: options.test,
      maxIterations: parseInt(options.maxIterations, 10),
      outputDir: options.outputDir,
      autoApprove: options.autoApprove ?? false
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const last2 = result.iterations[result.iterations.length - 1];
      if (last2) {
        console.log(`Iteration ${last2.iteration}: ${last2.issueCount} issue(s) | hash=${last2.scanHash} | delta=${last2.netDelta >= 0 ? "+" : ""}${last2.netDelta} | ${last2.approachHint}`);
      }
      console.log(`State: ${result.finalState}`);
      console.log(result.summary);
    }
    const last = result.iterations[result.iterations.length - 1];
    const hasIssues = last ? last.issueCount > 0 : false;
    if (result.finalState === "regressing" || result.finalState === "budget_exceeded" && hasIssues) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("compare-browsers <url>").description("Scan in Chrome and Safari, diff screenshots and element counts").option("--save-diff <path>", "Save pixel diff image to this path").option("--json", "Output results as JSON").option("--timeout <ms>", "Navigation timeout in ms", "15000").action(async (url, options) => {
  const resolvedUrl = await resolveBaseUrl(url);
  const globalOpts = program.opts();
  const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
  const timeout = parseInt(options.timeout, 10);
  if (!options.json) {
    console.log(`Comparing browsers for: ${resolvedUrl}`);
    console.log("");
  }
  if (!options.json) console.log("Chrome: launching...");
  const chromeDriver = new EngineDriver();
  let chromeScreenshot = null;
  let chromeElements = [];
  let chromeError = null;
  try {
    await chromeDriver.launch({
      headless: true,
      viewport: { width: viewport.width, height: viewport.height }
    });
    await chromeDriver.navigate(resolvedUrl, { waitFor: "stable", timeout });
    chromeScreenshot = await chromeDriver.screenshot();
    const discovered = await chromeDriver.discover({ filter: "interactive" });
    chromeElements = Array.isArray(discovered) ? discovered : [];
    if (!options.json) console.log(`Chrome: ${chromeElements.length} interactive elements`);
  } catch (err) {
    chromeError = err instanceof Error ? err.message : String(err);
    if (!options.json) console.log(`Chrome: failed \u2014 ${chromeError}`);
  } finally {
    await chromeDriver.close().catch(() => {
    });
  }
  if (!options.json) console.log("Safari: launching...");
  const { SafariDriver: SafariDriver2 } = await Promise.resolve().then(() => (init_driver2(), driver_exports2));
  const safariDriver = new SafariDriver2();
  let safariScreenshot = null;
  let safariElements = [];
  let safariError = null;
  try {
    const { SafariSession: SafariSession2 } = await Promise.resolve().then(() => (init_session2(), session_exports2));
    const enabled = await SafariSession2.isEnabled();
    if (!enabled) {
      safariError = "safaridriver not enabled. Run: sudo safaridriver --enable";
      if (!options.json) console.log(`Safari: skipped \u2014 ${safariError}`);
    } else {
      await safariDriver.launch({ viewport: { width: viewport.width, height: viewport.height } });
      await safariDriver.navigate(resolvedUrl, { waitFor: "load", timeout });
      safariScreenshot = await safariDriver.screenshot();
      const discovered = await safariDriver.discover({ filter: "interactive" });
      safariElements = Array.isArray(discovered) ? discovered : [];
      if (!options.json) console.log(`Safari: ${safariElements.length} interactive elements`);
    }
  } catch (err) {
    safariError = err instanceof Error ? err.message : String(err);
    if (!options.json) console.log(`Safari: failed \u2014 ${safariError}`);
  } finally {
    await safariDriver.close().catch(() => {
    });
  }
  let pixelDiff = null;
  let diffPercent = null;
  let diffSaved = false;
  if (chromeScreenshot && safariScreenshot) {
    try {
      const { PNG: PNG5 } = await import("pngjs");
      const pixelmatch4 = (await import("pixelmatch")).default;
      const chromePng = PNG5.sync.read(chromeScreenshot);
      const safariPng = PNG5.sync.read(safariScreenshot);
      const w = Math.min(chromePng.width, safariPng.width);
      const h = Math.min(chromePng.height, safariPng.height);
      const diff = new PNG5({ width: w, height: h });
      const chromeData = cropPngData(chromePng.data, chromePng.width, w, h);
      const safariData = cropPngData(safariPng.data, safariPng.width, w, h);
      pixelDiff = pixelmatch4(chromeData, safariData, diff.data, w, h, {
        threshold: 0.1,
        includeAA: false
      });
      diffPercent = Math.round(pixelDiff / (w * h) * 1e4) / 100;
      if (options.saveDiff) {
        const { writeFile: writeFile20, mkdir: mkdirFs } = await import("fs/promises");
        const { dirname: dirname10 } = await import("path");
        await mkdirFs(dirname10(options.saveDiff), { recursive: true });
        await writeFile20(options.saveDiff, PNG5.sync.write(diff));
        diffSaved = true;
      }
    } catch {
    }
  }
  const chromeLabels = new Set(chromeElements.map((e) => e.label?.toLowerCase()).filter(Boolean));
  const safariLabels = new Set(safariElements.map((e) => e.label?.toLowerCase()).filter(Boolean));
  const onlyInChrome = [...chromeLabels].filter((l) => !safariLabels.has(l));
  const onlyInSafari = [...safariLabels].filter((l) => !chromeLabels.has(l));
  const result = {
    url: resolvedUrl,
    chrome: {
      elementCount: chromeElements.length,
      error: chromeError
    },
    safari: {
      elementCount: safariElements.length,
      error: safariError
    },
    diff: {
      pixelDiff,
      diffPercent,
      diffSaved: diffSaved ? options.saveDiff : null,
      elementsOnlyInChrome: onlyInChrome,
      elementsOnlyInSafari: onlyInSafari
    }
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    console.log("Results:");
    console.log(`  Chrome: ${chromeError ? "ERROR" : `${chromeElements.length} elements`}`);
    console.log(`  Safari: ${safariError ? "ERROR" : `${safariElements.length} elements`}`);
    if (pixelDiff !== null) {
      console.log(`  Visual diff: ${diffPercent}% (${pixelDiff} pixels)`);
    }
    if (onlyInChrome.length > 0) {
      console.log(`  Only in Chrome: ${onlyInChrome.slice(0, 5).join(", ")}${onlyInChrome.length > 5 ? ` +${onlyInChrome.length - 5} more` : ""}`);
    }
    if (onlyInSafari.length > 0) {
      console.log(`  Only in Safari: ${onlyInSafari.slice(0, 5).join(", ")}${onlyInSafari.length > 5 ? ` +${onlyInSafari.length - 5} more` : ""}`);
    }
    if (diffSaved) {
      console.log(`  Diff saved: ${options.saveDiff}`);
    }
  }
});
function cropPngData(data, srcWidth, dstWidth, dstHeight) {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y++) {
    const srcOff = y * srcWidth * 4;
    const dstOff = y * dstWidth * 4;
    data.copy(dst, dstOff, srcOff, srcOff + dstWidth * 4);
  }
  return dst;
}
program.command("interact <url>").description("Click, type, fill, or interact with elements on a page").requiredOption("-a, --action <action>", "Action: click, type, fill, hover, press, scroll, select, check").requiredOption("-t, --target <name>", "Element accessible name").option("-v, --value <text>", "Value for type/fill/press/select").option("-r, --role <role>", "ARIA role filter").option("--no-screenshot", "Skip screenshot after interaction").action(async (url, opts) => {
  const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
  const driver3 = new EngineDriver2();
  try {
    await driver3.launch(withChromePath({ headless: true }));
    await driver3.navigate(url);
    const element = await driver3.find(opts.target, opts.role ? { role: opts.role } : void 0);
    if (!element) {
      console.error(`Element not found: "${opts.target}"`);
      console.error('Use "ibr observe <url>" to see available elements.');
      process.exit(1);
    }
    const action = opts.action;
    switch (action) {
      case "click":
        await driver3.click(element.id);
        break;
      case "type":
        await driver3.type(element.id, opts.value || "");
        break;
      case "fill":
        await driver3.fill(element.id, opts.value || "");
        break;
      case "hover":
        await driver3.hover(element.id);
        break;
      case "press":
        await driver3.pressKey(opts.value || "Enter");
        break;
      case "scroll":
        await driver3.scroll(Number(opts.value) || 300);
        break;
      case "select":
        await driver3.select(element.id, opts.value || "");
        break;
      case "check":
        await driver3.check(element.id);
        break;
      default:
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
    console.log(`\u2713 ${action} on "${opts.target}" succeeded`);
    if (opts.screenshot !== false) {
      const fs2 = await import("fs");
      const path2 = await import("path");
      const buf = await driver3.screenshot();
      const globalOpts = program.opts();
      const outDir = globalOpts.output || "./.ibr";
      fs2.mkdirSync(outDir, { recursive: true });
      const filename = `interact-${Date.now()}.png`;
      fs2.writeFileSync(path2.join(outDir, filename), buf);
      console.log(`Screenshot: ${path2.join(outDir, filename)}`);
    }
  } catch (err) {
    console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await driver3.close().catch(() => {
    });
  }
});
program.command("observe <url>").description("Preview available actions on a page without executing them").option("-r, --role <role>", "Filter by ARIA role").option("-l, --limit <n>", "Max results", "30").action(async (url, opts) => {
  const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
  const driver3 = new EngineDriver2();
  try {
    await driver3.launch(withChromePath({ headless: true }));
    await driver3.navigate(url);
    const actions = await driver3.observe({ role: opts.role, limit: Number(opts.limit) });
    if (actions.length === 0) {
      console.log("No interactive elements found.");
      return;
    }
    console.log(`Found ${actions.length} interactive elements:
`);
    actions.forEach((a, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. [${a.role}] "${a.label}" \u2014 ${a.actions.join(", ")}`);
    });
  } catch (err) {
    console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await driver3.close().catch(() => {
    });
  }
});
program.command("extract <url>").description("Extract structured data from a page \u2014 headings, buttons, inputs, links").action(async (url) => {
  const { EngineDriver: EngineDriver2 } = await Promise.resolve().then(() => (init_driver(), driver_exports));
  const driver3 = new EngineDriver2();
  try {
    await driver3.launch(withChromePath({ headless: true }));
    await driver3.navigate(url);
    const meta = await driver3.extractMeta();
    if (meta.headings.length > 0) {
      console.log("Headings:");
      meta.headings.forEach((h) => console.log(`  ${h}`));
      console.log();
    }
    if (meta.buttons.length > 0) {
      console.log(`Buttons (${meta.buttons.length}):`);
      meta.buttons.forEach((b) => console.log(`  \u2022 ${b.label}${b.enabled === false ? " (disabled)" : ""}`));
      console.log();
    }
    if (meta.inputs.length > 0) {
      console.log(`Inputs (${meta.inputs.length}):`);
      meta.inputs.forEach((inp) => console.log(`  \u2022 ${inp.label}${inp.value ? ` = "${inp.value}"` : ""}`));
      console.log();
    }
    if (meta.links.length > 0) {
      console.log(`Links (${meta.links.length}):`);
      meta.links.slice(0, 20).forEach((l) => console.log(`  \u2022 ${l.label}`));
      if (meta.links.length > 20) console.log(`  ... and ${meta.links.length - 20} more`);
    }
  } catch (err) {
    console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await driver3.close().catch(() => {
    });
  }
});
program.parse();
//# sourceMappingURL=ibr.js.map