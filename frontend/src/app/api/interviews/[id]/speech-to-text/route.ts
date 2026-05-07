import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';
import { transcribeAudio } from '@/lib/server/utils/ai';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const { id } = await context.params;
  const interview = await Interview.findById(id);
  if (!interview) {
    return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
  }

  if (interview.user.toString() !== user._id.toString()) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const audio = formData.get('audio');

  if (!audio || !(audio instanceof File)) {
    return NextResponse.json({ message: 'Valid audio file is required' }, { status: 400 });
  }

  try {
    const maxSizeBytes = 20 * 1024 * 1024;
    if (audio.size > maxSizeBytes) {
      return NextResponse.json(
        { message: 'Audio file is too large. Please upload a file under 20MB.' },
        { status: 400 }
      );
    }

    let text: string;
    try {
      text = await transcribeAudio(audio);
    } catch (sttError) {
      console.warn('NVIDIA STT failed, returning error to client for browser fallback:', sttError);
      return NextResponse.json(
        { message: 'STT service unavailable. Please type your answer or check browser microphone permissions.', sttError: sttError instanceof Error ? sttError.message : String(sttError) },
        { status: 503 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error('Transcription error', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
