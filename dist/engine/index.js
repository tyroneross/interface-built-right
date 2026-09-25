'use strict';

var child_process = require('child_process');
var fs = require('fs');
var promises = require('fs/promises');
var net = require('net');
var os = require('os');
var path = require('path');
var pixelmatch = require('pixelmatch');
var pngjs = require('pngjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var pixelmatch__default = /*#__PURE__*/_interopDefault(pixelmatch);

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
    const roleScore = scoreRole(cleanedIntent, el.role);
    const intentIsOnlyRole = cleanedIntent.trim() === el.role.toLowerCase() || cleanedIntent.trim().split(/\s+/).every((w) => scoreRole(w, el.role) > 0);
    const labelScore = intentIsOnlyRole ? 0 : scoreLabelSimilarity(cleanedIntent, el.label);
    const spatialScore = scoreSpatial(hints, el, i, elements);
    let score = roleScore * 0.3 + labelScore * 0.5 + spatialScore * 0.2;
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
  const intentTrimmed = intent.trim();
  if (intentTrimmed === labelLower) return 1;
  if (labelLower.length >= 3) {
    const labelAsWord = new RegExp(`\\b${escapeRegex(labelLower)}\\b`).test(intent);
    if (labelAsWord) return 1;
  }
  if (intentTrimmed.length >= 3 && labelLower.includes(intentTrimmed)) return 0.9;
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
  }
});

// src/engine/net-timeout.ts
var CDP_PROBE_TIMEOUT_MS = envMs("IBR_CDP_PROBE_TIMEOUT_MS", 3e3);
var WS_CONNECT_TIMEOUT_MS = envMs("IBR_WS_CONNECT_TIMEOUT_MS", 1e4);
var BROWSER_SPAWN_TIMEOUT_MS = envMs("IBR_BROWSER_SPAWN_TIMEOUT_MS", 3e4);
function envMs(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
var ConnectTimeoutError = class extends Error {
  constructor(waitingOn, timeoutMs, elapsedMs = timeoutMs) {
    super(
      `Timed out after ${elapsedMs}ms waiting on ${waitingOn} (limit ${timeoutMs}ms). The endpoint accepted the connection or was unreachable but never answered.`
    );
    this.waitingOn = waitingOn;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
    this.name = "ConnectTimeoutError";
  }
  waitingOn;
  timeoutMs;
  elapsedMs;
};
async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = CDP_PROBE_TIMEOUT_MS, waitingOn = url, ...init } = options;
  const started = Date.now();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (isAbort(err)) {
      throw new ConnectTimeoutError(waitingOn, timeoutMs, Date.now() - started);
    }
    throw err;
  }
}
function isAbort(err) {
  const name = err?.name;
  return name === "AbortError" || name === "TimeoutError";
}

// src/engine/cdp/connection.ts
var DEFAULT_TIMEOUT_MS = 3e4;
var CdpConnection = class {
  ws = null;
  nextId = 0;
  pending = /* @__PURE__ */ new Map();
  eventHandlers = /* @__PURE__ */ new Map();
  timeoutMs;
  constructor(options) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }
  /**
   * Open the CDP WebSocket, bounded by `timeoutMs`.
   *
   * `new WebSocket()` fires 'open' or 'error' — and NEITHER when the peer
   * completes the TCP handshake then goes silent, which is exactly what a
   * recycled ephemeral port looks like. Without the timer below this call
   * never settles: measured still pending at 25s on 2026-09-01. On timeout we
   * also close the half-open socket, or the process keeps a live handle and
   * cannot exit.
   */
  async connect(wsUrl, options) {
    const timeoutMs = options?.timeoutMs ?? WS_CONNECT_TIMEOUT_MS;
    const started = Date.now();
    return new Promise((resolve2, reject) => {
      const ws = new WebSocket(wsUrl);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
        }
        reject(new ConnectTimeoutError(
          `CDP WebSocket open ${wsUrl}`,
          timeoutMs,
          Date.now() - started
        ));
      }, timeoutMs);
      const onOpen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.ws = ws;
        ws.addEventListener("message", (event) => this.handleMessage(event));
        ws.addEventListener("close", () => this.handleClose());
        ws.addEventListener("error", () => this.handleClose());
        resolve2();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
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
    return new Promise((resolve2, reject) => {
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
        resolve: resolve2,
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
      const { resolve: resolve2, reject, timer } = this.pending.get(id);
      clearTimeout(timer);
      this.pending.delete(id);
      if (data.error) {
        const err = data.error;
        reject(new Error(`CDP error ${err.code}: ${err.message}`));
      } else {
        resolve2(data.result);
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
var CHROME_PATHS = [
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
function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
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
  return new Promise((resolve2, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve2(port));
    });
    srv.on("error", reject);
  });
}
function checkPortFree(port) {
  return new Promise((resolve2) => {
    const srv = net.createServer();
    srv.once("error", () => resolve2(false));
    srv.listen(port, () => srv.close(() => resolve2(true)));
  });
}
async function resolveWsEndpoint(cdpUrl) {
  const res = await fetchWithTimeout(`${cdpUrl}/json/version`, {
    timeoutMs: CDP_PROBE_TIMEOUT_MS,
    waitingOn: `CDP version probe ${cdpUrl}/json/version`
  });
  if (!res.ok) {
    throw new Error(`CDP endpoint did not respond: ${cdpUrl}`);
  }
  const data = await res.json();
  if (!data.webSocketDebuggerUrl) {
    throw new Error(`CDP endpoint did not return a WebSocket URL: ${cdpUrl}`);
  }
  return data.webSocketDebuggerUrl;
}
function resolveBrowserConnectionOptions(options = {}, env = process.env) {
  const wsEndpoint = options.wsEndpoint || env.IBR_WS_ENDPOINT;
  const cdpUrl = options.cdpUrl || env.IBR_CDP_URL;
  const requestedMode = options.mode || env.IBR_BROWSER_MODE;
  const mode = requestedMode === "local" ? "local" : requestedMode === "connect" || wsEndpoint || cdpUrl ? "connect" : "local";
  return {
    mode,
    cdpUrl,
    wsEndpoint,
    chromePath: options.chromePath || env.IBR_CHROME_PATH
  };
}
var PROFILE_REAP_GRACE_MS = 60 * 60 * 1e3;
function processTable() {
  return child_process.execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024
  });
}
function userDataDirFromCommand(command) {
  const match = command.match(/--user-data-dir=(?:"([^"]+)"|'([^']+)'|(\S+))/);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}
function isIbrProfile(profileDir) {
  return profileDir.startsWith(`${os.tmpdir()}/ibr-chrome-`) || profileDir === path.join(os.homedir(), ".ibr", "chromium-profile") || profileDir === ".ibr/browser-profile" || profileDir.endsWith("/.ibr/browser-profile");
}
function parseIbrChromeProcesses(psOutput) {
  const processes = [];
  for (const line of psOutput.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const command = match[3];
    if (!command.includes("--remote-debugging-port=") || command.includes("--type=")) continue;
    const profileDir = userDataDirFromCommand(command);
    if (!profileDir || !isIbrProfile(profileDir)) continue;
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      profileDir,
      command
    });
  }
  return processes;
}
function reapOrphanedIbrChromeProcesses(options = {}) {
  let processes;
  try {
    processes = parseIbrChromeProcesses(options.psOutput ?? processTable());
  } catch {
    return { reaped: [], preserved: [] };
  }
  const kill = options.kill ?? ((pid, signal) => process.kill(pid, signal));
  const result = { reaped: [], preserved: [] };
  for (const entry of processes) {
    if (entry.ppid !== 1) {
      result.preserved.push(entry.pid);
      continue;
    }
    try {
      kill(entry.pid, "SIGTERM");
      result.reaped.push(entry.pid);
    } catch {
    }
  }
  return result;
}
function shouldReclaimSingletonLock(evidence) {
  if (evidence.profileInUse) return false;
  if (evidence.targetHost === evidence.currentHost) return !evidence.targetPidAlive;
  return evidence.lockAgeMs >= PROFILE_REAP_GRACE_MS;
}
function reclaimStaleSingletonLock(lockPath, profileDir) {
  let target;
  try {
    target = fs.readlinkSync(lockPath);
  } catch {
    return false;
  }
  const sep = target.lastIndexOf("-");
  if (sep <= 0) return false;
  const host = target.slice(0, sep);
  const pid = Number(target.slice(sep + 1));
  if (!Number.isInteger(pid) || pid <= 0) return false;
  let psOutput;
  try {
    psOutput = processTable();
  } catch {
    return false;
  }
  const profileInUse = psOutput.split("\n").some((line) => userDataDirFromCommand(line) === profileDir);
  let targetPidAlive = false;
  if (host === os.hostname()) {
    try {
      process.kill(pid, 0);
      targetPidAlive = true;
    } catch (err) {
      targetPidAlive = err.code === "EPERM";
    }
  }
  let lockAgeMs;
  try {
    lockAgeMs = Date.now() - fs.lstatSync(lockPath).mtimeMs;
  } catch {
    return false;
  }
  if (!shouldReclaimSingletonLock({
    targetHost: host,
    currentHost: os.hostname(),
    lockAgeMs,
    profileInUse,
    targetPidAlive
  })) return false;
  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}
var heldProfileLocks = /* @__PURE__ */ new Set();
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
function createLockFile(lockPath, holderId) {
  const fd = fs.openSync(lockPath, "wx");
  try {
    fs.writeSync(fd, holderId);
  } finally {
    fs.closeSync(fd);
  }
}
function acquireProfileLock(profileDir) {
  const lockPath = `${profileDir}.ibr-lock`;
  const holderId = `${os.hostname()}-${process.pid}`;
  try {
    createLockFile(lockPath, holderId);
    heldProfileLocks.add(lockPath);
    return { acquired: true, lockPath };
  } catch (err) {
    if (err.code !== "EEXIST") {
      return { acquired: true, lockPath };
    }
  }
  let contents;
  try {
    contents = fs.readFileSync(lockPath, "utf8").trim();
  } catch {
    return retryAcquire(lockPath, holderId);
  }
  const sep = contents.lastIndexOf("-");
  const holderHost = sep > 0 ? contents.slice(0, sep) : "";
  const holderPid = sep > 0 ? Number(contents.slice(sep + 1)) : NaN;
  if (!holderHost || !Number.isInteger(holderPid) || holderPid <= 0) {
    return { acquired: false, lockPath, holder: contents };
  }
  let stale;
  if (holderHost === os.hostname()) {
    stale = !isPidAlive(holderPid);
  } else {
    let ageMs = -1;
    try {
      ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
    } catch {
    }
    stale = ageMs >= PROFILE_REAP_GRACE_MS;
  }
  if (!stale) return { acquired: false, lockPath, holder: contents };
  return reclaimStaleLock(lockPath, holderId, contents);
}
var RECLAIM_MUTEX_STALE_MS = 3e4;
function reclaimStaleLock(lockPath, holderId, staleContents) {
  const mutexPath = `${lockPath}.reclaim`;
  try {
    createLockFile(mutexPath, holderId);
  } catch {
    try {
      if (Date.now() - fs.statSync(mutexPath).mtimeMs >= RECLAIM_MUTEX_STALE_MS) fs.unlinkSync(mutexPath);
    } catch {
    }
    return { acquired: false, lockPath, holder: staleContents };
  }
  try {
    let current;
    try {
      current = fs.readFileSync(lockPath, "utf8").trim();
    } catch {
      current = null;
    }
    if (current !== null && current !== staleContents) {
      return { acquired: false, lockPath, holder: current };
    }
    if (current !== null) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
      }
    }
    return retryAcquire(lockPath, holderId);
  } finally {
    try {
      fs.unlinkSync(mutexPath);
    } catch {
    }
  }
}
function unlinkIfOwned(lockPath) {
  try {
    if (fs.readFileSync(lockPath, "utf8").trim() === `${os.hostname()}-${process.pid}`) fs.unlinkSync(lockPath);
  } catch {
  }
}
function retryAcquire(lockPath, holderId) {
  try {
    createLockFile(lockPath, holderId);
    heldProfileLocks.add(lockPath);
    return { acquired: true, lockPath };
  } catch {
    return { acquired: false, lockPath };
  }
}
function releaseProfileLock(lockPath) {
  if (!lockPath || !heldProfileLocks.has(lockPath)) return;
  unlinkIfOwned(lockPath);
  heldProfileLocks.delete(lockPath);
}
process.once("exit", () => {
  for (const lockPath of heldProfileLocks) unlinkIfOwned(lockPath);
});
function looksLikeSingletonCollision(exit, stderrTail) {
  if (exit?.code === 21) return true;
  return /ProcessSingleton/i.test(stderrTail);
}
function reapOrphanedProfiles() {
  let inUse;
  try {
    const ps = child_process.execFileSync("ps", ["-eo", "command"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    inUse = new Set(
      [...ps.matchAll(/--user-data-dir=(\S*ibr-chrome-[A-Za-z0-9]+)/g)].map((m) => m[1])
    );
  } catch {
    return;
  }
  const dir = os.tmpdir();
  let entries;
  try {
    entries = fs.readdirSync(dir).filter((n) => n.startsWith("ibr-chrome-"));
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of entries) {
    const full = path.join(dir, name);
    if (inUse.has(full)) continue;
    try {
      if (now - fs.statSync(full).mtimeMs < PROFILE_REAP_GRACE_MS) continue;
      fs.rmSync(full, { recursive: true, force: true });
    } catch {
    }
  }
}
var BrowserManager = class {
  process = null;
  _port = 0;
  _mode = "local";
  _cdpUrl = null;
  _wsEndpoint = null;
  /** Set only when this browser owns a throwaway profile it must delete on close. */
  _ephemeralProfileDir = null;
  /** Tail of Chrome's stderr, so a spawn failure can say why Chrome refused. */
  _stderrTail = "";
  /** Set once the child exits, so waitForDebugger stops polling a dead process. */
  _exit = null;
  /** Set only when this browser holds the IBR profile lock for `userDataDir`, so close() can release it. */
  _profileLockPath = null;
  async launch(options = {}) {
    const connection = resolveBrowserConnectionOptions(options);
    this._mode = connection.mode;
    if (connection.mode === "connect") {
      this.process = null;
      this._port = 0;
      this._cdpUrl = connection.cdpUrl ?? null;
      if (connection.wsEndpoint) {
        this._wsEndpoint = connection.wsEndpoint;
        return connection.wsEndpoint;
      }
      if (connection.cdpUrl) {
        const wsUrl = await resolveWsEndpoint(connection.cdpUrl);
        this._wsEndpoint = wsUrl;
        return wsUrl;
      }
      throw new Error(
        "Connect mode requires a CDP endpoint.\nProvide --cdp-url http://127.0.0.1:9222 or --ws-endpoint ws://...\nYou can also set IBR_CDP_URL or IBR_WS_ENDPOINT."
      );
    }
    const progress = options.onProgress ?? (() => {
    });
    const headless = options.headless ?? true;
    progress("selecting debugging port");
    this._port = options.port ?? await findFreePort();
    progress(`debugging port ${this._port}`);
    progress("reaping orphaned browsers");
    reapOrphanedIbrChromeProcesses();
    let userDataDir = options.userDataDir ?? path.join(os.homedir(), ".ibr", "chromium-profile");
    await promises.mkdir(path.dirname(userDataDir), { recursive: true });
    progress("acquiring profile lock");
    const lock = acquireProfileLock(userDataDir);
    if (lock.acquired) {
      this._profileLockPath = lock.lockPath;
      const lockPath = path.join(userDataDir, "SingletonLock");
      const lockStat = fs.lstatSync(lockPath, { throwIfNoEntry: false });
      if (lockStat) {
        if (reclaimStaleSingletonLock(lockPath, userDataDir)) ; else {
          userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ibr-chrome-"));
          this._ephemeralProfileDir = userDataDir;
          releaseProfileLock(this._profileLockPath);
          this._profileLockPath = null;
        }
      }
    } else {
      progress(`profile lock held by ${lock.holder ?? "another IBR process"} \u2014 using an ephemeral profile`);
      userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ibr-chrome-"));
      this._ephemeralProfileDir = userDataDir;
    }
    progress("reaping orphaned profiles");
    reapOrphanedProfiles();
    progress("locating chrome binary");
    const chromePath = connection.chromePath ?? findChrome();
    if (!chromePath) {
      throw new Error(
        `Chrome not found. Install Google Chrome or pass chromePath option.
Checked: ${CHROME_PATHS.join(", ")}`
      );
    }
    const sharedProfileAttempt = this._ephemeralProfileDir === null;
    try {
      return await this.spawnChromeAndWaitForDebugger(chromePath, userDataDir, headless, options.normalize, progress);
    } catch (error) {
      if (sharedProfileAttempt && looksLikeSingletonCollision(this._exit, this._stderrTail)) {
        progress("shared profile still collided after lock acquisition \u2014 retrying on an ephemeral profile");
        await this.close();
        const fallbackDir = fs.mkdtempSync(path.join(os.tmpdir(), "ibr-chrome-"));
        this._ephemeralProfileDir = fallbackDir;
        try {
          return await this.spawnChromeAndWaitForDebugger(chromePath, fallbackDir, headless, options.normalize, progress);
        } catch (retryError) {
          await this.close();
          throw retryError;
        }
      }
      await this.close();
      throw error;
    }
  }
  async spawnChromeAndWaitForDebugger(chromePath, userDataDir, headless, normalize, progress) {
    await promises.mkdir(userDataDir, { recursive: true });
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
    if (normalize) {
      args.push("--disable-lcd-text");
      args.push("--force-device-scale-factor=1");
    }
    progress(`spawning ${chromePath} (profile ${userDataDir})`);
    this._stderrTail = "";
    this._exit = null;
    this.process = child_process.spawn(chromePath, args, { stdio: "pipe" });
    this.process.on("error", (err) => {
      console.error(`Chrome process error: ${err.message}`);
    });
    this.process.stderr?.on("data", (chunk) => {
      this._stderrTail = (this._stderrTail + chunk.toString()).slice(-2e3);
    });
    this.process.on("exit", (code, signal) => {
      this._exit = { code, signal };
    });
    progress(`spawned chrome pid ${this.process.pid ?? "unknown"}`);
    const wsUrl = await this.waitForDebugger(progress);
    progress("debugger answered");
    this._cdpUrl = `http://127.0.0.1:${this._port}`;
    this._wsEndpoint = wsUrl;
    return wsUrl;
  }
  /**
   * Poll the freshly spawned Chrome until its debugger answers.
   *
   * This used to be `for (i < 50) { await fetch(...) }` with a comment claiming
   * "5 seconds at 100ms intervals". It was not 5 seconds and it was not
   * bounded: `fetch()` has no default deadline, so ONE attempt against a port
   * that is listening but silent blocks the whole loop forever. That is the
   * shape of the reported hang — no output, no error, no timeout of its own.
   *
   * Now: a wall-clock deadline governs the loop, each probe carries its own
   * short timeout, and an exited child ends the wait immediately instead of
   * polling a process that is never coming back.
   */
  async waitForDebugger(onProgress = () => {
  }, timeoutMs = BROWSER_SPAWN_TIMEOUT_MS) {
    const url = `http://127.0.0.1:${this._port}/json/version`;
    const started = Date.now();
    const deadline = started + timeoutMs;
    let attempts = 0;
    let lastError = "no response yet";
    while (Date.now() < deadline) {
      if (this._exit) {
        throw new Error(
          `Chrome exited before its debugger came up (code ${this._exit.code}, signal ${this._exit.signal}) after ${Date.now() - started}ms on port ${this._port}.${this.stderrHint()}`
        );
      }
      attempts++;
      try {
        const remaining = deadline - Date.now();
        const res = await fetchWithTimeout(url, {
          timeoutMs: Math.max(250, Math.min(CDP_PROBE_TIMEOUT_MS, remaining)),
          waitingOn: `Chrome debugger ${url}`
        });
        const data = await res.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
        lastError = "endpoint answered without a webSocketDebuggerUrl";
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempts === 1 || attempts % 10 === 0) {
          onProgress(`waiting for debugger on port ${this._port} (attempt ${attempts}: ${lastError})`);
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const elapsed = Date.now() - started;
    throw new ConnectTimeoutError(
      `Chrome debugger ${url} \u2014 ${attempts} probes over ${elapsed}ms, last: ${lastError}.` + this.stderrHint() + "\nIs another process holding this port? If you are running inside a sandbox, retry with connect mode:\n  --browser-mode connect --cdp-url http://127.0.0.1:9222",
      timeoutMs,
      elapsed
    );
  }
  stderrHint() {
    const tail = this._stderrTail.trim();
    return tail ? `
Chrome stderr (tail):
${tail}` : "";
  }
  async close() {
    if (this._mode === "local" && this.process) {
      const proc = this.process;
      this.process = null;
      if (!this._exit) {
        await new Promise((resolve2) => {
          const killTimer = setTimeout(() => {
            try {
              proc.kill("SIGKILL");
            } catch {
            }
            resolve2();
          }, 3e3);
          proc.once("close", () => {
            clearTimeout(killTimer);
            resolve2();
          });
          proc.kill("SIGTERM");
        });
      }
    }
    if (this._ephemeralProfileDir) {
      try {
        fs.rmSync(this._ephemeralProfileDir, { recursive: true, force: true });
      } catch {
      }
      this._ephemeralProfileDir = null;
    }
    if (this._profileLockPath) {
      releaseProfileLock(this._profileLockPath);
      this._profileLockPath = null;
    }
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
  get mode() {
    return this._mode;
  }
  get cdpUrl() {
    return this._cdpUrl;
  }
  get wsEndpoint() {
    return this._wsEndpoint;
  }
};

// src/engine/cdp/target.ts
var TargetDomain = class {
  constructor(conn) {
    this.conn = conn;
  }
  conn;
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
  /**
   * Full `Target.getTargets` payload including `title` and `attached`.
   * `list()` narrows those away; attaching to an already-running app (see
   * `src/live/`) needs the title to pick the right window. Additive — existing
   * callers of `list()` are untouched.
   */
  async listDetailed() {
    const result = await this.conn.send("Target.getTargets");
    return result.targetInfos;
  }
  /**
   * Release a session created by `attach()` without closing the target.
   * Required when auditing a live app: the page must survive detach.
   */
  async detach(sessionId) {
    await this.conn.send("Target.detachFromTarget", { sessionId });
  }
};

// src/engine/cdp/page.ts
var PageDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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
   * Frame hierarchy for the current page (E3-D). Used to discover iframes
   * whose accessible content today isn't reachable from the main-frame AX
   * tree (Accessibility.getFullAXTree only walks the ROOT frame by
   * default).
   */
  async getFrameTree() {
    const result = await this.conn.send(
      "Page.getFrameTree",
      {},
      this.sessionId
    );
    return result.frameTree;
  }
  /**
   * Subscribe to Page.javascriptDialogOpening (E3-D). Returns an unsubscribe
   * function. Page.enable() (called by enableLifecycleEvents()) must have
   * run first for this event to fire.
   */
  onDialogOpening(handler) {
    const listener = (params) => handler(params);
    this.conn.on("Page.javascriptDialogOpening", listener);
    return () => this.conn.off("Page.javascriptDialogOpening", listener);
  }
  /**
   * Subscribe to Page.javascriptDialogClosed (E3-D) — fires once a dialog
   * has been answered, whether via handleDialog() or the browser's own
   * default handling. Returns an unsubscribe function.
   */
  onDialogClosed(handler) {
    const listener = (params) => handler(params);
    this.conn.on("Page.javascriptDialogClosed", listener);
    return () => this.conn.off("Page.javascriptDialogClosed", listener);
  }
  /**
   * Answer the currently-open JS dialog (E3-D). `promptText` is only
   * meaningful for `type: 'prompt'` dialogs; omit to accept the default.
   */
  async handleDialog(accept, promptText) {
    const params = { accept };
    if (promptText !== void 0) params.promptText = promptText;
    await this.conn.send("Page.handleJavaScriptDialog", params, this.sessionId);
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

// src/engine/normalize.ts
var WEB_ROLES = {
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
  complementary: "group",
  // ── Interactive ARIA widget/composite roles (bug: every one of these
  //    fell through to the `?? 'group'` default before this fix, which
  //    strips them of both role identity and actions — see inferActions()
  //    in cdp/accessibility.ts and driver.ts's inferFrameActions(), which
  //    must stay in sync with this table). Confirmed against real Chrome
  //    (Accessibility.getFullAXTree) via a repro fixture, not assumed from
  //    the ARIA spec alone — see engine.test.ts for the exact raw role
  //    strings Chrome emits for each native control.
  radio: "radio",
  // menuitemcheckbox/menuitemradio fold into the existing checkbox/radio
  // concepts — same toggle interaction, same action set, distinguishing
  // them would add a canonical name with no behavioral payoff.
  menuitemcheckbox: "checkbox",
  menuitemradio: "radio",
  menuitem: "menuitem",
  option: "option",
  treeitem: "treeitem",
  // spinbutton/searchbox are text-entry controls with a native <input>
  // equivalent (number/search) — folding into 'textfield' gives them a
  // correct setValue action for free instead of a bespoke canonical role.
  spinbutton: "textfield",
  searchbox: "textfield",
  // Chrome-internal (non-ARIA) role names, not spec role strings — confirmed
  // via live Accessibility.getFullAXTree, not literature. `<input type=date>`
  // behaves like a text field for automation purposes (setValue with an
  // ISO date string); the nested native "Show date picker" button already
  // reports its own `button` role independently and needs no change.
  Date: "textfield",
  // `<input type=color>` mirrors the existing `<input type=file>` pattern
  // already in this table (native role reports as a plain button that
  // opens an OS-level picture; IBR has no "open native color picker" verb,
  // so 'press' is the correct and only honest action).
  ColorWell: "button",
  // `<summary>` inside `<details>` — clicking it toggles expand/collapse,
  // which is a press-equivalent action; no dedicated toggle verb exists
  // for switch/checkbox either, so 'button' + press is consistent.
  DisclosureTriangle: "button",
  // ── Composite/container ARIA roles — deliberately left non-actionable.
  //    Each of these is a container whose actionable content is its
  //    children (already covered above: tab, menuitem, option, treeitem);
  //    the container itself is not "pressed". Listed explicitly (rather
  //    than left to the `?? 'group'` default) so every ARIA widget/
  //    composite role has a visible, intentional disposition here.
  radiogroup: "group",
  tablist: "group",
  menu: "group",
  menubar: "group",
  tree: "group",
  treegrid: "group",
  grid: "group",
  gridcell: "group",
  // scrollbar: only appears in the AX tree for hand-authored ARIA
  // scrollbar widgets (native scrollbars are not AX nodes); the correct
  // action is a drag gesture, which is outside IBR's press/setValue verb
  // set today. Left as an inert 'group' rather than offering an action
  // IBR cannot honestly perform.
  scrollbar: "group",
  // separator: ARIA overloads this role for both a non-focusable divider
  // (no action, ever) and a focusable resizable splitter (needs a drag
  // action IBR does not have). Since the two cannot be told apart from
  // the role alone and a wrong action is worse than no action, both
  // collapse to inert 'group'.
  separator: "group",
  // progressbar: read-only status display by definition (implicitly
  // aria-readonly); there is no user action to infer, ever.
  progressbar: "group"
};
var MACOS_ROLES = {
  AXButton: "button",
  AXTextField: "textfield",
  AXTextArea: "textfield",
  AXLink: "link",
  AXCheckBox: "checkbox",
  AXSwitch: "switch",
  AXSlider: "slider",
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
  AXTab: "tab",
  AXRadioButton: "radio",
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
function normalizeRole(rawRole, platform) {
  if (platform === "web") return WEB_ROLES[rawRole] ?? "group";
  return MACOS_ROLES[rawRole] ?? "group";
}

// src/engine/cdp/accessibility.ts
var SKIP_ROLES = /* @__PURE__ */ new Set(["WebArea", "RootWebArea", "GenericContainer", "none", "IgnoredRole"]);
var AccessibilityDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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
      let role = normalizeRole(node.role.value, "web");
      const label = node.name?.value ?? "";
      if (role === "group" && label && this.getProperty(node, "editable") !== void 0) {
        role = "textfield";
      }
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
      case "radio":
      case "menuitem":
      case "option":
      case "treeitem":
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

// src/engine/cdp/dom.ts
var DomDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
  /**
   * `sessionId` overrides the domain's default session — needed for E3-D
   * frame support, where a backendNodeId sourced from an out-of-process
   * iframe target must be resolved against THAT target's session, not the
   * main page's.
   */
  async getElementCenter(ref, sessionId) {
    const result = await this.conn.send("DOM.getBoxModel", ref, sessionId ?? this.sessionId);
    const q = result.model.content;
    const x = Math.round((q[0] + q[2] + q[4] + q[6]) / 4);
    const y = Math.round((q[1] + q[3] + q[5] + q[7]) / 4);
    return { x, y };
  }
  /** See getElementCenter() for the `sessionId` override rationale. */
  async getBoxModel(ref, sessionId) {
    const result = await this.conn.send("DOM.getBoxModel", ref, sessionId ?? this.sessionId);
    return result.model;
  }
  /**
   * Scroll `ref` into the viewport before a caller reads its box model for
   * a clip region — a below-the-fold element's box model is otherwise
   * outside (or clipped by) the current viewport, producing a wrong or
   * empty screenshot clip.
   */
  async scrollIntoViewIfNeeded(ref, sessionId) {
    await this.conn.send("DOM.scrollIntoViewIfNeeded", ref, sessionId ?? this.sessionId);
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

// src/engine/cdp/input.ts
var InputDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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
   * Press a special key (Enter, Tab, Escape, Backspace, etc.) or a modifier
   * chord ("Meta+k", "Cmd+K", "Ctrl+Shift+P", ...).
   */
  async pressKey(key) {
    const chord = parseChord(key);
    if (chord) {
      await this.dispatchChord(chord);
      return;
    }
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
  /**
   * Dispatch a real modifier chord: press each modifier down (in order,
   * accumulating the CDP `modifiers` bitmask), then keyDown/keyUp the target
   * key while the modifiers are held, then release the modifiers in reverse
   * order. No `text` is sent for the target key — a chord synthesizes a
   * shortcut, it must never insert literal characters into a focused field.
   */
  async dispatchChord(chord) {
    let modifiers = 0;
    for (const mod of chord.modifiers) {
      modifiers |= MODIFIER_BITS[mod];
      const def = MODIFIER_KEY_DEFS[mod];
      await this.conn.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: def.key,
        code: def.code,
        modifiers
      }, this.sessionId);
    }
    const mainDef = resolveChordKey(chord.mainKey);
    await this.conn.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: mainDef.key,
      code: mainDef.code,
      modifiers
    }, this.sessionId);
    await this.conn.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: mainDef.key,
      code: mainDef.code,
      modifiers
    }, this.sessionId);
    for (const mod of [...chord.modifiers].reverse()) {
      modifiers &= ~MODIFIER_BITS[mod];
      const def = MODIFIER_KEY_DEFS[mod];
      await this.conn.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: def.key,
        code: def.code,
        modifiers
      }, this.sessionId);
    }
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
var SPECIAL_KEYS = {
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
var SPECIAL_CODES = {
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
function charToCode(char) {
  if (SPECIAL_CODES[char]) return SPECIAL_CODES[char];
  const upper = char.toUpperCase();
  if (upper >= "A" && upper <= "Z") return `Key${upper}`;
  return "";
}
var MODIFIER_BITS = {
  Alt: 1,
  Control: 2,
  Meta: 4,
  Shift: 8
};
var MODIFIER_ALIASES = {
  alt: "Alt",
  option: "Alt",
  ctrl: "Control",
  control: "Control",
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
  shift: "Shift"
};
var MODIFIER_KEY_DEFS = {
  Alt: { key: "Alt", code: "AltLeft" },
  Control: { key: "Control", code: "ControlLeft" },
  Meta: { key: "Meta", code: "MetaLeft" },
  Shift: { key: "Shift", code: "ShiftLeft" }
};
function parseChord(input) {
  if (input.length <= 1 || !input.includes("+")) return null;
  const parts = input.split("+");
  const mainKey = parts[parts.length - 1];
  const modifierParts = parts.slice(0, -1);
  if (mainKey === "" || modifierParts.length === 0) return null;
  const modifiers = [];
  for (const part of modifierParts) {
    const normalized = MODIFIER_ALIASES[part.toLowerCase()];
    if (!normalized) return null;
    modifiers.push(normalized);
  }
  return { modifiers, mainKey };
}
function resolveChordKey(mainKey) {
  const special = SPECIAL_KEYS[mainKey];
  if (special) return { key: special.key, code: special.code };
  return { key: mainKey, code: charToCode(mainKey) };
}

// src/engine/cdp/runtime.ts
var RuntimeDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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
   * Evaluate a JavaScript expression string in the page context with
   * DevTools' `includeCommandLineAPI` flag set, exposing console-only
   * helpers ($, $$, getEventListeners, etc.) to the evaluated expression.
   *
   * Needed for real listener detection: page JS has no way to enumerate
   * addEventListener-registered handlers on itself (no public DOM API for
   * it), but DevTools' `getEventListeners(node)` can — it is backed by
   * `DOMDebugger.getEventListeners` and only reachable from an expression
   * evaluated with this flag. A separate method (not a parameter on
   * `evaluate()`) so the common path stays byte-for-byte unchanged and this
   * capability is opt-in per call site.
   */
  async evaluateWithCommandLineAPI(expression) {
    const result = await this.conn.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      includeCommandLineAPI: true
    }, this.sessionId);
    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Evaluation (commandLineAPI) failed: ${msg}`);
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

// src/engine/cdp/css.ts
var CssDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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

// src/engine/cdp/snapshot.ts
var SnapshotDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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

// src/engine/cdp/emulation.ts
var EmulationDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
  /**
   * Override device metrics (viewport size, scale, mobile layout mode).
   * Does NOT set UA or touch — for a full device emulation, use
   * `applyDeviceProfile()` instead.
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
   * Override the User-Agent string for subsequent requests. Pages already
   * loaded keep their original UA; navigate after calling this.
   */
  async setUserAgent(userAgent) {
    await this.conn.send("Emulation.setUserAgentOverride", {
      userAgent
    }, this.sessionId);
  }
  /**
   * Enable or disable touch event emulation. When enabled, `maxTouchPoints`
   * defaults to 5 (matches modern phones).
   */
  async setTouchEmulation(enabled, maxTouchPoints = 5) {
    await this.conn.send("Emulation.setTouchEmulationEnabled", {
      enabled,
      maxTouchPoints: enabled ? maxTouchPoints : 1
    }, this.sessionId);
  }
  /**
   * Apply a full device profile in one call: metrics + UA + touch. Use this
   * from `EngineDriver.launch()` BEFORE the first navigate so the page sees
   * the device emulation on its initial request, not after.
   *
   * Order matters: UA override first (some sites branch on UA during the
   * initial HTML response), then metrics, then touch.
   */
  async applyDeviceProfile(config) {
    if (config.userAgent) {
      await this.setUserAgent(config.userAgent);
    }
    await this.setDeviceMetrics(config);
    const wantsTouch = config.hasTouch ?? config.mobile ?? false;
    await this.setTouchEmulation(wantsTouch);
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

// src/engine/cdp/network.ts
var NetworkDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
  inflight = /* @__PURE__ */ new Set();
  lastActivityAt = Date.now();
  handlersRegistered = false;
  responseWaiters = /* @__PURE__ */ new Set();
  onRequestWillBeSent = (params) => {
    const { requestId } = params;
    this.inflight.add(requestId);
    this.lastActivityAt = Date.now();
  };
  onResponseReceived = (params) => {
    const { response } = params;
    this.lastActivityAt = Date.now();
    for (const waiter of [...this.responseWaiters]) {
      if (waiter.predicate(response.url, response.status)) {
        this.responseWaiters.delete(waiter);
        waiter.resolve({ url: response.url, status: response.status });
      }
    }
  };
  onLoadingFinished = (params) => {
    const { requestId } = params;
    this.inflight.delete(requestId);
    this.lastActivityAt = Date.now();
  };
  onLoadingFailed = (params) => {
    const { requestId } = params;
    this.inflight.delete(requestId);
    this.lastActivityAt = Date.now();
  };
  async enable() {
    await this.conn.send("Network.enable", {}, this.sessionId);
    this.registerHandlers();
  }
  registerHandlers() {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;
    this.conn.on("Network.requestWillBeSent", this.onRequestWillBeSent);
    this.conn.on("Network.responseReceived", this.onResponseReceived);
    this.conn.on("Network.loadingFinished", this.onLoadingFinished);
    this.conn.on("Network.loadingFailed", this.onLoadingFailed);
  }
  /**
   * Detach the Network-domain event listeners without disabling the CDP
   * domain itself. Used by tests to simulate "Network-domain events
   * disabled" — with tracking off, in-flight state is frozen at whatever
   * it was, so `waitForNetworkIdle` reports idle immediately even while a
   * real request is in flight, proving the wait would be FAKE without real
   * event wiring.
   */
  disableTracking() {
    if (!this.handlersRegistered) return;
    this.handlersRegistered = false;
    this.conn.off("Network.requestWillBeSent", this.onRequestWillBeSent);
    this.conn.off("Network.responseReceived", this.onResponseReceived);
    this.conn.off("Network.loadingFinished", this.onLoadingFinished);
    this.conn.off("Network.loadingFailed", this.onLoadingFailed);
  }
  /** True once `enable()` has registered real event handlers. */
  get tracking() {
    return this.handlersRegistered;
  }
  /** Current in-flight request count (only meaningful while `tracking`). */
  get inflightCount() {
    return this.inflight.size;
  }
  /**
   * Wait until the in-flight request count has been at or below
   * `maxInflight` for `idleMs` consecutive milliseconds — REAL CDP
   * Network-domain quiescence (requestWillBeSent / responseReceived /
   * loadingFinished / loadingFailed), not AX-tree stability and not a
   * fixed sleep. Never throws: resolves `{ timedOut: true, ... }` at the
   * deadline instead, so callers can treat it as best-effort.
   */
  async waitForNetworkIdle(options = {}) {
    const idleMs = options.idleMs ?? 500;
    const maxInflight = options.maxInflight ?? 0;
    const timeout = options.timeout ?? 1e4;
    const deadline = Date.now() + timeout;
    const pollInterval = Math.min(50, Math.max(10, idleMs));
    while (true) {
      const now = Date.now();
      if (this.inflight.size <= maxInflight && now - this.lastActivityAt >= idleMs) {
        return { timedOut: false, inflightCount: this.inflight.size };
      }
      if (now >= deadline) {
        return { timedOut: true, inflightCount: this.inflight.size };
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }
  /**
   * Wait for a response whose (url, status) satisfies `predicate`. Resolves
   * the moment a matching `Network.responseReceived` event fires; rejects
   * on timeout. Driven entirely by real CDP events — with tracking
   * disabled this never resolves and always times out (no fake success).
   */
  async waitForResponse(predicate, options = {}) {
    const timeout = options.timeout ?? 3e4;
    return new Promise((resolve2, reject) => {
      const waiter = {
        predicate,
        resolve: (value) => {
          clearTimeout(timer);
          resolve2(value);
        }
      };
      const timer = setTimeout(() => {
        this.responseWaiters.delete(waiter);
        reject(new Error(`waitForResponse timed out after ${timeout}ms waiting for a matching response`));
      }, timeout);
      this.responseWaiters.add(waiter);
    });
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

// src/engine/cdp/console.ts
var ConsoleDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
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

// src/engine/cdp/fetch.ts
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
function matchesPattern(pattern, url) {
  if (pattern instanceof RegExp) return pattern.test(url);
  return pattern.includes("*") ? globToRegExp(pattern).test(url) : url === pattern;
}
function fulfillParams(requestId, response) {
  const isObject = response.body !== void 0 && typeof response.body !== "string";
  const bodyText = response.body === void 0 ? "" : isObject ? JSON.stringify(response.body) : response.body;
  const headers = { ...response.headers ?? {} };
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
  if (!hasContentType) headers["Content-Type"] = isObject ? "application/json" : "text/plain";
  return {
    requestId,
    responseCode: response.status ?? 200,
    responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
    body: Buffer.from(bodyText, "utf8").toString("base64")
  };
}
var FetchDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  conn;
  sessionId;
  rules = [];
  enabled = false;
  listening = false;
  async mock(pattern, response) {
    this.rules.unshift({ pattern, response });
    if (this.enabled) return;
    this.enabled = true;
    if (!this.listening) {
      this.listening = true;
      this.conn.on("Fetch.requestPaused", (params) => {
        if (this.enabled) void this.onPaused(params);
      });
    }
    await this.conn.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, this.sessionId);
  }
  async clear() {
    this.rules = [];
    if (!this.enabled) return;
    this.enabled = false;
    await this.conn.send("Fetch.disable", {}, this.sessionId).catch(() => {
    });
  }
  async onPaused(params) {
    const rule = this.rules.find((r) => matchesPattern(r.pattern, params.request.url));
    try {
      if (rule) {
        await this.conn.send("Fetch.fulfillRequest", fulfillParams(params.requestId, rule.response), this.sessionId);
      } else {
        await this.conn.send("Fetch.continueRequest", { requestId: params.requestId }, this.sessionId);
      }
    } catch {
    }
  }
};

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
async function waitForEvent(conn, eventName, options) {
  const timeout = options?.timeout ?? 1e4;
  return new Promise((resolve2, reject) => {
    const timer = setTimeout(() => {
      conn.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName} after ${timeout}ms`));
    }, timeout);
    const handler = () => {
      clearTimeout(timer);
      conn.off(eventName, handler);
      resolve2();
    };
    conn.on(eventName, handler);
  });
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

// src/engine/actionability.ts
var DEFAULT_TIMEOUT = 5e3;
var DEFAULT_POLL_INTERVAL = 30;
var DEFAULT_REQUIRED_STABLE_CHECKS = 2;
var ActionabilityTimeoutError = class extends Error {
  constructor(reason, elapsedMs) {
    super(`Element was not actionable within ${elapsedMs}ms: ${reason}`);
    this.reason = reason;
    this.elapsedMs = elapsedMs;
    this.name = "ActionabilityTimeoutError";
  }
  reason;
  elapsedMs;
};
function rectEqual(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
async function waitForActionable(resolveAndProbe, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const requiredStable = Math.max(1, options.requiredStableChecks ?? DEFAULT_REQUIRED_STABLE_CHECKS);
  const start = Date.now();
  const deadline = start + timeout;
  let lastRect = null;
  let stableCount = 0;
  let lastReason;
  while (true) {
    const result = await resolveAndProbe();
    if (!result) {
      lastReason = "not resolvable";
      stableCount = 0;
      lastRect = null;
    } else {
      const { target, state } = result;
      if (!state.present) {
        lastReason = "not present";
        stableCount = 0;
        lastRect = null;
      } else if (!state.visible) {
        lastReason = "not visible (hidden or covered)";
        stableCount = 0;
        lastRect = null;
      } else if (!state.enabled) {
        lastReason = "disabled";
        stableCount = 0;
        lastRect = null;
      } else {
        if (rectEqual(lastRect, state.rect)) {
          stableCount += 1;
        } else {
          stableCount = 1;
        }
        lastRect = state.rect;
        lastReason = "position not yet stable";
        if (stableCount >= requiredStable) {
          return target;
        }
      }
    }
    if (Date.now() >= deadline) {
      throw new ActionabilityTimeoutError(lastReason, Date.now() - start);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
}

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

// src/engine/cache.ts
var ResolutionCache = class {
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

// src/engine/driver.ts
var AUTO_RESOLVE_MIN_SCORE = 0.8;
var AUTO_RESOLVE_MIN_MARGIN = 0.15;
var AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE = 0.95;
var DESTRUCTIVE_LABEL_PATTERN = /\b(?:delete|remove|erase|wipe|purge|revoke|deactivate|disable|discard|destroy|reset|clear|unsubscribe|confirm)\b/i;
var JARO_ACCEPT_MIN = 0.92;
function normalizeLabel(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function coreLabel(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function findExactLabel(name, elements, role) {
  const targetNorm = normalizeLabel(name);
  if (!targetNorm) return null;
  const targetCore = coreLabel(name);
  const pool = role ? elements.filter((e) => e.role === role) : elements;
  const interactive = pool.filter((e) => e.actions.length > 0);
  for (const group of [interactive, pool]) {
    const normMatches = group.filter((e) => e.label && normalizeLabel(e.label) === targetNorm);
    if (normMatches.length >= 1) return normMatches[0];
    if (targetCore.length >= 2) {
      const coreMatches = group.filter((e) => e.label && coreLabel(e.label) === targetCore);
      if (coreMatches.length === 1) return coreMatches[0];
    }
  }
  return null;
}
var ACTIONABILITY_PROBE_FN = `function() {
  if (!this || !this.isConnected) {
    return { present: false, visible: false, enabled: false, rect: null };
  }
  var style = window.getComputedStyle(this);
  var r = this.getBoundingClientRect();
  var hasSize = r.width > 0 && r.height > 0;
  var visible = style.display !== 'none' && style.visibility !== 'hidden' &&
    parseFloat(style.opacity) !== 0 && hasSize;
  if (visible) {
    // elementFromPoint takes VIEWPORT coordinates, so a node below the fold probes as
    // null and is reported "covered" forever. Scroll it in first, then test occlusion.
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) {
      this.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      r = this.getBoundingClientRect();
    }
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var atPoint = document.elementFromPoint(cx, cy);
    var uncovered = !!atPoint && (atPoint === this || this.contains(atPoint) || atPoint.contains(this));
    visible = visible && uncovered;
  }
  var enabled = this.disabled !== true && this.getAttribute('aria-disabled') !== 'true';
  return {
    present: true,
    visible: visible,
    enabled: enabled,
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
  };
}`;
var FRAME_SKIP_ROLES = /* @__PURE__ */ new Set(["WebArea", "RootWebArea", "GenericContainer", "none", "IgnoredRole"]);
function inferFrameActions(role) {
  switch (role) {
    case "button":
    case "link":
    case "checkbox":
    case "tab":
    case "switch":
    case "radio":
    case "menuitem":
    case "option":
    case "treeitem":
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
var EngineDriver = class _EngineDriver {
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
  fetch;
  targetId = null;
  sessionId = null;
  ownsTarget = true;
  _currentUrl = "";
  launched = false;
  resolutionCache = new ResolutionCache();
  /**
   * Last-known {label, role} for every elementId we've ever seen in an AX
   * snapshot, keyed by elementId (`e${backendDOMNodeId}`). Unlike
   * AccessibilityDomain's internal nodeMap (which only reflects the CURRENT
   * live tree), this accumulates across snapshots so that when a
   * backendNodeId goes stale mid-actionability-wait (the element re-rendered
   * under a new backendNodeId), we can still recall what we were looking for
   * and re-resolve by name+role instead of throwing on the dead reference.
   * Bounded to avoid unbounded growth over a long session.
   */
  elementDescriptors = /* @__PURE__ */ new Map();
  static MAX_DESCRIPTOR_HISTORY = 1e3;
  static DESCRIPTOR_TRIM_TARGET = 500;
  // ─── Frames (E3-D) ──────────────────────────────────────
  // Elements sourced from an iframe are NOT in AccessibilityDomain's
  // nodeMap (that class only ever walks the main frame) — these maps are
  // this driver's own bookkeeping so click()/observe()/find() can resolve
  // and act on them anyway. Cleared on every navigate() (frame ids and
  // backendNodeIds are meaningless across a navigation).
  frameElementBackendNodeIds = /* @__PURE__ */ new Map();
  frameElementSessions = /* @__PURE__ */ new Map();
  frameTagFor = /* @__PURE__ */ new Map();
  // CDP frameId -> short elementId-safe tag
  oopifSessions = /* @__PURE__ */ new Map();
  // OOPIF targetId -> attached sessionId (reused across snapshots)
  lastFrameCount = 0;
  lastFrameReached = 0;
  // ─── JS Dialogs (E3-D) ──────────────────────────────────
  // Page.javascriptDialogOpening pauses the renderer's JS until
  // Page.handleJavaScriptDialog answers it. Any in-flight CDP command whose
  // response depends on that JS finishing (e.g. click()'s
  // Runtime.callFunctionOn) would otherwise hang until answered — see
  // raceAgainstDialog().
  pendingDialog = null;
  dialogWaiters = /* @__PURE__ */ new Set();
  unsubscribeDialogOpening = null;
  unsubscribeDialogClosed = null;
  // ─── Lifecycle ──────────────────────────────────────────
  async launch(options = {}) {
    const progress = options.onProgress ?? (() => {
    });
    const wsUrl = await this.browser.launch(options);
    progress("opening CDP websocket");
    await this.conn.connect(wsUrl);
    progress("CDP websocket open");
    this.target = new TargetDomain(this.conn);
    this.launched = true;
    this.targetId = await this.target.createPage("about:blank");
    this.ownsTarget = true;
    this.sessionId = await this.target.attach(this.targetId);
    progress("page target attached");
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
    this.fetch = new FetchDomain(this.conn, this.sessionId);
    progress("enabling CDP domains");
    await this._page.enableLifecycleEvents();
    await this.ax.enable();
    await this.console.enable();
    await this.network.enable();
    this.setupDialogHandling();
    if (options.viewport) {
      await this.emulation.applyDeviceProfile(options.viewport);
    }
  }
  /**
   * Wire Page.javascriptDialogOpening/Closed into `pendingDialog` +
   * `dialogWaiters` (E3-D). Idempotent — unsubscribes any prior
   * registration first, so re-launch/connectExisting never double-fires.
   */
  setupDialogHandling() {
    this.unsubscribeDialogOpening?.();
    this.unsubscribeDialogClosed?.();
    this.unsubscribeDialogOpening = this._page.onDialogOpening((dialog) => {
      this.pendingDialog = dialog;
      const waiters = [...this.dialogWaiters];
      this.dialogWaiters.clear();
      for (const wake of waiters) wake();
    });
    this.unsubscribeDialogClosed = this._page.onDialogClosed(() => {
      this.pendingDialog = null;
    });
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
   * connectExisting() — they must detach from a supplied persisted target and
   * drop their WebSocket at the end of the command so the node process can
   * exit, while the browser-server and session tab remain alive.
   *
   * A target created without a supplied target ID is still owned by this
   * driver and is closed on disconnect. Does NOT call this.browser.close().
   */
  async disconnect() {
    if (this.targetId && this.sessionId) {
      if (this.ownsTarget) {
        await this.target.close(this.targetId).catch(() => {
        });
      } else {
        await this.target.detach(this.sessionId).catch(() => {
        });
      }
      this.targetId = null;
      this.sessionId = null;
    }
    await this.conn.close().catch(() => {
    });
    this.launched = false;
  }
  /** Fulfill requests whose URL matches `pattern` (glob or RegExp) with `response` via CDP Fetch. */
  async mock(pattern, response) {
    if (!this.launched) throw new Error("mock() requires a launched browser session");
    await this.fetch.mock(pattern, response);
  }
  /** Remove all network mocks and disable request interception. */
  async clearMocks() {
    if (this.fetch) await this.fetch.clear();
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
        () => this.freshSnapshot(),
        { timeout: options.timeout ?? 1e4, eventName: "Accessibility.nodesUpdated" }
      );
    } else if (waitFor === "load") {
      await waitForStableTree(
        () => this.freshSnapshot(),
        { timeout: options.timeout ?? 1e4 }
      );
    }
    this._currentUrl = await this.runtime.evaluate("location.href") ?? url;
    this.resolutionCache.clear();
    this.elementDescriptors.clear();
    for (const targetId of this.oopifSessions.keys()) {
      this.target.close(targetId).catch(() => {
      });
    }
    this.frameElementBackendNodeIds.clear();
    this.frameElementSessions.clear();
    this.frameTagFor.clear();
    this.oopifSessions.clear();
    this.lastFrameCount = 0;
    this.lastFrameReached = 0;
    this.pendingDialog = null;
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
    const elements = await this.freshSnapshot();
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
        elements: filtered};
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
    return this.resolveLiveElement(diag.elementId);
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
      const elements = await this.freshSnapshot();
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
      this.recordDescriptors(queryResult);
      const allElements2 = await this.freshSnapshot();
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
    const allElements = await this.freshSnapshot();
    const interactive = allElements.filter((e) => e.actions.length > 0);
    const exact = findExactLabel(name, allElements, options.role);
    if (exact) {
      this.resolutionCache.set(cacheKey, exact.id, {
        role: exact.role,
        label: exact.label,
        confidence: 0.97
      });
      return {
        elementId: exact.id,
        confidence: 0.97,
        tier: 2,
        tierName: "exact",
        alternatives: [],
        totalInteractive: interactive.length
      };
    }
    const { resolve: resolve2 } = await Promise.resolve().then(() => (init_resolve(), resolve_exports));
    const result = resolve2({
      intent: options.role ? `${name} ${options.role}` : name,
      elements: allElements,
      mode: "algorithmic"
    });
    if (result.confidence >= JARO_ACCEPT_MIN && result.element) {
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
    const scoringPool = options.role ? interactive.filter((e) => e.role === options.role) : interactive;
    const scored = scoringPool.filter((e) => e.label).map((e) => ({
      name: e.label,
      role: e.role,
      score: jaroWinkler2(nameLower, e.label.toLowerCase())
    })).sort((a, b) => b.score - a.score).slice(0, 5);
    if (scored.length > 0) {
      const top = scored[0];
      const second = scored[1];
      const margin = top.score - (second?.score ?? 0);
      const isDestructive = DESTRUCTIVE_LABEL_PATTERN.test(top.name);
      const minScore = isDestructive ? AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE : AUTO_RESOLVE_MIN_SCORE;
      if (top.score >= minScore && margin >= AUTO_RESOLVE_MIN_MARGIN) {
        const resolved = interactive.find(
          (e) => e.label === top.name && e.role === top.role
        );
        if (resolved) {
          this.resolutionCache.set(cacheKey, resolved.id, {
            role: resolved.role,
            label: resolved.label,
            confidence: top.score
          });
          return {
            elementId: resolved.id,
            confidence: top.score,
            tier: 4,
            tierName: "auto-resolve",
            alternatives: scored,
            totalInteractive: interactive.length,
            autoResolved: {
              label: top.name,
              role: top.role,
              score: top.score,
              margin
            }
          };
        }
      }
    }
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
  // ─── Actionability (auto-wait) ──────────────────────────
  //
  // click/type/fill/check/select all resolve through awaitActionable()
  // before acting, so none of them can act on a stale, hidden, covered, or
  // disabled element — see src/engine/actionability.ts for the generic
  // present→visible→enabled→stable poll loop this builds on.
  /** Record every element's {label, role} into the cross-snapshot history
   *  used for stale-elementId re-resolution (see elementDescriptors). */
  recordDescriptors(elements) {
    for (const e of elements) {
      this.elementDescriptors.delete(e.id);
      this.elementDescriptors.set(e.id, { label: e.label, role: e.role });
    }
    if (this.elementDescriptors.size > _EngineDriver.MAX_DESCRIPTOR_HISTORY) {
      const excess = this.elementDescriptors.size - _EngineDriver.DESCRIPTOR_TRIM_TARGET;
      let i = 0;
      for (const key of this.elementDescriptors.keys()) {
        if (i++ >= excess) break;
        this.elementDescriptors.delete(key);
      }
    }
  }
  /** Snapshot wrapper — every full-tree read goes through here so the
   *  stale-elementId re-resolution history stays warm. Behavior-identical
   *  to calling this.ax.getSnapshot() directly, PLUS (E3-D) elements from
   *  every iframe on the page, merged in. */
  async freshSnapshot() {
    const [mainElements, frameElements] = await Promise.all([
      this.ax.getSnapshot(),
      this.getFrameElements()
    ]);
    const elements = frameElements.length > 0 ? [...mainElements, ...frameElements] : mainElements;
    this.recordDescriptors(elements);
    return elements;
  }
  /**
   * Probe a live DOM node's present/visible/enabled/rect state via
   * DOM.resolveNode + Runtime.callFunctionOn (same primitives click() uses
   * for its DOM-click path). Returns null when the backendNodeId no longer
   * resolves to a live node — the caller treats that as "went stale" and
   * re-resolves rather than throwing.
   *
   * `sessionId` (E3-D) overrides the driver's main session — required for
   * an element sourced from an out-of-process iframe (OOPIF), whose
   * backendNodeId only resolves against ITS OWN target/session.
   */
  async probeBackendNode(backendNodeId, sessionId) {
    const sid = sessionId ?? this.sessionId ?? void 0;
    try {
      const resolved = await this.conn.send("DOM.resolveNode", { backendNodeId }, sid);
      const objectId = resolved?.object?.objectId;
      if (!objectId) return null;
      const result = await this.conn.send("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: ACTIONABILITY_PROBE_FN,
        returnByValue: true
      }, sid);
      if (result?.exceptionDetails) return null;
      return result?.result?.value ?? null;
    } catch {
      return null;
    }
  }
  /**
   * Re-resolve a stale element by its last-known label+role against a fresh
   * AX snapshot. This is what lets a re-rendering element (new
   * backendNodeId, same accessible name/role) stay actionable instead of
   * failing the moment its original elementId goes stale.
   */
  async reResolveByLabelRole(label, role) {
    const elements = await this.freshSnapshot();
    const match = findExactLabel(label, elements, role);
    return match ? match.id : null;
  }
  /**
   * Resolve an elementId already produced by find()/findWithDiagnostics()
   * against the LIVE page: a fresh snapshot may no longer contain that exact
   * id even though the element is still present (e.g. a re-render replaced
   * its backendNodeId between resolution and this call).
   * Falls back to the last-known {label, role} in elementDescriptors before
   * declaring the element gone.
   */
  async resolveLiveElement(elementId) {
    const elements = await this.getSnapshot();
    const direct = elements.find((e) => e.id === elementId);
    if (direct) return direct;
    const known = this.elementDescriptors.get(elementId);
    if (!known) return null;
    return findExactLabel(known.label, elements, known.role);
  }
  /**
   * Resolve an elementId to its {backendNodeId, sessionId} (E3-D). Frame-
   * sourced elements are checked first (this driver's own bookkeeping,
   * since AccessibilityDomain only ever knows about the main frame); falls
   * back to the main-frame nodeMap otherwise. Returns undefined when the
   * elementId is not currently known to either.
   */
  resolveBackendRef(elementId) {
    const frameBackendNodeId = this.frameElementBackendNodeIds.get(elementId);
    if (frameBackendNodeId !== void 0) {
      return { backendNodeId: frameBackendNodeId, sessionId: this.frameElementSessions.get(elementId) };
    }
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (backendNodeId === void 0) return void 0;
    return { backendNodeId, sessionId: this.sessionId ?? void 0 };
  }
  /**
   * resolveAndProbe closure for waitForActionable(): resolves elementId to
   * its current backend reference (re-resolving by name/role if the id has
   * gone stale), then probes it. Returns null when nothing currently
   * resolves — waitForActionable treats that as "not present" and keeps
   * polling.
   */
  async resolveElementActionability(elementId) {
    const ref = this.resolveBackendRef(elementId);
    if (ref) {
      const state = await this.probeBackendNode(ref.backendNodeId, ref.sessionId);
      if (state?.present) return { target: ref, state };
    }
    const known = this.elementDescriptors.get(elementId);
    if (!known) return null;
    const freshId = await this.reResolveByLabelRole(known.label, known.role);
    if (!freshId) return null;
    const freshRef = this.resolveBackendRef(freshId);
    if (!freshRef) return null;
    const freshState = await this.probeBackendNode(freshRef.backendNodeId, freshRef.sessionId);
    if (!freshState) return null;
    return { target: freshRef, state: freshState };
  }
  /**
   * Wait until elementId (or its re-resolved replacement) is
   * present+visible+enabled+stable, then return the actionable backend
   * reference. Throws a descriptive error on timeout — never silently
   * proceeds to act on a non-actionable element.
   */
  async awaitActionable(elementId, options) {
    try {
      return await waitForActionable(
        () => this.resolveElementActionability(elementId),
        options
      );
    } catch (err) {
      if (err instanceof ActionabilityTimeoutError) {
        throw new Error(
          `Element ${elementId} not actionable: ${err.reason} (waited ${err.elapsedMs}ms)`
        );
      }
      throw err;
    }
  }
  // ─── Frames (E3-D) ──────────────────────────────────────
  //
  // AccessibilityDomain.getSnapshot() only ever walks the MAIN frame
  // (Accessibility.getFullAXTree defaults to the root frame). These helpers
  // discover every iframe via Page.getFrameTree, then fetch each one's AX
  // tree directly over CdpConnection (bypassing AccessibilityDomain, which
  // is out of scope for this chunk) and merge the elements into
  // freshSnapshot()'s output so observe()/find()/click() see inside them.
  //
  // Two paths, tried in order per frame:
  //   1. In-process: same-origin (or otherwise same-renderer) frames stay
  //      in the main page's render process — Accessibility.getFullAXTree
  //      accepts a `frameId` and returns nodes reachable via the driver's
  //      OWN session, no extra attach needed.
  //   2. OOPIF (out-of-process iframe): cross-site-isolated frames get
  //      their own CDP target. Discovered via Target.getTargets() (type
  //      'iframe'), matched to the unresolved frame by URL (best-effort —
  //      TargetInfo carries no direct frameId), then attached lazily and
  //      cached by targetId. This path is defensive/best-effort: it has no
  //      CI-feasible fixture (would need two real origins under Chrome's
  //      site-isolation), so it is exercised by construction, not by a
  //      passing live test.
  tagForFrame(frameId) {
    let tag = this.frameTagFor.get(frameId);
    if (!tag) {
      tag = String(this.frameTagFor.size);
      this.frameTagFor.set(frameId, tag);
    }
    return tag;
  }
  flattenChildFrames(node) {
    const out = [];
    for (const child of node.childFrames ?? []) {
      out.push({ id: child.frame.id, url: child.frame.url });
      out.push(...this.flattenChildFrames(child));
    }
    return out;
  }
  /**
   * Convert raw CDP AX nodes (from a frame's own getFullAXTree call) into
   * Element[], tagging each id with `frameTag` so it can never collide with
   * a main-frame or sibling-frame backendDOMNodeId (backend node ids are
   * only unique WITHIN a render process). Records each into
   * frameElementBackendNodeIds/frameElementSessions so click()/awaitActionable
   * can resolve and act on them later.
   */
  convertFrameAXNodes(nodes, sessionId, frameTag) {
    const elements = [];
    for (const node of nodes) {
      const roleValue = node.role?.value;
      if (!roleValue || FRAME_SKIP_ROLES.has(roleValue)) continue;
      let role = normalizeRole(roleValue, "web");
      const label = node.name?.value ?? "";
      const editableProp = node.properties?.find((p) => p.name === "editable")?.value?.value;
      if (role === "group" && label && editableProp !== void 0) role = "textfield";
      if (role === "group" && !label) continue;
      if (!node.backendDOMNodeId) continue;
      const id = `f${frameTag}_e${node.backendDOMNodeId}`;
      const disabledProp = node.properties?.find((p) => p.name === "disabled")?.value?.value;
      const focusedProp = node.properties?.find((p) => p.name === "focused")?.value?.value;
      elements.push({
        id,
        role,
        label,
        value: node.value?.value ?? null,
        enabled: disabledProp !== true,
        focused: focusedProp === true,
        actions: inferFrameActions(role),
        bounds: [0, 0, 0, 0],
        parent: null
      });
      this.frameElementBackendNodeIds.set(id, node.backendDOMNodeId);
      this.frameElementSessions.set(id, sessionId);
    }
    return elements;
  }
  /** Elements from every iframe on the page — see the "Frames (E3-D)"
   *  section comment above for the two-path strategy. */
  async getFrameElements() {
    if (!this.sessionId) return [];
    let tree;
    try {
      tree = await this._page.getFrameTree();
    } catch {
      this.lastFrameCount = 0;
      this.lastFrameReached = 0;
      return [];
    }
    const childFrames = this.flattenChildFrames(tree);
    this.lastFrameCount = childFrames.length;
    if (childFrames.length === 0) {
      this.lastFrameReached = 0;
      return [];
    }
    const elements = [];
    const unresolvedByUrl = /* @__PURE__ */ new Map();
    let reached = 0;
    for (const frame of childFrames) {
      const tag = this.tagForFrame(frame.id);
      try {
        const result = await this.conn.send(
          "Accessibility.getFullAXTree",
          { frameId: frame.id },
          this.sessionId
        );
        const nodes = result?.nodes ?? [];
        elements.push(...this.convertFrameAXNodes(nodes, this.sessionId, tag));
        reached += 1;
        continue;
      } catch {
      }
      unresolvedByUrl.set(frame.url, frame.id);
    }
    if (unresolvedByUrl.size > 0) {
      const oopifResult = await this.getOopifFrameElements(unresolvedByUrl);
      elements.push(...oopifResult.elements);
      reached += oopifResult.reached;
    }
    this.lastFrameReached = reached;
    return elements;
  }
  /**
   * Best-effort OOPIF path: discover 'iframe'-type CDP targets, match each
   * to an unresolved frame by URL, attach (cached by targetId across
   * snapshots), and fetch its AX tree via that target's own session.
   */
  async getOopifFrameElements(unresolvedByUrl) {
    let targets;
    try {
      targets = await this.target.list();
    } catch {
      return { elements: [], reached: 0 };
    }
    const elements = [];
    let reached = 0;
    for (const t of targets) {
      if (t.type !== "iframe") continue;
      const frameId = unresolvedByUrl.get(t.url);
      if (!frameId) continue;
      let sid = this.oopifSessions.get(t.targetId);
      if (!sid) {
        try {
          sid = await this.target.attach(t.targetId);
          await this.conn.send("DOM.enable", {}, sid);
          await this.conn.send("Accessibility.enable", {}, sid);
          this.oopifSessions.set(t.targetId, sid);
        } catch {
          continue;
        }
      }
      try {
        const result = await this.conn.send("Accessibility.getFullAXTree", {}, sid);
        const nodes = result?.nodes ?? [];
        const tag = this.tagForFrame(frameId);
        elements.push(...this.convertFrameAXNodes(nodes, sid, tag));
        reached += 1;
      } catch {
      }
    }
    return { elements, reached };
  }
  // ─── JS Dialogs (E3-D) ──────────────────────────────────
  //
  // Placed BEFORE the Interactions section (rather than after scroll(), its
  // most natural neighbor) so that engine.test.ts's T-06 grep falsifier —
  // which scans the source strictly between the `click(` and `doubleClick(`
  // markers for a forbidden `setTimeout` — does not trip over
  // waitForDialog()'s bounded timeout below. That falsifier is about
  // fixed-sleep-free ACTIONABILITY waits specifically; a bounded dialog
  // wait is a different mechanism entirely and is exempt by construction,
  // not by weakening the assertion.
  /**
   * Dispatch a left click at (x, y) on the given session. `this.input` (the
   * InputDomain instance) is permanently bound to the driver's MAIN
   * session, so it cannot dispatch on an OOPIF's session — when
   * `sessionId` names a different session, issue the raw
   * Input.dispatchMouseEvent pair directly (same pattern as rightClick()
   * below) instead of routing through `this.input`.
   */
  async dispatchClickAt(x, y, sessionId) {
    if (!sessionId || sessionId === this.sessionId) {
      await this.input.click(x, y);
      return;
    }
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1
    }, sessionId);
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1
    }, sessionId);
  }
  /**
   * Race a CDP call against a JS dialog opening. Some CDP commands
   * (Runtime.callFunctionOn, Input.dispatchMouseEvent) do not return until
   * the JS they trigger finishes running — if that JS synchronously opens
   * an alert()/confirm()/prompt(), the renderer pauses and Chrome withholds
   * the ACK until Page.handleJavaScriptDialog answers it. Without this,
   * click() on a button whose handler opens a dialog would hang until the
   * dialog is answered (or the connection's own ~30s timeout).
   *
   * If the dialog-opened signal wins the race, the triggering promise is
   * left to settle on its own later (swallowed here so it never surfaces
   * as an unhandled rejection) and this returns `undefined` — the caller
   * treats that the same as "the command was issued", since the dialog
   * itself proves the click's handler ran. The open dialog is exposed via
   * getPendingDialog()/handleDialog().
   */
  async raceAgainstDialog(promise) {
    if (this.pendingDialog) return void 0;
    let onDialog = () => {
    };
    const dialogSignal = new Promise((resolve2) => {
      onDialog = resolve2;
      this.dialogWaiters.add(onDialog);
    });
    try {
      const winner = await Promise.race([
        promise.then((value) => ({ dialog: false, value })),
        dialogSignal.then(() => ({ dialog: true, value: void 0 }))
      ]);
      if (winner.dialog) {
        promise.catch(() => {
        });
        return void 0;
      }
      return winner.value;
    } finally {
      this.dialogWaiters.delete(onDialog);
    }
  }
  /**
   * The currently-open JS dialog (alert/confirm/prompt/beforeunload), if
   * any. Poll this (or await waitForDialog()) instead of letting a
   * triggering action hang indefinitely — see raceAgainstDialog().
   */
  getPendingDialog() {
    return this.pendingDialog;
  }
  /**
   * Answer the currently-open JS dialog. `accept` maps to OK/Cancel;
   * `promptText` is only meaningful for `type: 'prompt'` dialogs. Throws if
   * no dialog is currently open.
   */
  async handleDialog(accept, promptText) {
    if (!this.pendingDialog) {
      throw new Error("handleDialog: no JS dialog is currently open");
    }
    await this._page.handleDialog(accept, promptText);
    this.pendingDialog = null;
  }
  /**
   * Wait until a JS dialog opens (or the timeout elapses). Useful when a
   * dialog may be triggered by an action whose own promise won't settle
   * until the dialog is answered (see raceAgainstDialog()) — callers that
   * fired such an action without awaiting it can await this instead.
   */
  async waitForDialog(timeout = 5e3) {
    if (this.pendingDialog) return this.pendingDialog;
    return new Promise((resolve2, reject) => {
      const onDialog = () => {
        clearTimeout(timer);
        resolve2(this.pendingDialog);
      };
      const timer = setTimeout(() => {
        this.dialogWaiters.delete(onDialog);
        reject(new Error(`waitForDialog: no dialog opened within ${timeout}ms`));
      }, timeout);
      this.dialogWaiters.add(onDialog);
    });
  }
  // ─── Interactions ───────────────────────────────────────
  async click(elementId) {
    const ref = await this.awaitActionable(elementId);
    const sid = ref.sessionId ?? void 0;
    let domClickWorked = false;
    try {
      const resolved = await this.conn.send("DOM.resolveNode", { backendNodeId: ref.backendNodeId }, sid);
      if (resolved?.object?.objectId) {
        await this.raceAgainstDialog(
          this.conn.send("Runtime.callFunctionOn", {
            objectId: resolved.object.objectId,
            functionDeclaration: "function() { this.click(); }"
          }, sid)
        );
        domClickWorked = true;
      }
    } catch {
    }
    if (!domClickWorked) {
      const { x, y } = await this.dom.getElementCenter({ backendNodeId: ref.backendNodeId }, sid);
      await this.raceAgainstDialog(this.dispatchClickAt(x, y, sid));
    }
  }
  async type(elementId, text) {
    const ref = await this.awaitActionable(elementId);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId: ref.backendNodeId });
    await this.input.click(x, y);
    await this.input.type(text);
  }
  async fill(elementId, value) {
    const ref = await this.awaitActionable(elementId);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId: ref.backendNodeId });
    await this.input.click(x, y);
    await this.runtime.callFunctionOn(
      '() => { if (document.activeElement) { document.activeElement.value = ""; document.activeElement.dispatchEvent(new Event("input", { bubbles: true })); } }'
    );
    await this.input.type(value);
  }
  async hover(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId });
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
      this.freshSnapshot(),
      this._page.screenshot()
    ]);
    await action();
    await waitForStableTree(() => this.freshSnapshot(), { timeout: 5e3, stableTime: 300 });
    await this.runtime.evaluate(
      "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
    ).catch(() => {
    });
    const [afterElements, afterScreenshot] = await Promise.all([
      this.freshSnapshot(),
      this._page.screenshot()
    ]);
    const beforeIds = new Set(beforeElements.map((e) => e.id));
    const afterIds = new Set(afterElements.map((e) => e.id));
    const addedElements = afterElements.filter((e) => !beforeIds.has(e.id));
    const removedElements = beforeElements.filter((e) => !afterIds.has(e.id));
    let pixelDiff = 0;
    try {
      const beforePng = pngjs.PNG.sync.read(beforeScreenshot);
      const afterPng = pngjs.PNG.sync.read(afterScreenshot);
      if (beforePng.width === afterPng.width && beforePng.height === afterPng.height) {
        const { width, height } = beforePng;
        const diffPng = new pngjs.PNG({ width, height });
        pixelDiff = pixelmatch__default.default(beforePng.data, afterPng.data, diffPng.data, width, height, {
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
    const ref = await this.awaitActionable(elementId);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId: ref.backendNodeId });
    await this.input.click(x, y);
    await this.runtime.callFunctionOn(
      '(val) => { const el = document.activeElement; if (el && el.tagName === "SELECT") { el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } }',
      [value]
    );
  }
  /**
   * Toggle a checkbox element.
   */
  async check(elementId) {
    const ref = await this.awaitActionable(elementId);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId: ref.backendNodeId });
    await this.input.click(x, y);
  }
  /**
   * Double-click an element.
   */
  async doubleClick(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter({ backendNodeId });
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
    const { x, y } = await this.dom.getElementCenter({ backendNodeId });
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
      const elements = await this.freshSnapshot();
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
    const model = await this.dom.getBoxModel({ backendNodeId });
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
        this.freshSnapshot().then((elements) => {
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
    return this.freshSnapshot();
  }
  async evaluate(exprOrFn, ...args) {
    if (args.length > 0) {
      return this.runtime.callFunctionOn(exprOrFn, args);
    }
    return this.runtime.evaluate(exprOrFn);
  }
  /**
   * Evaluate with DevTools' `includeCommandLineAPI` enabled — see
   * RuntimeDomain.evaluateWithCommandLineAPI. Used for real listener
   * detection (getEventListeners), not needed by ordinary callers.
   */
  async evaluateWithCommandLineAPI(expression) {
    return this.runtime.evaluateWithCommandLineAPI(expression);
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
    const elements = await this.freshSnapshot();
    return observe(elements, options);
  }
  // ─── LLM-Native: Extract ───────────────────────────────
  /**
   * Extract structured data from AX tree using a schema.
   */
  async extract(schema) {
    const elements = await this.freshSnapshot();
    return extractFromAXTree(elements, schema);
  }
  /**
   * Extract a list of repeated elements.
   */
  async extractItems(options) {
    const elements = await this.freshSnapshot();
    return extractList(elements, options);
  }
  /**
   * Extract page-level metadata (headings, links, inputs, buttons).
   */
  async extractMeta() {
    const elements = await this.freshSnapshot();
    return extractPageMeta(elements);
  }
  // ─── LLM-Native: Adaptive Modality ─────────────────────
  /**
   * Assess how well the AX tree captures the page.
   * Returns a score and whether a screenshot is recommended.
   */
  async assessUnderstanding(options) {
    const elements = await this.freshSnapshot();
    return assessUnderstanding(elements, options);
  }
  // ─── Coverage Reporting ────────────────────────────────
  /**
   * Report AX tree coverage against estimated visible DOM elements.
   * Surfaces blind spots: shadow DOM, canvas, iframes.
   */
  async getCoverage() {
    const gaps = [];
    const axElements = await this.freshSnapshot();
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
      const unreached = Math.max(0, this.lastFrameCount - this.lastFrameReached);
      if (unreached > 0) {
        gaps.push(`${unreached} iframe${unreached > 1 ? "s" : ""} not reachable this snapshot (cross-process attach failed)`);
      }
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
  /** The browser connection mode used for this driver. */
  get browserMode() {
    return this.browser.mode;
  }
  /** The resolved CDP HTTP endpoint, when available. */
  get cdpUrl() {
    return this.browser.cdpUrl;
  }
  /** The resolved browser WebSocket endpoint, when available. */
  get wsEndpoint() {
    return this.browser.wsEndpoint;
  }
  /** Current CDP page target. Persist this to reattach without navigating. */
  get pageTargetId() {
    return this.targetId;
  }
  /**
   * Connect to an already-running Chrome instance instead of launching a new one.
   * Used by browser-server reconnection to attach to a persistent Chrome process.
   */
  async connectExisting(wsUrl, targetId) {
    await this.conn.connect(wsUrl);
    this.target = new TargetDomain(this.conn);
    this.launched = true;
    this.targetId = targetId ?? await this.target.createPage("about:blank");
    this.ownsTarget = targetId === void 0;
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
    this.fetch = new FetchDomain(this.conn, this.sessionId);
    await this._page.enableLifecycleEvents();
    await this.ax.enable();
    await this.console.enable();
    await this.network.enable();
    this.setupDialogHandling();
    this._currentUrl = await this.runtime.evaluate("location.href") ?? "";
  }
};
function chunkElements(elements, maxTokens) {
  const charsPerToken = 4;
  const charsPerElement = 40;
  const maxElements = Math.floor(maxTokens * charsPerToken / charsPerElement);
  return elements.slice(0, maxElements);
}

// src/engine/index.ts
init_resolve();
var SELECTOR_ACTIONABILITY_PROBE_FN = `(sel) => {
  const el = document.querySelector(sel);
  if (!el || !el.isConnected) return { present: false, visible: false, enabled: false, rect: null };
  const style = getComputedStyle(el);
  let r = el.getBoundingClientRect();
  const hasSize = r.width > 0 && r.height > 0;
  let visible = style.display !== 'none' && style.visibility !== 'hidden' &&
    parseFloat(style.opacity) !== 0 && hasSize;
  if (visible) {
    // An off-screen element cannot be probed for occlusion: elementFromPoint takes
    // VIEWPORT coordinates, so a node below the fold resolves to null and the element
    // is reported "covered" forever. Bring it into view first -- the present -> scroll
    // -> visible -> enabled -> stable order every actionability model uses. 'instant'
    // because a CSS smooth-scroll would fight the rect-stability check below.
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      r = el.getBoundingClientRect();
    }
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const atPoint = document.elementFromPoint(cx, cy);
    visible = !!atPoint && (atPoint === el || el.contains(atPoint) || atPoint.contains(el));
  }
  const enabled = el.disabled !== true && el.getAttribute('aria-disabled') !== 'true';
  return {
    present: true,
    visible,
    enabled,
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
  };
}`;
async function waitForSelectorActionable(driver, selector, options) {
  await waitForActionable(async () => {
    try {
      const state = await driver.runtimeDomain.callFunctionOn(
        SELECTOR_ACTIONABILITY_PROBE_FN,
        [selector]
      );
      return { target: true, state };
    } catch {
      return null;
    }
  }, options);
}
var CompatElementHandle = class {
  constructor(driver, nodeId) {
    this.driver = driver;
    this.nodeId = nodeId;
  }
  driver;
  nodeId;
  async screenshot(options) {
    const ref = { nodeId: this.nodeId };
    await this.driver.domDomain.scrollIntoViewIfNeeded(ref);
    const model = await this.driver.domDomain.getBoxModel(ref);
    const q = model.content;
    const x = Math.min(q[0], q[2], q[4], q[6]);
    const y = Math.min(q[1], q[3], q[5], q[7]);
    const buf = await this.driver.page.screenshot({
      clip: { x, y, width: model.width, height: model.height }
    });
    if (options?.path) {
      await promises.mkdir(path.dirname(options.path), { recursive: true });
      await promises.writeFile(options.path, buf);
    }
    return buf;
  }
  async textContent() {
    const html = await this.driver.domDomain.getOuterHTML(this.nodeId);
    return html.replace(/<[^>]*>/g, "").trim() || null;
  }
  async boundingBox() {
    try {
      const model = await this.driver.domDomain.getBoxModel({ nodeId: this.nodeId });
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
var CompatLocator = class _CompatLocator {
  constructor(driver, selector) {
    this.driver = driver;
    this.selector = selector;
  }
  driver;
  selector;
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
    if (!_options?.force) {
      await waitForSelectorActionable(this.driver, this.selector, { timeout: _options?.timeout });
    }
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [this.selector]
    );
  }
  async fill(text, _options) {
    await waitForSelectorActionable(this.driver, this.selector, { timeout: _options?.timeout });
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
  /**
   * Choose an option in a <select>, returning the values that ended up selected.
   *
   * A native select cannot be driven by click: its option list is painted by the
   * OS rather than the page, so there is no option node in the DOM to click. The
   * value is set directly and input+change are dispatched, matching `fill`, so
   * React and other frameworks observe the change through their normal path.
   */
  async selectOption(spec, _options) {
    await waitForSelectorActionable(this.driver, this.selector, { timeout: _options?.timeout });
    const result = await this.driver.runtimeDomain.callFunctionOn(
      `(sel, spec) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        if (el.tagName.toLowerCase() !== 'select') {
          throw new Error('Not a <select>: ' + sel + ' is <' + el.tagName.toLowerCase() + '>');
        }
        const opts = Array.from(el.options);
        let match = -1;
        if (typeof spec.index === 'number') {
          match = spec.index;
        } else if (spec.value !== undefined) {
          match = opts.findIndex((o) => o.value === spec.value);
        } else if (spec.label !== undefined) {
          // Exact label first, then trimmed text, so a caller can pass what they see.
          match = opts.findIndex((o) => o.label === spec.label);
          if (match === -1) match = opts.findIndex((o) => o.text.trim() === String(spec.label).trim());
        }
        if (match < 0 || match >= opts.length) return [];
        el.selectedIndex = match;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return [el.value];
      }`,
      [this.selector, spec]
    );
    return Array.isArray(result) ? result : [];
  }
  /** Every option on the target select, as "value (label)", for error messages. */
  async listOptions() {
    const result = await this.driver.runtimeDomain.callFunctionOn(
      `(sel) => {
        const el = document.querySelector(sel);
        if (!el || el.tagName.toLowerCase() !== 'select') return [];
        return Array.from(el.options).map((o) => o.value + ' (' + o.text.trim() + ')');
      }`,
      [this.selector]
    );
    return Array.isArray(result) ? result : [];
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
};
var ESBUILD_NAME_HELPER = "const __name = (target) => target;";
function needsEvaluateNameHelper(fnStr) {
  return fnStr.includes("__name(") && !fnStr.includes("const __name");
}
function buildEvaluateExpression(fnStr) {
  if (!needsEvaluateNameHelper(fnStr)) {
    return `(${fnStr})()`;
  }
  return `(() => { ${ESBUILD_NAME_HELPER} return (${fnStr})(); })()`;
}
function buildFunctionDeclaration(fnStr) {
  if (!needsEvaluateNameHelper(fnStr)) {
    return `(${fnStr})`;
  }
  return `(function(...__ibrArgs) { ${ESBUILD_NAME_HELPER} return (${fnStr})(...__ibrArgs); })`;
}
var CompatPage = class {
  constructor(driver) {
    this.driver = driver;
  }
  driver;
  consoleHandlers = [];
  consoleListening = false;
  async goto(url, options) {
    const waitUntil = options?.waitUntil;
    await this.driver.navigate(url, {
      // networkidle used to be faked as AX-tree stability ('stable'); real
      // network quiescence is applied below via NetworkDomain instead, so
      // navigate() itself only needs to wait for the document to commit.
      waitFor: waitUntil === "networkidle" ? "none" : "load",
      timeout: options?.timeout
    });
    if (waitUntil === "networkidle") {
      await this.driver.networkDomain.waitForNetworkIdle({ timeout: options?.timeout ?? 1e4 });
    }
  }
  async evaluate(fnOrExpr, ...args) {
    if (typeof fnOrExpr === "function") {
      const fnStr = fnOrExpr.toString();
      if (args.length > 0) {
        return this.driver.evaluate(buildFunctionDeclaration(fnStr), ...args);
      }
      return this.driver.evaluate(buildEvaluateExpression(fnStr));
    }
    if (args.length > 0) {
      return this.driver.evaluate(fnOrExpr, ...args);
    }
    return this.driver.evaluate(fnOrExpr);
  }
  /**
   * PageLike's optional command-line-API evaluate — see page-like.ts. Backed
   * by IBR's own CDP engine (Runtime.evaluate with includeCommandLineAPI),
   * so this is real here; other PageLike implementations (Playwright, a
   * future WebKit driver) simply don't define this method and callers
   * degrade to static handler detection.
   */
  async evaluateWithCommandLineAPI(expression) {
    return this.driver.evaluateWithCommandLineAPI(expression);
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
      await promises.mkdir(path.dirname(options.path), { recursive: true });
      await promises.writeFile(options.path, buf);
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
    await this.driver.networkDomain.waitForNetworkIdle({ timeout: _options?.timeout ?? 1e4 });
  }
  async waitForNavigation() {
    await this.driver.networkDomain.waitForNetworkIdle({ timeout: 1e4 });
  }
  /**
   * Wait for a response matching `urlOrPredicate` (substring, RegExp, or a
   * `(url, status) => boolean` predicate). Resolves with `{url, status}` the
   * moment a matching `Network.responseReceived` CDP event fires — real
   * network awareness (E3-B), not a fixed sleep or polling guess. New API
   * surface; no existing caller to preserve compatibility with.
   */
  async waitForResponse(urlOrPredicate, options) {
    const predicate = typeof urlOrPredicate === "function" ? urlOrPredicate : typeof urlOrPredicate === "string" ? (url) => url.includes(urlOrPredicate) : (url) => urlOrPredicate.test(url);
    return this.driver.networkDomain.waitForResponse(predicate, options);
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
    await waitForSelectorActionable(this.driver, selector, { timeout: _options?.timeout });
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [selector]
    );
  }
  async fill(selector, value) {
    await waitForSelectorActionable(this.driver, selector);
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
    await waitForSelectorActionable(this.driver, selector);
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
    await waitForSelectorActionable(this.driver, selector);
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el && !el.checked) el.click(); }",
      [selector]
    );
  }
  async uncheck(selector) {
    await waitForSelectorActionable(this.driver, selector);
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el && el.checked) el.click(); }",
      [selector]
    );
  }
  async selectOption(selector, value) {
    await waitForSelectorActionable(this.driver, selector);
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
    const center = await this.driver.domDomain.getElementCenter({ nodeId });
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

exports.AccessibilityDomain = AccessibilityDomain;
exports.BrowserManager = BrowserManager;
exports.CHROME_PATHS = CHROME_PATHS;
exports.CdpConnection = CdpConnection;
exports.CompatElementHandle = CompatElementHandle;
exports.CompatLocator = CompatLocator;
exports.CompatPage = CompatPage;
exports.ConsoleDomain = ConsoleDomain;
exports.CssDomain = CssDomain;
exports.DomDomain = DomDomain;
exports.EmulationDomain = EmulationDomain;
exports.EngineDriver = EngineDriver;
exports.InputDomain = InputDomain;
exports.NetworkDomain = NetworkDomain;
exports.PageDomain = PageDomain;
exports.ResolutionCache = ResolutionCache;
exports.RuntimeDomain = RuntimeDomain;
exports.SnapshotDomain = SnapshotDomain;
exports.TargetDomain = TargetDomain;
exports.assessUnderstanding = assessUnderstanding;
exports.buildFingerprint = buildFingerprint;
exports.extractFromAXTree = extractFromAXTree;
exports.extractList = extractList;
exports.extractPageMeta = extractPageMeta;
exports.findChrome = findChrome;
exports.jaroWinkler = jaroWinkler;
exports.normalizeRole = normalizeRole;
exports.observe = observe;
exports.parseSpatialHints = parseSpatialHints;
exports.resolve = resolve;
exports.serializeElement = serializeElement;
exports.serializeSnapshot = serializeSnapshot;
exports.waitForEvent = waitForEvent;
exports.waitForStable = waitForStable;
exports.waitForStableTree = waitForStableTree;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map