import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';

const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'cpp', version: '10.2.0' },
  csharp: { language: 'csharp', version: '6.12.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
};

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

    const langConfig = LANGUAGE_MAP[language || 'javascript'];
    if (!langConfig) {
      return NextResponse.json({ message: `Unsupported language: ${language}` }, { status: 400 });
    }

    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const result = await response.json();

    if (result.run) {
      const output = result.run.stdout || result.run.stderr || '';
      const error = result.run.compile?.stderr || result.run.compile?.stdout || '';

      if (interviewId) {
        const interview = await Interview.findById(interviewId);
        if (interview && interview.user.toString() === user._id.toString()) {
          await Interview.findByIdAndUpdate(interviewId, {
            $push: { questions: { questionText: `Code execution (${language})`, userAnswer: code, score: 0, feedback: '', strengths: [], weaknesses: [], improvement: '' } },
          });
        }
      }

      return NextResponse.json({
        output: output.trim(),
        error: error.trim(),
        exitCode: result.run.code,
      });
    }

    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  } catch (err: any) {
    console.error('Code execution error:', err);
    return NextResponse.json({
      error: err.name === 'TimeoutError' ? 'Execution timed out (15s limit)' : 'Failed to execute code',
    }, { status: 500 });
  }
}
