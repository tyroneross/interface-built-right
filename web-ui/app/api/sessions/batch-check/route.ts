import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

// POST /api/sessions/batch-check - Check multiple sessions
export async function POST(request: NextRequest) {
  try {
    const { sessionIds } = await request.json();

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { error: 'sessionIds array is required' },
        { status: 400 }
      );
    }

    const parentDir = join(process.cwd(), '..');
    const results = [];

    for (const id of sessionIds) {
      const sessionDir = join(process.cwd(), IBR_DIR, 'sessions', id);

      if (!existsSync(sessionDir)) {
        results.push({
          sessionId: id,
          success: false,
          error: 'Session not found'
        });
        continue;
      }

      try {
        const command = `npm run ibr -- check ${id} --format json`;
        const { stdout } = await execAsync(command, { cwd: parentDir });

        const report = JSON.parse(stdout);
        const sessionPath = join(sessionDir, 'session.json');
        const content = await readFile(sessionPath, 'utf-8');
        const session = JSON.parse(content);

        results.push({
          sessionId: id,
          success: true,
          session,
          report
        });
      } catch (err) {
        results.push({
          sessionId: id,
          success: false,
          error: err instanceof Error ? err.message : 'Check failed'
        });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      results,
      summary: {
        total: sessionIds.length,
        succeeded,
        failed
      }
    });
  } catch (error) {
    console.error('Error in batch check:', error);
    return NextResponse.json(
      { error: 'Batch check failed' },
      { status: 500 }
    );
  }
}
