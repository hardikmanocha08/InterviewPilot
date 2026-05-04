'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [cameraHealth, setCameraHealth] = useState({
    brightness: 0,
    variance: 0,
    status: 'Starting camera',
  });
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceAnalysisRef = useRef<{
    lastVolume: number;
    silenceDuration: number;
  }>({ lastVolume: 0, silenceDuration: 0 });
  const violationReportedRef = useRef(false);
  const onViolationRef = useRef(onViolation);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const reportViolation = useCallback((reason: string) => {
    if (violationReportedRef.current) {
      return;
    }

    violationReportedRef.current = true;
    setCameraHealth((current) => ({ ...current, status: reason }));
    onViolationRef.current?.(reason);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          stream.getVideoTracks().forEach((track) => {
            track.onended = () => {
              reportViolation('Camera feed stopped.');
            };
            track.onmute = () => {
              reportViolation('Camera feed was muted or blocked.');
            };
          });
          await videoRef.current.play();
          setHasPermission(true);
        }
      } catch (err) {
        console.error('Camera permission denied:', err);
        setHasPermission(false);
        reportViolation('Camera permission failed or camera is unavailable.');
      }
    };

    initCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isEnabled, reportViolation]);

  useEffect(() => {
    if (!isRecording || !hasPermission) return;

    // Simulated behavioral analysis (in production, use ML model like TensorFlow.js)
    analysisIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !violationReportedRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video.videoWidth || !video.videoHeight || video.paused || video.ended) {
          reportViolation('Camera feed is not active.');
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let brightness = 0;
          let brightnessSquared = 0;
          const sampleStep = Math.max(4, Math.floor(frame.length / 12000));
          let samples = 0;

          for (let i = 0; i < frame.length; i += sampleStep * 4) {
            const value = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
            brightness += value;
            brightnessSquared += value * value;
            samples += 1;
          }

          const averageBrightness = brightness / Math.max(1, samples);
          const variance = brightnessSquared / Math.max(1, samples) - averageBrightness * averageBrightness;
          setCameraHealth({
            brightness: Math.round(averageBrightness),
            variance: Math.round(variance),
            status: 'Camera active',
          });

          if (averageBrightness < 55 || averageBrightness > 245 || variance < 12) {
            reportViolation('Camera view appears blocked, blank, or overexposed.');
            return;
          }

          const FaceDetectorCtor = (window as any).FaceDetector;
          if (FaceDetectorCtor) {
            try {
              const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
              const faces = await detector.detect(canvas);
              if (!faces.length) {
                reportViolation('No face detected in camera.');
                return;
              }
            } catch {
              // Basic frame checks above still catch blocked, blank, and odd camera states.
            }
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
  }, [isRecording, hasPermission, onMetricsUpdate, reportViolation]);

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
          <span>{cameraHealth.status}</span>
        </div>
        <span className="text-xs font-semibold text-primary">
          B{cameraHealth.brightness} V{cameraHealth.variance}
        </span>
      </div>
    </div>
  );
}
