'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';

type GoogleCredentialResponse = {
    credential?: string;
};

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (options: {
                        client_id: string;
                        callback: (response: GoogleCredentialResponse) => void;
                    }) => void;
                    renderButton: (
                        element: HTMLElement,
                        options: {
                            theme?: 'outline' | 'filled_blue' | 'filled_black';
                            size?: 'large' | 'medium' | 'small';
                            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                            width?: string | number;
                        }
                    ) => void;
                };
            };
        };
    }
}

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Frontend',
        experienceLevel: 'Fresher',
        industryMode: 'Product company',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const login = useAuthStore((state) => state.login);
    const router = useRouter();
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleResponse = async (response: GoogleCredentialResponse) => {
        if (!response.credential) {
            setError('Google sign up failed');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const apiResponse = await api.post('/users/google', { idToken: response.credential });
            login(apiResponse.data, apiResponse.data.token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Google sign up failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!googleClientId) {
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (!window.google) {
                return;
            }

            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleResponse,
            });

            const buttonContainer = document.getElementById('google-signup-button');
            if (buttonContainer) {
                buttonContainer.innerHTML = '';
                window.google.accounts.id.renderButton(buttonContainer, {
                    theme: 'outline',
                    size: 'large',
                    text: 'signup_with',
                    shape: 'rectangular',
                    width: '100%',
                });
            }
        };

        document.body.appendChild(script);

        return () => {
            script.remove();
        };
    }, [googleClientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/users', formData);
            login(response.data, response.data.token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full bg-surface p-8 rounded-2xl shadow-xl border border-border"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Create an Account</h1>
                    <p className="text-text-muted">Start your AI interview preparation journey</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Full Name</label>
                        <input
                            type="text"
                            name="name"
                            required
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                            placeholder="John Doe"
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                            placeholder="john@example.com"
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            required
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                            placeholder="••••••••"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Target Role</label>
                            <select
                                name="role"
                                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                                onChange={handleChange}
                            >
                                <option value="Frontend">Frontend Engineer</option>
                                <option value="Backend">Backend Engineer</option>
                                <option value="Fullstack">Fullstack Engineer</option>
                                <option value="Data Science">Data Scientist</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Experience</label>
                            <select
                                name="experienceLevel"
                                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                                onChange={handleChange}
                            >
                                <option value="Fresher">Fresher</option>
                                <option value="1-3 years">1-3 years</option>
                                <option value="3-5 years">3-5 years</option>
                                <option value="5+ years">5+ years</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Industry Mode</label>
                        <select
                            name="industryMode"
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                            onChange={handleChange}
                        >
                            <option value="Product company">Product company</option>
                            <option value="Service company">Service company</option>
                            <option value="Startup">Startup</option>
                            <option value="MNC">MNC</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-lg transition-colors mt-6 flex justify-center items-center h-12"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : "Create Account"}
                    </button>
                </form>

                {googleClientId && (
                    <>
                        <div className="my-6 flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-text-muted uppercase tracking-wide">or</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        <div id="google-signup-button" className="flex justify-center" />
                    </>
                )}

                <p className="mt-6 text-center text-text-muted text-sm">
                    Already have an account? <Link href="/login" className="text-primary hover:text-primary-hover font-medium">Log in</Link>
                </p>
            </motion.div>
        </div>
    );
}
