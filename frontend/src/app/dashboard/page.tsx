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

    return (
        <div className="max-w-6xl mx-auto h-full overflow-hidden flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
                <p className="text-text-muted">
                    {summary.user.role} ({summary.user.experienceLevel}) | Industry Mode: {summary.user.industryMode}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-surface p-6 rounded-2xl border border-border flex items-center space-x-4"
                    >
                        <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-muted">{stat.label}</p>
                            <h3 className="text-xl font-bold text-white mt-1">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-2xl border border-border p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Level Progress</h2>
                    <p className="text-text-muted mb-2">Level {summary.user.level}</p>
                    <div className="w-full h-3 bg-background rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${levelProgress.progressPercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-text-muted">
                        {levelProgress.currentLevelXp}/{levelProgress.xpForNext} XP to next level
                    </p>
                    <p className="text-sm text-text-muted mt-2">Longest streak: {summary.user.longestStreak} day(s)</p>
                </div>

                <div className="bg-surface rounded-2xl border border-border p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Badges</h2>
                    {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {badges.map((badge) => (
                                <span key={badge} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm border border-primary/40">
                                    {badge}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-muted">Complete interviews to unlock badges.</p>
                    )}
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1 min-h-0">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-white">Recent Interviews</h2>
                </div>

                <div className="divide-y divide-border overflow-y-auto max-h-full">
                    {summary.recentInterviews.length > 0 ? summary.recentInterviews.map((interview) => (
                        <div key={interview._id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div>
                                <h3 className="font-medium text-white mb-1">{interview.role}</h3>
                                <p className="text-sm text-text-muted">
                                    {interview.industryMode} | {new Date(interview.updatedAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-text-muted mb-1">Score</p>
                                <p className="font-bold text-accent">{Number(interview.score || 0).toFixed(1)}</p>
                                <Link
                                    href={`/dashboard/history/${interview._id}`}
                                    className="inline-block mt-2 text-sm text-primary hover:text-primary-hover"
                                >
                                    View Analysis
                                </Link>
                            </div>
                        </div>
                    )) : (
                        <div className="p-6 text-text-muted">No interviews completed yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
