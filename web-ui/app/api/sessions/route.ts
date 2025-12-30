import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

export async function GET() {
  try {
    const sessionsDir = join(process.cwd(), IBR_DIR, 'sessions');

    if (!existsSync(sessionsDir)) {
      return NextResponse.json({ sessions: [] });
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('sess_')) {
        const sessionPath = join(sessionsDir, entry.name, 'session.json');
        if (existsSync(sessionPath)) {
          const content = await readFile(sessionPath, 'utf-8');
          sessions.push(JSON.parse(content));
        }
      }
    }

    // Sort by creation date, newest first
    sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const { url, name, viewport = 'desktop' } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Build CLI command
    const args = [`start "${url}"`];
    if (name) args.push(`--name "${name}"`);
    args.push(`--viewport ${viewport}`);

    // Run ibr CLI command from parent directory
    const parentDir = join(process.cwd(), '..');
    const command = `npm run ibr -- ${args.join(' ')}`;

    const { stdout, stderr } = await execAsync(command, { cwd: parentDir });

    // Parse session ID from output
    // Note: nanoid can include dashes and underscores, so use a more permissive regex
    const sessionIdMatch = stdout.match(/Session started: (sess_[\w-]+)/);
    if (!sessionIdMatch) {
      console.error('CLI output:', stdout, stderr);
      return NextResponse.json(
        { error: 'Failed to parse session ID from CLI output' },
        { status: 500 }
      );
    }

    const sessionId = sessionIdMatch[1];

    // Read the created session
    const sessionPath = join(process.cwd(), IBR_DIR, 'sessions', sessionId, 'session.json');
    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    return NextResponse.json({ session, sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
