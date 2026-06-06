import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveSessionDir } from '@/lib/server/ibr-paths';
import { runIbrCli, extractJson } from '@/lib/server/run-ibr';

// Session IDs are nanoid-shaped: sess_<10 alnum/_/->. Reject anything else to
// keep the argv array clean and prevent surprises (the runIbrCli layer is
// already shell-safe; this is a 400-not-500 nicety).
const SESSION_ID_RE = /^sess_[A-Za-z0-9_-]+$/;

// POST /api/sessions/batch-check - Re-run comparisons for many sessions.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds } = body as { sessionIds?: unknown };

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { error: 'sessionIds array is required' },
        { status: 400 }
      );
    }

    const results: Array<{
      sessionId: string;
      success: boolean;
      session?: unknown;
      report?: unknown;
      error?: string;
    }> = [];

    for (const rawId of sessionIds) {
      const id = String(rawId);
      if (!SESSION_ID_RE.test(id)) {
        results.push({ sessionId: id, success: false, error: 'Invalid session id' });
        continue;
      }

      const sessionDir = resolveSessionDir(id);
      if (!existsSync(sessionDir)) {
        results.push({ sessionId: id, success: false, error: 'Session not found' });
        continue;
      }

      try {
        const { stdout } = await runIbrCli(['check', id, '--format', 'json']);
        const report = extractJson(stdout);
        if (report === null) {
          results.push({ sessionId: id, success: false, error: 'Could not parse CLI output' });
          continue;
        }
        const sessionPath = join(sessionDir, 'session.json');
        const content = await readFile(sessionPath, 'utf-8');
        const session = JSON.parse(content);

        results.push({ sessionId: id, success: true, session, report });
      } catch (err) {
        results.push({
          sessionId: id,
          success: false,
          error: err instanceof Error ? err.message : 'Check failed',
        });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      results,
      summary: { total: sessionIds.length, succeeded, failed },
    });
  } catch (error) {
    console.error('Error in batch check:', error);
    return NextResponse.json(
      { error: 'Batch check failed' },
      { status: 500 }
    );
  }
}
