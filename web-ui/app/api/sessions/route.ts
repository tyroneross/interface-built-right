import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Session, InteractiveMetadata } from '@/lib/types';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

// Check if a live session's browser is still running
// (In practice this is managed by liveSessionManager in-memory)
function isLiveSessionActive(sessionDir: string): boolean {
  // Check for a .active marker file that live-session.ts could create
  // For now, we'll mark all live sessions as closed since browser state
  // doesn't persist across process restarts
  return false;
}

// Convert live-session.json to Session format
function convertLiveSession(liveData: {
  id: string;
  url: string;
  name: string;
  viewport: { name: string; width: number; height: number };
  sandbox: boolean;
  createdAt: string;
  actions: Array<{
    type: string;
    timestamp: string;
    params: Record<string, unknown>;
    success: boolean;
    error?: string;
    duration?: number;
  }>;
}, isActive: boolean): Session {
  const lastAction = liveData.actions[liveData.actions.length - 1];

  return {
    id: liveData.id,
    name: liveData.name,
    url: liveData.url,
    type: 'interactive',
    viewport: {
      name: liveData.viewport.name as 'desktop' | 'mobile' | 'tablet' | 'reference',
      width: liveData.viewport.width,
      height: liveData.viewport.height,
    },
    status: isActive ? 'active' : 'closed',
    createdAt: liveData.createdAt,
    updatedAt: lastAction?.timestamp || liveData.createdAt,
    interactiveMetadata: {
      sandbox: liveData.sandbox,
      actions: liveData.actions.map(a => ({
        type: a.type as 'navigate' | 'click' | 'type' | 'fill' | 'hover' | 'evaluate' | 'screenshot' | 'wait',
        timestamp: a.timestamp,
        params: a.params,
        success: a.success,
        error: a.error,
        duration: a.duration,
      })),
      lastActionAt: lastAction?.timestamp,
      active: isActive,
    },
  };
}

export async function GET() {
  try {
    const sessionsDir = join(process.cwd(), IBR_DIR, 'sessions');

    if (!existsSync(sessionsDir)) {
      return NextResponse.json({ sessions: [] });
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: Session[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Regular capture/reference sessions (sess_*)
      if (entry.name.startsWith('sess_')) {
        const sessionPath = join(sessionsDir, entry.name, 'session.json');
        if (existsSync(sessionPath)) {
          const content = await readFile(sessionPath, 'utf-8');
          sessions.push(JSON.parse(content));
        }
      }

      // Interactive/live sessions (live_*)
      if (entry.name.startsWith('live_')) {
        const sessionPath = join(sessionsDir, entry.name, 'live-session.json');
        if (existsSync(sessionPath)) {
          const content = await readFile(sessionPath, 'utf-8');
          const liveData = JSON.parse(content);
          const isActive = isLiveSessionActive(join(sessionsDir, entry.name));
          sessions.push(convertLiveSession(liveData, isActive));
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
