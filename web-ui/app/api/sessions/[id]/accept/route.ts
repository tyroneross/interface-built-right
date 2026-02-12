import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, copyFile, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const IBR_DIR = process.env.IBR_DIR || './.ibr';

// POST /api/sessions/[id]/accept - Accept current as new baseline
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

    const baselinePath = join(sessionDir, 'baseline.png');
    const currentPath = join(sessionDir, 'current.png');

    // Current screenshot must exist to accept it as baseline
    if (!existsSync(currentPath)) {
      return NextResponse.json(
        {
          error: 'No current screenshot to accept as baseline.',
          hint: 'Run `npx ibr check` first to capture the current state.',
        },
        { status: 400 }
      );
    }

    // Copy current to baseline (overwrite)
    await copyFile(currentPath, baselinePath);

    // Read and update session
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
