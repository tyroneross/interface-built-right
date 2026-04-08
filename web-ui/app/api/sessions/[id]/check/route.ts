import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

async function runIbr(args: string): Promise<string> {
  const parentDir = join(process.cwd(), '..');
  const { stdout } = await execAsync(`npm run ibr -- ${args}`, {
    cwd: parentDir,
    timeout: 120000,
  });
  return stdout;
}

// POST /api/sessions/[id]/check - Re-run comparison via IBR CLI
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

    // Read session to get URL
    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Session has no URL to check against' },
        { status: 400 }
      );
    }

    // Run comparison via IBR's CDP engine
    const checkOutput = await runIbr(`check ${id} --json`);

    let result;
    try {
      result = JSON.parse(checkOutput);
    } catch {
      result = { raw: checkOutput };
    }

    // Re-read session for updated comparison data
    const updated = JSON.parse(await readFile(sessionPath, 'utf-8'));

    return NextResponse.json({
      session: updated,
      report: result,
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
