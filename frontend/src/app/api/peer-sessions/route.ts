import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import PeerSession from '@/lib/server/models/PeerSession';
import Interview from '@/lib/server/models/Interview';
import crypto from 'crypto';

const randomCode = (len = 8) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
};

const normalizeCode = (code: string) => code.trim().toLowerCase();
const hashJoinCode = (code: string) => {
  const normalized = normalizeCode(code);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}_${normalized.length}`;
};

// GET available peers waiting for interview
export async function GET(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const includeMine = req.nextUrl.searchParams.get('includeMine') === 'true';
    const waitingSessions = await PeerSession.find({
      status: 'waiting',
      candidateId: { $ne: user._id },
      isAIPaired: false,
    })
      .populate('candidateId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    if (includeMine) {
      const ownSession = await PeerSession.findOne({
        $or: [
          { candidateId: user._id },
          { interviewerId: user._id },
        ],
        status: { $in: ['waiting', 'active'] },
        isAIPaired: false,
      })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({
        availableSessions: waitingSessions,
        ownSession,
      });
    }

    return NextResponse.json(waitingSessions);
  } catch (err) {
    console.error('Error fetching peers:', err);
    return NextResponse.json({ message: 'Failed to fetch available peers' }, { status: 500 });
  }
}

// POST create new peer session
export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const { role, experienceLevel, interviewId, visibility, peerRole } = await req.json();

    const interview = await Interview.findById(interviewId);
    if (!interview || interview.user.toString() !== user._id.toString()) {
      return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
    }

    const existingSession = await PeerSession.findOne({
      $or: [
        { candidateId: user._id, candidateInterviewId: interviewId },
        { interviewerId: user._id, interviewerInterviewId: interviewId },
      ],
      status: { $in: ['waiting', 'active'] },
    });

    if (existingSession) {
      let joinCode = undefined;
      if (existingSession.visibility === 'private' && existingSession.joinCodeHash) {
        joinCode = randomCode(8);
        existingSession.joinCodeHash = hashJoinCode(joinCode);
        await existingSession.save();
      }
      return NextResponse.json({ session: existingSession, joinCode });
    }

    const sessionData: any = {
      status: 'waiting',
      role,
      experienceLevel,
      isAIPaired: false,
      visibility: visibility || 'public',
    };

    if (peerRole === 'interviewer') {
      sessionData.interviewerId = user._id;
      sessionData.interviewerInterviewId = interviewId;
    } else {
      sessionData.candidateId = user._id;
      sessionData.candidateInterviewId = interviewId;
    }

    if (visibility === 'private') {
      const joinCode = randomCode(8);
      sessionData.joinCodeHash = hashJoinCode(joinCode);
      sessionData.visibility = 'private';

      const peerSession = new PeerSession(sessionData);
      await peerSession.save();
      return NextResponse.json({ session: peerSession, joinCode });
    }

    const peerSession = new PeerSession(sessionData);
    await peerSession.save();
    return NextResponse.json({ session: peerSession });
  } catch (err) {
    console.error('Error creating peer session:', err);
    return NextResponse.json({ message: 'Failed to create peer session' }, { status: 500 });
  }
}
