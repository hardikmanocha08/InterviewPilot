'use client';

import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiEye, FiZap, FiSmile } from 'react-icons/fi';

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

interface CurrentBehavioralState {
  eyeContact: number;
  confidence: number;
  emotion: BehavioralMetric['emotionState'];
  pace: BehavioralMetric['speakingPace'];
}

export default function BehavioralAnalysisOverlay({
  isEnabled,
  onMetricsUpdate,
  isRecording,
  onViolation,
}: BehavioralAnalysisProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [metrics, setMetrics] = useState<BehavioralMetric[]>([]);
  const [currentState, setCurrentState] = useState<CurrentBehavioralState>({
    eyeContact: 0,
    confidence: 0,
    emotion: 'neutral',
    pace: 'normal',
  });
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceAnalysisRef = useRef<{
    lastVolume: number;
    silenceDuration: number;
  }>({ lastVolume: 0, silenceDuration: 0 });
  const violationReportedRef = useRef(false);

  useEffect(() => {
    if (!isEnabled) return;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error('Camera permission denied:', err);
        setHasPermission(false);
      }
    };

    initCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isEnabled]);

  useEffect(() => {
    if (!isRecording || !hasPermission) return;

    // Simulated behavioral analysis (in production, use ML model like TensorFlow.js)
    analysisIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !violationReportedRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video.videoWidth || !video.videoHeight || video.paused || video.ended) {
          violationReportedRef.current = true;
          onViolation?.('Camera feed is not active.');
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const FaceDetectorCtor = (window as any).FaceDetector;
          if (FaceDetectorCtor) {
            try {
              const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
              const faces = await detector.detect(canvas);
              if (!faces.length) {
                violationReportedRef.current = true;
                onViolation?.('No face detected in camera.');
                return;
              }
            } catch {
              // Fall back to basic frame checks below when FaceDetector is unavailable or fails.
            }
          }

          const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let brightness = 0;
          const sampleStep = Math.max(4, Math.floor(frame.length / 12000));
          let samples = 0;

          for (let i = 0; i < frame.length; i += sampleStep * 4) {
            brightness += (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
            samples += 1;
          }

          const averageBrightness = brightness / Math.max(1, samples);
          if (averageBrightness < 18 || averageBrightness > 245) {
            violationReportedRef.current = true;
            onViolation?.('Camera view appears blocked, blank, or overexposed.');
            return;
          }
        }
      }

      // Simulate metrics - in real implementation, analyze video frames
      const simulatedEyeContact = Math.random() * 100;
      const simulatedConfidence = Math.random() * 100;
      const emotions = ['neutral', 'positive', 'nervous', 'stressed'] as const;
      const emotion = emotions[Math.floor(Math.random() * emotions.length)];
      const paces = ['slow', 'normal', 'fast'] as const;
      const pace = paces[Math.floor(Math.random() * paces.length)];

      const newMetric: BehavioralMetric = {
        timestamp: new Date(),
        eyeContact: Math.round(simulatedEyeContact),
        confidence: Math.round(simulatedConfidence),
        speakingPace: pace,
        emotionState: emotion,
      };

      setMetrics(prev => {
        const updated = [...prev, newMetric];
        onMetricsUpdate(updated);
        return updated;
      });

      setCurrentState({
        eyeContact: Math.round(simulatedEyeContact),
        confidence: Math.round(simulatedConfidence),
        emotion,
        pace,
      });
    }, 1000); // Proctor continuously while recording.

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isRecording, hasPermission, onMetricsUpdate, onViolation]);

  if (!isEnabled || !hasPermission) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-surface border border-border rounded-lg overflow-hidden shadow-xl max-w-xs">
      {/* Webcam Feed */}
      <div className="relative w-64 h-48 bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Metrics Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
          <div className="space-y-2 text-xs text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <FiEye className="w-3 h-3" />
                <span>Eye Contact:</span>
              </div>
              <span className="font-semibold">{currentState.eyeContact}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <FiZap className="w-3 h-3" />
                <span>Confidence:</span>
              </div>
              <span className="font-semibold">{currentState.confidence}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <FiSmile className="w-3 h-3" />
                <span>Emotion:</span>
              </div>
              <span className="font-semibold capitalize">{currentState.emotion}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pace:</span>
              <span className="font-semibold capitalize">{currentState.pace}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-surface border-t border-border flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-text-muted">
          <FiCamera className="w-3 h-3 text-primary animate-pulse" />
          <span>Live Analysis</span>
        </div>
        <span className="text-xs font-semibold text-primary">{metrics.length} frames</span>
      </div>
    </div>
  );
}
