import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth-context';
import { ThemeProvider, useTheme } from '../src/theme-context';
import { LanguageProvider } from '../src/language-context';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && !inAppGroup) {
      router.replace('/(app)');
    }

    // Always hide splash after first nav decision
    if (!navReady) {
      SplashScreen.hideAsync().then(() => setNavReady(true));
    }
  }, [user, isLoading, segments]);

  return null;
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
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}