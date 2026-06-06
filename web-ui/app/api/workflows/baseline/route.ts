import { NextRequest, NextResponse } from 'next/server';
import { runIbrCli } from '@/lib/server/run-ibr';

// POST /api/workflows/baseline - Capture a baseline for a URL, then immediately
// scan to identify elements. Both calls go through runIbrCli (execFile + argv),
// so URL/name values are literal arguments — no shell interpolation.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, name, viewport } = body as {
      url?: unknown;
      name?: unknown;
      viewport?: unknown;
    };

    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (name !== undefined && name !== null && typeof name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    if (viewport !== undefined && viewport !== null && typeof viewport !== 'string') {
      return NextResponse.json({ error: 'viewport must be a string' }, { status: 400 });
    }

    const startArgs: string[] = ['start', url];
    if (name) startArgs.push('--name', name as string);
    if (viewport) startArgs.push('--viewport', viewport as string);

    const { stdout: startOut } = await runIbrCli(startArgs, { timeoutMs: 60_000 });

    let scanResult: unknown = null;
    try {
      const scanArgs: string[] = ['scan', url, '--json'];
      if (viewport) scanArgs.push('--viewport', viewport as string);
      const { stdout: scanOut } = await runIbrCli(scanArgs, { timeoutMs: 120_000 });
      scanResult = JSON.parse(scanOut);
    } catch {
      scanResult = null;
    }

    return NextResponse.json({
      success: true,
      url,
      name: typeof name === 'string' && name.trim() ? name : url,
      baseline: startOut.trim(),
      elements: scanResult,
    });
  } catch (error) {
    console.error('Error building baseline:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Baseline capture failed' },
      { status: 500 }
    );
  }
}
