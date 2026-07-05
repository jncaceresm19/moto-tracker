import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from './api';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.userId && payload.email) {
      // Check if token is expired
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

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const decoded = decodeToken(token);
        if (decoded) {
          setUser(decoded);
        } else {
          // Token is invalid or expired, remove it
          await AsyncStorage.removeItem('accessToken');
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
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
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
