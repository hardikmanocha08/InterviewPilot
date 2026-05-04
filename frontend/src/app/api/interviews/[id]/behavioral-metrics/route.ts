import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import Interview from '@/lib/server/models/Interview';
import { analyzeBehavioralMetrics } from '@/lib/server/utils/ai';

// POST submit behavioral metrics
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    const { metrics } = await req.json();

    const interview = await Interview.findById(id);
    if (!interview || interview.user.toString() !== user._id.toString()) {
      return NextResponse.json({ message: 'Interview not found' }, { status: 404 });
    }

    if (!interview.behavioralAnalysis) {
      interview.behavioralAnalysis = {
        isEnabled: true,
        metrics: [],
        averageEyeContact: 0,
        averageConfidence: 0,
        overallEmotionTrend: 'neutral',
        communicationFeedback: '',
      };
    }

    // Add metrics with timestamps
    const newMetrics = metrics.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));

    interview.behavioralAnalysis.metrics.push(...newMetrics);

    // Analyze if we have accumulated enough metrics
    if (interview.behavioralAnalysis.metrics.length >= 5) {
      const analysis = await analyzeBehavioralMetrics(interview.behavioralAnalysis.metrics);
      interview.behavioralAnalysis.averageEyeContact = analysis.averageEyeContact;
      interview.behavioralAnalysis.averageConfidence = analysis.averageConfidence;
      interview.behavioralAnalysis.overallEmotionTrend = analysis.overallEmotionTrend;
      interview.behavioralAnalysis.communicationFeedback = analysis.communicationFeedback;
    }

    await interview.save();

    return NextResponse.json({
      message: 'Metrics recorded',
      behavioralAnalysis: interview.behavioralAnalysis,
    });
  } catch (err) {
    console.error('Error submitting behavioral metrics:', err);
    return NextResponse.json({ message: 'Failed to submit metrics' }, { status: 500 });
  }
}
