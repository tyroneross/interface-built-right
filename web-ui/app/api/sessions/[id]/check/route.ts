import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

// POST /api/sessions/[id]/check - Re-run comparison for a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionDir = join(process.cwd(), IBR_DIR, 'sessions', id);

    if (!existsSync(sessionDir)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Run ibr check command from parent directory
    const parentDir = join(process.cwd(), '..');
    const command = `npm run ibr -- check ${id} --format json`;

    const { stdout, stderr } = await execAsync(command, { cwd: parentDir });

    // Parse the JSON report
    let report;
    try {
      report = JSON.parse(stdout);
    } catch {
      console.error('Failed to parse check output:', stdout, stderr);
      return NextResponse.json(
        { error: 'Failed to parse comparison report' },
        { status: 500 }
      );
    }

    // Read updated session
    const sessionPath = join(sessionDir, 'session.json');
    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    return NextResponse.json({ session, report });
  } catch (error) {
    console.error('Error checking session:', error);
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
