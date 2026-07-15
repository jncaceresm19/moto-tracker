import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/auth-context';
import { ThemeProvider, useTheme } from '../src/theme-context';
import { LanguageProvider, useLanguage } from '../src/language-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Location from 'expo-location';
import { isBiometricEnabled, hasBiometricPreference, hasBiometricHardware, isBiometricEnrolled, enableBiometric, disableBiometric, authenticateWithBiometrics } from '../src/services/biometric';
import BiometricLockScreen from './(auth)/biometric';
import { api } from '../src/api';
import { getDueRemindersByDate, getReminderMessage } from '../src/services/reminderService';
import { CustomAlert } from '../src/components/CustomAlert';

SplashScreen.preventAutoHideAsync();

// TODO: Push notifications - re-enable when using development build
// import * as Notifications from 'expo-notifications';
// import { api } from '../src/api';
//
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });
//
// async function registerForPushNotifications() {
//   try {
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;
//     if (existingStatus !== 'granted') {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }
//     if (finalStatus !== 'granted') return;
//     const tokenData = await Notifications.getExpoPushTokenAsync();
//     const pushToken = tokenData.data;
//     await api('/api/notifications/push-token', { method: 'POST', body: { token: pushToken } });
//   } catch (error) {
//     console.log('[PUSH] Registration error:', error);
//   }
// }

function RootLayoutInner() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [biometricNeeded, setBiometricNeeded] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [reminderAlert, setReminderAlert] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);
  const biometricChecked = useRef(false);

  // Banking-style: lock only after 5+ minutes in background
  useEffect(() => {
    const LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      // App went to background - record timestamp
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
        console.log('[AUTH] App went to background');
      }

      // App came to foreground - check time elapsed
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const elapsed = backgroundTime.current ? Date.now() - backgroundTime.current : 0;
        console.log('[AUTH] App returned to foreground, elapsed:', Math.round(elapsed / 1000), 's');

        if (user && elapsed >= LOCK_THRESHOLD_MS) {
          const enabled = await isBiometricEnabled();
          if (enabled) {
            setBiometricNeeded(true);
          }
        }
        backgroundTime.current = null;
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    if (isLoading) return;

    // No user → go to login
    if (!user) {
      router.replace('/(auth)/login');
      SplashScreen.hideAsync();
      biometricChecked.current = true;
      setInitialCheckDone(true);
      return;
    }

    // Register push token when user is logged in
    // TODO: Re-enable when using development build (expo-notifications push removed from Expo Go SDK 53+)
    // registerForPushNotifications();

    // Save user location for proximity-based notifications
    saveUserLocation();

    // Check for due oil change reminders
    checkDueReminders();

    // Check biometric only once per session
    if (!biometricChecked.current) {
      console.log('[AUTH] Checking biometric...');
      checkBiometricFlow();
    }
  }, [user, isLoading]);

  const saveUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (location) {
        api('/api/profile/location', {
          method: 'PUT',
          body: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        }).catch(() => {}); // fire and forget
      }
    } catch (err) {
      console.log('[LOCATION] Could not save location:', err);
    }
  };

  const checkDueReminders = async () => {
    try {
      // Check date-based reminders only — this is reliable
      const dueByDate = await getDueRemindersByDate();
      
      if (dueByDate.length > 0) {
        const first = dueByDate[0];
        const msg = getReminderMessage(first, 'date');
        setReminderAlert({ visible: true, title: msg.title, message: msg.body });
      }
    } catch (err) {
      console.log('[REMINDER] Check error:', err);
    }
  };

  const checkBiometricFlow = async () => {
    try {
      const hasPreference = await hasBiometricPreference();
      console.log('[AUTH] Has preference:', hasPreference);

      if (hasPreference) {
        // User already answered before → use their preference
        const enabled = await isBiometricEnabled();
        console.log('[AUTH] Biometric enabled:', enabled);
        biometricChecked.current = true;
        setInitialCheckDone(true);
        SplashScreen.hideAsync();
        if (enabled) {
          // Banking style: always lock on fresh start
          setBiometricNeeded(true);
        } else {
          router.replace('/(app)');
        }
      } else {
        // First time → check if device supports biometrics
        const hasHardware = await hasBiometricHardware();
        const enrolled = await isBiometricEnrolled();
        console.log('[AUTH] Hardware:', hasHardware, '| Enrolled:', enrolled);

        biometricChecked.current = true;
        setInitialCheckDone(true);
        SplashScreen.hideAsync();

        if (hasHardware && enrolled) {
          // Device supports biometrics → ask user if they want to enable
          setShowBiometricPrompt(true);
        } else {
          // Device doesn't support → go to app
          router.replace('/(app)');
        }
      }
    } catch (error) {
      console.log('[AUTH] Biometric check error:', error);
      biometricChecked.current = true;
      setInitialCheckDone(true);
      SplashScreen.hideAsync();
      router.replace('/(app)');
    }
  };

  const handleEnableBiometric = async () => {
    setShowBiometricPrompt(false);
    const authenticated = await authenticateWithBiometrics();
    if (authenticated) {
      await enableBiometric();
      setBiometricNeeded(true);
    } else {
      router.replace('/(app)');
    }
  };

  const handleSkipBiometric = async () => {
    setShowBiometricPrompt(false);
    await disableBiometric();
    router.replace('/(app)');
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {biometricNeeded && user && initialCheckDone && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <BiometricLockScreen
            onSuccess={() => {
              setBiometricNeeded(false);
              router.replace('/(app)');
            }}
          />
        </View>
      )}

      {/* Biometric Onboarding Prompt - first time only */}
      <Modal visible={showBiometricPrompt} transparent animationType="fade">
        <View style={onboardingStyles.overlay}>
          <View style={[onboardingStyles.card, { backgroundColor: colors.surface }]}>
            <View style={[onboardingStyles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="finger-print" size={48} color={colors.primary} />
            </View>
            <Text style={[onboardingStyles.title, { color: colors.text }]}>
              {t('biometricOnboardingTitle')}
            </Text>
            <Text style={[onboardingStyles.subtitle, { color: colors.textSecondary }]}>
              {t('biometricOnboardingMessage')}
            </Text>
            <TouchableOpacity
              style={[onboardingStyles.enableBtn, { backgroundColor: colors.primary }]}
              onPress={handleEnableBiometric}
            >
              <Ionicons name="finger-print" size={20} color="#FFFFFF" />
              <Text style={onboardingStyles.enableBtnText}>
                {t('enableBiometric')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={onboardingStyles.skipBtn}
              onPress={handleSkipBiometric}
            >
              <Text style={[onboardingStyles.skipBtnText, { color: colors.textSecondary }]}>
                {t('skip')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Oil Change Reminder Alert */}
      <CustomAlert
        visible={reminderAlert.visible}
        title={reminderAlert.title}
        message={reminderAlert.message}
        buttons={[{ text: 'OK', onPress: () => setReminderAlert({ visible: false, title: '', message: '' }) }]}
        icon="alarm-outline"
        iconColor={colors.accent}
        onClose={() => setReminderAlert({ visible: false, title: '', message: '' })}
      />
    </View>
  );
}

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

const onboardingStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  enableBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipBtn: {
    marginTop: 12,
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <RootLayoutInner />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
