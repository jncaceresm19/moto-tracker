import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { authenticateWithBiometrics } from '../../src/services/biometric';

const MAX_ATTEMPTS = 3;

interface Props {
  onSuccess?: () => void;
}

export default function BiometricLockScreen({ onSuccess }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      attemptAuth();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const attemptAuth = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);

    try {
      const result = await authenticateWithBiometrics();

      if (result) {
        setAuthSuccess(true);
        // Small delay so user sees the loader before navigating
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
          router.replace('/(app)');
        }, 800);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(true);

        if (newAttempts >= MAX_ATTEMPTS) {
          router.replace('/(auth)/login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      {/* Logo from login */}
      <View style={styles.brandBlock}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      {/* Fingerprint area */}
      <View style={styles.fingerprintArea}>
        {authSuccess ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#FFFFFF" />
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" style={styles.fingerprintLoader} />
        ) : (
          <TouchableOpacity
            style={[styles.fingerprintButton, { borderColor: '#FFFFFF' }]}
            onPress={attemptAuth}
          >
            <Ionicons name="finger-print" size={56} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {!authSuccess && !loading && (
          <Text style={[styles.subtitle, { color: '#FFFFFFCC' }]}>
            {t('biometricLockSubtitle')}
          </Text>
        )}

        {error && !authSuccess && (
          <Text style={[styles.error, { color: '#FFFFFFCC' }]}>
            {t('biometricFailed')} ({attempts}/{MAX_ATTEMPTS})
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  icon: {
    width: 100,
    height: 100,
  },
  fingerprintArea: {
    alignItems: 'center',
    marginTop: 24,
  },
  fingerprintButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  fingerprintLoader: {
    width: 110,
    height: 110,
    marginBottom: 20,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  loader: {
    marginTop: 12,
  },
});
