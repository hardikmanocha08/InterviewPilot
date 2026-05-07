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

    console.log('[code/execute] Running:', { language: langConfig.language, version: langConfig.version, codeLength: code.length });

    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
        stdin: '',
        compile_timeout: 10000,
        run_timeout: 10000,
      }),
      signal: AbortSignal.timeout(20000),
    });

    console.log('[code/execute] Piston response status:', response.status);

    const result = await response.json();
    console.log('[code/execute] Piston result:', JSON.stringify(result).substring(0, 500));

    if (result.run) {
      const stdout = result.run.stdout || '';
      const stderr = result.run.stderr || '';
      const compileOutput = result.run.compile?.output || '';
      const compileError = result.run.compile?.error || '';
      const exitCode = result.run.code;

      const combinedOutput = [compileError, compileOutput, stdout, stderr].filter(Boolean).join('\n') || 'No output';

      if (interviewId) {
        try {
          const interview = await Interview.findById(interviewId);
          if (interview && interview.user.toString() === user._id.toString()) {
            await Interview.findByIdAndUpdate(interviewId, {
              $push: { questions: { questionText: `Code execution (${language})`, userAnswer: code, score: 0, feedback: '', strengths: [], weaknesses: [], improvement: '' } },
            });
          }
        } catch (dbErr) {
          console.error('[code/execute] DB update failed:', dbErr);
        }
      }

      return NextResponse.json({
        output: combinedOutput.trim(),
        exitCode,
        hasError: exitCode !== 0 || !!stderr,
      });
    }

    console.error('[code/execute] No run result:', JSON.stringify(result));
    return NextResponse.json({ error: result.message || result.error || 'Execution failed. Piston API returned no run result.' }, { status: 500 });
  } catch (err: any) {
    console.error('[code/execute] Error:', err.message || err);
    return NextResponse.json({
      error: err.name === 'TimeoutError' ? 'Execution timed out (20s limit)' : `Execution failed: ${err.message || 'Unknown error'}`,
    }, { status: 500 });
  }
}
