'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import CodeEditor from '@/app/components/CodeEditor';
import Whiteboard from '@/app/components/Whiteboard';
import { FiMic, FiMicOff, FiPhoneOff, FiRefreshCw, FiSend } from 'react-icons/fi';

interface PeerInterviewRoomProps {
  sessionId: string;
  peerRole: 'interviewer' | 'interviewee';
  onFinish: () => void;
}

interface PeerSessionState {
  status?: 'waiting' | 'active' | 'completed';
  currentQuestion?: string;
  currentAnswer?: string;
  codeText?: string;
  whiteboardElements?: string;
  candidateMicActive?: boolean;
  interviewerMicActive?: boolean;
  candidateMicLevel?: number;
  interviewerMicLevel?: number;
  rtcOffer?: string;
  rtcAnswer?: string;
  candidateIceCandidates?: string[];
  interviewerIceCandidates?: string[];
}

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export default function PeerInterviewRoom({ sessionId, peerRole, onFinish }: PeerInterviewRoomProps) {
  const [session, setSession] = useState<PeerSessionState>({});
  const [effectiveRole, setEffectiveRole] = useState(peerRole);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [codeText, setCodeText] = useState('');
  const [whiteboardMode, setWhiteboardMode] = useState(false);
  const [whiteboardElements, setWhiteboardElements] = useState<any[]>([]);
  const lastSyncedWhiteboardHashRef = useRef('');
  const pendingWhiteboardRef = useRef<any[] | null>(null);
  const whiteboardFlushingRef = useRef(false);
  const fetchingStateRef = useRef(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState('');
  const [codeRunning, setCodeRunning] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localMicLevel, setLocalMicLevel] = useState(0);
  const [remoteMicLevel, setRemoteMicLevel] = useState(0);
  const [remotePlaybackReady, setRemotePlaybackReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const handledRemoteCandidatesRef = useRef(new Set<string>());
  const hasSetRemoteAnswerRef = useRef(false);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteGainRef = useRef<GainNode | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localMeterFrameRef = useRef<number | null>(null);
  const remoteMeterFrameRef = useRef<number | null>(null);
  const lastMicLevelPatchRef = useRef(0);
  const pyodideRef = useRef<any>(null);
  const pyodideLoadingRef = useRef(false);

  const patchSession = useCallback(async (payload: Record<string, unknown>) => {
    const res = await api.patch(`/peer-sessions/${sessionId}/state`, payload);
    setSession(res.data.session || {});
    return res.data.session as PeerSessionState;
  }, [sessionId]);

  const flushWhiteboard = useCallback(async () => {
    const pending = pendingWhiteboardRef.current;
    if (!pending) {
      whiteboardFlushingRef.current = false;
      return;
    }
    pendingWhiteboardRef.current = null;
    const serialized = JSON.stringify(pending);
    try {
      await patchSession({ whiteboardElements: serialized });
      lastSyncedWhiteboardHashRef.current = serialized;
    } catch {
      pendingWhiteboardRef.current = pending;
    }
    whiteboardFlushingRef.current = false;
    if (pendingWhiteboardRef.current) {
      whiteboardFlushingRef.current = true;
      void flushWhiteboard();
    }
  }, [patchSession]);

  const syncWhiteboard = useCallback((els: any[]) => {
    pendingWhiteboardRef.current = els;
    if (!whiteboardFlushingRef.current) {
      whiteboardFlushingRef.current = true;
      void flushWhiteboard();
    }
  }, [flushWhiteboard]);

  const handleRunCode = async (code: string, language: string) => {
    setCodeRunning(true);
    setCodeOutput('');
    try {
      const res = await api.post('/code/execute', { code, language });
      if (res.data.error) {
        setCodeOutput(res.data.error);
      } else if (res.data.clientSide) {
        const result = await executeClientSide(code, language);
        setCodeOutput(result);
      } else if (res.data.output) {
        setCodeOutput(res.data.output);
      } else {
        setCodeOutput('No output');
      }
    } catch (err: any) {
      setCodeOutput(err.response?.data?.error || err.response?.data?.message || 'Execution failed');
    } finally {
      setCodeRunning(false);
    }
  };

  const executeClientSide = async (code: string, language: string): Promise<string> => {
    if (language === 'javascript' || language === 'typescript') {
      return executeJS(code);
    }
    if (language === 'python') {
      return executePython(code);
    }
    return `${language} execution requires a server-side runtime. Use a local compiler or an online IDE.`;
  };

  const executeJS = (code: string): Promise<string> => new Promise((resolve) => {
    const outputs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const capture = (method: string, orig: typeof console.log) => (...args: any[]) => {
      outputs.push(`[${method}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')}`);
      orig(...args);
    };

    console.log = capture('log', originalLog);
    console.error = capture('error', originalError);
    console.warn = capture('warn', originalWarn);

    const timeout = setTimeout(() => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      resolve('Execution timed out (10s limit). Possible infinite loop?');
    }, 10000);

    try {
      const wrappedCode = `(function() { "use strict"; try { ${code} } catch(e) { console.error(e.message); } })();`;
      const fn = new Function(wrappedCode);
      const result = fn();
      clearTimeout(timeout);

      if (result !== undefined) {
        outputs.push(`[return] ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
      }

      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      resolve(outputs.length ? outputs.join('\n') : 'No output (no console.log calls)');
    } catch (err: any) {
      clearTimeout(timeout);
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      resolve(`Runtime error: ${err.message || String(err)}`);
    }
  });

  const executePython = async (code: string): Promise<string> => {
    try {
      if (!pyodideRef.current && !pyodideLoadingRef.current) {
        pyodideLoadingRef.current = true;
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide script'));
          document.head.appendChild(script);
        });
        const loadPyodide = (globalThis as any).loadPyodide;
        if (!loadPyodide) throw new Error('loadPyodide not found after script load');
        pyodideRef.current = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/' });
        pyodideLoadingRef.current = false;
      }

      const pyodide = pyodideRef.current;
      if (!pyodide) {
        return 'Failed to load Python runtime. Check your internet connection and try again.';
      }

      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      const timeout = setTimeout(() => {
        pyodide.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
      }, 10000);

      try {
        pyodide.runPython(code);
        clearTimeout(timeout);
        const stdout = pyodide.runPython('sys.stdout.getvalue()');
        const stderr = pyodide.runPython('sys.stderr.getvalue()');
        const combined = [stdout, stderr].filter(Boolean).join('\n');
        return combined || 'No output (no print statements)';
      } catch (err: any) {
        clearTimeout(timeout);
        const stderr = pyodide.runPython('sys.stderr.getvalue()');
        return stderr || `Python error: ${err.message || String(err)}`;
      }
    } catch (err: any) {
      pyodideLoadingRef.current = false;
      return `Python runtime error: ${err.message || 'Failed to load Pyodide. Check your internet connection.'}`;
    }
  };

  const calculateLevel = (analyser: AnalyserNode, data: Uint8Array<ArrayBuffer>) => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.min(100, Math.round(Math.sqrt(sum / data.length) * 180));
  };

  const stopLocalMeter = useCallback(() => {
    if (localMeterFrameRef.current !== null) {
      cancelAnimationFrame(localMeterFrameRef.current);
      localMeterFrameRef.current = null;
    }
    void localAudioContextRef.current?.close();
    localAudioContextRef.current = null;
    setLocalMicLevel(0);
  }, []);

  const startLocalMeter = useCallback((stream: MediaStream) => {
    stopLocalMeter();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    void audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    localAudioContextRef.current = audioContext;
    const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));

    const tick = () => {
      const level = calculateLevel(analyser, data);
      setLocalMicLevel(level);
      const now = Date.now();
      if (now - lastMicLevelPatchRef.current > 500) {
        lastMicLevelPatchRef.current = now;
        void patchSession({ micLevel: level });
      }
      localMeterFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [patchSession, stopLocalMeter]);

  const stopRemoteMeter = useCallback(() => {
    if (remoteMeterFrameRef.current !== null) {
      cancelAnimationFrame(remoteMeterFrameRef.current);
      remoteMeterFrameRef.current = null;
    }
    void remoteAudioContextRef.current?.close();
    remoteAudioContextRef.current = null;
    setRemoteMicLevel(0);
  }, []);

  const startRemoteMeter = useCallback((stream: MediaStream) => {
    stopRemoteMeter();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    void audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    remoteAudioContextRef.current = audioContext;
    const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));

    const tick = () => {
      setRemoteMicLevel(calculateLevel(analyser, data));
      remoteMeterFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [stopRemoteMeter]);

  const stopRemotePlayback = useCallback(() => {
    remotePlaybackSourceRef.current?.disconnect();
    remoteGainRef.current?.disconnect();
    remotePlaybackSourceRef.current = null;
    remoteGainRef.current = null;
    setRemotePlaybackReady(false);
  }, []);

  const startRemotePlayback = useCallback((stream: MediaStream) => {
    stopRemotePlayback();

    let audioContext = remotePlaybackContextRef.current;
    if (!audioContext || audioContext.state === 'closed') {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextCtor();
      remotePlaybackContextRef.current = audioContext;
    }

    void audioContext.resume().then(() => {
      const source = audioContext.createMediaStreamSource(stream);
      const gain = audioContext.createGain();
      gain.gain.value = 2;
      source.connect(gain).connect(audioContext.destination);

      remotePlaybackSourceRef.current = source;
      remoteGainRef.current = gain;
      setRemotePlaybackReady(true);
    }).catch(() => {});
  }, [stopRemotePlayback]);

  const ensurePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void patchSession({ iceCandidate: JSON.stringify(event.candidate.toJSON()) });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreamRef.current = remoteStream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.volume = 1;
        const playPromise = remoteAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
      startRemoteMeter(remoteStream);
      startRemotePlayback(remoteStream);
    };

    return pc;
  }, [patchSession, startRemoteMeter, startRemotePlayback]);

  const createOffer = useCallback(async () => {
    const pc = ensurePeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await patchSession({ rtcOffer: JSON.stringify(offer) });
  }, [ensurePeerConnection, patchSession]);

  const answerOffer = useCallback(async (offerText: string) => {
    const pc = ensurePeerConnection();
    if (pc.signalingState !== 'stable') {
      return;
    }
    const offer = JSON.parse(offerText) as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(offer);
    const rtcAnswer = await pc.createAnswer();
    await pc.setLocalDescription(rtcAnswer);
    await patchSession({ rtcAnswer: JSON.stringify(rtcAnswer) });
  }, [ensurePeerConnection, patchSession]);

  const startMic = useCallback(async () => {
    try {
      setMicError(null);

      const stream = localStreamRef.current;

      if (stream && stream.getAudioTracks().length > 0) {
        stream.getAudioTracks().forEach(track => { track.enabled = true; });
        startLocalMeter(stream);
        setMicActive(true);
        await patchSession({ micActive: true });
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      localStreamRef.current = newStream;
      startLocalMeter(newStream);

      const pc = ensurePeerConnection();
      pc.addTrack(newStream.getAudioTracks()[0], newStream);

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!remotePlaybackContextRef.current || remotePlaybackContextRef.current.state === 'closed') {
        const ctx = new AudioContextCtor();
        const silent = ctx.createOscillator();
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        silent.connect(silentGain).connect(ctx.destination);
        silent.start();
        remotePlaybackContextRef.current = ctx;
      }
      void remotePlaybackContextRef.current.resume();

      if (pc.connectionState === 'new') {
        if (effectiveRole === 'interviewer') {
          await createOffer();
        } else if (session.rtcOffer) {
          await answerOffer(session.rtcOffer);
        }
      }

      setMicActive(true);
      await patchSession({ micActive: true });
    } catch (error) {
      setMicError('Microphone permission failed. Check browser permissions and try again.');
    }
  }, [answerOffer, createOffer, effectiveRole, patchSession, session.rtcOffer, startLocalMeter, ensurePeerConnection]);

  const stopMic = useCallback(async () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(track => { track.enabled = false; });
    }
    stopLocalMeter();
    setMicActive(false);
    await patchSession({ micActive: false, micLevel: 0 });
  }, [patchSession, stopLocalMeter]);

  useEffect(() => {
    const fetchState = async () => {
      if (fetchingStateRef.current) return;
      fetchingStateRef.current = true;
      try {
        const res = await api.get(`/peer-sessions/${sessionId}/state`);
        const nextSession = res.data.session || {};
        setSession(nextSession);
        if (nextSession.status === 'completed') {
          onFinish();
          return;
        }
        if (res.data.peerRole) {
          setEffectiveRole(res.data.peerRole);
        }

        if ((res.data.peerRole || effectiveRole) === 'interviewer') {
          setAnswer(nextSession.currentAnswer || '');
          setCodeText(nextSession.codeText || '');
        } else {
          setQuestion(nextSession.currentQuestion || '');
        }

        if (nextSession.whiteboardElements) {
          try {
            const parsed = JSON.parse(nextSession.whiteboardElements);
            if (Array.isArray(parsed)) {
              const hash = JSON.stringify(parsed);
              if (hash !== lastSyncedWhiteboardHashRef.current) {
                lastSyncedWhiteboardHashRef.current = hash;
                setWhiteboardElements(parsed);
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      } finally {
        fetchingStateRef.current = false;
      }
    };

    void fetchState();
    const interval = setInterval(fetchState, 50);
    return () => {
      clearInterval(interval);
      whiteboardFlushingRef.current = false;
      if (pendingWhiteboardRef.current) {
        void flushWhiteboard();
      }
    };
  }, [effectiveRole, onFinish, sessionId, flushWhiteboard]);

  useEffect(() => {
    if (!micActive) {
      return;
    }

    const syncRtc = async () => {
      const pc = ensurePeerConnection();

      if (effectiveRole === 'interviewee' && session.rtcOffer && !pc.currentRemoteDescription) {
        await answerOffer(session.rtcOffer);
      }

      if (effectiveRole === 'interviewer' && session.rtcAnswer && !hasSetRemoteAnswerRef.current) {
        await pc.setRemoteDescription(JSON.parse(session.rtcAnswer) as RTCSessionDescriptionInit);
        hasSetRemoteAnswerRef.current = true;
      }

      const remoteCandidates = effectiveRole === 'interviewer'
        ? session.candidateIceCandidates || []
        : session.interviewerIceCandidates || [];

      for (const candidateText of remoteCandidates) {
        if (handledRemoteCandidatesRef.current.has(candidateText)) {
          continue;
        }
        if (!pc.currentRemoteDescription) {
          continue;
        }
        await pc.addIceCandidate(JSON.parse(candidateText) as RTCIceCandidateInit);
        handledRemoteCandidatesRef.current.add(candidateText);
      }
    };

    void syncRtc().catch(() => {});
  }, [answerOffer, ensurePeerConnection, effectiveRole, micActive, session]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
      stopLocalMeter();
      stopRemoteMeter();
      stopRemotePlayback();
    };
  }, [stopLocalMeter, stopRemoteMeter, stopRemotePlayback]);

  const saveQuestion = async () => {
    setSaving(true);
    try {
      await patchSession({ currentQuestion: question });
      setQuestion('');
    } finally {
      setSaving(false);
    }
  };

  const saveAnswer = async () => {
    setSaving(true);
    try {
      await patchSession({ currentAnswer: answer, codeText });
      setAnswer('');
      setCodeText('');
    } finally {
      setSaving(false);
    }
  };

  const playRemoteAudio = () => {
    if (remoteStreamRef.current) {
      startRemotePlayback(remoteStreamRef.current);
    }
    void remotePlaybackContextRef.current?.resume().then(() => {
      setRemotePlaybackReady(true);
    });
  };

  const interviewerMicActive = Boolean(session.interviewerMicActive);
  const intervieweeMicActive = Boolean(session.candidateMicActive);
  const interviewerLevel = effectiveRole === 'interviewer'
    ? localMicLevel
    : session.interviewerMicLevel || 0;
  const intervieweeLevel = effectiveRole === 'interviewee'
    ? localMicLevel
    : session.candidateMicLevel || 0;

  const MicLevel = ({ label, level, active }: { label: string; level: number; active: boolean }) => (
    <div className="min-w-32">
      <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
        <span>{label}</span>
        <span>{active ? `${level}%` : 'off'}</span>
      </div>
      <div className="h-1.5 bg-background border border-border rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${level > 4 ? 'bg-green-400' : 'bg-border'}`}
          style={{ width: `${Math.max(active ? 4 : 0, level)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'fixed', left: 0, top: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />

      <div className="border-b border-border bg-surface px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-primary font-semibold">Peer Interview</p>
          <h1 className="text-white font-bold capitalize">{effectiveRole}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded border ${interviewerMicActive ? 'text-green-300 border-green-500/30 bg-green-500/10' : 'text-text-muted border-border'}`}>
            Interviewer mic
          </span>
          <span className={`text-xs px-2 py-1 rounded border ${intervieweeMicActive ? 'text-green-300 border-green-500/30 bg-green-500/10' : 'text-text-muted border-border'}`}>
            Interviewee mic
          </span>
          <span className="hidden sm:inline text-xs px-2 py-1 rounded border border-border text-text-muted">
            Audio: {connectionState}
          </span>
          {!remotePlaybackReady && remoteStreamRef.current && (
            <button
              onClick={playRemoteAudio}
              className="text-xs px-3 py-1.5 rounded border border-primary text-primary hover:bg-primary/10 animate-pulse"
            >
              Click to enable audio
            </button>
          )}
          <span className={`hidden sm:inline text-xs px-2 py-1 rounded border ${remotePlaybackReady ? 'border-green-500/30 text-green-300 bg-green-500/10' : 'border-border text-text-muted'}`}>
            Audio {remotePlaybackReady ? 'on' : 'off'}
          </span>
          <div className="hidden md:flex items-center gap-3">
            <MicLevel label="Interviewer" level={interviewerLevel} active={interviewerMicActive} />
            <MicLevel label="Interviewee" level={intervieweeLevel} active={intervieweeMicActive} />
            <MicLevel label="Remote in" level={remoteMicLevel} active={remoteMicLevel > 0} />
          </div>
          <button
            onClick={micActive ? stopMic : startMic}
            className={`p-3 rounded-lg text-white ${micActive ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'}`}
            title={micActive ? 'Mute microphone' : 'Start microphone'}
          >
            {micActive ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
          </button>
          <button
            onClick={onFinish}
            className="p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white"
            title="End interview"
          >
            <FiPhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {micError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-200 px-4 sm:px-6 py-2 text-sm">
          {micError}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        <section className="border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-6 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Question</label>
              {effectiveRole === 'interviewer' && (
                <button
                  onClick={saveQuestion}
                  disabled={saving || !question.trim()}
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <FiSend className="w-4 h-4" />
                  <span>Send</span>
                </button>
              )}
            </div>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              readOnly={effectiveRole !== 'interviewer'}
              placeholder={effectiveRole === 'interviewer' ? 'Type the question for the interviewee...' : 'Waiting for the interviewer question...'}
              className="w-full min-h-[180px] bg-surface border border-border rounded-lg p-4 text-white resize-y focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Interviewee Response</label>
              {effectiveRole === 'interviewee' && (
                <button
                  onClick={saveAnswer}
                  disabled={saving || (!answer.trim() && !codeText.trim())}
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  <span>Update</span>
                </button>
              )}
            </div>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              readOnly={effectiveRole !== 'interviewee'}
              placeholder={effectiveRole === 'interviewee' ? 'Respond to the interviewer...' : 'Waiting for the interviewee response...'}
              className="w-full min-h-[220px] bg-surface border border-border rounded-lg p-4 text-white resize-y focus:outline-none focus:border-primary"
            />
          </div>
        </section>

        <section className="p-4 sm:p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-white">
                {whiteboardMode ? 'Whiteboard' : 'Coding Space'}
              </label>
              <button
                onClick={() => setWhiteboardMode(!whiteboardMode)}
                className="p-1.5 rounded bg-surface border border-border hover:border-primary text-text-muted hover:text-white transition-colors"
                title={whiteboardMode ? 'Switch to code editor' : 'Switch to whiteboard'}
              >
                {whiteboardMode ? <span className="text-sm">{`</>`}</span> : <span className="text-sm">📐</span>}
              </button>
            </div>
            {!whiteboardMode && effectiveRole === 'interviewee' && (
              <button
                onClick={saveAnswer}
                disabled={saving}
                className="bg-surface border border-border hover:border-primary text-white px-3 py-2 rounded-lg text-sm"
              >
                Save code
              </button>
            )}
          </div>

          {whiteboardMode ? (
            <div className="flex-1 rounded-lg overflow-hidden border border-border">
              <Whiteboard
                elements={whiteboardElements}
                onChange={syncWhiteboard}
                readOnly={false}
              />
            </div>
          ) : (
            <div className="flex-1 rounded-lg overflow-hidden border border-border">
              <CodeEditor
                value={codeText}
                onChange={setCodeText}
                language={codeLanguage}
                onLanguageChange={setCodeLanguage}
                readOnly={effectiveRole !== 'interviewee'}
                onRun={effectiveRole === 'interviewee' ? handleRunCode : undefined}
                running={codeRunning}
                output={codeOutput}
                placeholder={effectiveRole === 'interviewee' ? 'Write code here...' : 'The interviewee code appears here.'}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
