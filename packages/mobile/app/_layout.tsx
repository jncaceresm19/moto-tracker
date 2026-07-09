import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth-context';
import { ThemeProvider, useTheme } from '../src/theme-context';
import { LanguageProvider } from '../src/language-context';
import * as SplashScreen from 'expo-splash-screen';
import { isBiometricEnabled } from '../src/services/biometric';
import BiometricLockScreen from './(auth)/biometric';

SplashScreen.preventAutoHideAsync();

// Track biometric auth across the session
let biometricAuthenticated = false;

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      biometricAuthenticated = false;
      router.replace('/(auth)/login');
      SplashScreen.hideAsync();
    }
  }, [user, isLoading]);

  return null;
}

function RootLayoutInner() {
  const { user, isLoading } = useAuth();
  const [biometricNeeded, setBiometricNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setBiometricNeeded(false);
      SplashScreen.hideAsync();
      return;
    }

    // Already authenticated this session → skip
    if (biometricAuthenticated) {
      console.log('[AUTH] Biometric already authenticated this session');
      setBiometricNeeded(false);
      SplashScreen.hideAsync();
      return;
    }

    console.log('[AUTH] Checking biometric...');
    isBiometricEnabled().then((enabled) => {
      console.log('[AUTH] Biometric enabled:', enabled);
      setBiometricNeeded(enabled);
      SplashScreen.hideAsync();
    });
  }, [user, isLoading]);

  // Still loading — splash visible
  if (biometricNeeded === null) {
    return null;
  }

  // Biometric lock
  if (biometricNeeded === true) {
    return (
      <BiometricLockScreen
        onSuccess={() => {
          biometricAuthenticated = true;
          setBiometricNeeded(false);
        }}
      />
    );
  }

  // Normal
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <RootLayoutInner />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
