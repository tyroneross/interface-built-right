import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveSessionDir } from '@/lib/server/ibr-paths';
import { runIbrCli, extractJson } from '@/lib/server/run-ibr';

const SESSION_ID_RE = /^sess_[A-Za-z0-9_-]+$/;

// POST /api/sessions/[id]/check - Re-run comparison via IBR's CDP engine.
// `id` is shape-validated then passed as an argv element to runIbrCli — never
// concatenated into a shell command.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!SESSION_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const sessionDir = resolveSessionDir(id);
    const sessionPath = join(sessionDir, 'session.json');

    if (!existsSync(sessionDir) || !existsSync(sessionPath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Session has no URL to check against' },
        { status: 400 }
      );
    }

    const { stdout } = await runIbrCli(['check', id, '--json'], { timeoutMs: 120_000 });

    const parsed = extractJson<Record<string, unknown>>(stdout);
    const result = parsed ?? { raw: stdout };

    const updated = JSON.parse(await readFile(sessionPath, 'utf-8'));

    return NextResponse.json({ session: updated, report: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking session:', message);
    return NextResponse.json(
      { error: 'Failed to check session', detail: message },
      { status: 500 }
    );
  }
}
