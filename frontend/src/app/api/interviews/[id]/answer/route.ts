import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';
import { evaluateAnswer } from '@/lib/server/utils/ai';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const { questionId, answerText } = await req.json();

  if (!questionId || !answerText) {
    return NextResponse.json({ message: 'Question ID and answer text are required' }, { status: 400 });
  }

  const { id } = await context.params;
  const interview = await Interview.findById(id);
  if (!interview) {
    return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
  }

  if (interview.user.toString() !== user._id.toString()) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  if (interview.status === 'completed') {
    return NextResponse.json({ message: 'Interview already completed' }, { status: 400 });
  }

  const questionIndex = interview.questions.findIndex((q) => q._id?.toString() === questionId);
  if (questionIndex === -1) {
    return NextResponse.json({ message: 'Question not found' }, { status: 404 });
  }

  try {
    const question = interview.questions[questionIndex];
    question.userAnswer = answerText;

    // In timed mode, defer all AI analysis until interview completion.
    if (interview.interviewMode === 'timed') {
      question.score = 0;
      question.feedback = '';
      question.strengths = [];
      question.weaknesses = [];
      question.improvement = '';
      await interview.save();
      return NextResponse.json(question);
    }

    const evaluation = await evaluateAnswer(question.questionText, answerText);
    question.score = evaluation.score ?? 0;
    question.feedback = evaluation.feedback ?? '';
    question.strengths = evaluation.strengths ?? [];
    question.weaknesses = evaluation.weaknesses ?? [];
    question.improvement = evaluation.improvement ?? '';

    await interview.save();

    return NextResponse.json(question);
  } catch (err) {
    console.error('Answer evaluation error', err);
    return NextResponse.json({ message: 'Failed to evaluate answer' }, { status: 500 });
  }
}
