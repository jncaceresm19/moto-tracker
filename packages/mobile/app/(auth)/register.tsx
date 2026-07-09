import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showAlert(t('error'), t('fillAllFields'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    // Validate phone format if provided (Chilean format: +569XXXXXXXX)
    if (phone && !/^\+569\d{8}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      showAlert(t('error'), t('invalidPhone'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name, phone || undefined);
      router.replace('/(app)');
    } catch (err) {
      showAlert(t('error'), err instanceof Error ? err.message : t('registrationFailed'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 5,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      marginBottom: 12,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 16,
      fontSize: 14,
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
        <Text style={dynamicStyles.subtitle}>{t('signUpSubtitle')}</Text>
      </View>

      <TextInput
        style={dynamicStyles.input}
        placeholder={t('name')}
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />

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
        placeholder={t('phone')}
        placeholderTextColor={colors.textMuted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      {phone ? null : (
        <Text style={[styles.phoneHint, { color: colors.textMuted }]}>+569XXXXXXXX</Text>
      )}

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
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={dynamicStyles.buttonText}>{loading ? t('signUpLoading') : t('signUpButton')}</Text>
      </TouchableOpacity>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity>
          <Text style={dynamicStyles.link}>{t('hasAccount')}</Text>
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
  phoneHint: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
});