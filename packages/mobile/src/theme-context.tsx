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
  accent: string;
  accentText: string;
  danger: string;
  dangerText: string;
  success: string;
  successText: string;
  card: string;
  inputBg: string;
  inputBorder: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  headerBg: string;
  headerTintColor: string;
  overlay: string;
  statusBarStyle: 'dark-content' | 'light-content';
  // Dashboard colors
  ink: string;
  inkSoft: string;
  inkFaint: string;
  alertRed: string;
  alertRedBg: string;
  alertRedBorder: string;
  brandBlue: string;
  brandBlueBg: string;
  amber: string;
  amberBg: string;
  green: string;
}

const lightTheme: ThemeColors = {
  background: '#F0F2F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7F8FA',
  text: '#1C1D1F',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F0F1F3',
  primary: '#1B75BC',
  primaryText: '#FFFFFF',
  accent: '#F7941E',
  accentText: '#4A2A05',
  danger: '#DC2626',
  dangerText: '#FFFFFF',
  success: '#16A34A',
  successText: '#FFFFFF',
  card: '#F7F8FA',
  inputBg: '#FFFFFF',
  inputBorder: '#D1D5DB',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarActive: '#1B75BC',
  tabBarInactive: '#9CA3AF',
  headerBg: '#1B75BC',
  headerTintColor: '#FFFFFF',
  overlay: 'rgba(15, 23, 32, 0.5)',
  statusBarStyle: 'dark-content',
  // Dashboard colors
  ink: '#171B26',
  inkSoft: '#5A6478',
  inkFaint: '#93A0B4',
  alertRed: '#E14336',
  alertRedBg: '#FDEBEA',
  alertRedBorder: '#F6C7C3',
  brandBlue: '#2F6FED',
  brandBlueBg: '#EAF1FE',
  amber: '#F5A623',
  amberBg: '#FEF3E0',
  green: '#1F9D63',
};

const darkTheme: ThemeColors = {
  background: '#121212',
  surface: '#1C1D1F',
  surfaceSecondary: '#232427',
  text: '#F3F4F6',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: '#2D2E30',
  borderLight: '#252627',
  primary: '#4C9AE0',
  primaryText: '#FFFFFF',
  accent: '#FFA940',
  accentText: '#1C1D1F',
  danger: '#F87171',
  dangerText: '#1C1D1F',
  success: '#4ADE80',
  successText: '#1C1D1F',
  card: '#1C1D1F',
  inputBg: '#1F2023',
  inputBorder: '#3A3B3E',
  tabBar: '#132332',
  tabBarBorder: '#1D3A4F',
  tabBarActive: '#4C9AE0',
  tabBarInactive: '#5E7A8C',
  headerBg: '#132332',
  headerTintColor: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.65)',
  statusBarStyle: 'light-content',
  // Dashboard colors
  ink: '#F0F2F5',
  inkSoft: '#A0A8B8',
  inkFaint: '#6B7280',
  alertRed: '#F87171',
  alertRedBg: '#3D1A1A',
  alertRedBorder: '#5C2A2A',
  brandBlue: '#6B8FE8',
  brandBlueBg: '#1A2440',
  amber: '#FBBF24',
  amberBg: '#3D2E10',
  green: '#34D399',
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

// Helper para pasar a <NavigationContainer theme={...}> de React Navigation
export function getNavigationTheme(colors: ThemeColors, mode: ThemeMode) {
  return {
    dark: mode === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.headerBg,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  };
}