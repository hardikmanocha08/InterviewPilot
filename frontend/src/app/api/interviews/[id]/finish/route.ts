import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';
import { evaluateAnswer } from '@/lib/server/utils/ai';
import { sendEmail } from '@/lib/server/utils/email';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (a: Date, b: Date) => {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

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

  if (interview.status === 'completed') {
    return NextResponse.json({ interview, message: 'Interview already completed' });
  }

  const allowedEndedReasons = new Set(['manual', 'timeout', 'abandoned']);
  let endedReason: 'manual' | 'timeout' | 'abandoned' = 'manual';

  const endedReasonFromQuery = req.nextUrl.searchParams.get('endedReason');
  if (endedReasonFromQuery && allowedEndedReasons.has(endedReasonFromQuery)) {
    endedReason = endedReasonFromQuery as 'manual' | 'timeout' | 'abandoned';
  } else {
    try {
      const body = await req.json();
      if (body?.endedReason && allowedEndedReasons.has(body.endedReason)) {
        endedReason = body.endedReason;
      }
    } catch {
      // Empty body is expected for keepalive/sendBeacon flows.
    }
  }

  // For timed interviews, run all question analysis only at the end.
  if (interview.interviewMode === 'timed') {
    for (const question of interview.questions) {
      if (!question.userAnswer?.trim()) {
        continue;
      }
      const evaluation = await evaluateAnswer(question.questionText, question.userAnswer);
      question.score = evaluation.score ?? 0;
      question.feedback = evaluation.feedback ?? '';
      question.strengths = evaluation.strengths ?? [];
      question.weaknesses = evaluation.weaknesses ?? [];
      question.improvement = evaluation.improvement ?? '';
    }
  }

  const answeredQuestions = interview.questions.filter((q) => q.userAnswer);
  const totalScore = answeredQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
  const avgScore = answeredQuestions.length > 0 ? totalScore / answeredQuestions.length : 0;
  const now = new Date();
  const previousInterviewDate = user.lastInterviewDate ? new Date(user.lastInterviewDate) : null;

  interview.score = avgScore;
  interview.status = 'completed';
  interview.completedAt = now;
  interview.endedReason = endedReason;
  interview.overallFeedback = {
    strengths: ['Communication'],
    weaknesses: ['Review fundamental topics'],
    improvementPlan: 'Keep practicing daily.',
  };

  if (!previousInterviewDate) {
    user.streakCount = 1;
  } else {
    const daysSinceLast = diffDays(now, previousInterviewDate);
    if (daysSinceLast === 1) {
      user.streakCount += 1;
    } else if (daysSinceLast > 1) {
      user.streakCount = 1;
    }
  }

  user.longestStreak = Math.max(user.longestStreak || 0, user.streakCount || 0);
  user.lastInterviewDate = now;

  const xpGain = Math.max(10, Math.round(avgScore * 10) + answeredQuestions.length * 5);
  user.xp = (user.xp || 0) + xpGain;
  user.level = Math.max(1, Math.floor(user.xp / 100) + 1);

  const badgeSet = new Set(user.badges || []);
  badgeSet.add('First Steps');
  if (avgScore >= 8) {
    badgeSet.add('Sharp Thinker');
  }
  if ((user.streakCount || 0) >= 3) {
    badgeSet.add('Consistency Champ');
  }
  if ((user.level || 1) >= 5) {
    badgeSet.add('Level Grinder');
  }
  user.badges = Array.from(badgeSet);

  await interview.save();
  await user.save();

  const emailTo = user.settings?.notificationEmail || user.email;
  const shouldSendEmail = Boolean(emailTo) && (user.settings?.notifications ?? true);
  if (shouldSendEmail) {
    const answeredCount = answeredQuestions.length;
    const analysisLines = interview.questions.map((q, index) => {
      const scoreText = Number(q.score || 0).toFixed(1);
      const answerStatus = q.userAnswer?.trim() ? 'Answered' : 'Not answered';
      const feedback = q.feedback?.trim() || 'No feedback available.';
      return `${index + 1}. ${q.questionText}\nStatus: ${answerStatus}\nScore: ${scoreText}/10\nFeedback: ${feedback}`;
    });

    const subject = `InterviewPilot Test Summary - ${interview.role} (${Number(avgScore).toFixed(1)}/10)`;
    const text = [
      `Your interview was ${endedReason === 'manual' ? 'submitted' : `ended (${endedReason})`}.`,
      `Role: ${interview.role}`,
      `Experience: ${interview.experienceLevel}`,
      `Industry: ${interview.industryMode}`,
      `Mode: ${interview.interviewMode}`,
      `Attempted Questions: ${answeredCount}/${interview.questions.length}`,
      `Final Score: ${Number(avgScore).toFixed(1)}/10`,
      '',
      'Per-question analysis:',
      ...analysisLines,
    ].join('\n');

    try {
      await sendEmail({ to: emailTo, subject, text });
    } catch (emailError) {
      console.error('Failed to send interview summary email', emailError);
    }
  }

  return NextResponse.json({
    interview,
    gamification: {
      xpGain,
      streakCount: user.streakCount,
      longestStreak: user.longestStreak,
      level: user.level,
      xp: user.xp,
      badges: user.badges,
    },
  });
}
