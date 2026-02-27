import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import User from '@/lib/server/models/User';
import generateToken from '@/lib/server/utils/generateToken';

export async function POST(req: NextRequest) {
  await connectDB();

  const { name, email, password, role, experienceLevel, industryMode } = await req.json();

  if (!name || !email || !password || !role || !experienceLevel) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return NextResponse.json({ message: 'User already exists' }, { status: 400 });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      experienceLevel,
      industryMode: industryMode || 'Product company',
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
