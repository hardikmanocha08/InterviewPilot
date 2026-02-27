import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import Interview from '@/lib/server/models/Interview';

export async function GET(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  await Interview.updateMany(
    { user: user._id, status: 'in-progress' },
    {
      $set: {
        status: 'completed',
        endedReason: 'abandoned',
        completedAt: new Date(),
      },
    }
  );

  const status = req.nextUrl.searchParams.get('status');
  const limit = Number(req.nextUrl.searchParams.get('limit') || '50');

  const query: Record<string, unknown> = { user: user._id };
  if (status) {
    query.status = status;
  }

  const interviews = await Interview.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .lean();

  return NextResponse.json(interviews);
}
