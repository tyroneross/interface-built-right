import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { resolveSessionsDir } from '@/lib/server/ibr-paths';
import { runIbrCli } from '@/lib/server/run-ibr';

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

// POST /api/sessions/extract - Build a reference session from a live URL.
// Runs IBR's scan + screenshot via execFile (argv), no shell.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, metadata } = body as {
      url?: unknown;
      metadata?: Record<string, unknown>;
    };

    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const name =
      typeof metadata?.name === 'string' && metadata.name.trim()
        ? (metadata.name as string)
        : parsed.hostname;
    const sessionId = `sess_${nanoid(10)}`;
    const sessionDir = join(resolveSessionsDir(), sessionId);
    await mkdir(sessionDir, { recursive: true });

    const referencePath = join(sessionDir, 'reference.png');

    // Use IBR's own CDP engine to scan and screenshot in parallel.
    const [scanRes, _screenshotRes] = await Promise.all([
      runIbrCli(['scan', url, '--json'], { timeoutMs: 120_000 }),
      runIbrCli(['screenshot', url, '--output', referencePath], { timeoutMs: 120_000 }),
    ]);

    let scanData: { elements?: unknown[]; cssVariables?: Record<string, unknown>; raw?: string };
    try {
      scanData = JSON.parse(scanRes.stdout);
    } catch {
      scanData = { raw: scanRes.stdout };
    }

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

    const now = new Date().toISOString();
    const session: ReferenceSession = {
      id: sessionId,
      name: String(name).trim(),
      url,
      type: 'reference',
      viewport: { name: 'desktop', width: 1920, height: 1080 },
      status: 'baseline',
      createdAt: now,
      updatedAt: now,
      referenceMetadata: {
        framework: typeof metadata?.framework === 'string' ? metadata.framework : undefined,
        componentLibrary:
          typeof metadata?.componentLibrary === 'string' ? metadata.componentLibrary : undefined,
        targetPath: typeof metadata?.targetPath === 'string' ? metadata.targetPath : undefined,
        notes: typeof metadata?.notes === 'string' ? metadata.notes : undefined,
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
