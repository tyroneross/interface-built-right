import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// POST /api/workflows/baseline - Build baseline for a URL
export async function POST(request: NextRequest) {
  try {
    const { url, name, viewport } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    const parentDir = join(process.cwd(), '..');
    const nameFlag = name ? ` --name "${name}"` : '';
    const vpFlag = viewport ? ` --viewport ${viewport}` : '';
    const command = `npm run ibr -- start ${url}${nameFlag}${vpFlag}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: parentDir,
      timeout: 60000,
    });

    // After capturing, run a scan to identify elements
    let scanResult;
    try {
      const scanCommand = `npm run ibr -- scan ${url} --json${vpFlag}`;
      const { stdout: scanOut } = await execAsync(scanCommand, {
        cwd: parentDir,
        timeout: 120000,
      });
      scanResult = JSON.parse(scanOut);
    } catch {
      scanResult = null;
    }

    return NextResponse.json({
      success: true,
      url,
      name: name || url,
      baseline: stdout.trim(),
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
