/**
 * IBR MCP Tool Definitions
 *
 * Each tool maps to existing IBR programmatic APIs.
 * Responses are formatted as concise text for LLM consumption.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from "fs";
import { join } from "path";
import { loadDesignSystemConfig } from '../design-system/index.js';
import { scan } from "../scan.js";
import {
  compare,
  InterfaceBuiltRight,
} from "../index.js";
import {
  listSessions,
  getSessionStats,
  createSession,
  getSessionPaths,
} from "../session.js";
import type { ScanOptions } from "../scan.js";
import {
  scanNative,
  scanMacOS,
  listDevices,
  findDevice,
  bootDevice,
  captureNativeScreenshot,
  getDeviceViewport,
  formatDevice,
  findProcess,
  extractMacOSElements,
  extractNativeElements,
} from "../native/index.js";
import { captureScreenshot } from "../capture.js";
import { VIEWPORTS } from "../schemas.js";
import { loadTokenSpec, validateAgainstTokens } from '../tokens.js';
import { correlateToSource, formatBridgeResult } from '../native/bridge.js';
import { EngineDriver, type FindDiagnostics } from '../engine/driver.js';
import type { ActionDescriptor } from '../engine/observe.js';
import type { Element as EngineElement } from '../engine/types.js';
import { searchFlow } from '../flows/search.js';
import { formFlow } from '../flows/form.js';
import { loginFlow } from '../flows/login.js';
import { CompatPage } from '../engine/compat.js';
import {
  idbTap,
  idbType,
  idbSwipe,
  idbButton,
  idbOpenUrl,
  isIdbCliAvailable,
} from '../native/idb.js';
import {
  elementCenter,
  findElementByLabel,
  flattenMacOSElements,
  flattenSimulatorElements,
  performNativeAction,
  resolveMacOSElement,
  resolveSimulatorElement,
  type NativeAction,
  type NativeElementCandidate,
} from '../native/actions.js'
import { compressSnapshot, formatCompressed } from '../engine/compress.js';

type SessionEntry = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  driver: any  // EngineDriver | SafariDriver | null (null for native/simulator sessions)
  type: 'chrome' | 'safari' | 'macos' | 'simulator'
  url?: string
  app?: string
  device?: { udid: string; name: string }
  pid?: number
  createdAt: number
}

type ExtractedMeta = {
  headings: string[]
  buttons: Array<{ label: string; enabled?: boolean }>
  inputs: Array<{ label: string; value?: string | null }>
  links: Array<{ label: string }>
}

// Session store — persistent browser instances (Chrome, Safari, macOS native, iOS/watchOS simulator)
const sessions = new Map<string, SessionEntry>()

// --- Content types ---

type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

type McpResponse = { content: McpContent[]; isError?: boolean };

// --- Response helpers ---

function textResponse(text: string): McpResponse {
  return { content: [{ type: "text" as const, text }] };
}

function errorResponse(text: string): McpResponse {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

function imageResponse(base64: string, metadata: string): McpResponse {
  return {
    content: [
      { type: "image" as const, data: base64, mimeType: "image/png" },
      { type: "text" as const, text: metadata },
    ],
  };
}

// --- Tool definitions ---

export const TOOLS = [
  {
    name: "scan",
    description:
      "Reads the live page and returns structured data — all interactive elements with computed CSS, handler wiring, accessibility data, page intent classification, and console errors. Use during or after building UI to see what is actually rendered.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description:
            "URL to scan (e.g. http://localhost:3000/page)",
        },
        viewport: {
          type: "string",
          enum: ["desktop", "mobile", "tablet"],
          description: "Viewport preset (default: 'desktop')",
        },
        patience: {
          type: "number",
          description: "Wait longer for slow async content in ms (AI search, LLM results). Overrides network idle timeout.",
        },
        networkIdleTimeout: {
          type: "number",
          description: "Network idle timeout in ms (default: 10000)",
        },
      },
      required: ["url"],
    },
    annotations: {
      title: "UI Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "snapshot",
    description:
      "Capture a visual reference point of the current page state. Use before making UI changes so you can compare afterwards with the 'compare' tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to capture baseline from",
        },
        name: {
          type: "string",
          description:
            "Name for the baseline session (e.g. 'header-redesign')",
        },
        selector: {
          type: "string",
          description:
            "CSS selector to wait for before capturing (optional)",
        },
      },
      required: ["url"],
    },
    annotations: {
      title: "Capture Baseline",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "compare",
    description:
      "Compare current UI state against a reference point. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN) with changed regions and recommendations. Use after making UI changes to understand what shifted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description:
            "Session ID to compare against (default: most recent session)",
        },
      },
    },
    annotations: {
      title: "Compare Against Baseline",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "list_sessions",
    description:
      "List all IBR sessions with timestamps, URLs, viewports, and comparison status. Shows captured reference points available for change tracking.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    annotations: {
      title: "List Sessions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  // --- Screenshot & reference tools ---
  {
    name: "screenshot",
    description:
      "Navigate to any URL and capture a screenshot that Claude can see. Returns the image as a base64 content block. Use for viewing external design sites (Mobbin, Dribbble, etc.), capturing UI state visually, or saving design references. For structured data (CSS, handlers, a11y), use 'scan' instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to capture (localhost or external)",
        },
        viewport: {
          type: "string",
          enum: ["desktop", "mobile", "tablet"],
          description: "Viewport preset (default: desktop)",
        },
        selector: {
          type: "string",
          description: "CSS selector to capture a specific element instead of full page",
        },
        full_page: {
          type: "boolean",
          description: "Capture full scrollable page (default: false — viewport only)",
        },
        wait_for: {
          type: "string",
          description: "CSS selector to wait for before capturing",
        },
        delay: {
          type: "number",
          description: "Extra ms to wait after page load (default: 2000 for external sites, 500 for localhost)",
        },
        save_as: {
          type: "string",
          description: "Save to reference library as this name (e.g. 'mobbin-login'). Stored in .ibr/references/",
        },
      },
      required: ["url"],
    },
    annotations: {
      title: "Screenshot",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "references",
    description:
      "Manage the design reference library. List saved references, show a specific reference image (returned as base64 so Claude can see it), or delete a reference.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "show", "delete"],
          description: "Action to perform (default: list)",
        },
        name: {
          type: "string",
          description: "Reference name — required for show and delete",
        },
      },
    },
    annotations: {
      title: "Design References",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  // --- Native iOS/watchOS tools ---
  {
    name: "native_scan",
    description:
      "Scan a running iOS or watchOS simulator — extracts accessibility elements, validates touch targets, checks watchOS constraints, and audits accessibility labels. Use during or after building SwiftUI to see what the simulator renders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description:
            "Device name fragment or UDID (e.g. 'Apple Watch', 'iPhone 16'). Uses first booted device if omitted.",
        },
        screenshot: {
          type: "boolean",
          description: "Capture a screenshot (default: true)",
        },
      },
    },
    annotations: {
      title: "Native Simulator Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "native_snapshot",
    description:
      "Capture a visual reference point from a running iOS or watchOS simulator. Use before making native UI changes so you can track what changed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description:
            "Device name fragment or UDID. Uses first booted device if omitted.",
        },
        name: {
          type: "string",
          description: "Name for the baseline session (e.g. 'watch-timer-screen')",
        },
      },
    },
    annotations: {
      title: "Native Baseline Capture",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_compare",
    description:
      "Compare current simulator state against a native reference point. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN). Use after making native UI changes to understand what shifted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description:
            "Session ID to compare against (default: most recent native session)",
        },
        device: {
          type: "string",
          description:
            "Device name fragment or UDID. Uses first booted device if omitted.",
        },
      },
    },
    annotations: {
      title: "Native Compare Against Baseline",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  // --- macOS native app scanning ---
  {
    name: "scan_macos",
    description:
      "Scan a running macOS native app via the Accessibility API — extracts all UI elements, validates touch targets, checks accessibility labels, classifies page intent, and produces a verdict. Use during or after building a native macOS app (SwiftUI/AppKit) to see what the UI actually renders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description:
            "App name to scan (e.g. 'Secrets Vault', 'Calculator'). Case-insensitive substring match.",
        },
        bundle_id: {
          type: "string",
          description:
            "Bundle identifier (e.g. 'com.secretsvault.app'). Alternative to app name.",
        },
        pid: {
          type: "number",
          description: "Direct process ID. Alternative to app/bundle_id.",
        },
        screenshot: {
          type: "string",
          description: "Path to save a screenshot of the app window (optional).",
        },
      },
    },
    annotations: {
      title: "macOS Native App Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "native_devices",
    description:
      "List available iOS and watchOS simulator devices with their boot status, runtime versions, and UDIDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        platform: {
          type: "string",
          enum: ["ios", "watchos"],
          description: "Filter by platform (optional)",
        },
      },
    },
    annotations: {
      title: "List Simulator Devices",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "validate_tokens",
    description:
      "Validate UI elements against a design token specification. Checks touch targets, font sizes, colors, spacing, and corner radius against the token values defined in .ibr/tokens.json or a custom spec file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to scan and validate (web URL or simulator URL)",
        },
        device: {
          type: "string",
          description: "Simulator device to scan (alternative to url, for native apps)",
        },
        spec_path: {
          type: "string",
          description: "Path to token spec JSON file (default: .ibr/tokens.json)",
        },
      },
    },
    annotations: {
      title: "Validate Design Tokens",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "scan_static",
    description:
      "Scan HTML and CSS files without launching a browser. Useful for email templates, SSR output, or design system components. Checks structure, accessibility attributes, touch targets, and content — without handler detection or computed cascade styles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        html_path: {
          type: "string",
          description: "Path to the HTML file to scan",
        },
        css_path: {
          type: "string",
          description: "Optional path to CSS file to apply",
        },
      },
      required: ["html_path"],
    },
    annotations: {
      title: "Static HTML/CSS Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "bridge_to_source",
    description:
      "Correlate runtime UI elements from a native simulator scan to their Swift source code locations. Matches AX identifiers, labels, and button text to .accessibilityIdentifier(), .accessibilityLabel(), Button(), and View struct declarations. Uses NavGator architecture data if available, falls back to direct file scanning.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description: "Simulator device to scan (name fragment or UDID). Uses first booted device if omitted.",
        },
        project_root: {
          type: "string",
          description: "Absolute path to the Swift project root. Required — bridge needs source files to correlate against.",
        },
        app: {
          type: "string",
          description: "macOS app name to scan instead of simulator (e.g. 'FlowDoro'). Alternative to device.",
        },
      },
      required: ["project_root"],
    },
    annotations: {
      title: "Bridge AX Elements to Source",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  // --- Interaction tools ---
  {
    name: "interact",
    description: "Click, type, fill, or perform other interactions on page elements. Resolves elements by accessible name (e.g. 'Submit', 'Search tools'). Use 'observe' first to see available actions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL of the page to interact with",
        },
        action: {
          type: "string",
          enum: ["click", "type", "fill", "hover", "press", "scroll", "select", "check", "doubleClick", "rightClick"],
          description: "Interaction to perform",
        },
        target: {
          type: "string",
          description: "Accessible name or description of the element (e.g. 'Submit button', 'Search tools', 'FlowDoro')",
        },
        value: {
          type: "string",
          description: "Value for type/fill/press/select/scroll actions",
        },
        role: {
          type: "string",
          description: "Optional ARIA role filter (e.g. 'button', 'textbox', 'link')",
        },
        screenshot: {
          type: "boolean",
          description: "Capture screenshot after interaction (default: true)",
        },
      },
      required: ["url", "action", "target"],
    },
    annotations: {
      title: "Interact with Element",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "observe",
    description: "Preview all available actions on a page without executing them. Returns clickable buttons, fillable inputs, links, and other interactive elements with their accessible names. Use before 'interact' to find the right target name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to observe",
        },
        role: {
          type: "string",
          description: "Filter by ARIA role (e.g. 'button', 'textbox', 'link')",
        },
        limit: {
          type: "number",
          description: "Max number of actions to return (default: 30)",
        },
      },
      required: ["url"],
    },
    annotations: {
      title: "Observe Page Actions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "extract",
    description: "Extract structured data from a page — headings, buttons, inputs, links, forms. Use to verify page state after interactions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to extract data from",
        },
      },
      required: ["url"],
    },
    annotations: {
      title: "Extract Page Data",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "interact_and_verify",
    description: "Execute an interaction and capture before/after state to verify it worked. Returns element diff (added/removed elements) and optional screenshot comparison.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL of the page",
        },
        action: {
          type: "string",
          enum: ["click", "type", "fill", "hover", "press"],
          description: "Interaction to perform",
        },
        target: {
          type: "string",
          description: "Accessible name of the element",
        },
        value: {
          type: "string",
          description: "Value for type/fill/press actions",
        },
      },
      required: ["url", "action", "target"],
    },
    annotations: {
      title: "Interact and Verify",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  // --- Flow tools ---
  {
    name: "flow_search",
    description: "Execute a full search flow — finds the search box, enters query, submits, and returns results. Use for testing search functionality end-to-end.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the page with search" },
        query: { type: "string", description: "Search query to enter" },
        sessionId: { type: "string", description: "Optional: use existing session instead of launching new browser" },
      },
      required: ["url", "query"],
    },
    annotations: {
      title: "Search Flow",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "flow_form",
    description: "Fill and optionally submit a form. Detects form fields semantically and fills them with provided values. Use for testing form submission flows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the page with the form" },
        fields: {
          type: "object",
          description: 'Field name to value pairs, e.g., {"Email": "test@example.com", "Password": "secret"}',
        },
        submit: { type: "boolean", description: "Submit the form after filling (default: true)" },
        sessionId: { type: "string", description: "Optional: use existing session" },
      },
      required: ["url", "fields"],
    },
    annotations: {
      title: "Form Fill Flow",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "flow_login",
    description: "Execute a login flow — finds username/email and password fields, fills them, clicks submit, and verifies login success. Use for testing authentication flows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the login page" },
        username: { type: "string", description: "Username or email" },
        password: { type: "string", description: "Password" },
        sessionId: { type: "string", description: "Optional: use existing session" },
      },
      required: ["url", "username", "password"],
    },
    annotations: {
      title: "Login Flow",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "plan_test",
    description: "Auto-generate a test plan by observing the current page. Returns suggested interaction steps, assertions, and detected flows (search, form, login). Use as the first step before running tests.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to observe for test planning" },
        intent: {
          type: "string",
          description: "Optional: what to test, e.g., 'login flow', 'search functionality'",
        },
        sessionId: { type: "string", description: "Optional: use existing session" },
      },
      required: ["url"],
    },
    annotations: {
      title: "Plan Test",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  // --- Persistent session tools ---
  {
    name: "session_start",
    description: "Start a persistent session for web (Chrome/Safari), macOS native app, or iOS/watchOS simulator. Chrome is default for web. Use 'app' for native macOS apps, 'simulator' for iOS/watchOS. Session stays alive across tool calls — use session_action to interact, session_read to observe/extract, session_close when done.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to navigate to (web sessions)" },
        headless: { type: "boolean", description: "Run headless (default: true, web only)" },
        viewport: {
          type: "object" as const,
          properties: {
            width: { type: "number" as const },
            height: { type: "number" as const },
          },
        },
        browser: {
          type: "string",
          enum: ["chrome", "safari"],
          description: "Browser for web sessions (default: chrome)",
        },
        app: {
          type: "string",
          description: "macOS app name for native sessions (e.g. 'Finder', 'Secrets Vault')",
        },
        simulator: {
          type: "string",
          description: "Simulator device name or UDID for iOS/watchOS (e.g. 'iPhone 16 Pro')",
        },
      },
    },
    annotations: {
      title: "Start Persistent Session",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "session_action",
    description: "Execute an interaction in a persistent session (click, type, fill, hover, press, scroll, select, check). Elements resolved by accessible name. Returns rich diagnostics: confidence score, resolution tier, alternatives if not found.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by session_start" },
        action: {
          type: "string",
          enum: ["click", "type", "fill", "hover", "press", "scroll", "select", "check"],
          description: "Interaction to perform",
        },
        target: { type: "string", description: "Accessible name of element (e.g., 'Submit', 'Email')" },
        value: { type: "string", description: "Text to type/fill, key to press, or scroll direction" },
        role: { type: "string", description: "Filter by role (button, link, textbox, etc.)" },
        screenshot: { type: "boolean", description: "Capture screenshot after action (default: true)" },
      },
      required: ["sessionId", "action", "target"],
    },
    annotations: {
      title: "Session Action",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "session_read",
    description: "Read page state from a persistent session without interacting. Modes: 'observe' (list interactive elements), 'extract' (headings, buttons, inputs, links), 'screenshot' (capture current view), 'state' (URL, element count, console errors).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by session_start" },
        what: {
          type: "string",
          enum: ["observe", "extract", "screenshot", "state"],
          description: "What to read from the session",
        },
      },
      required: ["sessionId", "what"],
    },
    annotations: {
      title: "Session Read",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "session_close",
    description: "Close a persistent browser session and release resources.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by session_start" },
      },
      required: ["sessionId"],
    },
    annotations: {
      title: "Close Persistent Session",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_start",
    description:
      "Start a cursor-free native UI session for a running macOS app or iOS/watchOS simulator. macOS uses AXUIElement actions; simulator uses the Simulator.app accessibility tree when available. Does not move the user's mouse cursor.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description: "macOS app name, bundle ID, or process-name fragment (e.g. 'Finder', 'Calculator', 'com.apple.TextEdit').",
        },
        simulator: {
          type: "string",
          description: "Simulator device name or UDID for iOS/watchOS (e.g. 'iPhone 16 Pro').",
        },
      },
    },
    annotations: {
      title: "Start Native Session",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_read",
    description:
      "Read a cursor-free native session. Modes: observe (interactive elements), extract (AX element summary), state (session metadata), screenshot (when supported).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
        what: {
          type: "string",
          enum: ["observe", "extract", "screenshot", "state"],
          description: "What to read from the native session",
        },
        limit: { type: "number", description: "Maximum elements to return for observe/extract (default: 50)" },
      },
      required: ["sessionId", "what"],
    },
    annotations: {
      title: "Read Native Session",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_action",
    description:
      "Perform a cursor-free native action by accessible name: click/press, fill/type, focus, showMenu, increment, decrement, confirm, cancel, or scrollToVisible. Uses Accessibility APIs instead of moving the host cursor.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
        action: {
          type: "string",
          enum: ["click", "press", "fill", "type", "focus", "showMenu", "increment", "decrement", "confirm", "cancel", "scroll", "scrollToVisible", "check", "select"],
          description: "Native action to perform",
        },
        target: { type: "string", description: "Accessible name, AX identifier, description, or visible value to target" },
        value: { type: "string", description: "Text for fill/type/setValue actions" },
        role: { type: "string", description: "Optional role filter (button, textbox, checkbox, AXButton, etc.)" },
      },
      required: ["sessionId", "action", "target"],
    },
    annotations: {
      title: "Native Session Action",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_close",
    description: "Close a native session record. This does not quit the target app or simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
      },
      required: ["sessionId"],
    },
    annotations: {
      title: "Close Native Session",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  // --- iOS/watchOS simulator interaction ---
  {
    name: "design_system",
    description:
      "Manage the project design system configuration. Initialize default config, view active configuration, or validate that tokens and principles are correctly set up.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["init", "status", "validate"],
          description: "'init' copies the default config to .ibr/design-system.json, 'status' shows the active config, 'validate' reports which principles are active and their severities",
        },
        projectDir: {
          type: "string",
          description: "Project directory (default: current working directory)",
        },
      },
      required: ["action"],
    },
    annotations: {
      title: "Design System",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "sim_action",
    description:
      "Tap, type, scroll, or press a hardware button in an iOS/watchOS simulator. " +
      "For tap with a label target: resolves the element from the accessibility tree then taps at its center coordinates. " +
      "For tap with coordinates: taps directly at x,y. " +
      "Requires IDB for typing and swipe (install: brew install idb-companion && pip install fb-idb). " +
      "Tap and openUrl fall back to simctl when IDB is unavailable.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description: "Device name fragment or UDID. Uses first booted device if omitted.",
        },
        action: {
          type: "string",
          enum: ["tap", "type", "scroll", "swipe", "home", "openUrl"],
          description: "Interaction to perform",
        },
        target: {
          type: "string",
          description:
            "For tap: element accessibility label to resolve (e.g. 'Submit') or 'x,y' coordinates. " +
            "For type: the text to input. " +
            "For scroll/swipe: direction ('up', 'down', 'left', 'right'). " +
            "For openUrl: the URL to open (e.g. 'myapp://route'). " +
            "For home: ignored.",
        },
        value: {
          type: "string",
          description:
            "Optional extra value. For tap by label: overrides auto-resolved coordinates if provided as 'x,y'. " +
            "For scroll: starting x,y as 'x,y' (default: screen center).",
        },
      },
      required: ["action", "target"],
    },
    annotations: {
      title: "Simulator Action",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

// --- Tool handlers ---

const DEFAULT_OUTPUT_DIR = ".ibr";

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<McpResponse> {
  try {
    switch (name) {
      case "scan":
        return await handleScan(args);
      case "snapshot":
        return await handleSnapshot(args);
      case "compare":
        return await handleCompare(args);
      case "list_sessions":
        return await handleListSessions();
      case "screenshot":
        return await handleScreenshot(args);
      case "references":
        return await handleReferences(args);
      case "scan_macos":
        return await handleScanMacOS(args);
      case "native_scan":
        return await handleNativeScan(args);
      case "native_snapshot":
        return await handleNativeSnapshot(args);
      case "native_compare":
        return await handleNativeCompare(args);
      case "native_devices":
        return await handleNativeDevices(args);
      case "validate_tokens":
        return await handleValidateTokens(args);
      case "scan_static":
        return await handleScanStatic(args);
      case "bridge_to_source":
        return await handleBridgeToSource(args);
      case "native_session_start":
        return await handleNativeSessionStart(args);
      case "native_session_read":
        return await handleNativeSessionRead(args);
      case "native_session_action":
        return await handleNativeSessionAction(args);
      case "native_session_close":
        return await handleNativeSessionClose(args);
      case "interact": {
        const { url, action, target, value, role, screenshot: wantScreenshot = true } = args as {
          url: string; action: string; target: string; value?: string; role?: string; screenshot?: boolean
        }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          // Find element with diagnostics
          const diag = await driver.findWithDiagnostics(target, role ? { role } : undefined) as FindDiagnostics
          if (!diag.elementId) {
            const altNames = diag.alternatives.map(a => `"${a.name}" (${a.role}, score: ${a.score.toFixed(2)})`).join(', ')
            const notFoundContent: McpContent[] = [
              {
                type: 'text',
                text: `Element "${target}" not found (${diag.totalInteractive} interactive elements on page). ` +
                  `Best matches: ${altNames || 'none'}. ` +
                  `Hint: Use 'observe' to see all interactive elements, or try one of the alternatives.`,
              },
            ]
            if (diag.screenshot) {
              notFoundContent.push({ type: 'image', data: diag.screenshot, mimeType: 'image/png' })
            }
            return { content: notFoundContent, isError: true }
          }

          // Resolve element object from id
          const allElements = await driver.getSnapshot()
          const element = allElements.find(e => e.id === diag.elementId)
          if (!element) {
            return errorResponse(`Element "${target}" was resolved but disappeared from AX tree. Try again.`)
          }

          // Execute action
          switch (action) {
            case 'click': await driver.click(element.id); break
            case 'type': await driver.type(element.id, value || ''); break
            case 'fill': await driver.fill(element.id, value || ''); break
            case 'hover': await driver.hover(element.id); break
            case 'press': await driver.pressKey(value || 'Enter'); break
            case 'scroll': await driver.scroll(Number(value) || 300); break
            case 'select': await driver.select(element.id, value || ''); break
            case 'check': await driver.check(element.id); break
            case 'doubleClick': await driver.doubleClick(element.id); break
            case 'rightClick': await driver.rightClick(element.id); break
            default: return errorResponse(`Unknown action: ${action}`)
          }

          // Wait for UI to settle
          await new Promise(r => setTimeout(r, 500))

          const resolutionInfo = `(resolved via ${diag.tierName}, confidence: ${diag.confidence.toFixed(2)})`

          // Capture screenshot if requested
          if (wantScreenshot) {
            const buf = await driver.screenshot()
            const base64 = buf.toString('base64')
            return imageResponse(base64, `✓ ${action} on "${target}" succeeded ${resolutionInfo}`)
          }

          return textResponse(`✓ ${action} on "${target}" succeeded ${resolutionInfo}`)
        } catch (err) {
          return errorResponse(`Interaction failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "observe": {
        const { url, role: roleFilter, limit = 30 } = args as { url: string; role?: string; limit?: number }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)
          const actions = await driver.observe({ role: roleFilter, limit })

          if (actions.length === 0) {
            return textResponse('No interactive elements found on this page.')
          }

          if (actions.length > 80) {
            const compressed = compressSnapshot(actions.map(a => ({
              id: a.elementId ?? '',
              role: a.role ?? '',
              label: a.description ?? a.label ?? '',
              actions: a.actions,
            })))
            return textResponse(formatCompressed(compressed))
          }

          const lines = actions.map((a, i) => `${i + 1}. [${a.role}] "${a.label}" — ${a.actions.join(', ')}`)
          return textResponse(`Found ${actions.length} interactive elements:\n\n${lines.join('\n')}`)
        } catch (err) {
          return errorResponse(`Observe failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "extract": {
        const { url } = args as { url: string }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)
          const meta = await driver.extractMeta()

          const sections: string[] = []
          if (meta.headings.length > 0) {
            sections.push(`Headings:\n${meta.headings.map(h => `  ${h}`).join('\n')}`)
          }
          if (meta.buttons.length > 0) {
            sections.push(`Buttons (${meta.buttons.length}):\n${meta.buttons.map(b => `  • ${b.label}${b.enabled === false ? ' (disabled)' : ''}`).join('\n')}`)
          }
          if (meta.inputs.length > 0) {
            sections.push(`Inputs (${meta.inputs.length}):\n${meta.inputs.map(inp => `  • ${inp.label}${inp.value ? ` = "${inp.value}"` : ''}`).join('\n')}`)
          }
          if (meta.links.length > 0) {
            sections.push(`Links (${meta.links.length}):\n${meta.links.slice(0, 20).map(l => `  • ${l.label}`).join('\n')}${meta.links.length > 20 ? `\n  ... and ${meta.links.length - 20} more` : ''}`)
          }

          return textResponse(sections.join('\n\n') || 'No structured data found on page.')
        } catch (err) {
          return errorResponse(`Extract failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "interact_and_verify": {
        const { url, action, target, value } = args as { url: string; action: string; target: string; value?: string }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          const element = await driver.find(target)
          if (!element) {
            return errorResponse(`Element not found: "${target}". Use 'observe' to see available elements.`)
          }

          const result = await driver.actAndCapture(async () => {
            switch (action) {
              case 'click': await driver.click(element.id); break
              case 'type': await driver.type(element.id, value || ''); break
              case 'fill': await driver.fill(element.id, value || ''); break
              case 'hover': await driver.hover(element.id); break
              case 'press': await driver.pressKey(value || 'Enter'); break
              default: throw new Error(`Unknown action: ${action}`)
            }
          })

          const lines = [
            `✓ ${action} on "${target}" — verified`,
            ``,
            `Elements added: ${result.diff.addedElements.length}`,
            `Elements removed: ${result.diff.removedElements.length}`,
            `Pixel diff: ${result.diff.pixelDiff}px`,
          ]

          if (result.diff.addedElements.length > 0) {
            lines.push(``, `New elements:`)
            result.diff.addedElements.slice(0, 10).forEach(el => {
              lines.push(`  + [${el.role}] "${el.label || '(unnamed)'}"`)
            })
          }
          if (result.diff.removedElements.length > 0) {
            lines.push(``, `Removed elements:`)
            result.diff.removedElements.slice(0, 10).forEach(el => {
              lines.push(`  - [${el.role}] "${el.label || '(unnamed)'}"`)
            })
          }

          // Return with after-screenshot
          const base64 = result.after.screenshot.toString('base64')
          return imageResponse(base64, lines.join('\n'))
        } catch (err) {
          return errorResponse(`Interact and verify failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "flow_search": {
        const { url, query } = args as { url: string; query: string }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          const page = new CompatPage(driver)
          const result = await searchFlow(page, { query })

          const lines = [
            result.success ? `Search flow succeeded` : `Search flow failed`,
            `Query: "${query}"`,
            `Results found: ${result.resultCount}`,
            `Has results: ${result.hasResults}`,
          ]
          if (result.error) {
            lines.push(`Error: ${result.error}`)
          }
          lines.push(``, `Steps:`)
          result.steps.forEach(s => {
            lines.push(`  ${s.success ? '✓' : '✗'} ${s.action}${s.error ? ` (${s.error})` : ''}`)
          })

          return textResponse(lines.join('\n'))
        } catch (err) {
          return errorResponse(`flow_search failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "flow_form": {
        const { url, fields, submit = true } = args as {
          url: string;
          fields: Record<string, string>;
          submit?: boolean;
        }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          const page = new CompatPage(driver)
          const formFields = Object.entries(fields).map(([name, value]) => ({ name, value }))
          const result = await formFlow(page, {
            fields: formFields,
            submitButton: submit ? undefined : '__NO_SUBMIT__',
          })

          const lines = [
            result.success ? `Form flow succeeded` : `Form flow failed`,
            `Filled: ${result.filledFields.join(', ') || 'none'}`,
            `Failed: ${result.failedFields.join(', ') || 'none'}`,
          ]
          if (result.error) {
            lines.push(`Error: ${result.error}`)
          }

          return textResponse(lines.join('\n'))
        } catch (err) {
          return errorResponse(`flow_form failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "flow_login": {
        const { url, username, password } = args as { url: string; username: string; password: string }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          const page = new CompatPage(driver)
          const result = await loginFlow(page, { email: username, password })

          const redirectUrl = driver.currentUrl !== url ? driver.currentUrl : undefined

          const lines = [
            result.success ? `Login flow succeeded` : `Login flow failed`,
            `Logged in: ${result.authenticated}`,
          ]
          if (redirectUrl) {
            lines.push(`Redirect URL: ${redirectUrl}`)
          }
          if (result.username) {
            lines.push(`Username detected: ${result.username}`)
          }
          if (result.error) {
            lines.push(`Error: ${result.error}`)
          }
          lines.push(``, `Steps:`)
          result.steps.forEach(s => {
            lines.push(`  ${s.success ? '✓' : '✗'} ${s.action}${s.error ? ` (${s.error})` : ''}`)
          })

          return textResponse(lines.join('\n'))
        } catch (err) {
          return errorResponse(`flow_login failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "plan_test": {
        const { url, intent } = args as { url: string; intent?: string }

        const driver = new EngineDriver()
        try {
          await driver.launch()
          await driver.navigate(url)

          const [actions, meta] = await Promise.all([
            driver.observe({ limit: 100 }),
            driver.extractMeta(),
          ])

          // Detect available flows
          const suggestedFlows: string[] = []
          const hasSearchInput = actions.some(a =>
            a.role === 'searchbox' ||
            (a.role === 'textbox' && /search|query/i.test(a.label))
          )
          const hasPasswordField = meta.inputs.some(i => /password/i.test(i.label))
          const hasEmailField = meta.inputs.some(i => /email|username|login/i.test(i.label))
          const hasFormFields = meta.inputs.length > 0

          if (hasSearchInput) suggestedFlows.push('search')
          if (hasEmailField && hasPasswordField) suggestedFlows.push('login')
          else if (hasFormFields) suggestedFlows.push('form')

          // Build suggested steps
          const steps: Array<{ action: string; target: string; role?: string; value?: string; expect?: string }> = []

          if (hasEmailField && hasPasswordField) {
            const emailInput = meta.inputs.find(i => /email|username|login/i.test(i.label))
            const passInput = meta.inputs.find(i => /password/i.test(i.label))
            const submitBtn = meta.buttons.find(b => /login|sign in|submit/i.test(b.label))

            if (emailInput) steps.push({ action: 'fill', target: emailInput.label, value: '<test email>' })
            if (passInput) steps.push({ action: 'fill', target: passInput.label, value: '<test password>' })
            if (submitBtn) steps.push({ action: 'click', target: submitBtn.label, role: 'button' })
            steps.push({ action: 'verify', target: 'authenticated state', expect: 'Dashboard visible' })
          } else if (hasSearchInput) {
            const searchAction = actions.find(a => a.role === 'searchbox' || /search/i.test(a.label))
            if (searchAction) {
              steps.push({ action: 'fill', target: searchAction.label, value: '<search query>' })
              steps.push({ action: 'verify', target: 'results', expect: 'Results visible' })
            }
          } else {
            // Generic: click first few buttons
            meta.buttons.slice(0, 3).forEach(b => {
              steps.push({ action: 'click', target: b.label, role: 'button' })
            })
            meta.inputs.slice(0, 3).forEach(inp => {
              steps.push({ action: 'fill', target: inp.label, value: '<test value>' })
            })
          }

          const interactiveCount = actions.length
          const totalElements = meta.buttons.length + meta.inputs.length + meta.links.length
          const coverage = {
            interactive: interactiveCount,
            total: totalElements,
            percentage: totalElements > 0 ? Math.round((interactiveCount / totalElements) * 100) : 0,
          }

          const plan = {
            suggestedFlows,
            interactiveElements: interactiveCount,
            steps,
            coverage,
          }

          const lines = [
            `Test plan for: ${url}`,
            intent ? `Intent: ${intent}` : '',
            ``,
            `Suggested flows: ${suggestedFlows.length > 0 ? suggestedFlows.join(', ') : 'none detected'}`,
            `Interactive elements: ${interactiveCount}`,
            `Coverage: ${coverage.percentage}%`,
            ``,
            `Steps:`,
            ...steps.map((s, i) => {
              if (s.action === 'verify') return `  ${i + 1}. verify: ${s.expect}`
              if (s.action === 'fill') return `  ${i + 1}. fill "${s.target}" with ${s.value}`
              return `  ${i + 1}. ${s.action} "${s.target}"${s.role ? ` [${s.role}]` : ''}`
            }),
          ].filter(l => l !== '')

          return textResponse(JSON.stringify(plan, null, 2) + '\n\n' + lines.join('\n'))
        } catch (err) {
          return errorResponse(`plan_test failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await driver.close().catch(() => {})
        }
      }

      case "session_start": {
        const { url, headless = true, viewport, browser, app, simulator } = args as {
          url?: string
          headless?: boolean
          viewport?: { width: number; height: number }
          browser?: 'chrome' | 'safari'
          app?: string
          simulator?: string
        }

        const sessionId = crypto.randomUUID()

        // ── macOS native session ──────────────────────────────────────────
        if (app) {
          return await startMacOSSession(sessionId, app, 'session_start (macos)')
        }

        // ── iOS/watchOS simulator session ─────────────────────────────────
        if (simulator) {
          return await startSimulatorSession(sessionId, simulator, 'session_start (simulator)')
        }

        // ── Web sessions (Chrome or Safari) ──────────────────────────────
        if (!url) {
          return errorResponse(`session_start requires 'url' for web sessions, 'app' for macOS native, or 'simulator' for iOS/watchOS`)
        }

        // Safari session (on request)
        if (browser === 'safari') {
          try {
            const { SafariDriver } = await import('../engine/safari/driver.js')
            const safariDriver = new SafariDriver()
            await safariDriver.launch({})
            await safariDriver.navigate(url)

            sessions.set(sessionId, { driver: safariDriver, type: 'safari', url, createdAt: Date.now() })

            return textResponse(JSON.stringify({
              sessionId,
              type: 'safari',
              url,
              timestamp: new Date().toISOString(),
            }, null, 2))
          } catch (err) {
            return errorResponse(`session_start (safari) failed: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        // Chrome session (default)
        const driver = new EngineDriver()
        try {
          await driver.launch({
            headless,
            viewport: viewport ? { width: viewport.width, height: viewport.height } : undefined,
          })
          await driver.navigate(url)

          const elements = await driver.getSnapshot()
          const elementCount = elements.filter(e => e.actions.length > 0).length

          sessions.set(sessionId, { driver, type: 'chrome', url: driver.url || url, createdAt: Date.now() })

          return textResponse(JSON.stringify({
            sessionId,
            type: 'chrome',
            url: driver.url || url,
            elementCount,
            timestamp: new Date().toISOString(),
          }, null, 2))
        } catch (err) {
          await driver.close().catch(() => {})
          return errorResponse(`session_start failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      case "session_action": {
        const {
          sessionId, action, target, value, role,
          screenshot: wantScreenshot = true,
        } = args as {
          sessionId: string
          action: string
          target: string
          value?: string
          role?: string
          screenshot?: boolean
        }

        const entry = sessions.get(sessionId)
        if (!entry) {
          return errorResponse('Session not found. Use session_start first.')
        }

        // ── macOS native session ──────────────────────────────────────────
        if (entry.type === 'macos') {
          return await runMacOSSessionAction(entry, { action, target, value, role })
        }

        // ── Simulator session ─────────────────────────────────────────────
        if (entry.type === 'simulator') {
          return await runSimulatorSessionAction(entry, { action, target, value, role })
        }

        // ── Browser session (Chrome or Safari) ───────────────────────────
        const driver = entry.driver

        try {
          const diag = await driver.findWithDiagnostics(target, role ? { role } : undefined) as FindDiagnostics
          if (!diag.elementId) {
            const notFoundPayload = JSON.stringify({
              success: false,
              error: `Element "${target}" not found`,
              alternatives: diag.alternatives,
              hint: diag.alternatives.length > 0
                ? `Try one of these: ${diag.alternatives.map((a) => `"${a.name}" (${a.role})`).join(', ')}`
                : 'Use session_read with what="observe" to see all interactive elements',
            }, null, 2)
            const notFoundContent: McpContent[] = [{ type: 'text', text: notFoundPayload }]
            if (diag.screenshot) {
              notFoundContent.push({ type: 'image', data: diag.screenshot, mimeType: 'image/png' })
            }
            return { content: notFoundContent }
          }

          const allElements = await driver.getSnapshot() as EngineElement[]
          const element = allElements.find((e) => e.id === diag.elementId)

          switch (action) {
            case 'click': await driver.click(diag.elementId); break
            case 'type': await driver.type(diag.elementId, value || ''); break
            case 'fill': await driver.fill(diag.elementId, value || ''); break
            case 'hover': await driver.hover(diag.elementId); break
            case 'press': await driver.pressKey(value || 'Enter'); break
            case 'scroll': await driver.scroll(Number(value) || 300); break
            case 'select': await driver.select(diag.elementId, value || ''); break
            case 'check': await driver.check(diag.elementId); break
            default: return errorResponse(`Unknown action: ${action}`)
          }

          await new Promise(r => setTimeout(r, 500))

          const afterElements = await driver.getSnapshot() as EngineElement[]
          const afterCount = afterElements.filter((e) => e.actions.length > 0).length
          entry.url = driver.url

          const actionResult: Record<string, unknown> = {
            success: true,
            elementFound: {
              id: diag.elementId,
              role: element?.role ?? 'unknown',
              label: element?.label ?? target,
              confidence: diag.confidence,
              tier: diag.tierName,
            },
            pageState: { url: driver.url, elementCount: afterCount },
          }

          if (wantScreenshot) {
            const buf = await driver.screenshot()
            const base64 = buf.toString('base64')
            return {
              content: [
                { type: 'image' as const, data: base64, mimeType: 'image/png' },
                { type: 'text' as const, text: JSON.stringify(actionResult, null, 2) },
              ],
            }
          }

          return textResponse(JSON.stringify(actionResult, null, 2))
        } catch (err) {
          return errorResponse(`session_action failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      case "session_read": {
        const { sessionId, what } = args as { sessionId: string; what: string }

        const entry = sessions.get(sessionId)
        if (!entry) {
          return errorResponse('Session not found. Use session_start first.')
        }

        // ── macOS native session ──────────────────────────────────────────
        if (entry.type === 'macos') {
          return await readMacOSSession(entry, what, Number(args.limit) || 50)
        }

        // ── Simulator session ─────────────────────────────────────────────
        if (entry.type === 'simulator') {
          return await readSimulatorSession(entry, what, Number(args.limit) || 50)
        }

        // ── Browser session (Chrome or Safari) ───────────────────────────
        const driver = entry.driver

        try {
          switch (what) {
            case 'observe': {
              const actions = await driver.observe() as ActionDescriptor[]

              if (actions.length === 0) {
                return textResponse('No interactive elements found on this page.')
              }

              if (actions.length > 80) {
                const compressed = compressSnapshot(actions.map((a) => ({
                  id: a.elementId ?? '',
                  role: a.role ?? '',
                  label: a.description ?? a.label ?? '',
                  actions: a.actions,
                })))
                return textResponse(formatCompressed(compressed))
              }

              const lines = actions.map((a, i) => `${i + 1}. [${a.role}] "${a.label}" — ${a.actions.join(', ')}`)
              return textResponse(`Found ${actions.length} interactive elements:\n\n${lines.join('\n')}`)
            }

            case 'extract': {
              const meta = await driver.extractMeta() as ExtractedMeta
              const sections: string[] = []
              if (meta.headings.length > 0) {
                sections.push(`Headings:\n${meta.headings.map((h) => `  ${h}`).join('\n')}`)
              }
              if (meta.buttons.length > 0) {
                sections.push(`Buttons (${meta.buttons.length}):\n${meta.buttons.map((b) => `  • ${b.label}${b.enabled === false ? ' (disabled)' : ''}`).join('\n')}`)
              }
              if (meta.inputs.length > 0) {
                sections.push(`Inputs (${meta.inputs.length}):\n${meta.inputs.map((inp) => `  • ${inp.label}${inp.value ? ` = "${inp.value}"` : ''}`).join('\n')}`)
              }
              if (meta.links.length > 0) {
                sections.push(`Links (${meta.links.length}):\n${meta.links.slice(0, 20).map((l) => `  • ${l.label}`).join('\n')}${meta.links.length > 20 ? `\n  ... and ${meta.links.length - 20} more` : ''}`)
              }
              return textResponse(sections.join('\n\n') || 'No structured data found on page.')
            }

            case 'screenshot': {
              const buf = await driver.screenshot()
              const base64 = buf.toString('base64')
              return imageResponse(base64, `Screenshot of ${driver.url}`)
            }

            case 'state': {
              const elements = await driver.getSnapshot() as EngineElement[]
              const elementCount = elements.filter((e) => e.actions.length > 0).length
              const consoleErrors = (driver.getConsoleErrors() as Array<{ text: string }>).map((m) => m.text)
              return textResponse(JSON.stringify({
                url: driver.url,
                elementCount,
                consoleErrors,
              }, null, 2))
            }

            default:
              return errorResponse(`Unknown read mode: ${what}. Use: observe, extract, screenshot, state`)
          }
        } catch (err) {
          return errorResponse(`session_read failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      case "session_close": {
        const { sessionId } = args as { sessionId: string }

        const entry = sessions.get(sessionId)
        if (!entry) {
          return errorResponse('Session not found.')
        }

        try {
          // Native sessions (macos/simulator) have no driver to close
          if (entry.driver) {
            await entry.driver.close()
          }
          sessions.delete(sessionId)
          return textResponse(`Session ${sessionId} closed.`)
        } catch (err) {
          sessions.delete(sessionId)
          return errorResponse(`session_close error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      case "sim_action":
        return await handleSimAction(args);

      case "design_system":
        return await handleDesignSystem(args);

      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Tool execution failed"
    );
  }
}

async function handleNativeSessionStart(args: Record<string, unknown>): Promise<McpResponse> {
  const app = args.app as string | undefined
  const simulator = args.simulator as string | undefined

  if (app && simulator) {
    return errorResponse("Provide either 'app' or 'simulator', not both.")
  }
  if (!app && !simulator) {
    return errorResponse("native_session_start requires 'app' for macOS or 'simulator' for iOS/watchOS.")
  }

  const sessionId = crypto.randomUUID()
  if (app) {
    return await startMacOSSession(sessionId, app, 'native_session_start (macos)')
  }
  return await startSimulatorSession(sessionId, simulator!, 'native_session_start (simulator)')
}

async function handleNativeSessionRead(args: Record<string, unknown>): Promise<McpResponse> {
  const sessionId = args.sessionId as string
  const what = args.what as string
  const limit = Number(args.limit) || 50
  const entry = sessions.get(sessionId)

  if (!entry) return errorResponse('Session not found. Use native_session_start first.')
  if (entry.type === 'macos') return await readMacOSSession(entry, what, limit)
  if (entry.type === 'simulator') return await readSimulatorSession(entry, what, limit)
  return errorResponse(`Session ${sessionId} is a ${entry.type} web session. Use session_read for web sessions.`)
}

async function handleNativeSessionAction(args: Record<string, unknown>): Promise<McpResponse> {
  const {
    sessionId,
    action,
    target,
    value,
    role,
  } = args as { sessionId: string; action: string; target: string; value?: string; role?: string }

  const entry = sessions.get(sessionId)
  if (!entry) return errorResponse('Session not found. Use native_session_start first.')
  if (entry.type === 'macos') return await runMacOSSessionAction(entry, { action, target, value, role })
  if (entry.type === 'simulator') return await runSimulatorSessionAction(entry, { action, target, value, role })
  return errorResponse(`Session ${sessionId} is a ${entry.type} web session. Use session_action for web sessions.`)
}

async function handleNativeSessionClose(args: Record<string, unknown>): Promise<McpResponse> {
  const sessionId = args.sessionId as string
  const entry = sessions.get(sessionId)
  if (!entry) return errorResponse('Session not found.')
  if (entry.type !== 'macos' && entry.type !== 'simulator') {
    return errorResponse(`Session ${sessionId} is a ${entry.type} web session. Use session_close for web sessions.`)
  }
  sessions.delete(sessionId)
  return textResponse(`Native session ${sessionId} closed.`)
}

async function startMacOSSession(
  sessionId: string,
  app: string,
  errorPrefix: string
): Promise<McpResponse> {
  try {
    const pid = await findProcess(app)
    sessions.set(sessionId, { driver: null, type: 'macos', app, pid, createdAt: Date.now() })

    return textResponse(JSON.stringify({
      sessionId,
      type: 'macos',
      backend: 'macos-ax',
      app,
      pid,
      hostCursorAffected: false,
      timestamp: new Date().toISOString(),
    }, null, 2))
  } catch (err) {
    return errorResponse(`${errorPrefix} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function startSimulatorSession(
  sessionId: string,
  simulator: string,
  errorPrefix: string
): Promise<McpResponse> {
  try {
    let device = await findDevice(simulator)
    if (!device) throw new Error(`Simulator not found: ${simulator}`)
    if (device.state !== 'Booted') {
      await bootDevice(device.udid)
      device = await findDevice(device.udid) ?? device
    }

    sessions.set(sessionId, {
      driver: null,
      type: 'simulator',
      device: { udid: device.udid, name: device.name },
      createdAt: Date.now(),
    })

    return textResponse(JSON.stringify({
      sessionId,
      type: 'simulator',
      backend: 'simulator-ax',
      device: { udid: device.udid, name: device.name },
      hostCursorAffected: false,
      timestamp: new Date().toISOString(),
    }, null, 2))
  } catch (err) {
    return errorResponse(`${errorPrefix} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function readMacOSSession(entry: SessionEntry, what: string, limit: number): Promise<McpResponse> {
  try {
    if (what === 'screenshot') {
      return textResponse('macOS screenshot capture is available through scan_macos with a screenshot path.')
    }

    const { elements, window } = await extractMacOSElements({ pid: entry.pid! })
    const candidates = flattenMacOSElements(elements)
    const interactive = candidates.filter(candidate => candidate.actions.length > 0)

    if (what === 'state') {
      return textResponse(JSON.stringify({
        type: 'macos',
        backend: 'macos-ax',
        app: entry.app,
        pid: entry.pid,
        window,
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        hostCursorAffected: false,
      }, null, 2))
    }

    if (what !== 'observe' && what !== 'extract') {
      return errorResponse(`Unknown read mode: ${what}. Use: observe, extract, screenshot, state`)
    }

    const source = what === 'observe' ? interactive : candidates
    return textResponse(JSON.stringify({
      type: 'macos',
      backend: 'macos-ax',
      app: entry.app,
      pid: entry.pid,
      window,
      totalElements: candidates.length,
      interactiveElements: interactive.length,
      returned: Math.min(source.length, limit),
      hostCursorAffected: false,
      elements: source.slice(0, limit).map(formatNativeCandidate),
    }, null, 2))
  } catch (err) {
    return errorResponse(`native session read (macos) failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function readSimulatorSession(entry: SessionEntry, what: string, limit: number): Promise<McpResponse> {
  try {
    if (what === 'screenshot') {
      return textResponse('Simulator screenshot capture is available through native_scan or native_snapshot.')
    }

    const device = await findDevice(entry.device!.udid)
    if (!device) return errorResponse(`Simulator not found: ${entry.device!.udid}`)

    const elements = await extractNativeElements(device)
    const candidates = flattenSimulatorElements(elements)
    const interactive = candidates.filter(candidate => candidate.actions.length > 0)

    if (what === 'state') {
      return textResponse(JSON.stringify({
        type: 'simulator',
        backend: 'simulator-ax',
        device: entry.device,
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        hostCursorAffected: false,
      }, null, 2))
    }

    if (what !== 'observe' && what !== 'extract') {
      return errorResponse(`Unknown read mode: ${what}. Use: observe, extract, screenshot, state`)
    }

    const source = what === 'observe' ? interactive : candidates
    return textResponse(JSON.stringify({
      type: 'simulator',
      backend: 'simulator-ax',
      device: entry.device,
      totalElements: candidates.length,
      interactiveElements: interactive.length,
      returned: Math.min(source.length, limit),
      hostCursorAffected: false,
      elements: source.slice(0, limit).map(formatNativeCandidate),
    }, null, 2))
  } catch (err) {
    return errorResponse(`native session read (simulator) failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function runMacOSSessionAction(
  entry: SessionEntry,
  request: { action: string; target: string; value?: string; role?: string }
): Promise<McpResponse> {
  try {
    const { elements } = await extractMacOSElements({ pid: entry.pid! })
    const resolution = resolveMacOSElement(elements, request.target, request.role ? { role: request.role } : {})
    if (!resolution) {
      return nativeTargetNotFound(request.target, flattenMacOSElements(elements))
    }
    if (!resolution.element.path) {
      return errorResponse(`Element "${request.target}" was found but has no AX path. Rebuild the native extractor and try again.`)
    }

    const mapped = mapSessionActionToNative(request.action, request.value)
    if ('error' in mapped) return errorResponse(mapped.error)

    const actionResult = await performNativeAction({
      pid: entry.pid!,
      elementPath: resolution.element.path,
      action: mapped.action,
      value: mapped.value,
    })

    return nativeActionResponse(actionResult.success, {
      backend: 'macos-ax',
      app: entry.app,
      pid: entry.pid,
      requestedAction: request.action,
      axAction: mapped.action,
      target: request.target,
      resolved: formatNativeCandidate(resolution.element),
      confidence: resolution.confidence,
      tier: resolution.tier,
      alternatives: resolution.alternatives,
      hostCursorAffected: false,
      error: actionResult.error,
    })
  } catch (err) {
    return errorResponse(`native session action (macos) failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function runSimulatorSessionAction(
  entry: SessionEntry,
  request: { action: string; target: string; value?: string; role?: string }
): Promise<McpResponse> {
  try {
    const device = await findDevice(entry.device!.udid)
    if (!device) return errorResponse(`Simulator not found: ${entry.device!.udid}`)

    const elements = await extractNativeElements(device)
    const resolution = resolveSimulatorElement(elements, request.target, request.role ? { role: request.role } : {})
    if (!resolution) {
      return nativeTargetNotFound(request.target, flattenSimulatorElements(elements))
    }
    if (!resolution.element.path) {
      return errorResponse(`Element "${request.target}" was found but has no AX path. Rebuild the native extractor and try again.`)
    }

    const mapped = mapSessionActionToNative(request.action, request.value)
    if ('error' in mapped) return errorResponse(mapped.error)

    const simulatorPid = await findProcess('com.apple.iphonesimulator')
    const actionResult = await performNativeAction({
      pid: simulatorPid,
      deviceName: device.name,
      elementPath: resolution.element.path,
      action: mapped.action,
      value: mapped.value,
    })

    return nativeActionResponse(actionResult.success, {
      backend: 'simulator-ax',
      device: entry.device,
      requestedAction: request.action,
      axAction: mapped.action,
      target: request.target,
      resolved: formatNativeCandidate(resolution.element),
      confidence: resolution.confidence,
      tier: resolution.tier,
      alternatives: resolution.alternatives,
      hostCursorAffected: false,
      error: actionResult.error,
    })
  } catch (err) {
    return errorResponse(`native session action (simulator) failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function mapSessionActionToNative(
  action: string,
  value?: string
): { action: NativeAction; value?: string } | { error: string } {
  switch (action) {
    case 'click':
    case 'press':
    case 'check':
    case 'select':
      return { action: 'press' }
    case 'fill':
    case 'type':
      if (value === undefined) return { error: `${action} requires 'value'.` }
      return { action: 'setValue', value }
    case 'focus':
      return { action: 'focus' }
    case 'showMenu':
      return { action: 'showMenu' }
    case 'increment':
      return { action: 'increment' }
    case 'decrement':
      return { action: 'decrement' }
    case 'confirm':
      return { action: 'confirm' }
    case 'cancel':
      return { action: 'cancel' }
    case 'scroll':
    case 'scrollToVisible':
      return { action: 'scrollToVisible' }
    case 'hover':
    case 'doubleClick':
    case 'rightClick':
      return { error: `${action} would require pointer-style event injection. Use AX actions for cursor-free native sessions.` }
    default:
      return { error: `Unknown native action: ${action}` }
  }
}

function nativeTargetNotFound(target: string, candidates: NativeElementCandidate[]): McpResponse {
  const alternatives = candidates
    .filter(candidate => candidate.label || candidate.identifier)
    .slice(0, 10)
    .map(formatNativeCandidate)

  return errorResponse(JSON.stringify({
    success: false,
    error: `Element "${target}" not found`,
    alternatives,
    hint: 'Use native_session_read with what="observe" to inspect actionable AX elements.',
  }, null, 2))
}

function nativeActionResponse(success: boolean, payload: Record<string, unknown>): McpResponse {
  const response = textResponse(JSON.stringify({ success, ...payload }, null, 2))
  if (!success) response.isError = true
  return response
}

function formatNativeCandidate(candidate: NativeElementCandidate): Record<string, unknown> {
  return {
    role: candidate.role,
    label: candidate.label || null,
    identifier: candidate.identifier || null,
    enabled: candidate.enabled,
    actions: candidate.actions,
    path: candidate.path,
    frame: candidate.frame,
  }
}

async function handleScan(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const url = args.url as string;
  if (!url) {
    return errorResponse("The 'url' parameter is required.");
  }

  const viewport = (args.viewport as string) || "desktop";

  const result = await scan(url, {
    viewport: viewport as ScanOptions["viewport"],
    patience: args.patience as number | undefined,
    networkIdleTimeout: args.networkIdleTimeout as number | undefined,
  });

  // Format for LLM consumption — concise structured text
  const lines = [
    `UI Scan: ${result.url}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
    "",
    `Page intent: ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `Auth: ${result.semantic.state.auth.authenticated ? "Authenticated" : "Not authenticated"}`,
    `Loading: ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : "Complete"}`,
  ];

  // Console errors
  if (result.console.errors.length > 0) {
    lines.push("");
    lines.push(`Console errors (${result.console.errors.length}):`);
    for (const e of result.console.errors.slice(0, 5)) {
      lines.push(`- ${e.slice(0, 200)}`);
    }
  }

  // Issues
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }

  // Element summary
  const totalElements = result.elements.all.length;
  const interactive = result.elements.all.filter(
    (e) => e.interactive.hasOnClick || e.interactive.hasHref
  ).length;

  lines.push("");
  lines.push(`Elements: ${totalElements} total, ${interactive} interactive`);

  // Interactivity summary
  if (result.interactivity) {
    const { buttons, links, forms } = result.interactivity;
    lines.push(
      `Buttons: ${buttons?.length || 0}, Links: ${links?.length || 0}, Forms: ${forms?.length || 0}`
    );
  }

  // Audit summary
  if (result.elements.audit) {
    const audit = result.elements.audit;
    if (audit.issues && audit.issues.length > 0) {
      lines.push("");
      lines.push(`Audit issues (${audit.issues.length}):`);
      for (const a of audit.issues.slice(0, 5)) {
        lines.push(`- ${a.message || a}`);
      }
    }
  }

  // Design system results
  if (result.designSystem) {
    const ds = result.designSystem;
    lines.push("");
    lines.push(`Design system: ${ds.configName} (compliance: ${ds.complianceScore}%)`);
    const dsViolations = ds.principleViolations.length + ds.tokenViolations.length + ds.customViolations.length;
    if (dsViolations > 0) {
      lines.push(`Design system violations: ${dsViolations}`);
      for (const v of ds.principleViolations.slice(0, 5)) {
        lines.push(`  - [${v.severity}] ${v.message}`);
      }
      for (const v of ds.tokenViolations.slice(0, 3)) {
        lines.push(`  - [${v.severity}] ${v.message}`);
      }
      if (dsViolations > 8) {
        lines.push(`  ... and ${dsViolations - 8} more`);
      }
    }
  }

  // Rule engine results
  if (result.ruleEngine && result.ruleEngine.length > 0) {
    lines.push("");
    lines.push(`Rule engine violations (${result.ruleEngine.length}):`);
    for (const v of result.ruleEngine.slice(0, 10)) {
      lines.push(`- [${v.severity}] ${v.rule}: ${v.actual} (${v.element})`);
    }
    if (result.ruleEngine.length > 10) {
      lines.push(`  ... and ${result.ruleEngine.length - 10} more`);
    }
  }

  // Scan summaries
  if (result.summaries) {
    const s = result.summaries;
    lines.push("");
    lines.push("Summaries:");
    if (s.componentCensus && s.componentCensus.length > 0) {
      lines.push(`  Components: ${s.componentCensus.map((c) => `${c.pattern}(${c.count})`).join(", ")}`);
    }
    if (s.contrastReport && s.contrastReport.length > 0) {
      const failing = s.contrastReport.filter((c) => c.status === 'fail').length;
      const total = s.contrastReport.length;
      lines.push(`  Contrast: ${total - failing}/${total} pass`);
    }
    if (s.interactionMap && s.interactionMap.length > 0) {
      lines.push(`  Interaction coverage: ${s.interactionMap.map((m) => `${m.category}(${m.count})`).join(", ")}`);
    }
    if (s.tokenEfficiency) {
      lines.push(`  Token efficiency: ${s.tokenEfficiency.reductionPercent}% reduction (${s.tokenEfficiency.summaryTokenEstimate} vs ${s.tokenEfficiency.rawTokenEstimate} tokens)`);
    }
  }

  if (result.verdict === 'PARTIAL') {
    lines.push("");
    lines.push(`⚠️ ${result.partialReason}`);
    lines.push("Ask the user if the page has finished loading, then re-scan.");
  }

  return textResponse(lines.join("\n"));
}

async function handleSnapshot(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const url = args.url as string;
  if (!url) {
    return errorResponse("The 'url' parameter is required.");
  }

  const name = (args.name as string) || `baseline-${Date.now()}`;
  const ibr = new InterfaceBuiltRight({ outputDir: DEFAULT_OUTPUT_DIR });

  const result = await ibr.startSession(url, { name });

  return textResponse(
    [
      `Baseline captured: ${result.session.id}`,
      `Name: ${result.session.name}`,
      `URL: ${result.session.url}`,
      `Viewport: ${result.session.viewport.name} (${result.session.viewport.width}x${result.session.viewport.height})`,
      `Status: ${result.session.status}`,
      "",
      "Run the 'compare' tool after making changes to see what shifted.",
    ].join("\n")
  );
}

async function handleCompare(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const ibr = new InterfaceBuiltRight({ outputDir: DEFAULT_OUTPUT_DIR });

  const sessionId = args.session_id as string | undefined;

  let session;
  if (sessionId) {
    session = await ibr.getSession(sessionId);
    if (!session) {
      return errorResponse(`Session "${sessionId}" not found.`);
    }
  } else {
    session = await ibr.getMostRecentSession();
    if (!session) {
      return errorResponse(
        "No sessions found. Capture a baseline first with the 'snapshot' tool."
      );
    }
  }

  const report = await ibr.check(session.id);

  const lines = [
    `Comparison: ${report.sessionName} (${report.sessionId})`,
    `URL: ${report.url}`,
    `Verdict: ${report.analysis.verdict}`,
    `Diff: ${report.comparison.diffPercent.toFixed(2)}% (${report.comparison.diffPixels} pixels)`,
    `${report.analysis.summary}`,
  ];

  if (report.analysis.changedRegions && report.analysis.changedRegions.length > 0) {
    lines.push("");
    lines.push(`Changed regions (${report.analysis.changedRegions.length}):`);
    for (const r of report.analysis.changedRegions.slice(0, 5)) {
      lines.push(`- ${r.location}: ${r.description} [${r.severity}]`);
    }
  }

  if (report.analysis.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${report.analysis.recommendation}`);
  }

  return textResponse(lines.join("\n"));
}

async function handleListSessions(): Promise<McpResponse> {
  const sessions = await listSessions(DEFAULT_OUTPUT_DIR);

  if (sessions.length === 0) {
    return textResponse(
      "No sessions found. Capture a baseline with the 'snapshot' tool."
    );
  }

  const lines = [`Sessions (${sessions.length}):`];

  for (const s of sessions.slice(0, 20)) {
    const date = new Date(s.createdAt).toISOString().replace("T", " ").slice(0, 19);
    const viewport = `${s.viewport.name} (${s.viewport.width}x${s.viewport.height})`;
    const verdict =
      s.analysis && s.analysis.verdict
        ? ` | ${s.analysis.verdict}`
        : "";
    lines.push(
      `- ${s.id} | ${s.name} | ${date} | ${viewport} | ${s.status}${verdict}`
    );
  }

  if (sessions.length > 20) {
    lines.push(`  ... and ${sessions.length - 20} more`);
  }

  // Stats
  const stats = await getSessionStats(DEFAULT_OUTPUT_DIR);
  lines.push("");
  lines.push(
    `Total: ${stats.total} | By status: ${Object.entries(stats.byStatus)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}`
  );

  return textResponse(lines.join("\n"));
}

// --- Reference storage helpers ---

const REFERENCES_DIR = join(DEFAULT_OUTPUT_DIR, "references");
const REFERENCES_INDEX = join(REFERENCES_DIR, "index.json");

interface ReferenceEntry {
  name: string;
  url: string;
  viewport: { name: string; width: number; height: number };
  capturedAt: string;
  path: string;
  fileSize: number;
}

interface ReferencesIndex {
  references: ReferenceEntry[];
}

function readReferencesIndex(): ReferencesIndex {
  if (!existsSync(REFERENCES_INDEX)) {
    return { references: [] };
  }
  return JSON.parse(readFileSync(REFERENCES_INDEX, "utf-8"));
}

function writeReferencesIndex(index: ReferencesIndex): void {
  mkdirSync(REFERENCES_DIR, { recursive: true });
  writeFileSync(REFERENCES_INDEX, JSON.stringify(index, null, 2));
}

// --- Screenshot handler ---

async function handleScreenshot(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const url = args.url as string;
  if (!url) {
    return errorResponse("The 'url' parameter is required.");
  }

  const viewportName = (args.viewport as string) || "desktop";
  const viewport = VIEWPORTS[viewportName as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;
  const selector = args.selector as string | undefined;
  const fullPage = (args.full_page as boolean) ?? false;
  const waitFor = args.wait_for as string | undefined;
  const saveAs = args.save_as as string | undefined;

  // External sites need more time for JS rendering
  const isExternal = !url.includes("localhost") && !url.includes("127.0.0.1");
  const delay = (args.delay as number) ?? (isExternal ? 2000 : 500);

  // Capture to temp path
  const timestamp = Date.now();
  const screenshotsDir = join(DEFAULT_OUTPUT_DIR, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });
  const tempPath = join(screenshotsDir, `capture-${timestamp}.png`);

  await captureScreenshot({
    url,
    outputPath: tempPath,
    viewport,
    fullPage,
    waitForNetworkIdle: true,
    timeout: isExternal ? 60000 : 30000,
    selector,
    waitFor,
    delay,
  });

  // Read captured PNG as base64
  const imageBuffer = readFileSync(tempPath);
  const base64 = imageBuffer.toString("base64");
  const fileSize = imageBuffer.length;

  // Save to reference library if requested
  let savedPath = "not saved";
  if (saveAs) {
    mkdirSync(REFERENCES_DIR, { recursive: true });
    const refPath = join(REFERENCES_DIR, `${saveAs}.png`);
    writeFileSync(refPath, imageBuffer);
    savedPath = refPath;

    // Update index
    const index = readReferencesIndex();
    // Remove existing entry with same name
    index.references = index.references.filter((r) => r.name !== saveAs);
    index.references.push({
      name: saveAs,
      url,
      viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
      capturedAt: new Date().toISOString(),
      path: `${saveAs}.png`,
      fileSize,
    });
    writeReferencesIndex(index);
  }

  const metadata = [
    `Screenshot: ${url}`,
    `Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`,
    `Full page: ${fullPage}`,
    `Size: ${(fileSize / 1024).toFixed(1)} KB`,
    saveAs ? `Saved as: ${saveAs} (${savedPath})` : "Not saved to references",
  ].join("\n");

  return imageResponse(base64, metadata);
}

// --- References handler ---

async function handleReferences(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const action = (args.action as string) || "list";
  const name = args.name as string | undefined;

  switch (action) {
    case "list": {
      const index = readReferencesIndex();
      if (index.references.length === 0) {
        return textResponse(
          "No design references saved. Use the 'screenshot' tool with save_as to save references."
        );
      }

      const lines = [`Design References (${index.references.length}):`];
      for (const ref of index.references) {
        const date = ref.capturedAt.replace("T", " ").slice(0, 19);
        const size = (ref.fileSize / 1024).toFixed(1);
        lines.push(
          `- ${ref.name} | ${ref.url} | ${ref.viewport.name} (${ref.viewport.width}x${ref.viewport.height}) | ${date} | ${size} KB`
        );
      }
      return textResponse(lines.join("\n"));
    }

    case "show": {
      if (!name) {
        return errorResponse("The 'name' parameter is required for action 'show'.");
      }

      const index = readReferencesIndex();
      const ref = index.references.find((r) => r.name === name);
      if (!ref) {
        return errorResponse(
          `Reference "${name}" not found. Use action 'list' to see available references.`
        );
      }

      const refPath = join(REFERENCES_DIR, ref.path);
      if (!existsSync(refPath)) {
        return errorResponse(`Reference file missing: ${refPath}`);
      }

      const imageBuffer = readFileSync(refPath);
      const base64 = imageBuffer.toString("base64");

      const metadata = [
        `Reference: ${ref.name}`,
        `URL: ${ref.url}`,
        `Viewport: ${ref.viewport.name} (${ref.viewport.width}x${ref.viewport.height})`,
        `Captured: ${ref.capturedAt.replace("T", " ").slice(0, 19)}`,
        `Size: ${(ref.fileSize / 1024).toFixed(1)} KB`,
      ].join("\n");

      return imageResponse(base64, metadata);
    }

    case "delete": {
      if (!name) {
        return errorResponse("The 'name' parameter is required for action 'delete'.");
      }

      const index = readReferencesIndex();
      const ref = index.references.find((r) => r.name === name);
      if (!ref) {
        return errorResponse(
          `Reference "${name}" not found. Use action 'list' to see available references.`
        );
      }

      // Delete the PNG file
      const refPath = join(REFERENCES_DIR, ref.path);
      if (existsSync(refPath)) {
        unlinkSync(refPath);
      }

      // Update index
      index.references = index.references.filter((r) => r.name !== name);
      writeReferencesIndex(index);

      return textResponse(`Deleted reference: ${name}`);
    }

    default:
      return errorResponse(`Unknown action: ${action}. Use 'list', 'show', or 'delete'.`);
  }
}

// --- macOS native app handler ---

async function handleScanMacOS(
  args: Record<string, unknown>
): Promise<McpResponse> {
  if (process.platform !== "darwin") {
    return errorResponse("scan_macos is only available on macOS.");
  }

  const app = args.app as string | undefined;
  const bundleId = args.bundle_id as string | undefined;
  const pid = args.pid as number | undefined;
  const screenshot = args.screenshot as string | undefined;

  if (!app && !bundleId && !pid) {
    return errorResponse("Provide 'app', 'bundle_id', or 'pid' to identify the target app.");
  }

  const result = await scanMacOS({
    app,
    bundleId,
    pid,
    screenshot: screenshot ? { path: screenshot } : undefined,
    outputDir: DEFAULT_OUTPUT_DIR,
  });

  const lines = [
    `macOS App Scan: ${result.url}`,
    `Window: ${result.route.slice(1)}`,
    `Viewport: ${result.viewport.width}x${result.viewport.height}`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
    "",
    `Page intent: ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `Auth: ${result.semantic.state.auth.authenticated === false ? "Not authenticated" : result.semantic.state.auth.authenticated ? "Authenticated" : "Unknown"}`,
  ];

  // Elements
  lines.push("");
  lines.push(`Elements: ${result.elements.audit.totalElements} total, ${result.elements.audit.interactiveCount} interactive`);
  lines.push(`With handlers: ${result.elements.audit.withHandlers}, Without: ${result.elements.audit.withoutHandlers}`);

  // Interactivity
  const { buttons, links, forms } = result.interactivity;
  lines.push(`Buttons: ${buttons.length}, Links: ${links.length}, Forms: ${forms.length}`);

  // Issues
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`  Fix: ${issue.fix}`);
      }
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }

  // Audit issues
  if (result.elements.audit.issues.length > 0) {
    lines.push("");
    lines.push(`Audit issues (${result.elements.audit.issues.length}):`);
    for (const a of result.elements.audit.issues.slice(0, 5)) {
      lines.push(`- ${a.message}`);
    }
  }

  return textResponse(lines.join("\n"));
}

// --- Native tool handlers ---

async function handleNativeScan(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const device = args.device as string | undefined;
  const screenshot = args.screenshot !== false;

  const result = await scanNative({
    device,
    screenshot,
    outputDir: DEFAULT_OUTPUT_DIR,
  });

  const lines = [
    `Native Scan: ${result.device.name}`,
    `Platform: ${result.platform}`,
    `Runtime: ${result.device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".")}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
  ];

  lines.push("");
  lines.push(`Elements: ${result.elements.audit.totalElements} total, ${result.elements.audit.interactiveCount} interactive`);
  lines.push(`With handlers: ${result.elements.audit.withHandlers}, Without: ${result.elements.audit.withoutHandlers}`);

  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }

  if (result.screenshotPath) {
    lines.push("");
    lines.push(`Screenshot: ${result.screenshotPath}`);
  }

  return textResponse(lines.join("\n"));
}

async function handleNativeSnapshot(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const deviceQuery = args.device as string | undefined;
  const name = (args.name as string) || `native-baseline-${Date.now()}`;

  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
    if (!device) {
      return errorResponse(`No simulator found matching "${deviceQuery}".`);
    }
  } else {
    const { getBootedDevices } = await import("../native/simulator.js");
    const booted = await getBootedDevices();
    if (booted.length === 0) {
      return errorResponse("No booted simulators found. Boot one first.");
    }
    device = booted[0];
  }

  const viewport = getDeviceViewport(device);

  const session = await createSession(
    DEFAULT_OUTPUT_DIR,
    `simulator://${device.name}`,
    name,
    viewport,
    device.platform
  );

  const paths = getSessionPaths(DEFAULT_OUTPUT_DIR, session.id);

  const captureResult = await captureNativeScreenshot({
    device,
    outputPath: paths.baseline,
  });

  if (!captureResult.success) {
    return errorResponse(`Screenshot capture failed: ${captureResult.error}`);
  }

  return textResponse(
    [
      `Native baseline captured: ${session.id}`,
      `Name: ${session.name}`,
      `Device: ${device.name} (${device.platform})`,
      `Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`,
      `Status: ${session.status}`,
      "",
      "Run 'native_compare' after making changes to see what shifted.",
    ].join("\n")
  );
}

async function handleNativeCompare(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const sessionId = args.session_id as string | undefined;
  const deviceQuery = args.device as string | undefined;

  let session;
  if (sessionId) {
    const { getSession } = await import("../session.js");
    session = await getSession(DEFAULT_OUTPUT_DIR, sessionId);
    if (!session) {
      return errorResponse(`Session "${sessionId}" not found.`);
    }
  } else {
    const sessions = await listSessions(DEFAULT_OUTPUT_DIR);
    session = sessions.find(s => s.platform === "ios" || s.platform === "watchos");
    if (!session) {
      return errorResponse(
        "No native sessions found. Capture a baseline first with 'native_snapshot'."
      );
    }
  }

  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
  } else {
    const { getBootedDevices } = await import("../native/simulator.js");
    const booted = await getBootedDevices();
    device = booted[0];
  }

  if (!device) {
    return errorResponse("No booted simulator found for comparison.");
  }

  const paths = getSessionPaths(DEFAULT_OUTPUT_DIR, session.id);

  const captureResult = await captureNativeScreenshot({
    device,
    outputPath: paths.current,
  });

  if (!captureResult.success) {
    return errorResponse(`Screenshot capture failed: ${captureResult.error}`);
  }

  const result = await compare({
    baselinePath: paths.baseline,
    currentPath: paths.current,
  });

  const lines = [
    `Native Comparison: ${session.name} (${session.id})`,
    `Device: ${device.name}`,
    `Verdict: ${result.verdict}`,
    `Diff: ${result.diffPercent.toFixed(2)}% (${result.diffPixels} pixels)`,
    `${result.summary}`,
  ];

  if (result.changedRegions.length > 0) {
    lines.push("");
    lines.push(`Changed regions (${result.changedRegions.length}):`);
    for (const r of result.changedRegions.slice(0, 5)) {
      lines.push(`- ${r.location}: ${r.description} [${r.severity}]`);
    }
  }

  if (result.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${result.recommendation}`);
  }

  return textResponse(lines.join("\n"));
}

async function handleNativeDevices(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const platformFilter = args.platform as string | undefined;

  let devices = await listDevices();
  devices = devices.filter(d => d.isAvailable);

  if (platformFilter) {
    devices = devices.filter(d => d.platform === platformFilter);
  }

  if (devices.length === 0) {
    return textResponse(
      platformFilter
        ? `No available ${platformFilter} simulators found.`
        : "No available simulators found. Install simulators via Xcode."
    );
  }

  const ios = devices.filter(d => d.platform === "ios");
  const watchos = devices.filter(d => d.platform === "watchos");

  const lines: string[] = [];

  if (ios.length > 0 && (!platformFilter || platformFilter === "ios")) {
    lines.push(`iOS Simulators (${ios.length}):`);
    for (const d of ios) {
      lines.push(`  ${formatDevice(d)}`);
    }
  }

  if (watchos.length > 0 && (!platformFilter || platformFilter === "watchos")) {
    if (lines.length > 0) lines.push("");
    lines.push(`watchOS Simulators (${watchos.length}):`);
    for (const d of watchos) {
      lines.push(`  ${formatDevice(d)}`);
    }
  }

  const booted = devices.filter(d => d.state === "Booted");
  lines.push("");
  lines.push(`Total: ${devices.length} available, ${booted.length} booted`);

  return textResponse(lines.join("\n"));
}

async function handleValidateTokens(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const url = args.url as string | undefined;
  const device = args.device as string | undefined;
  const specPath = (args.spec_path as string) || '.ibr/tokens.json';

  // Validate input
  if (!url && !device) {
    return errorResponse("Provide either 'url' or 'device' parameter.");
  }

  // Load token spec
  let spec;
  try {
    spec = loadTokenSpec(specPath);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : `Failed to load token spec from ${specPath}`
    );
  }

  // Get elements based on source
  let elements: any[];
  let source: string;

  if (url) {
    // Web scan
    try {
      const result = await scan(url, { viewport: 'desktop' as ScanOptions["viewport"] });
      elements = result.elements.all;
      source = `${url} (web)`;
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : `Failed to scan URL: ${url}`
      );
    }
  } else if (device) {
    // Native scan
    try {
      const result = await scanNative({
        device,
        screenshot: false,
        outputDir: DEFAULT_OUTPUT_DIR,
      });
      elements = result.elements.all;
      source = `${device} (native)`;
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : `Failed to scan device: ${device}`
      );
    }
  } else {
    return errorResponse("No valid source provided.");
  }

  // Validate against tokens
  const violations = validateAgainstTokens(elements, spec);

  // Format output
  const lines = [
    `Token Validation: ${spec.name}`,
    `Source: ${source}`,
    `Elements checked: ${elements.length}`,
    `Violations found: ${violations.length}`,
  ];

  if (violations.length === 0) {
    lines.push("");
    lines.push("All elements comply with design tokens.");
    return textResponse(lines.join("\n"));
  }

  // Group by severity
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    lines.push("");
    lines.push(`Errors (${errors.length}):`);
    for (const v of errors.slice(0, 10)) {
      lines.push(`- ${v.message}`);
    }
    if (errors.length > 10) {
      lines.push(`  ... and ${errors.length - 10} more`);
    }
  }

  if (warnings.length > 0) {
    lines.push("");
    lines.push(`Warnings (${warnings.length}):`);
    for (const v of warnings.slice(0, 10)) {
      lines.push(`- ${v.message}`);
    }
    if (warnings.length > 10) {
      lines.push(`  ... and ${warnings.length - 10} more`);
    }
  }

  return textResponse(lines.join("\n"));
}

// --- Static HTML/CSS scan handler ---

async function handleScanStatic(args: Record<string, unknown>): Promise<McpResponse> {
  const htmlPath = args.html_path as string;
  if (!htmlPath) {
    return errorResponse("The 'html_path' parameter is required.");
  }

  const cssPath = args.css_path as string | undefined;

  // Import and run
  const { scanStatic } = await import('../static/scan.js');
  const result = scanStatic({ htmlPath, cssPath });

  // Format output
  const lines = [
    `Static Scan: ${result.htmlPath}`,
    result.cssPath ? `CSS: ${result.cssPath}` : 'CSS: none',
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
    '',
    `Elements: ${result.elements.audit.totalElements} total, ${result.elements.audit.interactiveCount} interactive`,
    `With handlers: ${result.elements.audit.withHandlers}, Without: ${result.elements.audit.withoutHandlers}`,
  ];

  if (result.issues.length > 0) {
    lines.push('');
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`  Fix: ${issue.fix}`);
      }
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }

  return textResponse(lines.join('\n'));
}

// --- Bridge to source handler ---

async function handleBridgeToSource(args: Record<string, unknown>): Promise<McpResponse> {
  const projectRoot = args.project_root as string;
  if (!projectRoot) {
    return errorResponse("The 'project_root' parameter is required.");
  }

  if (!existsSync(projectRoot)) {
    return errorResponse(`Project root not found: ${projectRoot}`);
  }

  const deviceQuery = args.device as string | undefined;
  const appName = args.app as string | undefined;

  // Get elements from a scan source
  let elements: any[];
  let scanSource: string;

  if (appName) {
    // macOS app scan
    try {
      const result = await scanMacOS({ app: appName, outputDir: DEFAULT_OUTPUT_DIR });
      elements = result.elements.all;
      scanSource = `macOS app: ${appName}`;
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : `Failed to scan macOS app: ${appName}`
      );
    }
  } else {
    // Simulator scan
    try {
      const result = await scanNative({
        device: deviceQuery,
        screenshot: false,
        outputDir: DEFAULT_OUTPUT_DIR,
      });
      elements = result.elements.all;
      scanSource = `simulator: ${result.device.name}`;
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : `Failed to scan simulator${deviceQuery ? `: ${deviceQuery}` : ''}`
      );
    }
  }

  // Run correlation
  const result = correlateToSource(elements, projectRoot);

  // Format output
  const lines = [
    `Source Bridge: ${scanSource}`,
    formatBridgeResult(result),
  ];

  return textResponse(lines.join('\n'));
}

// --- iOS/watchOS simulator interaction handler ---

async function handleSimAction(args: Record<string, unknown>): Promise<McpResponse> {
  const action = args.action as string;
  const target = args.target as string | undefined;
  const value = args.value as string | undefined;
  const deviceQuery = args.device as string | undefined;

  if (!action) {
    return errorResponse("The 'action' parameter is required.");
  }

  // Resolve device UDID
  let udid: string;
  try {
    if (deviceQuery) {
      const device = await findDevice(deviceQuery);
      if (!device) {
        return errorResponse(
          `No simulator found matching "${deviceQuery}". Run \`xcrun simctl list devices available\` to see available devices.`
        );
      }
      udid = device.udid;
    } else {
      const { getBootedDevices } = await import('../native/simulator.js');
      const booted = await getBootedDevices();
      if (booted.length === 0) {
        return errorResponse('No booted simulators found. Boot one with: xcrun simctl boot <device-name>');
      }
      udid = booted[0].udid;
    }
  } catch (err) {
    return errorResponse(`Failed to resolve device: ${err instanceof Error ? err.message : String(err)}`);
  }

  switch (action) {
    case 'tap': {
      if (!target) {
        return errorResponse("'target' is required for tap (element label or 'x,y' coordinates).");
      }

      // Check if target looks like coordinates: "x,y"
      const coordMatch = /^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/.exec(target);
      if (coordMatch) {
        const x = parseFloat(coordMatch[1]);
        const y = parseFloat(coordMatch[2]);
        const tapResult = await idbTap(udid, x, y);
        if (!tapResult.success) {
          return errorResponse(`tap failed: ${tapResult.error}`);
        }
        return textResponse(`Tapped at (${x}, ${y}) on device ${udid.slice(0, 8)}`);
      }

      // Resolve by label: extract AX tree, find element, get center
      try {
        const { extractNativeElements, isExtractorAvailable } = await import('../native/extract.js');
        const { findDevice: fd } = await import('../native/simulator.js');

        if (!isExtractorAvailable()) {
          return errorResponse(
            'AX element extraction unavailable. Cannot resolve element by label. ' +
            'Provide coordinates as "x,y" instead, or install Xcode Command Line Tools.'
          );
        }

        // Re-resolve full device object for extractNativeElements
        const device = await fd(udid);
        if (!device) {
          return errorResponse('Device not found after UDID resolution');
        }

        const nativeElements = await extractNativeElements(device);

        // Flatten tree into list for label search
        const flat: Array<{ label: string; identifier: string; frame: { x: number; y: number; width: number; height: number } }> = [];
        function flattenElements(elements: typeof nativeElements): void {
          for (const el of elements) {
            flat.push({ label: el.label, identifier: el.identifier, frame: el.frame });
            if (el.children.length > 0) flattenElements(el.children);
          }
        }
        flattenElements(nativeElements);

        const found = findElementByLabel(flat, target);
        if (!found) {
          const labels = flat
            .filter(e => e.label)
            .slice(0, 10)
            .map(e => `"${e.label}"`)
            .join(', ');
          return errorResponse(
            `Element "${target}" not found in AX tree. ` +
            `Available labels (first 10): ${labels || 'none'}. ` +
            'Try providing "x,y" coordinates directly.'
          );
        }

        const center = elementCenter(found);
        if (!center) {
          return errorResponse(`Element "${target}" found but has no frame data. Cannot compute tap coordinates.`);
        }

        // Allow value to override coordinates
        if (value) {
          const override = /^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/.exec(value);
          if (override) {
            const ox = parseFloat(override[1]);
            const oy = parseFloat(override[2]);
            const overrideResult = await idbTap(udid, ox, oy);
            if (!overrideResult.success) return errorResponse(`tap failed: ${overrideResult.error}`);
            return textResponse(`Tapped "${target}" at (${ox}, ${oy}) [coordinate override]`);
          }
        }

        const tapResult = await idbTap(udid, center.x, center.y);
        if (!tapResult.success) return errorResponse(`tap failed: ${tapResult.error}`);
        return textResponse(`Tapped "${target}" at center (${center.x}, ${center.y})`);
      } catch (err) {
        return errorResponse(`tap by label failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    case 'type': {
      if (!target) {
        return errorResponse("'target' is required for type (text to input).");
      }
      if (!(await isIdbCliAvailable())) {
        return errorResponse(
          'IDB not available. Install with: brew install idb-companion && pip install fb-idb'
        );
      }
      const typeResult = await idbType(udid, target);
      if (!typeResult.success) return errorResponse(`type failed: ${typeResult.error}`);
      return textResponse(`Typed "${target}" into focused field`);
    }

    case 'scroll':
    case 'swipe': {
      const direction = (target as 'up' | 'down' | 'left' | 'right') ?? 'down';
      const validDirs = ['up', 'down', 'left', 'right'];
      if (!validDirs.includes(direction)) {
        return errorResponse(`Invalid direction "${direction}". Use: up, down, left, right`);
      }

      // Parse optional starting point from value
      let cx = 187;
      let cy = 400;
      if (value) {
        const startMatch = /^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/.exec(value);
        if (startMatch) {
          cx = parseFloat(startMatch[1]);
          cy = parseFloat(startMatch[2]);
        }
      }

      const distance = 300;
      let x2 = cx, y2 = cy;
      switch (direction) {
        case 'up': y2 = cy + distance; break;
        case 'down': y2 = cy - distance; break;
        case 'left': x2 = cx + distance; break;
        case 'right': x2 = cx - distance; break;
      }

      const swipeResult = await idbSwipe(udid, cx, cy, x2, y2, 0.5);
      if (!swipeResult.success) return errorResponse(`${action} failed: ${swipeResult.error}`);
      return textResponse(`Scrolled ${direction} from (${cx}, ${cy})`);
    }

    case 'home': {
      const homeResult = await idbButton(udid, 'HOME');
      if (!homeResult.success) return errorResponse(`home button failed: ${homeResult.error}`);
      return textResponse('Pressed HOME button');
    }

    case 'openUrl': {
      if (!target) {
        return errorResponse("'target' is required for openUrl (the URL to open, e.g. 'myapp://route').");
      }
      const urlResult = await idbOpenUrl(udid, target);
      if (!urlResult.success) return errorResponse(`openUrl failed: ${urlResult.error}`);
      return textResponse(`Opened URL: ${target}`);
    }

    default:
      return errorResponse(`Unknown action: ${action}. Use: tap, type, scroll, swipe, home, openUrl`);
  }
}

async function handleDesignSystem(
  args: Record<string, unknown>
): Promise<McpResponse> {
  const action = args.action as string;
  const projectDir = (args.projectDir as string) || process.cwd();
  const ibrDir = join(projectDir, '.ibr');
  const configPath = join(ibrDir, 'design-system.json');

  switch (action) {
    case 'init': {
      // Find the templates file relative to this package
      // Walk up from the module to find templates/design-system.json
      const templateCandidates = [
        join(projectDir, 'node_modules', 'interface-built-right', 'templates', 'design-system.json'),
        join(projectDir, 'templates', 'design-system.json'),
        // Dev: relative to this compiled file in dist/mcp/ → ../../templates/
        join(__dirname, '..', '..', 'templates', 'design-system.json'),
      ];

      const templatePath = templateCandidates.find(p => existsSync(p));
      if (!templatePath) {
        return errorResponse(
          'Could not find design-system template. ' +
          'Expected at templates/design-system.json or node_modules/interface-built-right/templates/design-system.json'
        );
      }

      if (existsSync(configPath)) {
        return textResponse(
          `.ibr/design-system.json already exists. Delete it first if you want to reset to defaults.\nPath: ${configPath}`
        );
      }

      if (!existsSync(ibrDir)) {
        mkdirSync(ibrDir, { recursive: true });
      }

      copyFileSync(templatePath, configPath);
      return textResponse(
        `Design system config created at .ibr/design-system.json\n` +
        `Edit it to add your tokens and configure principle severities.\n` +
        `Path: ${configPath}`
      );
    }

    case 'status': {
      if (!existsSync(configPath)) {
        return textResponse(
          'No design system config found. Run design_system with action "init" to create one.\n' +
          `Expected: ${configPath}`
        );
      }

      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      return textResponse(
        `Design system config: ${configPath}\n\n${JSON.stringify(config, null, 2)}`
      );
    }

    case 'validate': {
      const config = await loadDesignSystemConfig(projectDir);
      if (!config) {
        return textResponse(
          'No design system config found. Run design_system with action "init" to create one.\n' +
          `Expected: ${configPath}`
        );
      }

      const lines: string[] = [
        `Design system: ${config.name}`,
        '',
        'Calm Precision Principles:',
      ];

      const allPrincipleIds = [
        ...config.principles.calmPrecision.core,
        ...config.principles.calmPrecision.stylistic,
      ];

      for (const principleId of allPrincipleIds) {
        const explicit = config.principles.calmPrecision.severity[principleId];
        const isCore = config.principles.calmPrecision.core.includes(principleId);
        const defaultSev = explicit ?? (isCore ? 'error' : 'warn');
        const source = explicit ? 'explicit' : 'default';
        lines.push(`  ${principleId}: ${defaultSev} (${source})`);
      }

      if (config.principles.custom.length > 0) {
        lines.push('', 'Custom Principles:');
        for (const custom of config.principles.custom) {
          lines.push(`  ${custom.id} (${custom.name}): ${custom.severity}`);
          lines.push(`    Checks: ${custom.checks.length}`);
        }
      }

      lines.push('', 'Token categories:');
      const tokenKeys = Object.keys(config.tokens).filter(
        k => config.tokens[k as keyof typeof config.tokens] !== undefined
      );
      if (tokenKeys.length === 0) {
        lines.push('  (none configured)');
      } else {
        for (const k of tokenKeys) {
          lines.push(`  ${k}: active`);
        }
      }

      return textResponse(lines.join('\n'));
    }

    default:
      return errorResponse(`Unknown action: ${action}. Use: init, status, validate`);
  }
}
