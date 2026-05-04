import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import PeerSession from '@/lib/server/models/PeerSession';
import Interview from '@/lib/server/models/Interview';

// GET available peers waiting for interview
export async function GET(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const waitingSessions = await PeerSession.find({
      status: 'waiting',
      candidateId: { $ne: user._id }, // Don't show own sessions
      isAIPaired: false,
    })
      .populate('candidateId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(waitingSessions);
  } catch (err) {
    console.error('Error fetching peers:', err);
    return NextResponse.json({ message: 'Failed to fetch available peers' }, { status: 500 });
  }
}

// POST create new peer session (as candidate)
export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const { role, experienceLevel, interviewId } = await req.json();

    // Verify interview exists and belongs to user
    const interview = await Interview.findById(interviewId);
    if (!interview || interview.user.toString() !== user._id.toString()) {
      return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
    }

    const peerSession = new PeerSession({
      candidateId: user._id,
      candidateInterviewId: interviewId,
      status: 'waiting',
      role,
      experienceLevel,
      isAIPaired: false,
    });

    await peerSession.save();
    return NextResponse.json(peerSession);
  } catch (err) {
    console.error('Error creating peer session:', err);
    return NextResponse.json({ message: 'Failed to create peer session' }, { status: 500 });
  }
}
