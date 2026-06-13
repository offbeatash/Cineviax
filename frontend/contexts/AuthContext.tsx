import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { deleteStoredToken, getStoredToken, setStoredToken } from '../utils/tokenStorage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_guest: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const storedToken = await getStoredToken();
      if (storedToken) {
        const response = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setToken(storedToken);
        setUser(response.data);
      }
    } catch (error) {
      console.error('Error loading token:', error);
      await deleteStoredToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getApiErrorMessage = (error: any, fallback: string) => {
    if (error?.response?.data?.detail) {
      return error.response.data.detail;
    }
    if (error?.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return fallback;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/login`, {
        email,
        password,
      });
      const { access_token, user: profile } = response.data;
      await setStoredToken(access_token);
      setToken(access_token);
      setUser(profile);
    } catch (error: any) {
      throw new Error(getApiErrorMessage(error, 'Login failed'));
    }
  };

  const signup = async (name: string, email: string, phone: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/signup`, {
        name,
        email,
        phone: phone || null,
        password,
      });
      const { access_token, user: profile } = response.data;
      await setStoredToken(access_token);
      setToken(access_token);
      setUser(profile);
    } catch (error: any) {
      throw new Error(getApiErrorMessage(error, 'Signup failed'));
    }
  };

  const guestLogin = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/guest`);
      const { access_token, user: profile } = response.data;
      await setStoredToken(access_token);
      setToken(access_token);
      setUser(profile);
    } catch (error: any) {
      throw new Error(getApiErrorMessage(error, 'Guest login failed'));
    }
  };

  const updateProfile = async (name: string) => {
    if (!token) {
      throw new Error('You must be logged in to update your profile');
    }

    try {
      const response = await axios.patch(
        `${API_URL}/api/me`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data);
    } catch (error: any) {
      throw new Error(getApiErrorMessage(error, 'Profile update failed'));
    }
  };

  const logout = async () => {
    await deleteStoredToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, guestLogin, updateProfile, logout, token }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
