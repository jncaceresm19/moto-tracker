import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';
import { forgotPassword, resetPassword } from '../../src/api';

// Password strength checker (same as register)
function getPasswordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw),
  };
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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

  // --- Forgot password flow state ---
  const [fpStep, setFpStep] = useState<'idle' | 'email' | 'code' | 'newPassword' | 'success'>('idle');
  const [fpEmail, setFpEmail] = useState('');
  const [fpCodeDigits, setFpCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const fpCode = fpCodeDigits.join('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const otpRefs = useRef<Array<TextInput | null>>([]);

  const handleLogin = async () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Ingresa un correo válido';
    if (!password) newErrors.password = 'La contraseña es obligatoria';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

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

  // --- Forgot password handlers ---
  const handleForgotPasswordOpen = () => {
    setFpEmail(email); // pre-fill with login email
    setFpStep('email');
  };

  const handleSendResetCode = async () => {
    if (!fpEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail)) {
      showAlert(t('error'), 'Ingresa un correo válido', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }
    setFpLoading(true);
    try {
      await forgotPassword(fpEmail);
      setFpStep('code');
    } catch (err) {
      showAlert(t('error'), err instanceof Error ? err.message : 'No se pudo enviar el código', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setFpLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (fpCode.length !== 6) {
      showAlert(t('error'), 'El código debe tener 6 dígitos', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }
    // Just move to password step — we verify code when submitting new password
    setFpStep('newPassword');
  };

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    setFpCodeDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !fpCodeDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async () => {
    const checks = getPasswordChecks(fpNewPassword);
    if (!checks.length || !checks.uppercase || !checks.number || !checks.special) {
      showAlert(t('error'), 'La contraseña no cumple los requisitos', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      showAlert(t('error'), 'Las contraseñas no coinciden', [{ text: 'OK' }], 'close-circle', '#FF3B30');
      return;
    }

    setFpLoading(true);
    try {
      await resetPassword(fpEmail, fpCode, fpNewPassword);
      setFpStep('success');
    } catch (err) {
      showAlert(t('error'), err instanceof Error ? err.message : 'No se pudo cambiar la contraseña', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpClose = () => {
    setFpStep('idle');
    setFpCodeDigits(['', '', '', '', '', '']);
    setFpNewPassword('');
    setFpConfirmPassword('');
  };

  const fpChecks = getPasswordChecks(fpNewPassword);

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
      borderRadius: 30,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 6,
    },
    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    forgotLink: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 15,
      fontSize: 15,
      fontWeight: '600',
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 15,
      fontWeight: '600',
    },
    // Forgot password modal styles
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    fpModal: {
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    fpCloseBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      zIndex: 1,
    },
    fpIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
      backgroundColor: colors.primary + '15',
    },
    fpModalTitle: {
      fontSize: 19,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
      color: colors.text,
    },
    fpModalSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginBottom: 20,
      color: colors.textSecondary,
    },
    fpEmailHighlight: {
      fontWeight: '600',
      color: colors.text,
    },
    fpInput: {
      width: '100%',
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      marginBottom: 16,
      color: colors.text,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
    },
    fpInputWithIcon: {
      paddingLeft: 40,
    },
    fpInputIcon: {
      position: 'absolute',
      left: 12,
      top: 15,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    otpBox: {
      width: 42,
      height: 50,
      borderWidth: 1,
      borderRadius: 10,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
    },
    otpBoxFilled: {
      borderColor: colors.primary,
    },
    fpVerifyBtn: {
      width: '100%',
      borderRadius: 30,
      padding: 16,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    fpVerifyBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
    },
    fpPasswordToggle: {
      position: 'absolute',
      right: 12,
      top: 12,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    ruleText: {
      fontSize: 12,
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

      <View>
        <TextInput
          style={[dynamicStyles.input, errors.email && { borderColor: '#FF3B30' }, { paddingLeft: 44 }]}
          placeholder={t('email')}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={(v) => { setEmail(v); if (errors.email) setErrors(p => ({ ...p, email: undefined })); }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={{ position: 'absolute', left: 12, top: 16 }} />
      </View>
      {errors.email ? <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: -10, marginBottom: 12, marginLeft: 4 }}>{errors.email}</Text> : null}

      <View>
        <TextInput
          style={[dynamicStyles.input, errors.password && { borderColor: '#FF3B30' }, { paddingLeft: 44 }]}
          placeholder={t('password')}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={(v) => { setPassword(v); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={{ position: 'absolute', left: 12, top: 12 }}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} style={{ marginTop: 4 }} />
        </TouchableOpacity>
      </View>
      {errors.password ? <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: -10, marginBottom: 12, marginLeft: 4 }}>{errors.password}</Text> : null}

      <TouchableOpacity activeOpacity={0.7} onPress={handleForgotPasswordOpen}>
        <Text style={dynamicStyles.forgotLink} >¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={dynamicStyles.button}
        activeOpacity={0.8}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={dynamicStyles.buttonText}>{t('signInButton')}</Text>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/register" asChild>
        <TouchableOpacity activeOpacity={0.7}>
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

      {/* ===== FORGOT PASSWORD MODALS ===== */}

      {/* Step 1: Enter email */}
      <Modal visible={fpStep === 'email'} transparent animationType="fade">
        <TouchableOpacity style={dynamicStyles.overlay} activeOpacity={1} onPress={() => { }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={[dynamicStyles.fpModal, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={dynamicStyles.fpCloseBtn} onPress={handleFpClose}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={dynamicStyles.fpIconWrap}>
                  <Ionicons name="key-outline" size={24} color={colors.primary} />
                </View>

                <Text style={dynamicStyles.fpModalTitle}>Recuperar contraseña</Text>
                <Text style={dynamicStyles.fpModalSubtitle}>
                  Ingresa tu correo y te enviaremos un código de verificación
                </Text>

                <View style={{ width: '100%' }}>
                  <TextInput
                    style={[dynamicStyles.fpInput, dynamicStyles.fpInputWithIcon]}
                    placeholder="Correo electrónico"
                    placeholderTextColor={colors.textMuted}
                    value={fpEmail}
                    onChangeText={setFpEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoFocus
                  />
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={dynamicStyles.fpInputIcon} />
                </View>

                <TouchableOpacity
                  style={dynamicStyles.fpVerifyBtn}
                  onPress={handleSendResetCode}
                  disabled={fpLoading}
                >
                  {fpLoading ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={dynamicStyles.fpVerifyBtnText}>Enviar código</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Step 2: Enter OTP code */}
      <Modal visible={fpStep === 'code'} transparent animationType="fade">
        <TouchableOpacity style={dynamicStyles.overlay} activeOpacity={1} onPress={() => { }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={[dynamicStyles.fpModal, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={dynamicStyles.fpCloseBtn} onPress={handleFpClose}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={dynamicStyles.fpIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
                </View>

                <Text style={dynamicStyles.fpModalTitle}>Código de verificación</Text>
                <Text style={dynamicStyles.fpModalSubtitle}>
                  Ingresa el código de 6 dígitos enviado a{'\n'}
                  <Text style={dynamicStyles.fpEmailHighlight}>{fpEmail}</Text>
                </Text>

                <View style={dynamicStyles.otpRow}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      style={[dynamicStyles.otpBox, fpCodeDigits[i] && dynamicStyles.otpBoxFilled]}
                      value={fpCodeDigits[i]}
                      onChangeText={(txt) => handleOtpChange(txt, i)}
                      onKeyPress={(e) => handleOtpKeyPress(e, i)}
                      keyboardType="numeric"
                      maxLength={1}
                      autoFocus={i === 0}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={dynamicStyles.fpVerifyBtn}
                  onPress={handleVerifyResetCode}
                  disabled={fpCode.length !== 6}
                >
                  <Text style={dynamicStyles.fpVerifyBtnText}>Verificar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 16, padding: 8 }} onPress={() => setFpStep('email')}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Volver</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Step 3: New password */}
      <Modal visible={fpStep === 'newPassword'} transparent animationType="fade">
        <TouchableOpacity style={dynamicStyles.overlay} activeOpacity={1} onPress={() => { }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={[dynamicStyles.fpModal, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={dynamicStyles.fpCloseBtn} onPress={handleFpClose}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={dynamicStyles.fpIconWrap}>
                  <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
                </View>

                <Text style={dynamicStyles.fpModalTitle}>Nueva contraseña</Text>
                <Text style={dynamicStyles.fpModalSubtitle}>Ingresa tu nueva contraseña</Text>

                <View style={{ width: '100%', marginBottom: 4 }}>
                  <TextInput
                    style={dynamicStyles.fpInput}
                    placeholder="Nueva contraseña"
                    placeholderTextColor={colors.textMuted}
                    value={fpNewPassword}
                    onChangeText={setFpNewPassword}
                    secureTextEntry={!fpShowPassword}
                  />
                  <TouchableOpacity style={dynamicStyles.fpPasswordToggle} onPress={() => setFpShowPassword(!fpShowPassword)}>
                    <Ionicons name={fpShowPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Password rules */}
                {fpNewPassword.length > 0 && (
                  <View style={{ width: '100%', marginBottom: 12, paddingHorizontal: 4 }}>
                    {[
                      { key: 'length', label: 'Mínimo 8 caracteres', met: fpChecks.length },
                      { key: 'uppercase', label: 'Una letra mayúscula', met: fpChecks.uppercase },
                      { key: 'number', label: 'Un número', met: fpChecks.number },
                      { key: 'special', label: 'Un carácter especial (!@#$%^&*)', met: fpChecks.special },
                    ].map(rule => (
                      <View key={rule.key} style={dynamicStyles.ruleRow}>
                        <Ionicons
                          name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={rule.met ? '#34C759' : '#FF3B30'}
                        />
                        <Text style={[dynamicStyles.ruleText, { color: rule.met ? '#34C759' : '#FF3B30' }]}>
                          {rule.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TextInput
                  style={dynamicStyles.fpInput}
                  placeholder="Repetir contraseña"
                  placeholderTextColor={colors.textMuted}
                  value={fpConfirmPassword}
                  onChangeText={setFpConfirmPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={dynamicStyles.fpVerifyBtn}
                  onPress={handleResetPassword}
                  disabled={fpLoading}
                >
                  {fpLoading ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={dynamicStyles.fpVerifyBtnText}>Guardar</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 16, padding: 8 }} onPress={() => setFpStep('code')}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Volver</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Step 4: Success */}
      <Modal visible={fpStep === 'success'} transparent animationType="fade">
        <TouchableOpacity style={dynamicStyles.overlay} activeOpacity={1} onPress={() => { }}>
          <TouchableOpacity activeOpacity={1} onPress={() => { }}>
            <View style={[dynamicStyles.fpModal, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              <Text style={[dynamicStyles.fpModalTitle, { marginTop: 12 }]}>¡Contraseña cambiada!</Text>
              <Text style={dynamicStyles.fpModalSubtitle}>
                Tu contraseña ha sido actualizada. Ya puedes iniciar sesión.
              </Text>
              <TouchableOpacity
                style={dynamicStyles.fpVerifyBtn}
                onPress={handleFpClose}
              >
                <Text style={dynamicStyles.fpVerifyBtnText}>Iniciar sesión</Text>
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
});