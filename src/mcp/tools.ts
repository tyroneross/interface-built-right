/**
 * IBR MCP Tool Definitions
 *
 * Each tool maps to existing IBR programmatic APIs.
 * Responses are formatted as concise text for LLM consumption.
 */

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
} from "../session.js";
import type { ScanOptions } from "../scan.js";

// --- Response helpers ---

function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResponse(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
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
];

// --- Tool handlers ---

const DEFAULT_OUTPUT_DIR = ".ibr";

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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

async function handleListSessions(): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
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
