import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const IBR_DIR = process.env.IBR_DIR || './.ibr';

// POST /api/sessions/[id]/check - Re-run comparison for a session
// Uses direct file operations instead of shelling out to CLI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionDir = join(process.cwd(), IBR_DIR, 'sessions', id);
    const sessionPath = join(sessionDir, 'session.json');

    if (!existsSync(sessionDir) || !existsSync(sessionPath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Read the session
    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    // Check if baseline exists
    const baselinePath = join(sessionDir, 'baseline.png');
    if (!existsSync(baselinePath)) {
      return NextResponse.json(
        { error: 'No baseline screenshot found. Capture a baseline first.' },
        { status: 400 }
      );
    }

    // Check if current screenshot exists for comparison
    const currentPath = join(sessionDir, 'current.png');
    if (!existsSync(currentPath)) {
      return NextResponse.json(
        {
          error: 'No current screenshot to compare. The page needs to be recaptured.',
          hint: 'Run `npx ibr check` from the command line to capture and compare.',
        },
        { status: 400 }
      );
    }

    // Read session data and return it — the web UI shows the existing
    // comparison results. A full re-comparison requires Playwright which
    // must be run via CLI: `npx ibr check <id>`
    const report = {
      sessionId: session.id,
      sessionName: session.name,
      url: session.url,
      timestamp: new Date().toISOString(),
      viewport: session.viewport,
      comparison: session.comparison || null,
      analysis: session.analysis || null,
      files: {
        baseline: `baseline.png`,
        current: `current.png`,
        diff: existsSync(join(sessionDir, 'diff.png')) ? 'diff.png' : null,
      },
      status: session.status,
    };

    return NextResponse.json({
      session,
      report,
      message: session.comparison
        ? 'Showing existing comparison results.'
        : 'No comparison data yet. Run `npx ibr check` to capture current state and compare.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking session:', message);
    return NextResponse.json(
      { error: 'Failed to check session', detail: message },
      { status: 500 }
    );
  }
}
