'use client';

interface BehavioralMetric {
  timestamp: Date;
  eyeContact: number;
  confidence: number;
  speakingPace: 'slow' | 'normal' | 'fast';
  emotionState: 'neutral' | 'positive' | 'nervous' | 'stressed';
}

interface BehavioralAnalysisProps {
  isEnabled: boolean;
  onMetricsUpdate: (metrics: BehavioralMetric[]) => void;
  isRecording: boolean;
  onViolation?: (reason: string) => void;
}

// Webcam/proctoring overlay removed.
// Keep the component to avoid changing imports, but render nothing.
export default function BehavioralAnalysisOverlay({
  isEnabled,
}: BehavioralAnalysisProps) {
  // If proctoring is enabled, the previous implementation would start webcam capture.
  // This version intentionally does nothing.
  if (!isEnabled) return null;
  return null;
}

