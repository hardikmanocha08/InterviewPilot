'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiActivity, FiAward, FiTarget, FiZap } from 'react-icons/fi';
import api from '@/lib/api';

type DashboardSummary = {
    user: {
        name: string;
        role: string;
        experienceLevel: string;
        industryMode: string;
        streakCount: number;
        longestStreak: number;
        xp: number;
        level: number;
        badges: string[];
        levelProgress: {
            currentLevelXp: number;
            xpForNext: number;
            progressPercent: number;
        };
    };
    stats: {
        totalInterviews: number;
        averageScore: number;
        strongestRole: string;
        weakestRole: string;
    };
    recentInterviews: Array<{
        _id: string;
        role: string;
        score: number;
        status: string;
        endedReason?: 'manual' | 'timeout' | 'abandoned';
        industryMode: string;
        updatedAt: string;
    }>;
};

export default function Dashboard() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSummary = async () => {
            try {
                const response = await api.get('/dashboard/summary');
                setSummary(response.data);
            } catch (error) {
                console.error('Failed to load dashboard summary:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSummary();
    }, []);

    if (loading) {
        return <div className="text-text-muted">Loading dashboard...</div>;
    }

    if (!summary) {
        return <div className="text-red-400">Failed to load dashboard data.</div>;
    }

    const badges = Array.isArray(summary.user?.badges) ? summary.user.badges : [];
    const levelProgress = summary.user?.levelProgress ?? {
        currentLevelXp: 0,
        xpForNext: 100,
        progressPercent: 0,
    };

    const stats = [
        { label: 'Total Interviews', value: String(summary.stats.totalInterviews), icon: FiActivity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Average Score', value: `${summary.stats.averageScore}/10`, icon: FiAward, color: 'text-green-500', bg: 'bg-green-500/10' },
        { label: 'Current Streak', value: `${summary.user.streakCount} day(s)`, icon: FiZap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { label: 'Weakest Role', value: summary.stats.weakestRole, icon: FiTarget, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];
    const recentFive = summary.recentInterviews.slice(0, 5);

    return (
        <div className="max-w-6xl mx-auto h-full overflow-hidden flex flex-col gap-3 sm:gap-4 px-4 sm:px-6 md:px-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Dashboard Overview</h1>
                <p className="text-xs sm:text-sm text-text-muted truncate">
                    {summary.user.role} ({summary.user.experienceLevel}) | Industry Mode: {summary.user.industryMode}
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-surface p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-2 sm:gap-0"
                    >
                        <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${stat.bg} ${stat.color} flex-shrink-0`}>
                            <stat.icon className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-text-muted">{stat.label}</p>
                            <h3 className="text-sm sm:text-lg font-bold text-white mt-0.5">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-surface rounded-lg sm:rounded-2xl border border-border p-3 sm:p-4">
                    <h2 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3">Level Progress</h2>
                    <p className="text-text-muted mb-2 text-xs sm:text-sm">Level {summary.user.level}</p>
                    <div className="w-full h-2 sm:h-3 bg-background rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${levelProgress.progressPercent}%` }}
                        />
                    </div>
                    <p className="text-xs text-text-muted">
                        {levelProgress.currentLevelXp}/{levelProgress.xpForNext} XP to next level 
                    </p>
                    <p className="text-xs text-text-muted mt-2">Longest streak: {summary.user.longestStreak} day(s)</p>
                </div>

                <div className="bg-surface rounded-lg sm:rounded-2xl border border-border p-3 sm:p-4">
                    <h2 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3">Badges</h2>
                    {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {badges.map((badge) => (
                                <span key={badge} className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/20 text-primary text-[10px] sm:text-xs border border-primary/40">
                                    {badge}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs sm:text-sm text-text-muted">Complete interviews to unlock badges.</p>
                    )}
                </div>
            </div>

            <div className="bg-surface rounded-lg sm:rounded-2xl border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-base sm:text-xl font-bold text-white truncate">Recent Interviews</h2>
                    <span className="text-[10px] sm:text-xs text-text-muted whitespace-nowrap">Last 5</span>
                </div>

                <div className="overflow-y-auto min-h-[240px]">
                    {recentFive.length > 0 ? (
                        <div className="divide-y divide-border">
                            {recentFive.map((interview) => (
                                <div key={interview._id} className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-white/5 transition-colors">
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-4">
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-white text-sm truncate">{interview.role}</h3>
                                            <p className="text-[10px] sm:text-[11px] text-text-muted truncate">
                                                {interview.industryMode} - {new Date(interview.updatedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] sm:text-[11px] text-text-muted">Score</p>
                                            <p className="font-bold text-accent text-xs sm:text-sm">{Number(interview.score || 0).toFixed(1)}/10</p>
                                        </div>
                                        <Link
                                            href={`/dashboard/history/${interview._id}`}
                                            className="text-xs sm:text-sm text-primary hover:text-primary-hover whitespace-nowrap hidden sm:block"
                                        >
                                            View
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6 text-sm text-text-muted">No interviews completed yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
