import { NextRequest, NextResponse } from 'next/server';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const IBR_DIR = process.env.IBR_DIR || './.ibr';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionPath = join(
      process.cwd(),
      IBR_DIR,
      'sessions',
      id,
      'session.json'
    );

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

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionDir = join(process.cwd(), IBR_DIR, 'sessions', id);

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
