'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
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
  candidateMicActive?: boolean;
  interviewerMicActive?: boolean;
  candidateMicLevel?: number;
  interviewerMicLevel?: number;
  rtcOffer?: string;
  rtcAnswer?: string;
  candidateIceCandidates?: string[];
  interviewerIceCandidates?: string[];
  candidateAudioChunks?: PeerAudioChunk[];
  interviewerAudioChunks?: PeerAudioChunk[];
  candidatePcmPackets?: PeerPcmPacket[];
  interviewerPcmPackets?: PeerPcmPacket[];
}

interface PeerAudioChunk {
  id: string;
  data: string;
  mimeType: string;
  createdAt?: string;
}

interface PeerPcmPacket {
  id: string;
  data: string;
  sampleRate: number;
  createdAt?: string;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function PeerInterviewRoom({ sessionId, peerRole, onFinish }: PeerInterviewRoomProps) {
  const [session, setSession] = useState<PeerSessionState>({});
  const [effectiveRole, setEffectiveRole] = useState(peerRole);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [codeText, setCodeText] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localMicLevel, setLocalMicLevel] = useState(0);
  const [remoteMicLevel, setRemoteMicLevel] = useState(0);
  const [remotePlaybackReady, setRemotePlaybackReady] = useState(false);
  const [relayPlaybackReady, setRelayPlaybackReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const handledRemoteCandidatesRef = useRef(new Set<string>());
  const hasSetRemoteAnswerRef = useRef(false);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackContextRef = useRef<AudioContext | null>(null);
  const relayAudioContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteGainRef = useRef<GainNode | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localMeterFrameRef = useRef<number | null>(null);
  const remoteMeterFrameRef = useRef<number | null>(null);
  const lastMicLevelPatchRef = useRef(0);
  const audioRelayRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRelayRunningRef = useRef(false);
  const audioRelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcmRelayContextRef = useRef<AudioContext | null>(null);
  const pcmRelayProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmRelaySourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmRelaySilentGainRef = useRef<GainNode | null>(null);
  const pcmPacketSendingRef = useRef(false);
  const lastPcmPacketAtRef = useRef(0);
  const playedRelayChunkIdsRef = useRef(new Set<string>());
  const playedPcmPacketIdsRef = useRef(new Set<string>());
  const relayQueueRef = useRef<PeerAudioChunk[]>([]);
  const pcmQueueRef = useRef<PeerPcmPacket[]>([]);
  const relayPlayingRef = useRef(false);
  const pcmPlayingRef = useRef(false);
  const relayNextStartTimeRef = useRef(0);
  const pcmNextStartTimeRef = useRef(0);

  const patchSession = useCallback(async (payload: Record<string, unknown>) => {
    const res = await api.patch(`/peer-sessions/${sessionId}/state`, payload);
    setSession(res.data.session || {});
    return res.data.session as PeerSessionState;
  }, [sessionId]);

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const dataUrlToArrayBuffer = async (dataUrl: string) => {
    const response = await fetch(dataUrl);
    return response.arrayBuffer();
  };

  const floatSamplesToBase64Pcm = (samples: Float32Array) => {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);

    for (let index = 0; index < samples.length; index += 1) {
      const clamped = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    }

    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  };

  const base64PcmToFloatSamples = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const view = new DataView(bytes.buffer);
    const samples = new Float32Array(bytes.length / 2);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 0x8000;
    }
    return samples;
  };

  const ensureRelayAudioContext = useCallback(() => {
    if (relayAudioContextRef.current) {
      void relayAudioContextRef.current.resume();
      return relayAudioContextRef.current;
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    relayAudioContextRef.current = audioContext;
    relayNextStartTimeRef.current = audioContext.currentTime;
    void audioContext.resume().then(() => {
      setRelayPlaybackReady(true);
    });
    return audioContext;
  }, []);

  const playPcmQueue = useCallback(async () => {
    if (pcmPlayingRef.current) {
      return;
    }

    pcmPlayingRef.current = true;
    const audioContext = ensureRelayAudioContext();
    await audioContext.resume();

    while (pcmQueueRef.current.length > 0) {
      const packet = pcmQueueRef.current.shift();
      if (!packet) {
        continue;
      }

      try {
        const samples = base64PcmToFloatSamples(packet.data);
        const audioBuffer = audioContext.createBuffer(1, samples.length, packet.sampleRate);
        audioBuffer.copyToChannel(samples, 0);

        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        gain.gain.value = 20;
        source.buffer = audioBuffer;
        source.connect(gain).connect(audioContext.destination);

        const startAt = Math.max(audioContext.currentTime + 0.03, pcmNextStartTimeRef.current);
        source.start(startAt);
        pcmNextStartTimeRef.current = startAt + audioBuffer.duration;
        setRelayPlaybackReady(true);
      } catch (error) {
        console.error('Failed to play PCM audio packet:', error);
      }
    }

    pcmPlayingRef.current = false;
  }, [ensureRelayAudioContext]);

  const enqueuePcmPackets = useCallback((packets: PeerPcmPacket[] = []) => {
    for (const packet of packets) {
      if (playedPcmPacketIdsRef.current.has(packet.id)) {
        continue;
      }
      playedPcmPacketIdsRef.current.add(packet.id);
      pcmQueueRef.current.push(packet);
    }

    void playPcmQueue();
  }, [playPcmQueue]);

  const playRelayQueue = useCallback(async () => {
    if (relayPlayingRef.current) {
      return;
    }

    relayPlayingRef.current = true;
    const audioContext = ensureRelayAudioContext();

    while (relayQueueRef.current.length > 0) {
      const chunk = relayQueueRef.current.shift();
      if (!chunk) {
        continue;
      }

      try {
        const arrayBuffer = await dataUrlToArrayBuffer(chunk.data);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        gain.gain.value = 20;
        source.buffer = audioBuffer;
        source.connect(gain).connect(audioContext.destination);

        const startAt = Math.max(audioContext.currentTime + 0.05, relayNextStartTimeRef.current);
        source.start(startAt);
        relayNextStartTimeRef.current = startAt + audioBuffer.duration;
      } catch (error) {
        console.error('Failed to play relayed audio chunk:', error);
        setRelayPlaybackReady(false);
      }
    }

    relayPlayingRef.current = false;
  }, [ensureRelayAudioContext]);

  const enqueueRelayChunks = useCallback((chunks: PeerAudioChunk[] = []) => {
    for (const chunk of chunks) {
      if (playedRelayChunkIdsRef.current.has(chunk.id)) {
        continue;
      }
      playedRelayChunkIdsRef.current.add(chunk.id);
      relayQueueRef.current.push(chunk);
    }

    void playRelayQueue();
  }, [playRelayQueue]);

  const startAudioRelay = useCallback((stream: MediaStream) => {
    if (!window.MediaRecorder) {
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    audioRelayRunningRef.current = true;

    const recordClip = () => {
      if (!audioRelayRunningRef.current) {
        return;
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      audioRelayRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
            const data = await blobToDataUrl(blob);
            await patchSession({
              audioChunk: {
                id: `${effectiveRole}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                data,
                mimeType: blob.type || 'audio/webm',
              },
            });
          } catch (error) {
            console.error('Failed to send audio relay clip:', error);
          }
        }

        if (audioRelayRunningRef.current) {
          audioRelayTimerRef.current = setTimeout(recordClip, 25);
        }
      };

      recorder.start();
      audioRelayTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 900);
    };

    recordClip();
  }, [effectiveRole, patchSession]);

  const stopAudioRelay = useCallback(() => {
    audioRelayRunningRef.current = false;
    if (audioRelayTimerRef.current) {
      clearTimeout(audioRelayTimerRef.current);
      audioRelayTimerRef.current = null;
    }
    if (audioRelayRecorderRef.current?.state === 'recording') {
      audioRelayRecorderRef.current.stop();
    }
    audioRelayRecorderRef.current = null;
  }, []);

  const startPcmRelay = useCallback((stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    source.connect(processor);
    processor.connect(silentGain).connect(audioContext.destination);

    pcmRelayContextRef.current = audioContext;
    pcmRelaySourceRef.current = source;
    pcmRelayProcessorRef.current = processor;
    pcmRelaySilentGainRef.current = silentGain;

    void audioContext.resume();

    processor.onaudioprocess = (event) => {
      const now = Date.now();
      if (pcmPacketSendingRef.current || now - lastPcmPacketAtRef.current < 220) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const packetData = floatSamplesToBase64Pcm(input);
      lastPcmPacketAtRef.current = now;
      pcmPacketSendingRef.current = true;

      void patchSession({
        pcmPacket: {
          id: `${effectiveRole}-pcm-${now}-${Math.random().toString(36).slice(2)}`,
          data: packetData,
          sampleRate: audioContext.sampleRate,
        },
      }).finally(() => {
        pcmPacketSendingRef.current = false;
      });
    };
  }, [effectiveRole, patchSession]);

  const stopPcmRelay = useCallback(() => {
    pcmRelayProcessorRef.current?.disconnect();
    pcmRelaySourceRef.current?.disconnect();
    pcmRelaySilentGainRef.current?.disconnect();
    void pcmRelayContextRef.current?.close();
    pcmRelayProcessorRef.current = null;
    pcmRelaySourceRef.current = null;
    pcmRelaySilentGainRef.current = null;
    pcmRelayContextRef.current = null;
    pcmPacketSendingRef.current = false;
  }, []);

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

  const stopRemotePlayback = useCallback(() => {
    remotePlaybackSourceRef.current?.disconnect();
    remoteGainRef.current?.disconnect();
    void remotePlaybackContextRef.current?.close();
    remotePlaybackSourceRef.current = null;
    remoteGainRef.current = null;
    remotePlaybackContextRef.current = null;
    setRemotePlaybackReady(false);
  }, []);

  const startRemotePlayback = useCallback((stream: MediaStream) => {
    stopRemotePlayback();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const gain = audioContext.createGain();
    gain.gain.value = 20;
    source.connect(gain).connect(audioContext.destination);

    remotePlaybackContextRef.current = audioContext;
    remotePlaybackSourceRef.current = source;
    remoteGainRef.current = gain;
    setRemotePlaybackReady(audioContext.state === 'running');
    void audioContext.resume().then(() => {
      setRemotePlaybackReady(true);
    });
  }, [stopRemotePlayback]);

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

  const ensurePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;
    audioSenderRef.current = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void patchSession({ iceCandidate: JSON.stringify(event.candidate.toJSON()) });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;
        startRemoteMeter(remoteStream);
        startRemotePlayback(remoteStream);
        void remoteAudioRef.current.play().catch(() => {
          setMicError('Remote audio is connected, but the browser blocked autoplay. Click the mic button once on this page.');
        });
      }
    };

    return pc;
  }, [patchSession, startRemoteMeter, startRemotePlayback]);

  const addLocalTracks = useCallback((stream: MediaStream) => {
    ensurePeerConnection();
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack && audioSenderRef.current) {
      void audioSenderRef.current.replaceTrack(audioTrack);
    }
  }, [ensurePeerConnection]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      addLocalTracks(stream);
      startLocalMeter(stream);
      ensureRelayAudioContext();
      startPcmRelay(stream);
      startAudioRelay(stream);
      setMicActive(true);
      await patchSession({ micActive: true });

      if (effectiveRole === 'interviewer') {
        await createOffer();
      } else if (session.rtcOffer) {
        await answerOffer(session.rtcOffer);
      }
    } catch (error) {
      console.error('Microphone failed:', error);
      setMicError('Microphone permission failed. Check browser permissions and try again.');
    }
  }, [addLocalTracks, answerOffer, createOffer, effectiveRole, ensureRelayAudioContext, patchSession, session.rtcOffer, startAudioRelay, startPcmRelay]);

  const stopMic = useCallback(async () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopAudioRelay();
    stopPcmRelay();
    stopLocalMeter();
    stopRemoteMeter();
    stopRemotePlayback();
    if (audioSenderRef.current) {
      await audioSenderRef.current.replaceTrack(null);
    }
    localStreamRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    audioSenderRef.current = null;
    handledRemoteCandidatesRef.current.clear();
    hasSetRemoteAnswerRef.current = false;
    setMicActive(false);
    await patchSession({ micActive: false, micLevel: 0 });
  }, [patchSession, stopAudioRelay, stopLocalMeter, stopPcmRelay, stopRemoteMeter, stopRemotePlayback]);

  useEffect(() => {
    const fetchState = async () => {
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
        enqueuePcmPackets(nextSession.candidatePcmPackets || []);
        enqueueRelayChunks(nextSession.candidateAudioChunks || []);
      } else {
        setQuestion(nextSession.currentQuestion || '');
        enqueuePcmPackets(nextSession.interviewerPcmPackets || []);
        enqueueRelayChunks(nextSession.interviewerAudioChunks || []);
      }
    };

    void fetchState();
    const interval = setInterval(fetchState, 750);
    return () => clearInterval(interval);
  }, [effectiveRole, enqueuePcmPackets, enqueueRelayChunks, onFinish, sessionId]);

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

    void syncRtc().catch((error) => {
      console.error('RTC sync failed:', error);
    });
  }, [answerOffer, ensurePeerConnection, effectiveRole, micActive, session]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      stopAudioRelay();
      stopPcmRelay();
      peerConnectionRef.current?.close();
      stopLocalMeter();
      stopRemoteMeter();
      stopRemotePlayback();
      void relayAudioContextRef.current?.close();
      relayAudioContextRef.current = null;
    };
  }, [stopAudioRelay, stopLocalMeter, stopPcmRelay, stopRemoteMeter, stopRemotePlayback]);

  const saveQuestion = async () => {
    setSaving(true);
    try {
      await patchSession({ currentQuestion: question });
    } finally {
      setSaving(false);
    }
  };

  const saveAnswer = async () => {
    setSaving(true);
    try {
      await patchSession({ currentAnswer: answer, codeText });
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
    void ensureRelayAudioContext().resume().then(() => {
      setRelayPlaybackReady(true);
    });
    void remoteAudioRef.current?.play().catch(() => {
      setMicError('Remote audio could not start. Check browser autoplay settings and output device.');
    });
    void playPcmQueue();
    void playRelayQueue();
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
      <audio ref={remoteAudioRef} autoPlay playsInline controls className="fixed left-4 bottom-4 z-50 h-8 w-64 opacity-80" />

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
          <button
            onClick={playRemoteAudio}
            className={`hidden sm:inline text-xs px-2 py-1 rounded border hover:text-white hover:border-primary ${remotePlaybackReady ? 'border-green-500/30 text-green-300 bg-green-500/10' : 'border-border text-text-muted'}`}
          >
            {remotePlaybackReady ? 'Audio enabled' : 'Enable audio'}
          </button>
          <span className={`hidden sm:inline text-xs px-2 py-1 rounded border ${relayPlaybackReady ? 'border-green-500/30 text-green-300 bg-green-500/10' : 'border-border text-text-muted'}`}>
            Relay {relayPlaybackReady ? 'on' : 'ready'}
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
            <label className="text-sm font-semibold text-white">Coding Space</label>
            {effectiveRole === 'interviewee' && (
              <button
                onClick={saveAnswer}
                disabled={saving}
                className="bg-surface border border-border hover:border-primary text-white px-3 py-2 rounded-lg text-sm"
              >
                Save code
              </button>
            )}
          </div>
          <textarea
            value={codeText}
            onChange={(event) => setCodeText(event.target.value)}
            readOnly={effectiveRole !== 'interviewee'}
            spellCheck={false}
            placeholder={effectiveRole === 'interviewee' ? 'Write code here...' : 'The interviewee code appears here.'}
            className="flex-1 min-h-[360px] bg-black border border-border rounded-lg p-4 text-green-100 font-mono text-sm resize-none focus:outline-none focus:border-primary"
          />
        </section>
      </div>
    </div>
  );
}
