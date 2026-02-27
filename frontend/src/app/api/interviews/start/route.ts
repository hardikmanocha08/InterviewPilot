import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';
import { generateInterviewQuestions } from '@/lib/server/utils/ai';

export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const { role, experienceLevel, industryMode, questionCount, interviewMode } = await req.json();

  if (!role || !experienceLevel) {
    return NextResponse.json({ message: 'Role and experience level are required' }, { status: 400 });
  }

  try {
    const countFromRequest = Number.isFinite(questionCount) ? Number(questionCount) : undefined;
    const preferredCount = user.settings?.preferredQuestionCount || 3;
    const totalQuestions = Math.max(3, Math.min(7, countFromRequest || preferredCount));
    const selectedIndustry = industryMode || user.industryMode || 'Product company';
    const selectedMode: 'timed' | 'untimed' = interviewMode === 'untimed' ? 'untimed' : 'timed';
    const baseTimeByExperience: Record<string, number> = {
      Fresher: 150,
      '1-3 years': 210,
      '3-5 years': 300,
      '5+ years': 360,
    };
    const experienceBase = baseTimeByExperience[experienceLevel] || 210;
    const questionLoadAdjustment = totalQuestions >= 6 ? -20 : totalQuestions <= 4 ? 15 : 0;
    const perQuestionTimeSeconds = selectedMode === 'timed'
      ? Math.max(120, Math.min(420, experienceBase + questionLoadAdjustment))
      : 0;
    const aiQuestions = await generateInterviewQuestions(
      `${role} (${selectedIndustry})`,
      experienceLevel,
      totalQuestions
    );

    const questions = aiQuestions.map((q: { questionText: string }) => ({
      questionText: q.questionText,
      userAnswer: '',
      score: 0,
      feedback: '',
      strengths: [],
      weaknesses: [],
      improvement: '',
    }));

    const interview = await Interview.create({
      user: user._id,
      role,
      experienceLevel,
      industryMode: selectedIndustry,
      interviewMode: selectedMode,
      perQuestionTimeSeconds,
      questions,
    });

    return NextResponse.json(interview, { status: 201 });
  } catch (err) {
    console.error('Interview start error', err);
    return NextResponse.json({ message: 'Failed to start interview' }, { status: 500 });
  }
}
