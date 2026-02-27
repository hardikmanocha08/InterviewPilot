import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import connectDB from '@/lib/server/db';
import Interview from '@/lib/server/models/Interview';

export async function GET(
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

  return NextResponse.json(interview);
}
