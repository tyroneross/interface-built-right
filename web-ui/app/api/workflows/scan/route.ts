import { NextRequest, NextResponse } from 'next/server';
import { runIbrCli, extractJson } from '@/lib/server/run-ibr';

// POST /api/workflows/scan - Run a full interface scan on a URL.
// Uses execFile (argument array) via runIbrCli — no shell, no string-concat,
// no command injection.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, viewport } = body as { url?: unknown; viewport?: unknown };

    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const args: string[] = ['scan', url, '--json'];
    if (viewport !== undefined && viewport !== null && viewport !== '') {
      if (typeof viewport !== 'string') {
        return NextResponse.json(
          { error: 'viewport must be a string' },
          { status: 400 }
        );
      }
      args.push('--viewport', viewport);
    }

    const { stdout, stderr } = await runIbrCli(args, { timeoutMs: 120_000 });

    const parsed = extractJson<Record<string, unknown>>(stdout);
    const result = parsed ?? { raw: stdout, stderr };

    return NextResponse.json({ success: true, url, result });
  } catch (error) {
    console.error('Error running scan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
