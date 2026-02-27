'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { FiSend, FiCheckCircle, FiChevronRight, FiAlertCircle, FiBarChart2, FiThumbsUp, FiTrendingDown, FiMic, FiSquare, FiXCircle } from 'react-icons/fi';

type EndReason = 'manual' | 'timeout' | 'abandoned';

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

    // Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasFinalizedRef = useRef(false);
    const timerExpiredRef = useRef(false);
    const canAbandonOnUnmountRef = useRef(false);

    useEffect(() => {
        const fetchSessionData = async () => {
            try {
                const res = await api.get(`/interviews/${id}`);
                const normalizedInterview = {
                    ...res.data,
                    interviewMode: res.data?.interviewMode === 'untimed' ? 'untimed' : 'timed',
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
        if (!interview || interview.interviewMode === 'untimed') {
            return;
        }

        // Guard timeout handling during question transition until the new timer value is rendered.
        timerExpiredRef.current = true;
        setTimeLeftSeconds(interview.perQuestionTimeSeconds || 180);
    }, [currentQuestionIndex, interview]);

    useEffect(() => {
        if (!interview || interview.interviewMode === 'untimed' || timeLeftSeconds === null) {
            return;
        }

        if (timeLeftSeconds > 0) {
            timerExpiredRef.current = false;
        }
    }, [timeLeftSeconds, interview]);

    useEffect(() => {
        if (!interview || interview.interviewMode === 'untimed' || timeLeftSeconds === null || hasFinalizedRef.current) {
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
        if (!interview || interview.interviewMode === 'untimed' || timeLeftSeconds !== 0 || timerExpiredRef.current || hasFinalizedRef.current) {
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
        if (interview.interviewMode !== 'untimed') {
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

        if (isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
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

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Stop tracks to release mic
                stream.getTracks().forEach(track => track.stop());

                await handleTranscription(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Microphone access denied or unavailable.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleTranscription = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const res = await api.post(`/interviews/${id}/speech-to-text`, formData);

            // Append transcribed text
            setAnswerInput(prev => prev + (prev ? ' ' : '') + res.data.text);
        } catch (error: any) {
            console.error('Transcription failed:', error);
            alert(error?.response?.data?.message || 'Failed to transcribe audio.');
        } finally {
            setIsTranscribing(false);
        }
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

    const currentQ = interview.questions[currentQuestionIndex];
    const isAnswered = !!currentQ.userAnswer;
    const minutes = timeLeftSeconds !== null ? Math.floor(timeLeftSeconds / 60) : 0;
    const seconds = timeLeftSeconds !== null ? timeLeftSeconds % 60 : 0;
    const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const timerPercent = interview.interviewMode !== 'untimed' && interview.perQuestionTimeSeconds
        ? Math.max(0, Math.min(100, Math.round(((timeLeftSeconds || 0) / interview.perQuestionTimeSeconds) * 100)))
        : 0;

    return (
        <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden relative">
            <button
                onClick={() => handleFinishInterview('manual')}
                disabled={finishing}
                className="fixed bottom-4 right-4 z-50 bg-red-500 hover:bg-red-600 disabled:opacity-70 text-white px-4 py-2 rounded-lg font-semibold shadow-lg flex items-center space-x-2"
            >
                <FiXCircle className="w-5 h-5" />
                <span>{finishing ? 'Ending...' : 'End Test'}</span>
            </button>
            {/* Left panel: Info & Progress */}
            <div className="w-full md:w-1/3 bg-surface border-r border-border p-6 flex flex-col h-full overflow-hidden">
                <div className="mb-8">
                    <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Interview Session</h2>
                    <h1 className="text-2xl font-bold text-white mb-2">{interview.role}</h1>
                    <div className="flex items-center space-x-2 text-sm text-text-muted">
                        <span className="bg-white/10 px-2 py-1 rounded">{interview.experienceLevel}</span>
                        <span>|</span>
                        <span className="capitalize">{interview.interviewMode}</span>
                        {interview.interviewMode !== 'untimed' && timeLeftSeconds !== null && (
                            <>
                                <span>|</span>
                                <span className={`font-semibold ${timeLeftSeconds <= 20 ? 'text-red-400' : 'text-accent'}`}>
                                    {formattedTime} left
                                </span>
                            </>
                        )}
                        <span>|</span>
                        <span>Question {currentQuestionIndex + 1} of {interview.questions.length}</span>
                    </div>
                </div>

                {/* Progress List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {interview.questions.map((q: any, idx: number) => (
                        <div
                            key={idx}
                            className={`p-4 rounded-xl border ${idx === currentQuestionIndex ? 'border-primary bg-primary/5' : 'border-border bg-background'} transition-colors`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${idx === currentQuestionIndex ? 'text-primary' : 'text-text-muted'}`}>
                                    Question {idx + 1}
                                </span>
                                {q.userAnswer && <FiCheckCircle className="text-green-500 w-5 h-5" />}
                            </div>
                            <p className="text-sm text-white line-clamp-2">{q.questionText}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel: Chat / Interaction Area */}
            <div className="w-full md:w-2/3 flex flex-col h-full">
                {interview.interviewMode !== 'untimed' && timeLeftSeconds !== null && (
                    <div className="px-6 md:px-10 pt-6">
                        <div className="bg-surface border border-border rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-text-muted">Question Timer</p>
                                <p className={`text-2xl font-bold ${timeLeftSeconds <= 20 ? 'text-red-400' : 'text-primary'}`}>
                                    {formattedTime}
                                </p>
                            </div>
                            <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${timeLeftSeconds <= 20 ? 'bg-red-500' : 'bg-primary'}`}
                                    style={{ width: `${timerPercent}%` }}
                                />
                            </div>
                            <p className="text-xs text-text-muted mt-2">
                                Time up will auto-skip this question. Last question auto-submits interview.
                            </p>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">

                    {/* AI Question Bubble */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col space-y-2 max-w-2xl"
                    >
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">AI</div>
                            <span className="text-sm font-medium text-text-muted">Interviewer</span>
                        </div>
                        <div className="bg-surface border border-border p-5 rounded-2xl rounded-tl-sm text-white text-lg leading-relaxed">
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
                <div className="p-6 border-t border-border bg-surface/50 backdrop-blur-md">
                    {!isAnswered ? (
                        <div className="relative flex flex-col items-end">
                            <textarea
                                value={answerInput}
                                onChange={(e) => setAnswerInput(e.target.value)}
                                placeholder={isRecording ? "Listening..." : "Type your answer here or click mic to speak..."}
                                disabled={evaluating || isRecording || isTranscribing || finishing}
                                className="w-full bg-background border border-border rounded-xl px-4 py-4 pr-16 text-white focus:outline-none focus:border-primary resize-none min-h-[120px] transition-colors"
                            />

                            <div className="absolute bottom-4 right-4 flex space-x-2">
                                {isRecording ? (
                                    <button
                                        onClick={stopRecording}
                                        className="p-3 bg-red-500 hover:bg-red-600 animate-pulse text-white rounded-lg transition-colors shadow-lg shadow-red-500/20"
                                        title="Stop Recording"
                                    >
                                        <FiSquare className="w-5 h-5 fill-current" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        disabled={evaluating || isTranscribing || finishing}
                                        className="p-3 bg-secondary hover:bg-secondary/80 disabled:bg-border disabled:text-text-muted text-white rounded-lg transition-colors"
                                        title="Voice Answer"
                                    >
                                        <FiMic className="w-5 h-5" />
                                    </button>
                                )}

                                <button
                                    onClick={handleAnswerSubmit}
                                    disabled={evaluating || isRecording || isTranscribing || finishing || !answerInput.trim()}
                                    className="p-3 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-text-muted text-white rounded-lg transition-colors"
                                    title="Submit Answer"
                                >
                                    <FiSend className="w-5 h-5" />
                                </button>
                            </div>
                            {isTranscribing && <span className="text-xs text-text-muted mt-2 animate-pulse">Transcribing audio...</span>}
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

