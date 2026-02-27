import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import User from '@/lib/server/models/User';
import generateToken from '@/lib/server/utils/generateToken';

export async function POST(req: NextRequest) {
  await connectDB();

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      return NextResponse.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        experienceLevel: user.experienceLevel,
        industryMode: user.industryMode,
        streakCount: user.streakCount,
        longestStreak: user.longestStreak,
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        settings: user.settings,
        token: generateToken(user._id.toString()),
      });
    }

    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
