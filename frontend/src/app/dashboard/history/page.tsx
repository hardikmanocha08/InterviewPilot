'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type InterviewHistoryItem = {
    _id: string;
    role: string;
    experienceLevel: string;
    industryMode: string;
    score: number;
    status: 'in-progress' | 'completed';
    endedReason?: 'manual' | 'timeout' | 'abandoned';
    updatedAt: string;
};

export default function HistoryPage() {
    const [items, setItems] = useState<InterviewHistoryItem[]>([]);
    const [sortBy, setSortBy] = useState<'date' | 'score' | 'role' | 'status'>('date');
    const [sortValue, setSortValue] = useState<string>('newest');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const response = await api.get('/interviews');
                setItems(response.data);
            } catch (error) {
                console.error('Failed to load history:', error);
            } finally {
                setLoading(false);
            }
        };

        setLoading(true);
        loadHistory();
    }, []);

    const summary = useMemo(() => {
        if (!items.length) {
            return { completed: 0, inProgress: 0, avg: 0 };
        }
        const completed = items.filter((i) => i.status === 'completed');
        const inProgress = items.filter((i) => i.status === 'in-progress').length;
        const avg = completed.length
            ? completed.reduce((sum, i) => sum + (i.score || 0), 0) / completed.length
            : 0;
        return { completed: completed.length, inProgress, avg };
    }, [items]);

    useEffect(() => {
        if (sortBy === 'date') setSortValue('newest');
        if (sortBy === 'role') setSortValue('all');
        if (sortBy === 'score') setSortValue('all');
        if (sortBy === 'status') setSortValue('all');
    }, [sortBy]);

    const sortedItems = useMemo(() => {
        let result = [...items];

        if (sortBy === 'date') {
            result.sort((a, b) => {
                const diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
                return sortValue === 'oldest' ? diff : -diff;
            });
            return result;
        }

        if (sortBy === 'role' && sortValue !== 'all') {
            result = result.filter((item) => item.role === sortValue);
        }

        if (sortBy === 'status' && sortValue !== 'all') {
            result = result.filter((item) => item.status === sortValue);
        }

        if (sortBy === 'score' && sortValue !== 'all') {
            result = result.filter((item) => {
                const score = Number(item.score || 0);
                if (sortValue === 'high') return score >= 8;
                if (sortValue === 'medium') return score >= 5 && score < 8;
                return score < 5;
            });
        }

        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return result;
    }, [items, sortBy, sortValue]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Interview History</h1>
                    <p className="text-text-muted">Review all your interview sessions and performance trends.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'role' | 'status')}
                        className="bg-surface border border-border rounded-lg px-4 py-2 text-white"
                    >
                        <option value="date">Sort by Date</option>
                        <option value="score">Sort by Score</option>
                        <option value="role">Sort by Role</option>
                        <option value="status">Sort by Status</option>
                    </select>
                    <select
                        value={sortValue}
                        onChange={(e) => setSortValue(e.target.value)}
                        className="bg-surface border border-border rounded-lg px-4 py-2 text-white"
                    >
                        {sortBy === 'date' && (
                            <>
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                            </>
                        )}
                        {sortBy === 'role' && (
                            <>
                                <option value="all">All Roles</option>
                                <option value="Frontend">Frontend</option>
                                <option value="Backend">Backend</option>
                                <option value="Fullstack">Fullstack</option>
                                <option value="Data Science">Data Science</option>
                            </>
                        )}
                        {sortBy === 'score' && (
                            <>
                                <option value="all">All Scores</option>
                                <option value="high">High (8-10)</option>
                                <option value="medium">Medium (5-7.9)</option>
                                <option value="low">Low (0-4.9)</option>
                            </>
                        )}
                        {sortBy === 'status' && (
                            <>
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="in-progress">In-progress</option>
                            </>
                        )}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-text-muted text-sm">Completed</p>
                    <p className="text-2xl text-white font-bold">{summary.completed}</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-text-muted text-sm">In-progress</p>
                    <p className="text-2xl text-white font-bold">{summary.inProgress}</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-text-muted text-sm">Average score</p>
                    <p className="text-2xl text-white font-bold">{summary.avg.toFixed(2)}/10</p>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="divide-y divide-border">
                    {loading ? (
                        <div className="p-6 text-text-muted">Loading history...</div>
                    ) : sortedItems.length === 0 ? (
                        <div className="p-6 text-text-muted">No interview history yet.</div>
                    ) : (
                        sortedItems.map((item) => (
                            <div key={item._id} className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium">{item.role}</p>
                                    <p className="text-text-muted text-sm">
                                        {item.experienceLevel} | {item.industryMode} | {new Date(item.updatedAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-text-muted capitalize">{item.status}</p>
                                    <p className="font-bold text-accent">{Number(item.score || 0).toFixed(1)}</p>
                                    <Link
                                        href={`/dashboard/history/${item._id}`}
                                        className="inline-block mt-2 text-sm text-primary hover:text-primary-hover"
                                    >
                                        View Analysis
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
