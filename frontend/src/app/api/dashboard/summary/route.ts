import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import Interview from '@/lib/server/models/Interview';

const getLevelProgress = (xp: number, level: number) => {
  const currentLevelBase = (level - 1) * 100;
  const currentLevelXp = Math.max(0, xp - currentLevelBase);
  const xpForNext = 100;
  return {
    currentLevelXp,
    xpForNext,
    progressPercent: Math.min(100, Math.round((currentLevelXp / xpForNext) * 100)),
  };
};

export async function GET(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const completed = await Interview.find({ user: user._id, status: 'completed' })
    .sort({ updatedAt: -1 })
    .lean();

  const totalInterviews = completed.length;
  const averageScore =
    totalInterviews > 0
      ? completed.reduce((sum, interview) => sum + (interview.score || 0), 0) / totalInterviews
      : 0;

  const recentInterviews = completed.slice(0, 5);
  const strongest = [...completed].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const weakest = [...completed].sort((a, b) => (a.score || 0) - (b.score || 0))[0];
  const levelProgress = getLevelProgress(user.xp || 0, user.level || 1);

  return NextResponse.json({
    user: {
      _id: user._id,
      name: user.name,
      role: user.role,
      experienceLevel: user.experienceLevel,
      industryMode: user.industryMode,
      streakCount: user.streakCount,
      longestStreak: user.longestStreak,
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      levelProgress,
    },
    stats: {
      totalInterviews,
      averageScore: Number(averageScore.toFixed(2)),
      strongestRole: strongest?.role || 'N/A',
      weakestRole: weakest?.role || 'N/A',
    },
    recentInterviews,
  });
}
