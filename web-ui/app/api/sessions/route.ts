import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Session } from '@/lib/types';
import { resolveSessionsDir, resolveSessionDir } from '@/lib/server/ibr-paths';
import { runIbrCli } from '@/lib/server/run-ibr';

// Live-session presence is tracked by the in-process live-session manager.
// Persistent files alone cannot prove an active browser — return false here
// so resumed sessions show as 'closed' until the manager confirms otherwise.
function isLiveSessionActive(_sessionDir: string): boolean {
  return false;
}

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
    const sessionsDir = resolveSessionsDir();

    if (!existsSync(sessionsDir)) {
      return NextResponse.json({ sessions: [] });
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: Session[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      if (entry.name.startsWith('sess_')) {
        const sessionPath = join(sessionsDir, entry.name, 'session.json');
        if (existsSync(sessionPath)) {
          const content = await readFile(sessionPath, 'utf-8');
          sessions.push(JSON.parse(content));
        }
      }

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

    sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
//
// Two paths:
//   - With url + name → invoke the IBR CLI via runIbrCli (no shell) and read
//     the resulting session record.
//   - Name only → create an empty session record with no capture.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, name, viewport = 'desktop' } = body as {
      url?: unknown;
      name?: unknown;
      viewport?: unknown;
    };

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const viewportArg: 'desktop' | 'mobile' | 'tablet' =
      viewport === 'mobile' || viewport === 'tablet' ? viewport : 'desktop';

    if (url !== undefined && url !== null && url !== '') {
      if (typeof url !== 'string') {
        return NextResponse.json({ error: 'url must be a string' }, { status: 400 });
      }
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }

      const { stdout, stderr } = await runIbrCli([
        'start',
        url,
        '--name',
        name,
        '--viewport',
        viewportArg,
      ]);

      const sessionIdMatch = stdout.match(/Session started: (sess_[\w-]+)/);
      if (!sessionIdMatch) {
        console.error('CLI output:', stdout, stderr);
        return NextResponse.json(
          { error: 'Failed to parse session ID from CLI output' },
          { status: 500 }
        );
      }

      const sessionId = sessionIdMatch[1];
      const sessionPath = join(resolveSessionDir(sessionId), 'session.json');
      const content = await readFile(sessionPath, 'utf-8');
      const session = JSON.parse(content);

      return NextResponse.json({ session, sessionId });
    } else {
      const { nanoid } = await import('nanoid');
      const sessionId = `sess_${nanoid(10)}`;
      const sessionDir = resolveSessionDir(sessionId);

      await mkdir(sessionDir, { recursive: true });

      const now = new Date().toISOString();
      const session: Session = {
        id: sessionId,
        name: name.trim(),
        url: '',
        type: 'capture',
        viewport: {
          name: viewportArg,
          width: viewportArg === 'mobile' ? 375 : viewportArg === 'tablet' ? 768 : 1920,
          height: viewportArg === 'mobile' ? 667 : viewportArg === 'tablet' ? 1024 : 1080,
        },
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      const sessionPath = join(sessionDir, 'session.json');
      await writeFile(sessionPath, JSON.stringify(session, null, 2));

      return NextResponse.json({ session, sessionId });
    }
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
