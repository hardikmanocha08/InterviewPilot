'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import BehavioralAnalysisOverlay from '@/app/components/BehavioralAnalysisOverlay';
import PeerInterviewRoom from '@/app/components/PeerInterviewRoom';
import PeerLobby from '@/app/components/PeerLobby';
import { FiSend, FiCheckCircle, FiChevronRight, FiAlertCircle, FiBarChart2, FiThumbsUp, FiTrendingDown, FiXCircle, FiMic, FiMicOff } from 'react-icons/fi';

type EndReason = 'manual' | 'timeout' | 'abandoned';

interface BehavioralMetric {
    timestamp: Date;
    eyeContact: number;
    confidence: number;
    speakingPace: 'slow' | 'normal' | 'fast';
    emotionState: 'neutral' | 'positive' | 'nervous' | 'stressed';
}

export default function InterviewRoom() {
    const { id } = useParams();
    const router = useRouter();

    const [interview, setInterview] = useState<any>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answerInput, setAnswerInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
    const [peerRole, setPeerRole] = useState<'interviewer' | 'interviewee' | null>(null);
    const [recordingAnswer, setRecordingAnswer] = useState(false);
    const [transcribingAnswer, setTranscribingAnswer] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasFinalizedRef = useRef(false);
    const timerExpiredRef = useRef(false);
    const canAbandonOnUnmountRef = useRef(false);
    const submittedBehavioralMetricsRef = useRef(0);
    const proctorViolationRef = useRef(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const answerAudioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        const fetchSessionData = async () => {
            try {
                const res = await api.get(`/interviews/${id}`);
                const normalizedInterview = {
                    ...res.data,
                    interviewMode: ['untimed', 'peer'].includes(res.data?.interviewMode)
                        ? res.data.interviewMode
                        : 'timed',
                    perQuestionTimeSeconds:
                        Number(res.data?.perQuestionTimeSeconds) > 0
                            ? Number(res.data.perQuestionTimeSeconds)
                            : 180,
                };
                setInterview(normalizedInterview);
                if (normalizedInterview.status === 'completed') {
                    router.replace(`/dashboard/history/${id}`);
                    return;
                }
                canAbandonOnUnmountRef.current = true;
                if (normalizedInterview.interviewMode === 'timed') {
                    setTimeLeftSeconds(normalizedInterview.perQuestionTimeSeconds);
                } else {
                    setTimeLeftSeconds(null);
                }
            } catch (error) {
                console.error("Failed to fetch interview session:", error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchSessionData();
        }

    }, [id, router]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [interview?.questions, evaluating]);

    useEffect(() => {
        if (!interview || interview.interviewMode !== 'timed') {
            return;
        }

        // Guard timeout handling during question transition until the new timer value is rendered.
        timerExpiredRef.current = true;
        setTimeLeftSeconds(interview.perQuestionTimeSeconds || 180);
    }, [currentQuestionIndex, interview]);

    useEffect(() => {
        if (!interview || interview.interviewMode !== 'timed' || timeLeftSeconds === null) {
            return;
        }

        if (timeLeftSeconds > 0) {
            timerExpiredRef.current = false;
        }
    }, [timeLeftSeconds, interview]);

    useEffect(() => {
        if (!interview || interview.interviewMode !== 'timed' || timeLeftSeconds === null || hasFinalizedRef.current) {
            return;
        }
        if (timeLeftSeconds <= 0) {
            return;
        }

        const interval = setInterval(() => {
            setTimeLeftSeconds((prev) => (prev === null ? null : Math.max(0, prev - 1)));
        }, 1000);

        return () => clearInterval(interval);
    }, [interview, timeLeftSeconds]);

    useEffect(() => {
        if (!interview || interview.interviewMode !== 'timed' || timeLeftSeconds !== 0 || timerExpiredRef.current || hasFinalizedRef.current) {
            return;
        }

        timerExpiredRef.current = true;
        void handleTimerExpired();
    }, [timeLeftSeconds, interview]);

    useEffect(() => {
        if (!interview || interview.status === 'completed') {
            return;
        }

        const onBeforeUnload = () => {
            if (hasFinalizedRef.current) {
                return;
            }
            hasFinalizedRef.current = true;
            finishWithBeacon('abandoned');
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        window.addEventListener('pagehide', onBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('pagehide', onBeforeUnload);
        };
    }, [interview]);

    useEffect(() => {
        return () => {
            if (!id || hasFinalizedRef.current || !canAbandonOnUnmountRef.current) {
                return;
            }
            hasFinalizedRef.current = true;
            finishWithBeacon('abandoned');
        };
    }, [id]);

    const submitCurrentAnswer = async (answerText: string) => {
        if (!interview || !answerText.trim()) {
            return false;
        }

        setEvaluating(true);
        const currentQ = interview.questions[currentQuestionIndex];

        try {
            const response = await api.post(`/interviews/${id}/answer`, {
                questionId: currentQ._id,
                answerText: answerText.trim(),
            });

            const updatedQuestions = [...interview.questions];
            updatedQuestions[currentQuestionIndex] = response.data;
            setInterview({ ...interview, questions: updatedQuestions });
            setAnswerInput('');
            return true;
        } catch (error) {
            console.error('Failed to submit answer', error);
            alert('Error evaluating answer.');
            return false;
        } finally {
            setEvaluating(false);
        }
    };

    // Submit logic
    const handleAnswerSubmit = async () => {
        if (finishing) {
            return;
        }
        const didSubmit = await submitCurrentAnswer(answerInput);
        if (!didSubmit || !interview) {
            return;
        }

        // Timed mode is flow-driven: no per-question analysis screen between questions.
        if (interview.interviewMode === 'timed') {
            if (currentQuestionIndex < interview.questions.length - 1) {
                setCurrentQuestionIndex((curr) => curr + 1);
            } else {
                await handleFinishInterview('manual');
            }
        }
    };

    const handleNextQuestion = () => {
        if (finishing) {
            return;
        }
        if (currentQuestionIndex < interview.questions.length - 1) {
            setCurrentQuestionIndex(curr => curr + 1);
        }
    };

    const buildFinishUrl = (reason: EndReason) => {
        const baseURL = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '/api';
        const apiBase = baseURL.startsWith('http')
            ? baseURL
            : `${window.location.origin}${baseURL.startsWith('/') ? baseURL : `/${baseURL}`}`;
        return `${apiBase}/interviews/${id}/finish?endedReason=${reason}`;
    };

    const finishWithBeacon = (reason: EndReason) => {
        const url = buildFinishUrl(reason);
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url);
            return;
        }
        fetch(url, { method: 'POST', keepalive: true, credentials: 'include' }).catch(() => undefined);
    };

    const handleFinishInterview = async (reason: EndReason = 'manual') => {
        if (hasFinalizedRef.current) {
            return;
        }
        hasFinalizedRef.current = true;
        setFinishing(true);
        try {
            await api.post(`/interviews/${id}/finish`, { endedReason: reason });
            router.push(`/dashboard/history/${id}`);
        } catch (e) {
            console.error(e);
            hasFinalizedRef.current = false;
        } finally {
            setFinishing(false);
        }
    };

    const handleTimerExpired = async () => {
        if (!interview || hasFinalizedRef.current) {
            return;
        }

        const typedAnswer = answerInput.trim();
        const currentQuestion = interview.questions[currentQuestionIndex];
        const alreadyAnswered = Boolean(currentQuestion?.userAnswer);

        if (!alreadyAnswered && typedAnswer) {
            await submitCurrentAnswer(typedAnswer);
        }

        if (currentQuestionIndex < interview.questions.length - 1) {
            setAnswerInput('');
            setCurrentQuestionIndex((curr) => curr + 1);
            return;
        }

        await handleFinishInterview('timeout');
    };

    const handleBehavioralMetricsUpdate = useCallback(async (metrics: BehavioralMetric[]) => {
        if (!id) {
            return;
        }

        const newMetrics = metrics.slice(submittedBehavioralMetricsRef.current);
        if (newMetrics.length === 0) {
            return;
        }

        submittedBehavioralMetricsRef.current = metrics.length;

        try {
            await api.post(`/interviews/${id}/behavioral-metrics`, { metrics: newMetrics });
        } catch (error) {
            submittedBehavioralMetricsRef.current -= newMetrics.length;
            console.error('Failed to submit behavioral metrics:', error);
        }
    }, [id]);

    const handlePeerSessionReady = useCallback((sessionId: string) => {
        setInterview((current: any) => current ? { ...current, peerSessionId: sessionId } : current);
    }, []);

    const handleBehavioralViolation = useCallback(async (reason: string) => {
        if (proctorViolationRef.current || !id) {
            return;
        }
        proctorViolationRef.current = true;
        hasFinalizedRef.current = true;
        setFinishing(true);
        alert(`Interview stopped: ${reason}`);
        try {
            await api.post(`/interviews/${id}/finish`, { endedReason: 'abandoned' });
        } catch (error) {
            console.error('Failed to finish after proctor violation:', error);
        } finally {
            router.replace(`/dashboard/history/${id}`);
        }
    }, [id, router]);

    const handlePeerFinish = useCallback(() => {
        void handleFinishInterview('manual');
    }, [handleFinishInterview]);

    const startAnswerRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            const recorder = new MediaRecorder(stream);
            answerAudioChunksRef.current = [];
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    answerAudioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                const audioBlob = new Blob(answerAudioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                if (!audioBlob.size || !id) {
                    return;
                }

                setTranscribingAnswer(true);
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'answer.webm');
                    const res = await api.post(`/interviews/${id}/speech-to-text`, formData);
                    const text = res.data?.text?.trim();
                    if (text) {
                        setAnswerInput((current) => current ? `${current.trim()}\n\n${text}` : text);
                    }
                } catch (error) {
                    console.error('Failed to transcribe answer:', error);
                    alert('Microphone recording worked, but transcription failed. Check your STT provider settings.');
                } finally {
                    setTranscribingAnswer(false);
                }
            };

            recorder.start();
            setRecordingAnswer(true);
        } catch (error) {
            console.error('Microphone permission failed:', error);
            alert('Microphone permission failed. Check browser permissions and try again.');
        }
    };

    const stopAnswerRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setRecordingAnswer(false);
    };

    if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-white">Loading Interview Environment...</div>;

    if (!interview) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <FiAlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-xl text-white font-bold mb-2">Error Loading Session</h2>
                <p className="text-text-muted mb-4">Please return to the dashboard and try starting a new interview.</p>
                <button onClick={() => router.push('/dashboard')} className="bg-primary text-white px-6 py-2 rounded-lg">Return Home</button>
            </div>
        )
    }

    if (interview.interviewMode === 'peer' && !peerRole) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-surface border border-border rounded-xl p-6 shadow-xl">
                    <p className="text-xs uppercase text-primary font-semibold mb-2">Peer Mode</p>
                    <h1 className="text-2xl font-bold text-white mb-2">How do you want to join?</h1>
                    <p className="text-text-muted mb-6">AI will not generate questions in this mode. The human interviewer writes the question, and the interviewee responds and codes.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => setPeerRole('interviewee')}
                            className="border border-border hover:border-primary bg-background rounded-lg p-5 text-left transition-colors"
                        >
                            <span className="block text-lg font-bold text-white mb-2">Join as Interviewee</span>
                            <span className="text-sm text-text-muted">Create a waiting room, answer questions, and use the coding space.</span>
                        </button>
                        <button
                            onClick={() => setPeerRole('interviewer')}
                            className="border border-border hover:border-primary bg-background rounded-lg p-5 text-left transition-colors"
                        >
                            <span className="block text-lg font-bold text-white mb-2">Join as Interviewer</span>
                            <span className="text-sm text-text-muted">Pick a waiting candidate, type questions, and listen live.</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (interview.interviewMode === 'peer' && interview.peerSessionId) {
        return (
            <PeerInterviewRoom
                sessionId={String(interview.peerSessionId)}
                peerRole={peerRole || 'interviewee'}
                onFinish={handlePeerFinish}
            />
        );
    }

    if (interview.interviewMode === 'peer' && !interview.peerSessionId) {
        return (
            <div className="min-h-screen bg-background p-4 sm:p-6">
                <div className="mb-6">
                    <button onClick={() => router.push('/dashboard')} className="text-sm text-text-muted hover:text-white transition-colors">
                        Return to dashboard
                    </button>
                </div>
                <PeerLobby
                    interviewId={String(id)}
                    role={interview.role}
                    experienceLevel={interview.experienceLevel}
                    peerRole={peerRole || 'interviewee'}
                    onJoinSession={handlePeerSessionReady}
                />
            </div>
        );
    }

    const currentQ = interview.questions[currentQuestionIndex];
    const isAnswered = !!currentQ.userAnswer;
    const minutes = timeLeftSeconds !== null ? Math.floor(timeLeftSeconds / 60) : 0;
    const seconds = timeLeftSeconds !== null ? timeLeftSeconds % 60 : 0;
    const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const timerPercent = interview.interviewMode === 'timed' && interview.perQuestionTimeSeconds
        ? Math.max(0, Math.min(100, Math.round(((timeLeftSeconds || 0) / interview.perQuestionTimeSeconds) * 100)))
        : 0;

    return (
        <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden relative">
            <BehavioralAnalysisOverlay
                isEnabled={Boolean(interview.behavioralAnalysis?.isEnabled)}
                isRecording={!finishing && interview.status !== 'completed'}
                onMetricsUpdate={handleBehavioralMetricsUpdate}
                onViolation={handleBehavioralViolation}
            />
            {/* Left panel: Info  & Progress */}
            <div className="w-full md:w-1/3 bg-surface border-b md:border-b-0 md:border-r border-border p-3 sm:p-4 md:p-6 flex flex-col h-auto md:h-full overflow-hidden">
                <div className="mb-4 md:mb-8">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <h2 className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">Interview</h2>
                        <button
                            onClick={() => handleFinishInterview('manual')}
                            disabled={finishing}
                            className="bg-red-500 hover:bg-red-600 disabled:opacity-70 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold shadow-lg text-xs flex items-center space-x-1 whitespace-nowrap flex-shrink-0"
                        >
                            <FiXCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">{finishing ? 'Ending...' : 'End Test'}</span>
                            <span className="sm:hidden">{finishing ? '...' : 'End'}</span>
                        </button>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">{interview.role}</h1>
                    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm text-text-muted">
                        <span className="bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{interview.experienceLevel}</span>
                        <span className="hidden sm:inline">|</span>
                        <span className="capitalize">{interview.interviewMode}</span>
                        {interview.interviewMode === 'timed' && timeLeftSeconds !== null && (
                            <>
                                <span className="hidden sm:inline">|</span>
                                <span className={`font-semibold ${timeLeftSeconds <= 20 ? 'text-red-400' : 'text-accent'}`}>
                                    {formattedTime} left
                                </span>
                            </>
                        )}
                        <span className="hidden sm:inline">|</span>
                        <span>Q{currentQuestionIndex + 1}/{interview.questions.length}</span>
                    </div>
                </div>

                {/* Progress List */}
                <div className="hidden md:grid grid-cols-3 gap-2 mb-6">
                    {interview.questions.map((q: any, idx: number) => (
                        <div
                            key={idx}
                            className={`p-2 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${idx === currentQuestionIndex ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-medium ${idx === currentQuestionIndex ? 'text-primary' : 'text-text-muted'}`}>
                                    Q{idx + 1}
                                </span>
                                {q.userAnswer && <FiCheckCircle className="text-green-500 w-3.5 h-3.5" />}
                            </div>
                            <p className="text-xs text-white line-clamp-3 leading-tight">{q.questionText}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel: Chat / Interaction Area */}
            <div className="w-full md:w-2/3 flex flex-col h-auto md:h-full">
                {interview.interviewMode === 'timed' && timeLeftSeconds !== null && (
                    <div className="px-3 sm:px-4 md:px-10 py-3 sm:py-4 md:py-4 flex-shrink-0">
                        <div className="bg-surface border border-border rounded-lg md:rounded-2xl p-3 md:p-3">
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                                <p className="text-xs md:text-sm text-text-muted">Question Timer</p>
                                <p className={`text-lg md:text-2xl font-bold ${timeLeftSeconds <= 20 ? 'text-red-400' : 'text-primary'}`}>
                                    {formattedTime}
                                </p>
                            </div>
                            <div className="h-1.5 md:h-2 w-full bg-background rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${timeLeftSeconds <= 20 ? 'bg-red-500' : 'bg-primary'}`}
                                    style={{ width: `${timerPercent}%` }}
                                />
                            </div>
                            <p className="text-[10px] md:text-xs text-text-muted mt-1.5 md:mt-2">
                                Time up will auto-skip. Last question auto-submits interview.
                            </p>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-10 space-y-4 md:space-y-6">

                    {/* AI Question Bubble */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col space-y-1.5 md:space-y-2 max-w-2xl"
                    >
                        <div className="flex items-center space-x-1.5 md:space-x-2">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px] md:text-xs font-bold">AI</div>
                            <span className="text-xs md:text-sm font-medium text-text-muted">Interviewer</span>
                        </div>
                        <div className="bg-surface border border-border p-3 md:p-5 rounded-lg md:rounded-2xl rounded-tl-sm text-white text-sm md:text-lg leading-relaxed">
                            {currentQ.questionText}
                        </div>
                    </motion.div>

                    {/* User Answer Bubble (if answered) */}
                    <AnimatePresence>
                        {isAnswered && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col space-y-2 max-w-2xl self-end ml-auto"
                            >
                                <div className="flex items-center space-x-2 justify-end">
                                    <span className="text-sm font-medium text-text-muted">You</span>
                                    <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-white text-xs font-bold">U</div>
                                </div>
                                <div className="bg-primary/20 border border-primary/30 p-5 rounded-2xl rounded-tr-sm text-white text-md leading-relaxed">
                                    {currentQ.userAnswer}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* AI Feedback Bubble (if answered) */}
                    <AnimatePresence>
                        {isAnswered && currentQ.feedback && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="pt-4 max-w-3xl"
                            >
                                <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
                                    <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                                        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                                            <FiBarChart2 className="w-5 h-5 text-accent" />
                                            <span>AI Evaluation</span>
                                        </h3>
                                        <div className="bg-background px-4 py-1.5 rounded-full border border-border">
                                            <span className="text-sm text-text-muted">Score: </span>
                                            <span className="text-lg font-bold text-accent">{currentQ.score}/10</span>
                                        </div>
                                    </div>

                                    <p className="text-white mb-6 leading-relaxed">{currentQ.feedback}</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                                            <h4 className="text-green-500 font-semibold mb-2 flex items-center space-x-2">
                                                <FiThumbsUp className="w-4 h-4" />
                                                <span>Strengths</span>
                                            </h4>
                                            <ul className="list-disc list-inside text-sm text-green-200 space-y-1">
                                                {currentQ.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>

                                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                                            <h4 className="text-red-500 font-semibold mb-2 flex items-center space-x-2">
                                                <FiTrendingDown className="w-4 h-4" />
                                                <span>Areas to Improve</span>
                                            </h4>
                                            <ul className="list-disc list-inside text-sm text-red-200 space-y-1">
                                                {currentQ.weaknesses?.map((w: string, i: number) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Evaluating State Loader */}
                    {evaluating && (
                        <div className="flex items-center space-x-3 text-text-muted italic animate-pulse">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px]">AI</div>
                            <span>Analyzing your response...</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 sm:p-4 md:p-6 border-t border-border bg-surface/50 backdrop-blur-md flex-shrink-0">
                    {!isAnswered ? (
                        <div className="relative flex flex-col items-end">
                            <textarea
                                value={answerInput}
                                onChange={(e) => setAnswerInput(e.target.value)}
                                placeholder="Type your answer here..."
                                disabled={evaluating || finishing}
                                className="w-full bg-background border border-border rounded-xl px-4 py-4 pr-16 text-white focus:outline-none focus:border-primary resize-none min-h-[100px] sm:min-h-[110px] md:min-h-[120px] max-h-[200px] transition-colors"
                            />

                            <div className="absolute bottom-4 right-4 flex space-x-2">
                                <button
                                    onClick={recordingAnswer ? stopAnswerRecording : startAnswerRecording}
                                    disabled={evaluating || finishing || transcribingAnswer}
                                    className={`p-3 disabled:bg-border disabled:text-text-muted text-white rounded-lg transition-colors ${recordingAnswer ? 'bg-red-500 hover:bg-red-600' : 'bg-surface border border-border hover:border-primary'}`}
                                    title={recordingAnswer ? 'Stop recording' : 'Record answer'}
                                >
                                    {recordingAnswer ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={handleAnswerSubmit}
                                    disabled={evaluating || finishing || !answerInput.trim()}
                                    className="p-3 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white rounded-lg transition-colors"
                                    title="Submit Answer"
                                >
                                    <FiSend className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-end space-x-4">
                            {currentQuestionIndex < interview.questions.length - 1 ? (
                                <button
                                    onClick={handleNextQuestion}
                                    className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center space-x-2"
                                >
                                    <span>Next Question</span>
                                    <FiChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleFinishInterview('manual')}
                                    disabled={finishing}
                                    className="bg-accent hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-green-500/20"
                                >
                                    {finishing ? "Finishing..." : "Complete Interview"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
