import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getProfile } from './api';

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

function decodeToken(token: string): { id: string; email: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.userId && payload.email) {
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }
      return { id: payload.userId, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const profile = await getProfile();
      setUser(prev => prev ? { ...prev, name: profile.name, avatarUrl: profile.avatarUrl, email: profile.email } : prev);
    } catch {
      // Profile fetch failed, keep existing user state
    }
  };

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const decoded = decodeToken(token);
        if (decoded) {
          setUser(decoded);
          // Fetch full profile in background
          try {
            const profile = await getProfile();
            setUser({ id: decoded.id, email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl });
          } catch {
            // Keep decoded token data
          }
        } else {
          await AsyncStorage.removeItem('accessToken');
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
    // Fetch full profile
    try {
      const profile = await getProfile();
      setUser({ id: data.user.id, email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl });
    } catch {
      // Keep login data
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const data = await apiRegister(email, password, name);
    setUser(data.user);
  };

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
