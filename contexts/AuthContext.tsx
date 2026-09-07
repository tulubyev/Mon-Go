import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, setAuthToken, type AuthUser } from '@/services/api';

const TOKEN_KEY = 'mongo_auth_token';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ email: string; requiresVerification: boolean }>;
  verifyCode: (identifier: string, code: string) => Promise<void>;
  sendCode: (identifier: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
}

// SecureStore has no web implementation — mirror BaikalLove's fallback so the
// app still runs in a browser during development.
async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Restore a saved session on cold start. A token that fails /api/auth/me
  // (expired, or the account is gone) is discarded rather than kept around
  // to fail again on every subsequent call.
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadToken();
        if (stored) {
          setAuthToken(stored);
          const me = await api.getMe();
          setToken(stored);
          setUser(me);
        }
      } catch {
        await removeToken();
        setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    await saveToken(data.token);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return api.register(data);
  }, []);

  const verifyCode = useCallback(async (identifier: string, code: string) => {
    const data = await api.verifyCode(identifier, code);
    if (data.token && data.user) {
      await saveToken(data.token);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
    }
  }, []);

  const sendCode = useCallback(async (identifier: string) => {
    await api.sendCode(identifier);
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      await logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        verifyCode,
        sendCode,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
