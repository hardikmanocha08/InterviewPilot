import { create } from 'zustand';
import Cookies from 'js-cookie';

interface AuthState {
    user: any | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (userData: any, token: string) => void;
    setUser: (userData: any | null) => void;
    logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: Cookies.get('token') || null,
    isAuthenticated: !!Cookies.get('token'),
    login: (userData, token) => {
        Cookies.set('token', token, { expires: 30 }); // 30 days
        set({ user: userData, token, isAuthenticated: true });
    },
    setUser: (userData) => {
        set((state) => ({ ...state, user: userData }));
    },
    logout: () => {
        Cookies.remove('token');
        set({ user: null, token: null, isAuthenticated: false });
    },
}));

export default useAuthStore;
