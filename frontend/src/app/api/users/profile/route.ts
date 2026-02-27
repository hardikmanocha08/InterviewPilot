import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  return NextResponse.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    experienceLevel: user.experienceLevel,
    industryMode: user.industryMode,
    streakCount: user.streakCount,
    longestStreak: user.longestStreak,
    lastInterviewDate: user.lastInterviewDate,
    xp: user.xp,
    level: user.level,
    badges: user.badges,
    settings: user.settings,
  });
}

export async function PATCH(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const body = await req.json();
  const { role, experienceLevel, industryMode, settings } = body ?? {};

  if (role) {
    user.role = role;
  }
  if (experienceLevel) {
    user.experienceLevel = experienceLevel;
  }
  if (industryMode) {
    user.industryMode = industryMode;
  }
  if (settings && typeof settings === 'object') {
    const safeQuestionCount =
      typeof settings.preferredQuestionCount === 'number'
        ? Math.max(3, Math.min(7, settings.preferredQuestionCount))
        : user.settings?.preferredQuestionCount;

    user.settings = {
      ...user.settings,
      ...settings,
      preferredQuestionCount: safeQuestionCount,
    };
  }

  await user.save();

  return NextResponse.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    experienceLevel: user.experienceLevel,
    industryMode: user.industryMode,
    streakCount: user.streakCount,
    longestStreak: user.longestStreak,
    lastInterviewDate: user.lastInterviewDate,
    xp: user.xp,
    level: user.level,
    badges: user.badges,
    settings: user.settings,
  });
}
