'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { FiPlayCircle, FiBriefcase, FiStar, FiArrowLeft } from 'react-icons/fi';

export default function InterviewSetup() {
    const { user, token, logout } = useAuthStore();
    const [formData, setFormData] = useState({
        role: user?.role || 'Frontend',
        experienceLevel: user?.experienceLevel || 'Fresher',
        industryMode: user?.industryMode || 'Product company',
        questionCount: user?.settings?.preferredQuestionCount || 3,
        interviewMode: 'timed',
    });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!token) {
            router.replace('/login');
        }
    }, [token, router]);

    useEffect(() => {
        if (!user) {
            return;
        }
        setFormData((prev) => ({
            ...prev,
            role: user.role || prev.role,
            experienceLevel: user.experienceLevel || prev.experienceLevel,
            industryMode: user.industryMode || prev.industryMode,
            questionCount: user.settings?.preferredQuestionCount || prev.questionCount,
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

    const perQuestionSeconds = getPerQuestionSeconds(formData.experienceLevel, formData.questionCount);
    const estimatedTotalMinutes = Math.ceil((perQuestionSeconds * formData.questionCount) / 60);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            router.replace('/login');
            return;
        }
        setLoading(true);

        try {
            const response = await api.post('/interviews/start', formData);
            router.push(`/interview/${response.data._id}`);
        } catch (error: any) {
            console.error('Failed to start interview:', error);
            if (error?.response?.status === 401) {
                logout();
                router.replace('/login');
                alert('Your session expired. Please log in again.');
            } else {
                alert(error?.response?.data?.message || 'Failed to start interview. Please try again.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center py-4 sm:py-6 px-4 overflow-hidden">
            <div className="w-full max-w-2xl mb-4 sm:mb-6">
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
                className="max-w-2xl w-full text-center mb-6 sm:mb-8"
            >
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">Configure Your Interview</h1>
                <p className="text-xs sm:text-base md:text-lg text-text-muted">Our AI will generate tailored questions based on your profile.</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-xl bg-surface border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl relative"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>

                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div>
                        <label className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">
                            <FiBriefcase className="text-primary flex-shrink-0" />
                            <span>Target Role</span>
                        </label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                        >
                            <option value="Frontend">Frontend Engineer</option>
                            <option value="Backend">Backend Engineer</option>
                            <option value="Fullstack">Fullstack Engineer</option>
                            <option value="Data Science">Data Scientist</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">
                            <FiStar className="text-accent flex-shrink-0" />
                            <span>Experience Level</span>
                        </label>
                        <select
                            value={formData.experienceLevel}
                            onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                        >
                            <option value="Fresher">Fresher (0 years)</option>
                            <option value="1-3 years">1-3 years</option>
                            <option value="3-5 years">3-5 years</option>
                            <option value="5+ years">Senior (5+ years)</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">
                            <FiBriefcase className="text-secondary flex-shrink-0" />
                            <span>Industry Mode</span>
                        </label>
                        <select
                            value={formData.industryMode}
                            onChange={(e) => setFormData({ ...formData, industryMode: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                        >
                            <option value="Product company">Product company</option>
                            <option value="Service company">Service company</option>
                            <option value="Startup">Startup</option>
                            <option value="MNC">MNC</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">
                            <FiStar className="text-secondary flex-shrink-0" />
                            <span>Interview Mode</span>
                        </label>
                        <select
                            value={formData.interviewMode}
                            onChange={(e) => setFormData({ ...formData, interviewMode: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                        >
                            <option value="timed">Timed (auto-skip + auto-submit)</option>
                            <option value="untimed">Untimed (self-paced)</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium text-white mb-1.5 sm:mb-2">
                            <FiStar className="text-primary flex-shrink-0" />
                            <span>Question Count (3-7)</span>
                        </label>
                        <input
                            type="number"
                            min={3}
                            max={7}
                            value={formData.questionCount}
                            onChange={(e) => setFormData({ ...formData, questionCount: Number(e.target.value) })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="pt-2 sm:pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2.5 sm:py-4 rounded-lg sm:rounded-xl transition-all flex justify-center items-center space-x-2 relative group text-sm sm:text-base"
                        >
                            {loading ? (
                                <div className="flex items-center space-x-2">
                                    <svg className="animate-spin h-4 h-5 sm:h-5 w-4 sm:w-5 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="hidden sm:inline">Generating Interface...</span>
                                    <span className="sm:hidden">Loading...</span>
                                </div>
                            ) : (
                                <>
                                    <FiPlayCircle className="w-4 h-4 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform flex-shrink-0" />
                                    <span className="hidden sm:inline">Start Mock Interview</span>
                                    <span className="sm:hidden">Start Interview</span>
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-text-muted mt-2 sm:mt-4">
                            {formData.interviewMode === 'timed'
                                ? `Timed mode: ${Math.floor(perQuestionSeconds / 60)}m ${perQuestionSeconds % 60}s per question, about ${estimatedTotalMinutes} minutes total.`
                                : 'Untimed mode: answer at your own pace and submit manually.'}
                        </p>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
