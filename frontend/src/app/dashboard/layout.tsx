'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { FiHome, FiTrendingUp, FiSettings, FiLogOut, FiPlusCircle } from 'react-icons/fi';
import api from '@/lib/api';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const { user, token, setUser, logout } = useAuthStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    useEffect(() => {
        const loadProfile = async () => {
            if (!token) {
                router.replace('/login');
                return;
            }

            if (user) {
                return;
            }

            try {
                const response = await api.get('/users/profile');
                setUser(response.data);
            } catch (error) {
                console.error('Failed to load profile:', error);
                logout();
                router.replace('/login');
            }
        };

        loadProfile();
    }, [token, user, setUser, logout, router]);

    return (
        <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border hidden md:flex flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <Image src="/interviewpilot-logo.svg" alt="InterviewPilot logo" width={32} height={32} />
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">InterviewPilot</h2>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <Link href="/dashboard" className="flex items-center space-x-3 px-4 py-3 text-text-main hover:bg-white/5 rounded-lg transition-colors">
                        <FiHome className="w-5 h-5" />
                        <span>Overview</span>
                    </Link>
                    <Link href="/dashboard/history" className="flex items-center space-x-3 px-4 py-3 text-text-muted hover:text-text-main hover:bg-white/5 rounded-lg transition-colors">
                        <FiTrendingUp className="w-5 h-5" />
                        <span>History</span>
                    </Link>
                    <Link href="/dashboard/settings" className="flex items-center space-x-3 px-4 py-3 text-text-muted hover:text-text-main hover:bg-white/5 rounded-lg transition-colors">
                        <FiSettings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-border">
                    <div className="mb-4 px-4 py-2">
                        <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                        <p className="text-xs text-text-muted">{user?.role || 'Engineer'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 px-4 py-3 w-full text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                        <FiLogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-surface/50 backdrop-blur-md border-b border-border sticky top-0 z-10 flex items-center justify-between px-8 py-4">
                    <div className="md:hidden">
                        <div className="flex items-center gap-2">
                            <Image src="/interviewpilot-logo.svg" alt="InterviewPilot logo" width={24} height={24} />
                            <h2 className="text-xl font-bold text-white">InterviewPilot</h2>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        {/* Breadcrumbs or greeting could go here */}
                        <p className="text-text-muted">Welcome back, <span className="text-white font-medium">{user?.name}</span></p>
                    </div>

                    <Link
                        href="/interview/setup"
                        className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-primary/20"
                    >
                        <FiPlusCircle className="w-5 h-5" />
                        <span>New Interview</span>
                    </Link>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
