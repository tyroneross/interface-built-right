import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const IBR_DIR = process.env.IBR_DIR || './.ibr';

interface ReferenceSession {
  id: string;
  name: string;
  url: string;
  type: 'reference';
  viewport: { name: string; width: number; height: number };
  status: 'baseline';
  createdAt: string;
  updatedAt: string;
  referenceMetadata: {
    framework?: string;
    componentLibrary?: string;
    targetPath?: string;
    notes?: string;
    originalUrl: string;
    extractedAt: string;
    dimensions: { width: number; height: number };
  };
}

async function runIbr(args: string): Promise<string> {
  const parentDir = join(process.cwd(), '..');
  const { stdout } = await execAsync(`npm run ibr -- ${args}`, {
    cwd: parentDir,
    timeout: 120000,
  });
  return stdout;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, metadata } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const name = metadata?.name || new URL(url).hostname;
    const sessionId = `sess_${nanoid(10)}`;
    const ibrDir = join(process.cwd(), IBR_DIR);
    const sessionDir = join(ibrDir, 'sessions', sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Use IBR's own CDP engine to scan and screenshot
    const [scanRaw, screenshotRaw] = await Promise.all([
      runIbr(`scan ${url} --json`),
      runIbr(`screenshot ${url} --output ${join(sessionDir, 'reference.png')}`),
    ]);

    let scanData;
    try {
      scanData = JSON.parse(scanRaw);
    } catch {
      scanData = { raw: scanRaw };
    }

    // Save extraction data
    const extractionData = {
      url,
      timestamp: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      elements: scanData.elements || [],
      cssVariables: scanData.cssVariables || {},
    };

    await writeFile(
      join(sessionDir, 'reference.json'),
      JSON.stringify(extractionData, null, 2)
    );

    // Create session record
    const now = new Date().toISOString();
    const session: ReferenceSession = {
      id: sessionId,
      name: name.trim(),
      url,
      type: 'reference',
      viewport: { name: 'desktop', width: 1920, height: 1080 },
      status: 'baseline',
      createdAt: now,
      updatedAt: now,
      referenceMetadata: {
        framework: metadata?.framework || undefined,
        componentLibrary: metadata?.componentLibrary || undefined,
        targetPath: metadata?.targetPath || undefined,
        notes: metadata?.notes || undefined,
        originalUrl: url,
        extractedAt: now,
        dimensions: { width: 1920, height: 1080 },
      },
    };

    await writeFile(
      join(sessionDir, 'session.json'),
      JSON.stringify(session, null, 2)
    );

    return NextResponse.json({ session, sessionId, extractionData });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract from URL' },
      { status: 500 }
    );
  }
}
