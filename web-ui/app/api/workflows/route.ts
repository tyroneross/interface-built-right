import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const IBR_DIR = process.env.IBR_DIR || './.ibr';

interface WorkflowItem {
  id: string;
  name: string;
  url: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: string;
  completedAt?: string;
  verdict?: 'MATCH' | 'EXPECTED_CHANGE' | 'UNEXPECTED_CHANGE' | 'LAYOUT_BROKEN';
  diffPercent?: number;
}

export async function GET() {
  try {
    const sessionsDir = join(process.cwd(), IBR_DIR, 'sessions');

    if (!existsSync(sessionsDir)) {
      return NextResponse.json({ workflows: [] });
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const workflows: WorkflowItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionDir = join(sessionsDir, entry.name);
      const sessionJsonPath = join(sessionDir, 'session.json');

      if (!existsSync(sessionJsonPath)) continue;

      try {
        const sessionData = JSON.parse(await readFile(sessionJsonPath, 'utf-8'));

        // Determine workflow status from session data
        let status: WorkflowItem['status'] = 'pending';

        if (sessionData.status === 'comparing') {
          status = 'running';
        } else if (sessionData.status === 'compared' || sessionData.comparison) {
          status = 'completed';
        } else if (sessionData.status === 'error') {
          status = 'failed';
        } else if (sessionData.status === 'baseline') {
          status = 'pending';
        }

        workflows.push({
          id: sessionData.id || entry.name,
          name: sessionData.name || entry.name,
          url: sessionData.url || '',
          status,
          startedAt: sessionData.createdAt || sessionData.created || new Date().toISOString(),
          completedAt: sessionData.comparison?.completedAt,
          verdict: sessionData.comparison?.analysis?.verdict,
          diffPercent: sessionData.comparison?.diffPercent,
        });
      } catch {
        // Skip sessions with invalid JSON
        continue;
      }
    }

    // Sort by startedAt descending (most recent first)
    workflows.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}
