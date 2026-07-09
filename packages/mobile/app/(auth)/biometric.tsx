import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
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
        if (onSuccess) {
          onSuccess();
        }
        router.replace('/(app)');
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
      <View style={styles.iconContainer}>
        <Ionicons name="finger-print" size={80} color="#FFFFFF" />
      </View>

      <Text style={[styles.title, { color: '#FFFFFF' }]}>
        {t('biometricLockTitle')}
      </Text>

      <Text style={[styles.subtitle, { color: '#FFFFFFCC' }]}>
        {t('biometricLockSubtitle')}
      </Text>

      {error && (
        <Text style={[styles.error, { color: '#FFFFFFCC' }]}>
          {t('biometricFailed')} ({attempts}/{MAX_ATTEMPTS})
        </Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
      ) : (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: '#FFFFFF20' }]}
          onPress={attemptAuth}
        >
          <Ionicons name="finger-print" size={24} color="#fff" />
          <Text style={styles.retryText}>{t('biometricLockRetry')}</Text>
        </TouchableOpacity>
      )}
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
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loader: {
    marginTop: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
