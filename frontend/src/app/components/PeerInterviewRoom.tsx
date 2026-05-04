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
  rtcOffer?: string;
  rtcAnswer?: string;
  candidateIceCandidates?: string[];
  interviewerIceCandidates?: string[];
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
  const [saving, setSaving] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const handledRemoteCandidatesRef = useRef(new Set<string>());
  const hasSetRemoteAnswerRef = useRef(false);

  const patchSession = useCallback(async (payload: Record<string, unknown>) => {
    const res = await api.patch(`/peer-sessions/${sessionId}/state`, payload);
    setSession(res.data.session || {});
    return res.data.session as PeerSessionState;
  }, [sessionId]);

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
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.volume = 1;
        void remoteAudioRef.current.play().catch(() => {
          setMicError('Remote audio is connected, but the browser blocked autoplay. Click the mic button once on this page.');
        });
      }
    };

    return pc;
  }, [patchSession]);

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
  }, [addLocalTracks, answerOffer, createOffer, effectiveRole, patchSession, session.rtcOffer]);

  const stopMic = useCallback(async () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    await patchSession({ micActive: false });
  }, [patchSession]);

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
      } else {
        setQuestion(nextSession.currentQuestion || '');
      }
    };

    void fetchState();
    const interval = setInterval(fetchState, 750);
    return () => clearInterval(interval);
  }, [effectiveRole, onFinish, sessionId]);

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
      peerConnectionRef.current?.close();
    };
  }, []);

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

  const interviewerMicActive = Boolean(session.interviewerMicActive);
  const intervieweeMicActive = Boolean(session.candidateMicActive);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay playsInline />

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
