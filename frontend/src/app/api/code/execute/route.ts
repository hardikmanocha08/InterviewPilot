import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';

const CLIENT_SIDE_LANGUAGES = new Set(['javascript', 'typescript', 'python']);

export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const { code, language, interviewId } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ message: 'Code is required' }, { status: 400 });
    }

    const lang = language || 'javascript';

    if (!CLIENT_SIDE_LANGUAGES.has(lang)) {
      return NextResponse.json({
        output: `${lang} execution requires a server-side runtime. In-browser execution is available for JavaScript, TypeScript, and Python. For ${lang}, use a local compiler or an online IDE like Replit.`,
        exitCode: 0,
        hasError: false,
      });
    }

    return NextResponse.json({
      output: '__CLIENT_SIDE_EXECUTION__',
      exitCode: 0,
      hasError: false,
      clientSide: true,
    });
  } catch (err: any) {
    console.error('[code/execute] Error:', err.message || err);
    return NextResponse.json({
      error: `Execution failed: ${err.message || 'Unknown error'}`,
    }, { status: 500 });
  }
}
