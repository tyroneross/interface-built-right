/**
 * NativeBackend — the primitive I/O seam beneath the native session controller.
 *
 * The controller (`session-controller.ts`) owns session lifecycle, element
 * resolution, post-action settling and all wire-shape construction. It performs
 * NO low-level AX I/O directly; every extract / action / screenshot goes through
 * a `NativeBackend`. This is the seam Epic 2 swaps: today's `RespawnBackend`
 * shells out to the one-shot Swift extractor per call; E2-A introduces a
 * long-lived `DaemonBackend` that implements the same interface with an
 * in-process AX tree + resolved-path cache.
 *
 * FROZEN at Wave 0 (chunk C0). Epic 2 implemented `keystroke`/`lifecycle`/`menu`
 * as LIVE capabilities (RespawnBackend delivers each and returns a validated
 * ActionOutcome) and added `DaemonBackend`; it never edits the controller or the
 * MCP adapters.
 */

// Import through the native barrel (not concrete modules) so existing test
// mocks that target '../native/index.js' continue to intercept these calls —
// this is the module boundary the pre-C0 handlers used. `index.js` does not
// import this file, so there is no cycle.
import {
  extractNativeElements,
  captureNativeScreenshot,
  captureMacOSScreenshot,
  extractMacOSElements,
  findDevice,
  findProcess,
} from './index.js';
import { performNativeAction, type NativeAction, type NativeActionResult } from './actions.js';
import type {
  MacOSAXElement,
  MacOSWindowInfo,
  NativeElement,
  SimulatorDevice,
} from './types.js';
import type { ActionOutcome } from '../action-outcome.js';
import { AXDaemon, DaemonError } from './daemon.js';
import {
  deliverKeystrokeOneShot,
  resolveKeystrokeTargetPid,
  runKeystrokeCapability,
  type KeystrokeDeliveryResult,
} from './keyboard.js';
import { runLifecycleCapability, defaultLifecycleOps } from './lifecycle.js';
import {
  deliverMenuOneShot,
  resolveMenuTargetPid,
  runMenuCapability,
  type MenuDeliveryResult,
} from './menu.js';

// ─── Target + capability shapes (frozen v1 surface) ──────────────────────────

/** The addressable target of a native session. */
export type NativeSessionTarget =
  | { kind: 'macos'; pid: number; app?: string }
  | { kind: 'simulator'; device: { udid: string; name: string } };

/** Result of an AX-tree extraction. `not-found` carries a caller-facing message. */
export type NativeExtraction =
  | { kind: 'macos'; elements: MacOSAXElement[]; window: MacOSWindowInfo }
  | { kind: 'simulator'; elements: NativeElement[]; device: SimulatorDevice }
  | { kind: 'not-found'; message: string };

/** A resolved AX action to execute against an element path. */
export interface NativePerformInput {
  elementPath: number[];
  action: NativeAction;
  value?: string;
}

/** Raw screenshot capture. `error` carries a caller-facing message. */
export type NativeScreenshotCapture =
  | { kind: 'macos'; base64: string; window: MacOSWindowInfo; screenshotPath: string }
  | { kind: 'simulator'; base64: string; device: SimulatorDevice; screenshotPath: string }
  | { kind: 'error'; error: string };

/** Keyboard chord / key delivered to the focused element (Epic 2). */
export interface KeystrokeSpec {
  /** Chord in `Modifier+Modifier+Key` form (e.g. "Meta+n", "Tab", "Escape"). */
  chord: string;
}

/** App lifecycle operation (Epic 2). */
export type AppLifecycleOp = 'launch' | 'switch' | 'quit';

/** App lifecycle request (Epic 2). */
export interface LifecycleSpec {
  op: AppLifecycleOp;
  /** App name / bundle id — required for launch, optional for switch/quit. */
  app?: string;
}

/** Menu traversal request over an opened AXMenu (Epic 2). */
export interface MenuSpec {
  /** Ordered menu-item titles to walk, e.g. ["File", "New Window"]. */
  menuPath: string[];
}

// ─── Backend interface ───────────────────────────────────────────────────────

/**
 * The primitive native I/O contract. Every method is target-aware. The three
 * capability methods (`keystroke`/`lifecycle`/`menu`) return an `ActionOutcome`
 * so every result — delivery success or a validated failure — is structured,
 * never a throw.
 */
export interface NativeBackend {
  /** Extract the AX tree for the target's front window/screen. */
  extract(target: NativeSessionTarget): Promise<NativeExtraction>;
  /** Execute a resolved AX action on an element path. */
  performAction(target: NativeSessionTarget, input: NativePerformInput): Promise<NativeActionResult>;
  /** Capture a screenshot of the target, writing PNG to `outputPath`. */
  captureScreenshot(target: NativeSessionTarget, outputPath: string): Promise<NativeScreenshotCapture>;
  /** Deliver a keyboard chord / key sequence to the focused element. */
  keystroke(target: NativeSessionTarget, spec: KeystrokeSpec): Promise<ActionOutcome>;
  /** Drive app lifecycle: launch | switch | quit. */
  lifecycle(target: NativeSessionTarget, spec: LifecycleSpec): Promise<ActionOutcome>;
  /** Traverse an opened AXMenu by path. */
  menu(target: NativeSessionTarget, spec: MenuSpec): Promise<ActionOutcome>;
}

// ─── RespawnBackend — today's one-shot extractor behavior ────────────────────

/**
 * The default backend: wraps the existing one-shot Swift extractor
 * (`extractMacOSElements` / `extractNativeElements` / `performNativeAction`).
 * Behavior-identical to pre-C0 code for extract/action/screenshot. The three
 * capabilities are LIVE (Epic 2): `keystroke` synthesizes chords, `lifecycle`
 * drives launch/switch/quit, and `menu` traverses AXMenus — each via the
 * one-shot binary / OS process control, returning a validated ActionOutcome.
 */
export class RespawnBackend implements NativeBackend {
  async extract(target: NativeSessionTarget): Promise<NativeExtraction> {
    if (target.kind === 'macos') {
      const { elements, window } = await extractMacOSElements({ pid: target.pid });
      return { kind: 'macos', elements, window };
    }
    const device = await findDevice(target.device.udid);
    if (!device) {
      return { kind: 'not-found', message: `Simulator not found: ${target.device.udid}` };
    }
    const elements = await extractNativeElements(device);
    return { kind: 'simulator', elements, device };
  }

  async performAction(
    target: NativeSessionTarget,
    input: NativePerformInput,
  ): Promise<NativeActionResult> {
    if (target.kind === 'macos') {
      return performNativeAction({
        pid: target.pid,
        elementPath: input.elementPath,
        action: input.action,
        value: input.value,
      });
    }
    const simulatorPid = await findProcess('com.apple.iphonesimulator');
    return performNativeAction({
      pid: simulatorPid,
      deviceName: target.device.name,
      elementPath: input.elementPath,
      action: input.action,
      value: input.value,
    });
  }

  async captureScreenshot(
    target: NativeSessionTarget,
    outputPath: string,
  ): Promise<NativeScreenshotCapture> {
    if (target.kind === 'macos') {
      const { window } = await extractMacOSElements({ pid: target.pid });
      if (window.windowId <= 0) {
        return {
          kind: 'error',
          error:
            'macOS screenshot capture failed: no on-screen CGWindowID was available for the current AX window.',
        };
      }
      await captureMacOSScreenshot(window.windowId, outputPath);
      const { readFile } = await import('fs/promises');
      const buf = await readFile(outputPath);
      return { kind: 'macos', base64: buf.toString('base64'), window, screenshotPath: outputPath };
    }

    const device = await findDevice(target.device.udid);
    if (!device) {
      return { kind: 'error', error: `Simulator not found: ${target.device.udid}` };
    }
    const capture = await captureNativeScreenshot({ device, outputPath });
    if (!capture.success || !capture.outputPath) {
      return {
        kind: 'error',
        error: `Simulator screenshot capture failed: ${capture.error || 'unknown error'}`,
      };
    }
    const { readFile } = await import('fs/promises');
    const buf = await readFile(capture.outputPath);
    return {
      kind: 'simulator',
      base64: buf.toString('base64'),
      device,
      screenshotPath: capture.outputPath,
    };
  }

  /**
   * Deliver a keyboard chord via the one-shot Swift extractor binary (E2-B).
   * See `keyboard.ts` for the two-phase (background-then-foreground) delivery
   * + AX-diff validator that builds the returned `ActionOutcome`.
   */
  async keystroke(target: NativeSessionTarget, spec: KeystrokeSpec): Promise<ActionOutcome> {
    return runKeystrokeCapability({
      target,
      spec,
      resolvePid: () => resolveKeystrokeTargetPid(target),
      extract: () => this.extract(target),
      deliver: deliverKeystrokeOneShot,
    });
  }

  /**
   * Drive app lifecycle (E2-C) via OS-level process control (`open`/
   * `osascript`) — never the AX event path. See `lifecycle.ts` for the
   * launch/switch/quit state machine and its validators.
   */
  async lifecycle(target: NativeSessionTarget, spec: LifecycleSpec): Promise<ActionOutcome> {
    return runLifecycleCapability(target, spec, defaultLifecycleOps);
  }

  /**
   * Walk a menu path (menu-bar or already-open context menu) via the
   * one-shot Swift extractor binary (E2-D). See `menu.ts` for the delivery
   * wrapper + AX-diff validator that builds the returned `ActionOutcome`.
   */
  async menu(target: NativeSessionTarget, spec: MenuSpec): Promise<ActionOutcome> {
    return runMenuCapability({
      target,
      spec,
      resolvePid: () => resolveMenuTargetPid(target),
      extract: () => this.extract(target),
      deliver: deliverMenuOneShot,
    });
  }
}

// ─── DaemonBackend — persistent AX daemon with respawn auto-fallback ─────────

/**
 * The E2-A backend: routes extract / performAction / screenshot through a
 * long-lived Swift AX daemon (`AXDaemon`) instead of respawning the one-shot
 * binary per call. Holds a `RespawnBackend` as a fallback and delegates to it
 * whenever the daemon is unavailable — startup fails, AX is not trusted, the
 * daemon crashes, or a request times out (the kill-9 auto-fallback). Once the
 * daemon is marked unusable every subsequent call goes straight to respawn, so
 * behavior degrades gracefully to today's path rather than failing.
 *
 * `keystroke` is wired to the daemon's `keystroke` op at E2-B (falling back to
 * the one-shot binary if the daemon dies mid-request); `lifecycle` (E2-C)
 * delegates straight to the respawn implementation (OS-level process control
 * gains nothing from the daemon connection); `menu` (E2-D) is wired to the
 * daemon's `menu` op the same way `keystroke` is — full-capability fallback
 * when the daemon cannot start, per-request fallback to the one-shot binary
 * if it dies mid-request.
 *
 * Screenshot capture stays on the existing `screencapture`/`simctl` path — the
 * daemon only supplies the CGWindowID for macOS (via a `resolve` op) so no
 * second tree walk is needed.
 */
export class DaemonBackend implements NativeBackend {
  private readonly daemon: AXDaemon;
  private readonly fallback: RespawnBackend;
  private usable = true;

  constructor(opts?: { daemon?: AXDaemon; fallback?: RespawnBackend }) {
    this.daemon = opts?.daemon ?? new AXDaemon();
    this.fallback = opts?.fallback ?? new RespawnBackend();
  }

  /** True once the daemon failed and calls are routing to the respawn fallback. */
  get fellBack(): boolean {
    return !this.usable;
  }

  /**
   * Run a daemon-backed operation, falling back to the respawn equivalent on any
   * daemon fault. A `DaemonError` (spawn fail, not-trusted, crash, timeout) trips
   * the permanent fallback; any other error is a real AX/IO condition that the
   * respawn path would hit too, so it propagates unchanged.
   */
  private async withFallback<T>(daemonOp: () => Promise<T>, fallbackOp: () => Promise<T>): Promise<T> {
    if (!this.usable) return fallbackOp();
    try {
      await this.daemon.start();
      return await daemonOp();
    } catch (err) {
      if (err instanceof DaemonError) {
        this.usable = false;
        return fallbackOp();
      }
      throw err;
    }
  }

  async extract(target: NativeSessionTarget): Promise<NativeExtraction> {
    return this.withFallback(
      async () => {
        if (target.kind === 'macos') {
          const resp = await this.daemon.request({
            op: 'extract',
            target: { kind: 'macos', pid: target.pid },
          });
          if (!resp.ok) throw new Error(resp.error || 'daemon extract failed');
          const result = resp.result as { window: MacOSWindowInfo; elements: MacOSAXElement[] };
          return { kind: 'macos', elements: result.elements, window: result.window };
        }
        const device = await findDevice(target.device.udid);
        if (!device) {
          return { kind: 'not-found', message: `Simulator not found: ${target.device.udid}` };
        }
        const resp = await this.daemon.request({
          op: 'extract',
          target: { kind: 'simulator', deviceName: target.device.name },
        });
        if (!resp.ok) throw new Error(resp.error || 'daemon extract failed');
        const result = resp.result as { elements: NativeElement[] };
        return { kind: 'simulator', elements: result.elements, device };
      },
      () => this.fallback.extract(target),
    );
  }

  async performAction(
    target: NativeSessionTarget,
    input: NativePerformInput,
  ): Promise<NativeActionResult> {
    return this.withFallback(
      async () => {
        if (target.kind === 'macos') {
          const resp = await this.daemon.request({
            op: 'action',
            target: { kind: 'macos', pid: target.pid },
            action: input.action,
            elementPath: input.elementPath,
            value: input.value,
          });
          if (!resp.ok) return { success: false, action: input.action, error: resp.error };
          return resp.result as NativeActionResult;
        }
        const simulatorPid = await findProcess('com.apple.iphonesimulator');
        const resp = await this.daemon.request({
          op: 'action',
          target: { kind: 'simulator', pid: simulatorPid, deviceName: target.device.name },
          action: input.action,
          elementPath: input.elementPath,
          value: input.value,
        });
        if (!resp.ok) return { success: false, action: input.action, error: resp.error };
        return resp.result as NativeActionResult;
      },
      () => this.fallback.performAction(target, input),
    );
  }

  async captureScreenshot(
    target: NativeSessionTarget,
    outputPath: string,
  ): Promise<NativeScreenshotCapture> {
    // Simulator screenshots go through simctl (no daemon benefit); reuse respawn.
    if (target.kind === 'simulator') {
      return this.fallback.captureScreenshot(target, outputPath);
    }
    return this.withFallback(
      async () => {
        const resp = await this.daemon.request({
          op: 'resolve',
          target: { kind: 'macos', pid: target.pid },
        });
        if (!resp.ok) throw new Error(resp.error || 'daemon resolve failed');
        const window = (resp.result as { window: MacOSWindowInfo }).window;
        if (window.windowId <= 0) {
          return {
            kind: 'error',
            error:
              'macOS screenshot capture failed: no on-screen CGWindowID was available for the current AX window.',
          };
        }
        await captureMacOSScreenshot(window.windowId, outputPath);
        const { readFile } = await import('fs/promises');
        const buf = await readFile(outputPath);
        return { kind: 'macos', base64: buf.toString('base64'), window, screenshotPath: outputPath };
      },
      () => this.fallback.captureScreenshot(target, outputPath),
    );
  }

  /**
   * Deliver a keyboard chord via the daemon's `keystroke` op (E2-B). Unlike
   * `extract`/`performAction`/`captureScreenshot`, this does not route through
   * `withFallback` for the whole call — if the daemon is already unusable (or
   * fails to start), the ENTIRE capability (delivery + AX-diff validation)
   * delegates to `RespawnBackend.keystroke` so the before/after signatures
   * come from one consistent backend. If the daemon dies mid-request (a
   * request already in flight when it crashes), this attempt still completes
   * by falling through to the one-shot binary for just the raw delivery,
   * rather than aborting — the kill-9 auto-fallback, applied per-request.
   */
  async keystroke(target: NativeSessionTarget, spec: KeystrokeSpec): Promise<ActionOutcome> {
    if (!this.usable) return this.fallback.keystroke(target, spec);
    try {
      await this.daemon.start();
    } catch (err) {
      if (err instanceof DaemonError) this.usable = false;
      return this.fallback.keystroke(target, spec);
    }

    return runKeystrokeCapability({
      target,
      spec,
      resolvePid: () => resolveKeystrokeTargetPid(target),
      extract: () => this.extract(target),
      deliver: async (pid, chord, foreground) => {
        try {
          const resp = await this.daemon.request({
            op: 'keystroke',
            target: target.kind === 'macos'
              ? { kind: 'macos', pid }
              : { kind: 'simulator', pid, deviceName: target.device.name },
            chord,
            foreground,
          });
          if (!resp.ok) return { success: false, error: resp.error };
          return resp.result as KeystrokeDeliveryResult;
        } catch (err) {
          if (err instanceof DaemonError) {
            this.usable = false;
            // Daemon died mid-request — finish this attempt via the one-shot
            // binary rather than aborting the capability call outright.
            return deliverKeystrokeOneShot(pid, chord, foreground);
          }
          throw err;
        }
      },
    });
  }

  /**
   * App lifecycle (E2-C) is OS-level process control (`open`/`osascript`), not
   * an AX-tree operation — the persistent daemon connection offers no benefit,
   * so this delegates straight to the respawn implementation (same reasoning
   * as the simulator branch of `captureScreenshot` above).
   */
  async lifecycle(target: NativeSessionTarget, spec: LifecycleSpec): Promise<ActionOutcome> {
    return this.fallback.lifecycle(target, spec);
  }

  /**
   * Walk a menu path via the daemon's `menu` op (E2-D). Mirrors `keystroke`:
   * if the daemon is already unusable (or fails to start), the ENTIRE
   * capability delegates to `RespawnBackend.menu` so before/after signatures
   * come from one consistent backend. If the daemon dies mid-request, this
   * attempt still completes via the one-shot binary for just the raw
   * traversal, rather than aborting.
   */
  async menu(target: NativeSessionTarget, spec: MenuSpec): Promise<ActionOutcome> {
    if (!this.usable) return this.fallback.menu(target, spec);
    try {
      await this.daemon.start();
    } catch (err) {
      if (err instanceof DaemonError) this.usable = false;
      return this.fallback.menu(target, spec);
    }

    return runMenuCapability({
      target,
      spec,
      resolvePid: () => resolveMenuTargetPid(target),
      extract: () => this.extract(target),
      deliver: async (pid, menuPath) => {
        try {
          const resp = await this.daemon.request({
            op: 'menu',
            target: target.kind === 'macos'
              ? { kind: 'macos', pid }
              : { kind: 'simulator', pid, deviceName: target.device.name },
            menuPath,
          });
          if (!resp.ok) return { success: false, error: resp.error };
          return resp.result as MenuDeliveryResult;
        } catch (err) {
          if (err instanceof DaemonError) {
            this.usable = false;
            // Daemon died mid-request — finish this attempt via the one-shot
            // binary rather than aborting the capability call outright.
            return deliverMenuOneShot(pid, menuPath);
          }
          throw err;
        }
      },
    });
  }

  /** Stop the underlying daemon (test/shutdown aid). */
  stop(): void {
    this.daemon.kill('DaemonBackend stopped');
  }
}

/**
 * Backend selection. Default is `RespawnBackend` (today's proven one-shot path);
 * `IBR_NATIVE_BACKEND=daemon` opts into the persistent `DaemonBackend` (which
 * itself auto-falls-back to respawn on any daemon fault). `IBR_NATIVE_BACKEND=respawn`
 * (or unset) forces respawn — the documented rollback. The E2-A spike proved the
 * daemon stable on this platform (TCC-inherited, orphan-safe, rebuild-safe), but
 * the default stays respawn until the V1 chunk validates it more broadly; the
 * daemon is opt-in and auto-fallback-guarded, never dormant.
 */
let defaultBackend: NativeBackend | null = null;
export function getNativeBackend(): NativeBackend {
  if (!defaultBackend) {
    const pref = (process.env.IBR_NATIVE_BACKEND || '').trim().toLowerCase();
    defaultBackend = pref === 'daemon' ? new DaemonBackend() : new RespawnBackend();
  }
  return defaultBackend;
}

/** Test seam: override the process-wide backend. Pass `null` to reset. */
export function __setNativeBackend(backend: NativeBackend | null): void {
  defaultBackend = backend;
}
