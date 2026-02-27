import axios from 'axios';
import Cookies from 'js-cookie';

const externalApi = process.env.NEXT_PUBLIC_API_URL;
const formattedBase = (() => {
    if (!externalApi) {
        return '/api';
    }

    if (externalApi.endsWith('/api')) {
        return externalApi;
    }

    return `${externalApi.replace(/\/+$/, '')}/api`;
})();

const api = axios.create({
    baseURL: formattedBase,
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
    (config) => {
        const token = Cookies.get('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
