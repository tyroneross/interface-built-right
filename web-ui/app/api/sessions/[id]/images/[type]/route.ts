import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveSessionDir } from '@/lib/server/ibr-paths';

const SESSION_ID_RE = /^(?:sess|live)_[A-Za-z0-9_-]+$/;
const ALLOWED_TYPES = new Set(['baseline', 'current', 'diff']);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id, type } = await params;

    if (!SESSION_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
    }

    const imagePath = join(resolveSessionDir(id), `${type}.png`);

    if (!existsSync(imagePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const imageBuffer = await readFile(imagePath);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error getting image:', error);
    return NextResponse.json(
      { error: 'Failed to get image' },
      { status: 500 }
    );
  }
}
