/* eslint-disable react-refresh/only-export-components */

import API_BASE from '../config/api.js';
import { createContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);

// All API calls go through this instead of plain fetch.
// On 401 → tries /auth/refresh → retries original request once.
// If refresh fails → clears authentication state.
export const authFetch = async (url, options = {}, onForceLogout) => {
    const defaultOptions = {
        ...options,
        credentials: 'include',
    };

    let res = await fetch(url, defaultOptions);

    if (res.status === 401) {
        // Try silent refresh
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
        });

        if (refreshRes.ok) {
            // Retry original request with the new access token cookie
            res = await fetch(url, defaultOptions);
        } else {
            // Refresh failed → user is no longer authenticated
            if (onForceLogout) {
                onForceLogout();
            }

            return res;
        }
    }

    return res;
};

const fetchUser = async (setUser, setIsLoading, onForceLogout) => {
    try {
        const response = await authFetch(
            `${API_BASE}/auth/me`,
            {},
            onForceLogout
        );

        const data = await response.json();

        if (response.ok) {
            setUser(data.user);
        } else {
            setUser(null);
        }
    } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
    } finally {
        setIsLoading(false);
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // IMPORTANT:
    // Do NOT redirect here.
    // Being logged out is a valid authentication state.
    const forceLogout = () => {
        setUser(null);
    };

    useEffect(() => {
        fetchUser(setUser, setIsLoading, forceLogout);
    }, []);

    const logout = async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (_) {
            // Ignore logout network errors
        }

        setUser(null);
        toast.success('Logged out successfully');

        // ❌ Do not use window.location.href here.
        // React will re-render based on user === null.
    };

    const refreshUser = async () => {
        setIsLoading(true);

        await fetchUser(
            setUser,
            setIsLoading,
            forceLogout
        );
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                logout,
                isLoading,
                refreshUser,
                authFetch,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};