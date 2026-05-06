'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { FiPlayCircle, FiBriefcase, FiStar, FiArrowLeft, FiUsers, FiClock, FiEye, FiEyeOff } from 'react-icons/fi';

export default function InterviewSetup() {
    const { user, token, logout } = useAuthStore();
    const [aiLoading, setAiLoading] = useState(false);
    const [peerLoading, setPeerLoading] = useState(false);
    const router = useRouter();

    const [aiForm, setAiForm] = useState({
        role: 'Frontend',
        experienceLevel: 'Fresher',
        industryMode: 'Product company',
        questionCount: 3,
        interviewMode: 'timed',
        enableBehavioralAnalysis: false,
    });

    const [peerForm, setPeerForm] = useState({
        role: 'Frontend',
        experienceLevel: 'Fresher',
        peerVisibility: 'public' as 'public' | 'private',
    });

    useEffect(() => {
        if (!token) {
            router.replace('/login');
        }
    }, [token, router]);

    useEffect(() => {
        if (!user) return;
        setAiForm((prev) => ({
            ...prev,
            role: user.role || prev.role,
            experienceLevel: user.experienceLevel || prev.experienceLevel,
            industryMode: user.industryMode || prev.industryMode,
            questionCount: user.settings?.preferredQuestionCount || prev.questionCount,
        }));
        setPeerForm((prev) => ({
            ...prev,
            role: user.role || prev.role,
            experienceLevel: user.experienceLevel || prev.experienceLevel,
        }));
    }, [user]);

    const getPerQuestionSeconds = (experienceLevel: string, questionCount: number) => {
        const baseTimeByExperience: Record<string, number> = {
            Fresher: 150,
            '1-3 years': 210,
            '3-5 years': 300,
            '5+ years': 360,
        };
        const base = baseTimeByExperience[experienceLevel] || 210;
        const adjustment = questionCount >= 6 ? -20 : questionCount <= 4 ? 15 : 0;
        return Math.max(120, Math.min(420, base + adjustment));
    };

    const perQuestionSeconds = getPerQuestionSeconds(aiForm.experienceLevel, aiForm.questionCount);
    const estimatedTotalMinutes = Math.ceil((perQuestionSeconds * aiForm.questionCount) / 60);

    const handleStartAIInterview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            router.replace('/login');
            return;
        }
        setAiLoading(true);
        try {
            const response = await api.post('/interviews/start', {
                ...aiForm,
                peerMode: false,
            });
            router.push(`/interview/${response.data._id}`);
        } catch (error: any) {
            console.error('Failed to start AI interview:', error);
            if (error?.response?.status === 401) {
                logout();
                router.replace('/login');
                alert('Your session expired. Please log in again.');
            } else {
                alert(error?.response?.data?.message || 'Failed to start interview. Please try again.');
            }
            setAiLoading(false);
        }
    };

    const handleStartPeerInterview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            router.replace('/login');
            return;
        }
        setPeerLoading(true);
        try {
            const response = await api.post('/interviews/start', {
                role: peerForm.role,
                experienceLevel: peerForm.experienceLevel,
                industryMode: aiForm.industryMode || user?.industryMode || 'Product company',
                questionCount: 0,
                interviewMode: 'untimed',
                enableBehavioralAnalysis: false,
                peerMode: true,
                peerVisibility: peerForm.peerVisibility,
            });
            router.push(`/interview/${response.data._id}`);
        } catch (error: any) {
            console.error('Failed to start peer interview:', error);
            if (error?.response?.status === 401) {
                logout();
                router.replace('/login');
                alert('Your session expired. Please log in again.');
            } else {
                alert(error?.response?.data?.message || 'Failed to start peer interview. Please try again.');
            }
            setPeerLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center py-4 sm:py-6 px-4 overflow-hidden">
            <div className="w-full max-w-4xl mb-4 sm:mb-6">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="inline-flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm text-text-muted hover:text-white transition-colors"
                >
                    <FiArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Back to Dashboard</span>
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl w-full text-center mb-6 sm:mb-8"
            >
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">Start an Interview</h1>
                <p className="text-xs sm:text-base md:text-lg text-text-muted">Choose between AI-powered practice or peer-to-peer mock interviews.</p>
            </motion.div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* ===== AI INTERVIEW SECTION ===== */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-surface border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl relative"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary rounded-t-xl sm:rounded-t-2xl"></div>

                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FiPlayCircle className="text-primary" />
                            AI Interview
                        </h2>
                        <p className="text-xs text-text-muted mt-1">Practice with AI-generated questions and get instant feedback.</p>
                    </div>

                    <form onSubmit={handleStartAIInterview} className="space-y-3">
                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiBriefcase className="text-primary flex-shrink-0" />
                                <span>Target Role</span>
                            </label>
                            <select
                                value={aiForm.role}
                                onChange={(e) => setAiForm({ ...aiForm, role: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="Frontend">Frontend Engineer</option>
                                <option value="Backend">Backend Engineer</option>
                                <option value="Fullstack">Fullstack Engineer</option>
                                <option value="Data Science">Data Scientist</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiStar className="text-accent flex-shrink-0" />
                                <span>Experience Level</span>
                            </label>
                            <select
                                value={aiForm.experienceLevel}
                                onChange={(e) => setAiForm({ ...aiForm, experienceLevel: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="Fresher">Fresher (0 years)</option>
                                <option value="1-3 years">1-3 years</option>
                                <option value="3-5 years">3-5 years</option>
                                <option value="5+ years">Senior (5+ years)</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiBriefcase className="text-secondary flex-shrink-0" />
                                <span>Industry</span>
                            </label>
                            <select
                                value={aiForm.industryMode}
                                onChange={(e) => setAiForm({ ...aiForm, industryMode: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="Product company">Product company</option>
                                <option value="Service company">Service company</option>
                                <option value="Startup">Startup</option>
                                <option value="MNC">MNC</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiClock className="text-secondary flex-shrink-0" />
                                <span>Mode</span>
                            </label>
                            <select
                                value={aiForm.interviewMode}
                                onChange={(e) => setAiForm({ ...aiForm, interviewMode: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                            >
                                <option value="timed">Timed (auto-skip + auto-submit)</option>
                                <option value="untimed">Untimed (self-paced)</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiStar className="text-primary flex-shrink-0" />
                                <span>Question Count (3-7)</span>
                            </label>
                            <input
                                type="number"
                                min={3}
                                max={7}
                                value={aiForm.questionCount}
                                onChange={(e) => setAiForm({ ...aiForm, questionCount: Number(e.target.value) })}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div className="flex items-center space-x-3 pt-1">
                            <input
                                type="checkbox"
                                id="proctoredInterview"
                                checked={aiForm.enableBehavioralAnalysis}
                                onChange={(e) => setAiForm({ ...aiForm, enableBehavioralAnalysis: e.target.checked })}
                                className="w-4 h-4 rounded border-border bg-background cursor-pointer accent-primary"
                            />
                            <label htmlFor="proctoredInterview" className="text-xs sm:text-sm font-medium text-white cursor-pointer flex-1">
                                Proctored (webcam required)
                            </label>
                        </div>
                        {aiForm.enableBehavioralAnalysis && (
                            <p className="text-xs text-text-muted ml-7 -mt-2">Closing the tab or switching away will end the interview.</p>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={aiLoading}
                                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all flex justify-center items-center space-x-2 relative group text-sm sm:text-base"
                            >
                                {aiLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Starting...</span>
                                    </div>
                                ) : (
                                    <>
                                        <FiPlayCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform flex-shrink-0" />
                                        <span>Start AI Interview</span>
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs text-text-muted mt-2">
                                {aiForm.interviewMode === 'timed'
                                    ? `~${estimatedTotalMinutes} min total, ${Math.floor(perQuestionSeconds / 60)}m per question`
                                    : 'Answer at your own pace'}
                            </p>
                        </div>
                    </form>
                </motion.div>

                {/* ===== PEER INTERVIEW SECTION ===== */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-surface border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl relative"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-xl sm:rounded-t-2xl"></div>

                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FiUsers className="text-purple-400" />
                            Peer Interview
                        </h2>
                        <p className="text-xs text-text-muted mt-1">Practice with another person. One acts as interviewer, one as candidate.</p>
                    </div>

                    <form onSubmit={handleStartPeerInterview} className="space-y-3">
                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiBriefcase className="text-purple-400 flex-shrink-0" />
                                <span>Target Role</span>
                            </label>
                            <select
                                value={peerForm.role}
                                onChange={(e) => setPeerForm({ ...peerForm, role: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors appearance-none"
                            >
                                <option value="Frontend">Frontend Engineer</option>
                                <option value="Backend">Backend Engineer</option>
                                <option value="Fullstack">Fullstack Engineer</option>
                                <option value="Data Science">Data Scientist</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiStar className="text-pink-400 flex-shrink-0" />
                                <span>Experience Level</span>
                            </label>
                            <select
                                value={peerForm.experienceLevel}
                                onChange={(e) => setPeerForm({ ...peerForm, experienceLevel: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors appearance-none"
                            >
                                <option value="Fresher">Fresher (0 years)</option>
                                <option value="1-3 years">1-3 years</option>
                                <option value="3-5 years">3-5 years</option>
                                <option value="5+ years">Senior (5+ years)</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-white mb-1.5">
                                <FiUsers className="text-purple-400 flex-shrink-0" />
                                <span>Room Type</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPeerForm((prev) => ({ ...prev, peerVisibility: 'public' }))}
                                    className={`w-full px-4 py-3 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${
                                        peerForm.peerVisibility === 'public'
                                            ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                                            : 'border-border bg-background text-text-muted hover:border-purple-500/50 hover:text-white'
                                    }`}
                                >
                                    <FiEye className="w-4 h-4" />
                                    Public
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPeerForm((prev) => ({ ...prev, peerVisibility: 'private' }))}
                                    className={`w-full px-4 py-3 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${
                                        peerForm.peerVisibility === 'private'
                                            ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                                            : 'border-border bg-background text-text-muted hover:border-purple-500/50 hover:text-white'
                                    }`}
                                >
                                    <FiEyeOff className="w-4 h-4" />
                                    Private
                                </button>
                            </div>
                            <p className="text-xs text-text-muted mt-2">
                                {peerForm.peerVisibility === 'public'
                                    ? 'Create a public room. Interviewers can browse and join.'
                                    : 'Interviewer creates a room with a code. Interviewee enters the code to join.'}
                            </p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={peerLoading}
                                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all flex justify-center items-center space-x-2 relative group text-sm sm:text-base"
                            >
                                {peerLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Starting...</span>
                                    </div>
                                ) : (
                                    <>
                                        <FiUsers className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform flex-shrink-0" />
                                        <span>Start Peer Interview</span>
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs text-text-muted mt-2">
                                AI will not generate questions. Human interviewer writes questions manually.
                            </p>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
