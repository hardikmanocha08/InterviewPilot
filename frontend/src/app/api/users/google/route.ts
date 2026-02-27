import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import User from '@/lib/server/models/User';
import generateToken from '@/lib/server/utils/generateToken';

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: 'true' | 'false';
  name?: string;
};

export async function POST(req: NextRequest) {
  await connectDB();

  const { idToken } = await req.json();

  if (!idToken) {
    return NextResponse.json({ message: 'Google token is required' }, { status: 400 });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return NextResponse.json({ message: 'Google auth is not configured' }, { status: 500 });
  }

  try {
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!tokenInfoResponse.ok) {
      return NextResponse.json({ message: 'Invalid Google token' }, { status: 401 });
    }

    const tokenInfo: GoogleTokenInfo = await tokenInfoResponse.json();

    if (tokenInfo.aud !== googleClientId) {
      return NextResponse.json({ message: 'Google token audience mismatch' }, { status: 401 });
    }

    if (!tokenInfo.email || tokenInfo.email_verified !== 'true') {
      return NextResponse.json({ message: 'Google email is not verified' }, { status: 401 });
    }

    let user = await User.findOne({ email: tokenInfo.email });

    if (!user) {
      user = await User.create({
        name: tokenInfo.name || tokenInfo.email.split('@')[0],
        email: tokenInfo.email,
        password: `${crypto.randomUUID()}-${crypto.randomUUID()}`,
        role: 'Frontend',
        experienceLevel: 'Fresher',
        industryMode: 'Product company',
      });
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
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      settings: user.settings,
      token: generateToken(user._id.toString()),
    });
  } catch (error) {
    console.error('Google login error', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
