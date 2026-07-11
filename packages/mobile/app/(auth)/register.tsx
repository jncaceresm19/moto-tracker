import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';
import { sendOtp, verifyOtpCode } from '../../src/services/verificationApi';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP flow state
  const [otpStep, setOtpStep] = useState<'idle' | 'choose' | 'code' | 'success'>('idle');
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // CustomAlert state
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
    if (!name || !email || !password || !rut) {
      showAlert(t('error'), t('fillAllFields'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    // Validate RUT format (basic check)
    const rutClean = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (!/^\d+[0-9K]$/.test(rutClean)) {
      showAlert(t('error'), 'RUT inválido', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    // Validate phone format if provided (Chilean format: +569XXXXXXXX)
    if (phone && !/^\+569\d{8}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      showAlert(t('error'), t('invalidPhone'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name, phone || undefined, rut);
      // Registration successful — show OTP method chooser
      setOtpStep('choose');
    } catch (err) {
      showAlert(t('error'), err instanceof Error ? err.message : t('registrationFailed'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseMethod = async (method: 'email' | 'phone') => {
    setOtpMethod(method);
    setOtpLoading(true);
    try {
      await sendOtp(email, method, phone || undefined);
      setOtpStep('code');
    } catch (err) {
      showAlert(t('error'), 'No se pudo enviar el código', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      showAlert(t('error'), 'El código debe tener 6 dígitos', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }
    setOtpLoading(true);
    try {
      await verifyOtpCode(otpCode);
      setOtpStep('success');
    } catch (err) {
      showAlert(t('error'), 'Código inválido o expirado', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setOtpStep('idle');
    setOtpCode('');
    router.replace('/(auth)/login');
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
        placeholder="RUT"
        placeholderTextColor={colors.textMuted}
        value={rut}
        onChangeText={setRut}
        autoCapitalize="characters"
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

      {/* MODAL: Choose OTP Method */}
      <Modal visible={otpStep === 'choose'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.otpModalTitle, { color: colors.text }]}>Validar cuenta</Text>
                <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>¿Cómo deseas recibir tu código de verificación?</Text>

                <TouchableOpacity
                  style={[styles.otpMethodBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                  onPress={() => handleChooseMethod('email')}
                  disabled={otpLoading}
                >
                  <Ionicons name="mail" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.otpMethodTitle, { color: colors.text }]}>Correo electrónico</Text>
                    <Text style={[styles.otpMethodDesc, { color: colors.textMuted }]}>{email}</Text>
                  </View>
                  {otpLoading && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>

                {phone ? (
                  <TouchableOpacity
                    style={[styles.otpMethodBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => handleChooseMethod('phone')}
                    disabled={otpLoading}
                  >
                    <Ionicons name="phone-portrait" size={24} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.otpMethodTitle, { color: colors.text }]}>SMS</Text>
                      <Text style={[styles.otpMethodDesc, { color: colors.textMuted }]}>{phone}</Text>
                    </View>
                    {otpLoading && <ActivityIndicator size="small" color={colors.primary} />}
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Enter OTP Code */}
      <Modal visible={otpStep === 'code'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.otpModalTitle, { color: colors.text }]}>Código de verificación</Text>
                <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>
                  Ingresa el código de 6 dígitos enviado a tu {otpMethod === 'email' ? 'correo' : 'celular'}
                </Text>

                <TextInput
                  style={[styles.otpCodeInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.otpVerifyBtn, { backgroundColor: colors.primary }]}
                  onPress={handleVerifyOtp}
                  disabled={otpLoading || otpCode.length !== 6}
                >
                  {otpLoading ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={[styles.otpVerifyBtnText, { color: colors.primaryText }]}>Verificar</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.otpResendBtn}
                  onPress={() => handleChooseMethod(otpMethod)}
                  disabled={otpLoading}
                >
                  <Text style={[styles.otpResendText, { color: colors.primary }]}>Reenviar código</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.otpBackBtn}
                  onPress={() => { setOtpStep('choose'); setOtpCode(''); }}
                >
                  <Text style={[styles.otpBackText, { color: colors.textMuted }]}>Cambiar método</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Success */}
      <Modal visible={otpStep === 'success'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => {}}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              <Text style={[styles.otpModalTitle, { color: colors.text, marginTop: 12 }]}>¡Cuenta creada con éxito!</Text>
              <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>
                Tu cuenta ha sido verificada. Ya puedes iniciar sesión.
              </Text>
              <TouchableOpacity
                style={[styles.otpVerifyBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={handleSuccessClose}
              >
                <Text style={[styles.otpVerifyBtnText, { color: colors.primaryText }]}>Ir al login</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  // OTP Modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  otpModal: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  otpModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  otpModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  otpMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  otpMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  otpMethodDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  otpCodeInput: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: 16,
  },
  otpVerifyBtn: {
    width: '100%',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  otpVerifyBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  otpResendBtn: {
    marginTop: 16,
    padding: 8,
  },
  otpResendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  otpBackBtn: {
    marginTop: 8,
    padding: 8,
  },
  otpBackText: {
    fontSize: 14,
  },
});
