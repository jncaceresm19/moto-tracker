import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryText: string;
  danger: string;
  dangerText: string;
  success: string;
  successText: string;
  card: string;
  inputBg: string;
  inputBorder: string;
  tabBar: string;
  tabBarBorder: string;
  headerBg: string;
}

const lightTheme: ThemeColors = {
  background: '#f5f5f5',
  surface: '#fff',
  surfaceSecondary: '#f8f8f8',
  text: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  border: '#eee',
  borderLight: '#f0f0f0',
  primary: '#007AFF',
  primaryText: '#fff',
  danger: '#FF3B30',
  dangerText: '#fff',
  success: '#34C759',
  successText: '#fff',
  card: '#f8f8f8',
  inputBg: '#fff',
  inputBorder: '#ddd',
  tabBar: '#fff',
  tabBarBorder: '#eee',
  headerBg: '#fff',
};

const darkTheme: ThemeColors = {
  background: '#1a1a1a',
  surface: '#2a2a2a',
  surfaceSecondary: '#333',
  text: '#f0f0f0',
  textSecondary: '#aaa',
  textMuted: '#777',
  border: '#444',
  borderLight: '#3a3a3a',
  primary: '#0A84FF',
  primaryText: '#fff',
  danger: '#FF453A',
  dangerText: '#fff',
  success: '#30D158',
  successText: '#fff',
  card: '#2a2a2a',
  inputBg: '#333',
  inputBorder: '#555',
  tabBar: '#2a2a2a',
  tabBarBorder: '#444',
  headerBg: '#2a2a2a',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') {
        setMode(saved);
      }
      setLoaded(true);
    })();
  }, []);

  const setTheme = async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem('theme', newMode);
  };

  const toggleTheme = () => {
    setTheme(mode === 'light' ? 'dark' : 'light');
  };

  const colors = mode === 'dark' ? darkTheme : lightTheme;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
