import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const IBR_DIR = process.env.IBR_DIR || './.ibr';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, feedback } = await request.json();

    if (!feedback?.trim()) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
    }

    const feedbackDir = join(process.cwd(), IBR_DIR, 'feedback');
    await mkdir(feedbackDir, { recursive: true });

    const feedbackPath = join(feedbackDir, 'pending.md');
    const timestamp = new Date().toISOString();

    const content = `# Visual Feedback for Claude

**Session:** ${sessionId || 'N/A'}
**Time:** ${timestamp}

## User Feedback

${feedback}

---
*This feedback was submitted via the Interface Built Right visual comparison UI.*
*Claude should read this file and act on the feedback.*
`;

    await writeFile(feedbackPath, content);

    return NextResponse.json({
      success: true,
      message: 'Feedback saved. Claude can now read it.',
      path: feedbackPath
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const feedbackPath = join(process.cwd(), IBR_DIR, 'feedback', 'pending.md');

    if (!existsSync(feedbackPath)) {
      return NextResponse.json({ feedback: null });
    }

    const content = await readFile(feedbackPath, 'utf-8');
    return NextResponse.json({ feedback: content });
  } catch (error) {
    console.error('Error reading feedback:', error);
    return NextResponse.json(
      { error: 'Failed to read feedback' },
      { status: 500 }
    );
  }
}
