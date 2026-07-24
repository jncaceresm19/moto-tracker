import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, verifyRegistration, logout as apiLogout, getProfile } from './api';

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  rut?: string;
  role?: string;
  birthDate?: string;
  verificadoClaveunica?: boolean;
  identidadVerificada?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithToken: (accessToken: string, refreshToken: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string, rut?: string, birthDate?: string) => Promise<void>;
  completeRegistration: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'cachedProfile';

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
      const updated = { id: user?.id || profile.id, email: profile.email, name: profile.name, phone: (profile as any)?.phone, avatarUrl: profile.avatarUrl, role: (profile as any)?.role, birthDate: (profile as any)?.birthDate, createdAt: (profile as any)?.createdAt };
      setUser(updated);
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(updated));
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', PROFILE_CACHE_KEY]);
        setUser(null);
      }
      // Keep current user data for other errors
    }
  };

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const decoded = decodeToken(token);
        if (decoded) {
          // Show cached profile immediately
          const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            try { setUser(JSON.parse(cached)); } catch {}
          } else {
            setUser(decoded);
          }

          // Fetch fresh profile in background
          setIsLoading(false);
          try {
            const profile = await getProfile();
            const full = { id: decoded.id, email: profile.email, name: profile.name, phone: (profile as any)?.phone, avatarUrl: profile.avatarUrl, role: (profile as any)?.role, birthDate: (profile as any)?.birthDate, createdAt: (profile as any)?.createdAt };
            setUser(full);
            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(full));
          } catch (e: any) {
            if (e?.message === 'SESSION_EXPIRED') {
              await AsyncStorage.multiRemove(['accessToken', 'refreshToken', PROFILE_CACHE_KEY]);
              setUser(null);
            }
            // Keep cached data for other errors
          }
          return;
        } else {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', PROFILE_CACHE_KEY]);
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
      const full = { ...data.user, email: profile.email, name: profile.name, phone: (profile as any).phone, avatarUrl: profile.avatarUrl, role: (profile as any).role, birthDate: (profile as any).birthDate, createdAt: (profile as any).createdAt };
      setUser(full);
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(full));
    } catch {
      // Keep login data (includes createdAt from login response)
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string, rut?: string, birthDate?: string) => {
    // Step 1: Save pending user + send OTP (no tokens, no user created yet)
    await apiRegister(email, password, name, phone, rut, birthDate);
  };

  const completeRegistration = async (email: string, code: string) => {
    // Step 2: Verify OTP + create user + get tokens
    const data = await verifyRegistration(email, code);
    setUser(data.user);
  };

  const signInWithToken = async (accessToken: string, refreshToken: string) => {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    const profile = await getProfile();
    setUser({ id: profile.id, email: profile.email, name: profile.name, phone: (profile as any).phone, avatarUrl: profile.avatarUrl, role: (profile as any).role, birthDate: (profile as any).birthDate, createdAt: (profile as any).createdAt });
  };

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signInWithToken, signUp, completeRegistration, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
