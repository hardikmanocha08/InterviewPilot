'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';

type SettingsForm = {
    role: string;
    experienceLevel: string;
    industryMode: 'Product company' | 'Service company' | 'Startup' | 'MNC';
    settings: {
        notifications: boolean;
        darkMode: boolean;
        preferredQuestionCount: number;
        notificationEmail: string;
    };
};

const initialForm: SettingsForm = {
    role: 'Frontend',
    experienceLevel: 'Fresher',
    industryMode: 'Product company',
    settings: {
        notifications: true,
        darkMode: true,
        preferredQuestionCount: 3,
        notificationEmail: '',
    },
};

export default function SettingsPage() {
    const { setUser } = useAuthStore();
    const [form, setForm] = useState<SettingsForm>(initialForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await api.get('/users/profile');
                setForm({
                    role: response.data.role || 'Frontend',
                    experienceLevel: response.data.experienceLevel || 'Fresher',
                    industryMode: response.data.industryMode || 'Product company',
                    settings: {
                        notifications: response.data.settings?.notifications ?? true,
                        darkMode: response.data.settings?.darkMode ?? true,
                        preferredQuestionCount: response.data.settings?.preferredQuestionCount ?? 3,
                        notificationEmail: response.data.settings?.notificationEmail || response.data.email || '',
                    },
                });
            } catch (error) {
                console.error('Failed to load settings:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const response = await api.patch('/users/profile', form);
            setUser(response.data);
            setMessage('Settings saved successfully.');
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const sendTestEmail = async () => {
        setSendingEmail(true);
        setMessage('');
        try {
            const response = await api.post('/users/settings/test-email', {
                email: form.settings.notificationEmail,
            });
            setMessage(response.data?.message || 'Test email sent successfully.');
        } catch (error: any) {
            console.error('Failed to send test email:', error);
            setMessage(error?.response?.data?.message || 'Failed to send test email.');
        } finally {
            setSendingEmail(false);
        }
    };

    useEffect(() => {
        document.documentElement.classList.toggle('theme-light', !form.settings.darkMode);
        localStorage.setItem('theme', form.settings.darkMode ? 'dark' : 'light');
    }, [form.settings.darkMode]);

    if (loading) {
        return <div className="text-text-muted">Loading settings...</div>;
    }

    return (
        <div className="max-w-3xl h-full overflow-hidden flex flex-col gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
                <p className="text-text-muted">Update your interview preferences and profile defaults.</p>
            </div>

            <form onSubmit={saveSettings} className="bg-surface border border-border rounded-2xl p-5 space-y-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-sm text-text-muted block mb-1">Target Role</label>
                    <select
                        value={form.role}
                        onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white"
                    >
                        <option value="Frontend">Frontend Engineer</option>
                        <option value="Backend">Backend Engineer</option>
                        <option value="Fullstack">Fullstack Engineer</option>
                        <option value="Data Science">Data Scientist</option>
                    </select>
                </div>

                <div>
                    <label className="text-sm text-text-muted block mb-1">Experience Level</label>
                    <select
                        value={form.experienceLevel}
                        onChange={(e) => setForm((prev) => ({ ...prev, experienceLevel: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white"
                    >
                        <option value="Fresher">Fresher</option>
                        <option value="1-3 years">1-3 years</option>
                        <option value="3-5 years">3-5 years</option>
                        <option value="5+ years">5+ years</option>
                    </select>
                </div>

                <div>
                    <label className="text-sm text-text-muted block mb-1">Industry Mode</label>
                    <select
                        value={form.industryMode}
                        onChange={(e) => setForm((prev) => ({ ...prev, industryMode: e.target.value as SettingsForm['industryMode'] }))}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white"
                    >
                        <option value="Product company">Product company</option>
                        <option value="Service company">Service company</option>
                        <option value="Startup">Startup</option>
                        <option value="MNC">MNC</option>
                    </select>
                </div>

                <div>
                    <label className="text-sm text-text-muted block mb-1">Default Question Count</label>
                    <input
                        type="number"
                        min={3}
                        max={7}
                        value={form.settings.preferredQuestionCount}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                settings: {
                                    ...prev.settings,
                                    preferredQuestionCount: Number(e.target.value),
                                },
                            }))
                        }
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white"
                    />
                </div>

                <div>
                    <label className="text-sm text-text-muted block mb-1">Notification Email</label>
                    <input
                        type="email"
                        value={form.settings.notificationEmail}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                settings: {
                                    ...prev.settings,
                                    notificationEmail: e.target.value,
                                },
                            }))
                        }
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white"
                        placeholder="you@example.com"
                    />
                </div>
                </div>

                <div className="space-y-3">
                    <label className="flex items-center justify-between text-white">
                        <span>Email Notifications</span>
                        <input
                            type="checkbox"
                            checked={form.settings.notifications}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        notifications: e.target.checked,
                                    },
                                }))
                            }
                        />
                    </label>
                    <label className="flex items-center justify-between text-white">
                        <span>Dark Mode</span>
                        <input
                            type="checkbox"
                            checked={form.settings.darkMode}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        darkMode: e.target.checked,
                                    },
                                }))
                            }
                        />
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary hover:bg-primary-hover disabled:opacity-70 text-white px-5 py-2 rounded-lg"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={sendingEmail}
                    className="ml-3 bg-accent hover:bg-green-600 disabled:opacity-70 text-white px-5 py-2 rounded-lg"
                >
                    {sendingEmail ? 'Sending...' : 'Send Test Email'}
                </button>
                {message && <p className="text-sm text-text-muted">{message}</p>}
            </form>
        </div>
    );
}
