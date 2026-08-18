/* eslint-disable react-refresh/only-export-components */
import API_BASE from '../config/api.js';
import { createContext, useState, useEffect } from 'react';  
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);


const fetchUser = async (token, setUser, setIsLoading) => {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      setUser(data.user);
    } else {
      localStorage.removeItem('token');
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

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return;
    }

    fetchUser(token, setUser, setIsLoading);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    setUser(null);
    window.location.href = '/';
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');

    if (token) {
      await fetchUser(token, setUser, setIsLoading);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        isLoading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

