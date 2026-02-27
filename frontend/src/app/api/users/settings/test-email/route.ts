import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import { sendEmail } from '@/lib/server/utils/email';

export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  const body = await req.json().catch(() => ({}));
  const requestedEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const to = requestedEmail || user.settings?.notificationEmail || user.email;

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ message: 'Please provide a valid email address.' }, { status: 400 });
  }

  try {
    await sendEmail({
      to,
      subject: 'InterviewPilot notifications test',
      text: `This is a test notification from InterviewPilot sent at ${new Date().toLocaleString()}.`,
    });
    return NextResponse.json({ message: `Test email sent to ${to}.` });
  } catch (err) {
    console.error('Test email failed', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to send test email.' },
      { status: 500 }
    );
  }
}
