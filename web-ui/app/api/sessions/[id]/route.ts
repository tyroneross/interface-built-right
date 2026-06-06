import { NextRequest, NextResponse } from 'next/server';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveSessionDir } from '@/lib/server/ibr-paths';

const SESSION_ID_RE = /^(?:sess|live)_[A-Za-z0-9_-]+$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SESSION_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }
    const sessionPath = join(resolveSessionDir(id), 'session.json');

    if (!existsSync(sessionPath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id] - Delete a session.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SESSION_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }
    const sessionDir = resolveSessionDir(id);

    if (!existsSync(sessionDir)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await rm(sessionDir, { recursive: true, force: true });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
