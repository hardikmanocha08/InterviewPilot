import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import PeerSession from '@/lib/server/models/PeerSession';
import Interview from '@/lib/server/models/Interview';
// NOTE: Next.js route handlers run in a Node environment; we use a small deterministic hash.
// This keeps the join code private (we store only a hash, not the raw code).
const normalizeCode = (code: string) => code.trim().toLowerCase();
const hashJoinCode = (code: string) => {
  const normalized = normalizeCode(code);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}_${normalized.length}`;
};


const getUserPeerRole = (session: any, userId: string) => {
  if (session.candidateId?.toString() === userId) return 'interviewee' as const;
  if (session.interviewerId?.toString() === userId) return 'interviewer' as const;
  return null;
};

export async function POST(
  req: NextRequest
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) return error;

  try {
    const { interviewId, joinCode } = await req.json();
    if (!interviewId || typeof interviewId !== 'string') {
      return NextResponse.json({ message: 'interviewId is required' }, { status: 400 });
    }
    if (!joinCode || typeof joinCode !== 'string') {
      return NextResponse.json({ message: 'joinCode is required' }, { status: 400 });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview || !user || interview.user.toString() !== user._id.toString()) {
      return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
    }


    const joinCodeHash = hashJoinCode(joinCode);

    // Candidate creates the room as a private session.
    const session = await PeerSession.findOne({
      status: 'waiting',
      isAIPaired: false,
      visibility: 'private',
      joinCodeHash,
    });

    if (!session) {
      return NextResponse.json({ message: 'Invalid or expired join code' }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
    }

    if (session.candidateId.toString() === user._id.toString()) {
      return NextResponse.json({ message: 'Cannot join own session' }, { status: 400 });
    }


    // Ensure this interviewer is the same interviewer-owner for both.
    // In current system, both sides reference the same interview document(s).
    // We keep behavior consistent with existing join endpoint.
    session.interviewerId = user._id;
    session.interviewerInterviewId = interview._id;
    session.status = 'active';
    session.startedAt = new Date();
    await session.save();


    await Interview.findByIdAndUpdate(session.candidateInterviewId, {
      interviewMode: 'peer',
      peerSessionId: session._id,
    });

    await Interview.findByIdAndUpdate(interviewId, {
      interviewMode: 'peer',
      peerSessionId: session._id,
    });

    return NextResponse.json({ session, peerRole: getUserPeerRole(session, user._id.toString()) });

  } catch (err) {
    console.error('Error joining by code:', err);
    return NextResponse.json({ message: 'Failed to join session' }, { status: 500 });
  }
}

