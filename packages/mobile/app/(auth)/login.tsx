import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(t('error'), t('fillAllFields'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      router.replace('/(app)');
    } catch (err) {
      showAlert(
        t('error'),
        err instanceof Error ? err.message : t('loginFailed'),
        [{ text: 'OK' }],
        'close-circle',
        '#FF3B30'
      );
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.background,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 0,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 14,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 6,
    },
    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 12,
      color: colors.textMuted,
      fontSize: 14,
    },
    googleButton: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
    },
    googleButtonTextDisabled: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
    googleNote: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 6,
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 15,
      fontWeight: '600',
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={styles.brandBlock}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/nombre.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={dynamicStyles.subtitle}>
          {t('signInTitle')}
        </Text>
      </View>

      <TextInput
        style={dynamicStyles.input}
        placeholder={t('email')}
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={dynamicStyles.input}
        placeholder={t('password')}
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={dynamicStyles.buttonText}>
          {loading ? t('signInLoading') : t('signInButton')}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={dynamicStyles.dividerLine} />
        <Text style={dynamicStyles.dividerText}>{t('or')}</Text>
        <View style={dynamicStyles.dividerLine} />
      </View>

      <TouchableOpacity
        style={dynamicStyles.googleButton}
        onPress={() =>
          showAlert(
            'Coming Soon',
            'Google Sign-In will be available in a future update.',
            [{ text: 'OK' }],
            'information-circle',
            '#007AFF'
          )
        }
        disabled
      >
        <Text style={dynamicStyles.googleButtonTextDisabled}>
          {t('continueWithGoogle')}
        </Text>
      </TouchableOpacity>

      <Text style={dynamicStyles.googleNote}>
        {t('googleComingSoon')}
      </Text>

      <Link href="/(auth)/register" asChild>
        <TouchableOpacity>
          <Text style={dynamicStyles.link}>
            {t('noAccount')}
          </Text>
        </TouchableOpacity>
      </Link>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon={alertIcon}
        iconColor={alertIconColor}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },

  icon: {
    width: 80,
    height: 80,
    marginBottom: -60,
  },

  logo: {
    width: 500,
    height: 180,
    marginBottom: -60,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
});
