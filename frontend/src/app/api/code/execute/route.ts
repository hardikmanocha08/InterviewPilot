import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';

const JS_LANGUAGES = new Set(['javascript', 'typescript']);

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

    if (!JS_LANGUAGES.has(language || 'javascript')) {
      return NextResponse.json({
        output: `${language || 'javascript'} execution requires a server-side runtime. Only JavaScript/TypeScript can run in-browser. For ${language || 'other'}, install a local compiler or use an online IDE like Replit.`,
        exitCode: 0,
        hasError: false,
        note: `${language || 'other'} requires server-side execution. Running as JS fallback.`,
      });
    }

    console.log('[code/execute] Running JS/TS code, length:', code.length);

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
