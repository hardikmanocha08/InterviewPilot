import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import PeerSession from '@/lib/server/models/PeerSession';
import Interview from '@/lib/server/models/Interview';

// POST join existing peer session (as interviewer)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const { sessionId } = await context.params;
    const { interviewId } = await req.json();

    const session = await PeerSession.findById(sessionId);
    if (!session || session.status !== 'waiting') {
      return NextResponse.json({ message: 'Session not available' }, { status: 404 });
    }

    if (session.candidateId.toString() === user._id.toString()) {
      return NextResponse.json({ message: 'Cannot join own session' }, { status: 400 });
    }

    // Verify interviewer's interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.user.toString() !== user._id.toString()) {
      return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
    }

    // Update session with interviewer
    session.interviewerId = user._id;
    session.interviewerInterviewId = interview._id;
    session.status = 'active';
    session.startedAt = new Date();
    await session.save();

    // Update both interviews to reference peer session
    await Interview.findByIdAndUpdate(session.candidateInterviewId, {
      interviewMode: 'peer',
      peerSessionId: session._id,
    });

    await Interview.findByIdAndUpdate(interviewId, {
      interviewMode: 'peer',
      peerSessionId: session._id,
    });

    return NextResponse.json(session);
  } catch (err) {
    console.error('Error joining peer session:', err);
    return NextResponse.json({ message: 'Failed to join session' }, { status: 500 });
  }
}
