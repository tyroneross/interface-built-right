/**
 * IBR MCP Tool Definitions
 *
 * Each tool maps to existing IBR programmatic APIs.
 * Responses are formatted as concise text for LLM consumption.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { scan, formatScanResult } from "../scan.js";
import {
  compare,
  type CompareInput,
  type CompareResult,
  InterfaceBuiltRight,
} from "../index.js";
import {
  listSessions,
  getMostRecentSession,
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
  captureNativeScreenshot,
  getDeviceViewport,
  formatDevice,
} from "../native/index.js";
import { captureScreenshot } from "../capture.js";
import { VIEWPORTS } from "../schemas.js";
import { loadTokenSpec, validateAgainstTokens } from '../tokens.js';
import { correlateToSource, formatBridgeResult } from '../native/bridge.js';

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
      "Comprehensive UI scan — extracts all interactive elements with computed CSS, handler wiring, accessibility data, page intent classification, and console errors. Use after building or modifying UI to validate implementation matches user intent.",
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
      "Capture a visual baseline screenshot for regression testing. Use before making UI changes so you can compare afterwards with the 'compare' tool.",
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
      "Compare current UI state against a baseline. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN) with changed regions and recommendations. Use after making UI changes to check for visual regressions.",
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
      "List all IBR sessions with timestamps, URLs, viewports, and comparison status. Shows baseline sessions available for regression comparison.",
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
      "Scan a running iOS or watchOS simulator — extracts accessibility elements, validates touch targets, checks watchOS constraints, and audits accessibility labels. Use after building or modifying Swift UI to validate implementation.",
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
      "Capture a baseline screenshot from a running iOS or watchOS simulator for regression testing. Use before making native UI changes.",
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
      "Compare current simulator state against a native baseline. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN). Use after making native UI changes to check for visual regressions.",
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
      "Scan a running macOS native app via the Accessibility API — extracts all UI elements, validates touch targets, checks accessibility labels, classifies page intent, and produces a verdict. Use after building or modifying a native macOS app (SwiftUI/AppKit) to validate the UI.",
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
      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Tool execution failed"
    );
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
      lines.push(`- [${issue.severity}] ${issue.message}`);
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
      "Run the 'compare' tool after making changes to check for visual regressions.",
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
    `Comparison: ${report.session.name} (${report.session.id})`,
    `URL: ${report.session.url}`,
    `Verdict: ${report.verdict}`,
    `Diff: ${report.diffPercent.toFixed(2)}% (${report.diffPixels} pixels)`,
    `${report.summary}`,
  ];

  if (report.changedRegions && report.changedRegions.length > 0) {
    lines.push("");
    lines.push(`Changed regions (${report.changedRegions.length}):`);
    for (const r of report.changedRegions.slice(0, 5)) {
      lines.push(`- ${r.location}: ${r.description} [${r.severity}]`);
    }
  }

  if (report.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${report.recommendation}`);
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
      "Run 'native_compare' after making changes to check for visual regressions.",
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
): Promise<{ content: Array<{ type: string; text: string }> }> {
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
      const result = await scanMacOS({ app: appName });
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
