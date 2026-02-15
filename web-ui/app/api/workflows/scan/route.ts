import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// POST /api/workflows/scan - Run full interface scan on a URL
export async function POST(request: NextRequest) {
  try {
    const { url, viewport } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    const parentDir = join(process.cwd(), '..');
    const vpFlag = viewport ? ` --viewport ${viewport}` : '';
    const command = `npm run ibr -- scan ${url} --json${vpFlag}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: parentDir,
      timeout: 120000,
    });

    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      result = { raw: stdout, stderr };
    }

    return NextResponse.json({
      success: true,
      url,
      result,
    });
  } catch (error) {
    console.error('Error running scan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
