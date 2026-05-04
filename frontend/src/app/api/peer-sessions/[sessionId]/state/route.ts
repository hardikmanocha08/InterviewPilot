import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import PeerSession from '@/lib/server/models/PeerSession';
import Interview from '@/lib/server/models/Interview';

const getUserPeerRole = (session: any, userId: string) => {
  if (session.candidateId?.toString() === userId) {
    return 'interviewee' as const;
  }
  if (session.interviewerId?.toString() === userId) {
    return 'interviewer' as const;
  }
  return null;
};

const syncPeerQuestionToInterviews = async (session: any) => {
  if (!session.currentQuestion?.trim()) {
    return;
  }

  const answerParts = [
    session.currentAnswer?.trim(),
    session.codeText?.trim() ? `Code:\n${session.codeText.trim()}` : '',
  ].filter(Boolean);

  const question = {
    questionText: session.currentQuestion.trim(),
    userAnswer: answerParts.join('\n\n'),
    score: 0,
    feedback: '',
    strengths: [],
    weaknesses: [],
    improvement: '',
  };

  for (const interviewId of [session.candidateInterviewId, session.interviewerInterviewId].filter(Boolean)) {
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      continue;
    }

    if (interview.questions.length === 0) {
      interview.questions.push(question);
    } else {
      interview.questions[0].questionText = question.questionText;
      interview.questions[0].userAnswer = question.userAnswer;
      if (!interview.questions[0].feedback) {
        interview.questions[0].score = 0;
        interview.questions[0].strengths = [];
        interview.questions[0].weaknesses = [];
        interview.questions[0].improvement = '';
      }
    }

    await interview.save();
  }
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const { sessionId } = await context.params;
  const session = await PeerSession.findById(sessionId).lean();
  if (!session) {
    return NextResponse.json({ message: 'Session not found' }, { status: 404 });
  }

  const peerRole = getUserPeerRole(session, user._id.toString());
  if (!peerRole) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  return NextResponse.json({ session, peerRole });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const { sessionId } = await context.params;
  const session = await PeerSession.findById(sessionId);
  if (!session) {
    return NextResponse.json({ message: 'Session not found' }, { status: 404 });
  }

  const peerRole = getUserPeerRole(session, user._id.toString());
  if (!peerRole) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json();

  if (peerRole === 'interviewer' && typeof body.currentQuestion === 'string') {
    session.currentQuestion = body.currentQuestion.slice(0, 4000);
  }
  if (peerRole === 'interviewee' && typeof body.currentAnswer === 'string') {
    session.currentAnswer = body.currentAnswer.slice(0, 12000);
  }
  if (peerRole === 'interviewee' && typeof body.codeText === 'string') {
    session.codeText = body.codeText.slice(0, 30000);
  }
  if (typeof body.micActive === 'boolean') {
    if (peerRole === 'interviewee') {
      session.candidateMicActive = body.micActive;
    } else {
      session.interviewerMicActive = body.micActive;
    }
  }
  if (typeof body.micLevel === 'number') {
    const micLevel = Math.max(0, Math.min(100, Math.round(body.micLevel)));
    if (peerRole === 'interviewee') {
      session.candidateMicLevel = micLevel;
    } else {
      session.interviewerMicLevel = micLevel;
    }
  }
  if (peerRole === 'interviewer' && typeof body.rtcOffer === 'string') {
    session.rtcOffer = body.rtcOffer;
    session.rtcAnswer = '';
    session.candidateIceCandidates = [];
    session.interviewerIceCandidates = [];
  }
  if (peerRole === 'interviewee' && typeof body.rtcAnswer === 'string') {
    session.rtcAnswer = body.rtcAnswer;
  }
  if (typeof body.iceCandidate === 'string') {
    if (!session.candidateIceCandidates) {
      session.candidateIceCandidates = [];
    }
    if (!session.interviewerIceCandidates) {
      session.interviewerIceCandidates = [];
    }

    const candidates = peerRole === 'interviewee'
      ? session.candidateIceCandidates
      : session.interviewerIceCandidates;
    if (!candidates.includes(body.iceCandidate)) {
      candidates.push(body.iceCandidate);
    }
  }
  if (
    body.audioChunk
    && typeof body.audioChunk.id === 'string'
    && typeof body.audioChunk.data === 'string'
    && typeof body.audioChunk.mimeType === 'string'
  ) {
    if (!session.candidateAudioChunks) {
      session.candidateAudioChunks = [];
    }
    if (!session.interviewerAudioChunks) {
      session.interviewerAudioChunks = [];
    }

    const chunks = peerRole === 'interviewee'
      ? session.candidateAudioChunks
      : session.interviewerAudioChunks;

    if (!chunks.some((chunk: any) => chunk.id === body.audioChunk.id)) {
      chunks.push({
        id: body.audioChunk.id,
        data: body.audioChunk.data,
        mimeType: body.audioChunk.mimeType,
        createdAt: new Date(),
      });
    }

    if (chunks.length > 40) {
      chunks.splice(0, chunks.length - 40);
    }
  }

  await session.save();
  await syncPeerQuestionToInterviews(session);

  return NextResponse.json({ session, peerRole });
}
