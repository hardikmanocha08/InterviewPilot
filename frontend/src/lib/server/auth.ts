import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import User, { IUser } from '@/lib/server/models/User';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

type AuthSuccess = { user: IUser; error?: never };
type AuthFailure = { user?: never; error: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

export const authenticate = async (req: NextRequest): Promise<AuthResult> => {
  const authHeader = req.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const cookieToken = req.cookies.get('token')?.value;
    if (cookieToken) {
      token = cookieToken;
    }
  }

  if (!token) {
    return {
      error: NextResponse.json({ message: 'Not authorized, missing token' }, { status: 401 }),
    };
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string };
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return {
        error: NextResponse.json({ message: 'User not found' }, { status: 404 }),
      };
    }

    return { user };
  } catch (error) {
    console.error('Token verification failed', error);
    return {
      error: NextResponse.json({ message: 'Not authorized, token failed' }, { status: 401 }),
    };
  }
};
