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
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in-progress'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
                const response = await api.get(`/interviews${query}`);
                setItems(response.data);
            } catch (error) {
                console.error('Failed to load history:', error);
            } finally {
                setLoading(false);
            }
        };

        setLoading(true);
        loadHistory();
    }, [statusFilter]);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Interview History</h1>
                    <p className="text-text-muted">Review all your interview sessions and performance trends.</p>
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'in-progress')}
                    className="bg-surface border border-border rounded-lg px-4 py-2 text-white"
                >
                    <option value="all">All sessions</option>
                    <option value="completed">Completed</option>
                    <option value="in-progress">In-progress</option>
                </select>
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
                    ) : items.length === 0 ? (
                        <div className="p-6 text-text-muted">No interview history yet.</div>
                    ) : (
                        items.map((item) => (
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
