import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';
import { transcribeAudioPlaceholder } from '@/lib/server/utils/ai';

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

  if (!audio) {
    return NextResponse.json({ message: 'No audio file provided' }, { status: 400 });
  }

  try {
    const text = await transcribeAudioPlaceholder();
    return NextResponse.json({ text });
  } catch (err) {
    console.error('Transcription error', err);
    return NextResponse.json({ message: 'Failed to transcribe audio' }, { status: 500 });
  }
}
