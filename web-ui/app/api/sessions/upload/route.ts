import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';

const IBR_DIR = process.env.IBR_DIR || './.ibr';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

interface ReferenceMetadata {
  framework?: string;
  componentLibrary?: string;
  targetPath?: string;
  notes?: string;
  originalFileName: string;
  uploadedAt: string;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}

interface ReferenceSession {
  id: string;
  name: string;
  type: 'reference';
  viewport: {
    name: string;
    width: number;
    height: number;
  };
  status: 'baseline';
  createdAt: string;
  updatedAt: string;
  referenceMetadata: ReferenceMetadata;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract form fields
    const file = formData.get('image') as File;
    const name = formData.get('name') as string;
    const framework = formData.get('framework') as string | null;
    const componentLibrary = formData.get('componentLibrary') as string | null;
    const targetPath = formData.get('targetPath') as string | null;
    const notes = formData.get('notes') as string | null;

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, WebP, SVG' },
        { status: 400 }
      );
    }

    // Generate session ID
    const sessionId = `sess_${nanoid(10)}`;
    const sessionDir = join(process.cwd(), IBR_DIR, 'sessions', sessionId);

    // Create session directory
    await mkdir(sessionDir, { recursive: true });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to PNG and get dimensions using Sharp
    let pngBuffer: Buffer;
    let dimensions: { width: number; height: number };

    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      dimensions = {
        width: metadata.width || 1920,
        height: metadata.height || 1080,
      };

      // Convert to PNG for consistency
      pngBuffer = await image.png().toBuffer();
    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      return NextResponse.json(
        { error: 'Failed to process image. Please try a different format.' },
        { status: 400 }
      );
    }

    // Save reference image as PNG
    const referencePath = join(sessionDir, 'reference.png');
    await writeFile(referencePath, pngBuffer);

    // Create session metadata
    const now = new Date().toISOString();
    const session: ReferenceSession = {
      id: sessionId,
      name: name.trim(),
      type: 'reference',
      viewport: {
        name: 'reference',
        width: dimensions.width,
        height: dimensions.height,
      },
      status: 'baseline',
      createdAt: now,
      updatedAt: now,
      referenceMetadata: {
        framework: framework || undefined,
        componentLibrary: componentLibrary || undefined,
        targetPath: targetPath || undefined,
        notes: notes || undefined,
        originalFileName: file.name,
        uploadedAt: now,
        fileSize: file.size,
        dimensions,
      },
    };

    // Save session.json
    const sessionPath = join(sessionDir, 'session.json');
    await writeFile(sessionPath, JSON.stringify(session, null, 2));

    return NextResponse.json({
      session,
      sessionId,
      referencePath: `${IBR_DIR}/sessions/${sessionId}/reference.png`,
    });
  } catch (error) {
    console.error('Error uploading reference image:', error);
    return NextResponse.json(
      { error: 'Failed to upload reference image' },
      { status: 500 }
    );
  }
}
