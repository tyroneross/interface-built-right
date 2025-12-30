import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

// POST /api/sessions/[id]/accept - Accept current as new baseline
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

    // Run ibr update command from parent directory
    const parentDir = join(process.cwd(), '..');
    const command = `npm run ibr -- update ${id}`;

    const { stdout, stderr } = await execAsync(command, { cwd: parentDir });

    // Check for success
    if (!stdout.includes('Baseline updated')) {
      console.error('Update output:', stdout, stderr);
      return NextResponse.json(
        { error: 'Failed to update baseline' },
        { status: 500 }
      );
    }

    // Read updated session
    const sessionPath = join(sessionDir, 'session.json');
    const content = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    return NextResponse.json({
      success: true,
      session,
      message: 'Baseline updated successfully'
    });
  } catch (error) {
    console.error('Error accepting baseline:', error);
    return NextResponse.json(
      { error: 'Failed to accept baseline' },
      { status: 500 }
    );
  }
}
