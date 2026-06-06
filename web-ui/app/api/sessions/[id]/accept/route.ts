import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveSessionDir } from '@/lib/server/ibr-paths';

const SESSION_ID_RE = /^sess_[A-Za-z0-9_-]+$/;

// POST /api/sessions/[id]/accept - Promote current screenshot to baseline.
// Pure file operations; no shell. (This route was already shell-free; the only
// change here is the path-resolution helper.)
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

    const baselinePath = join(sessionDir, 'baseline.png');
    const currentPath = join(sessionDir, 'current.png');

    if (!existsSync(currentPath)) {
      return NextResponse.json(
        {
          error: 'No current screenshot to accept as baseline.',
          hint: 'Run `npx ibr check` first to capture the current state.',
        },
        { status: 400 }
      );
    }

    await copyFile(currentPath, baselinePath);

    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    const updatedSession = {
      ...session,
      status: 'baseline',
      comparison: undefined,
      analysis: undefined,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(sessionPath, JSON.stringify(updatedSession, null, 2));

    return NextResponse.json({
      success: true,
      session: updatedSession,
      message: 'Baseline updated successfully. Current screenshot is now the baseline.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error accepting baseline:', message);
    return NextResponse.json(
      { error: 'Failed to accept baseline', detail: message },
      { status: 500 }
    );
  }
}
