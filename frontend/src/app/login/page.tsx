'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function Login() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const login = useAuthStore((state) => state.login);
    const router = useRouter();
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const googleScriptSrc = 'https://accounts.google.com/gsi/client';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleResponse = async (response: GoogleCredentialResponse) => {
        if (!response.credential) {
            setError('Google login failed');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const apiResponse = await api.post('/users/google', { idToken: response.credential });
            login(apiResponse.data, apiResponse.data.token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Google login failed');
        } finally {
            setLoading(false);
        }
    };

    const initializeGoogleButton = useCallback(() => {
        if (!googleClientId || !window.google) {
            return;
        }

        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleResponse,
        });

        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
            buttonContainer.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: '100%',
            });
        }
    }, [googleClientId]);

    useEffect(() => {
        if (!googleClientId) {
            return;
        }

        if (window.google) {
            initializeGoogleButton();
            return;
        }

        const existingScript = document.querySelector(`script[src="${googleScriptSrc}"]`) as HTMLScriptElement | null;
        if (existingScript) {
            existingScript.addEventListener('load', initializeGoogleButton);
            return () => existingScript.removeEventListener('load', initializeGoogleButton);
        }

        const script = document.createElement('script');
        script.src = googleScriptSrc;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', initializeGoogleButton);
        document.body.appendChild(script);

        return () => {
            script.removeEventListener('load', initializeGoogleButton);
        };
    }, [googleClientId, googleScriptSrc, initializeGoogleButton]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/users/login', formData);
            login(response.data, response.data.token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
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
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-text-muted">Log in to continue your preparation</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        ) : "Log In"}
                    </button>
                </form>

                {googleClientId && (
                    <>
                        <div className="my-6 flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-text-muted uppercase tracking-wide">or</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        <div id="google-signin-button" className="flex justify-center" />
                    </>
                )}

                <p className="mt-6 text-center text-text-muted text-sm">
                    Don't have an account? <Link href="/register" className="text-primary hover:text-primary-hover font-medium">Sign up</Link>
                </p>
            </motion.div>
        </div>
    );
}
