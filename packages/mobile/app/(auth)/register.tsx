import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';
import { resendRegistrationOtp } from '../../src/api';

// --- RUT validation (modulo 11) ---
function validateRutInline(rut: string): boolean {
  const clean = rut.replace(/[\.\-\s]/g, '').toUpperCase();
  if (!/^\d+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : rest.toString();
  return dv === expected;
}

// --- Password strength checker ---
function getPasswordChecks(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };
}

export default function RegisterScreen() {
  const { signUp, completeRegistration } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Step control
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 2 fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation errors (shown after pressing Next)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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

  // --- Step 1 validation ---
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresa un correo válido';
    }

    if (!rut.trim() || !validateRutInline(rut)) {
      newErrors.rut = 'RUT inválido';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Ingresa un número telefónico';
    } else if (phone.length !== 8) {
      newErrors.phone = 'El teléfono debe tener 8 dígitos';
    }

    if (!birthDate.trim()) {
      newErrors.birthDate = 'La fecha de nacimiento es obligatoria';
    } else {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) {
        newErrors.birthDate = 'Debes ser mayor de 18 años para registrarte';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Step 2 validation ---
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const checks = getPasswordChecks(password);

    if (!checks.length || !checks.uppercase || !checks.number || !checks.special) {
      newErrors.password = 'La contraseña no cumple los requisitos';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Handle Next (Step 1 → Step 2) ---
  const handleNext = () => {
    if (validateStep1()) {
      setErrors({});
      setStep(2);
    }
  };

  // --- Handle Register (Step 2 → OTP) ---
  const handleRegister = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await signUp(email, password, name, phone ? `+569${phone}` : undefined, rut, birthDate);
      setOtpStep('choose');
    } catch (err) {
      showAlert(t('error'), err instanceof Error ? err.message : t('registrationFailed'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setLoading(false);
    }
  };

  // --- OTP handlers (unchanged from original) ---
  const handleChooseMethod = async (method: 'email' | 'phone') => {
    setOtpMethod(method);
    setOtpLoading(true);
    try {
      await resendRegistrationOtp(email, method);
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
      await completeRegistration(email, otpCode);
      setOtpStep('success');
    } catch (err) {
      showAlert(t('error'), 'Código inválido o expirado', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpLoading(true);
    try {
      await resendRegistrationOtp(email, otpMethod);
      showAlert('Código reenviado', 'Revisa tu correo electrónico', [{ text: 'OK' }]);
    } catch (err) {
      showAlert(t('error'), 'No se pudo reenviar el código', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setOtpStep('idle');
    setOtpCode('');
    router.replace('/(app)');
  };

  // --- Password checks for live display ---
  const passwordChecks = getPasswordChecks(password);

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 4,
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 5,
    },
    stepIndicator: {
      textAlign: 'center',
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 20,
    },
    inputWrapper: {
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    inputError: {
      borderColor: '#FF3B30',
    },
    errorText: {
      color: '#FF3B30',
      fontSize: 12,
      marginTop: 4,
      marginBottom: 12,
      marginLeft: 4,
    },
    inputSpace: {
      marginBottom: 12,
    },
    phoneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      backgroundColor: colors.inputBg,
      overflow: 'hidden',
    },
    phonePrefix: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      borderRightWidth: 1,
      borderRightColor: colors.inputBorder,
      height: 48,
      backgroundColor: colors.inputBg,
    },
    phoneFlag: {
      fontSize: 18,
    },
    phoneCode: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    phoneInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    passwordToggle: {
      position: 'absolute',
      left: 12,
      top: 12,
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
    buttonDisabled: {
      opacity: 0.5,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 16,
      padding: 8,
    },
    backBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    link: {
      color: colors.accent,
      textAlign: 'center',
      marginTop: 16,
      fontSize: 14,
      fontWeight: '600',
    },
    // Password rules
    rulesContainer: {
      marginTop: 4,
      marginBottom: 12,
      paddingHorizontal: 4,
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

  // ========================================
  // STEP 1: Personal Data
  // ========================================
  if (step === 1) {
    return (
      <View style={dynamicStyles.container}>
        <ScrollView contentContainerStyle={dynamicStyles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Image source={require('../../assets/icon.png')} style={styles.icon} resizeMode="contain" />
            <Image source={require('../../assets/nombre.jpeg')} style={styles.logo} resizeMode="contain" />
            <Text style={dynamicStyles.subtitle}>{t('signUpSubtitle')}</Text>
          </View>

          {/* Name */}
          <View style={dynamicStyles.inputWrapper}>
            <TextInput
              style={[dynamicStyles.input, errors.name && dynamicStyles.inputError]}
              placeholder={t('name')}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(v) => { setName(v); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
            />
            {errors.name ? <Text style={dynamicStyles.errorText}>{errors.name}</Text> : <View style={{ marginBottom: 12 }} />}
          </View>

          {/* Email */}
          <View style={dynamicStyles.inputWrapper}>
            <TextInput
              style={[dynamicStyles.input, errors.email && dynamicStyles.inputError]}
              placeholder={t('email')}
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(v) => { setEmail(v); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {errors.email ? <Text style={dynamicStyles.errorText}>{errors.email}</Text> : <View style={{ marginBottom: 12 }} />}
          </View>

          {/* RUT */}
          <View style={dynamicStyles.inputWrapper}>
            <TextInput
              style={[dynamicStyles.input, errors.rut && dynamicStyles.inputError]}
              placeholder="RUT (ej: 12345678-5)"
              placeholderTextColor={colors.textMuted}
              value={rut}
              onChangeText={(v) => { setRut(v); if (errors.rut) setErrors(prev => ({ ...prev, rut: '' })); }}
              autoCapitalize="characters"
            />
            {errors.rut ? <Text style={dynamicStyles.errorText}>{errors.rut}</Text> : <View style={{ marginBottom: 12 }} />}
          </View>

          {/* Phone */}
          <View style={dynamicStyles.inputWrapper}>
            <View style={[dynamicStyles.phoneContainer, errors.phone && dynamicStyles.inputError]}>
              <View style={dynamicStyles.phonePrefix}>
                <Text style={dynamicStyles.phoneFlag}>🇨🇱</Text>
                <Text style={dynamicStyles.phoneCode}>+569</Text>
              </View>
              <TextInput
                style={dynamicStyles.phoneInput}
                placeholder="12345678"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={(v) => { setPhone(v.replace(/[^0-9]/g, '').slice(0, 8)); if (errors.phone) setErrors(prev => ({ ...prev, phone: '' })); }}
                keyboardType="phone-pad"
                maxLength={8}
              />
            </View>
            {errors.phone ? (
              <Text style={dynamicStyles.errorText}>{errors.phone}</Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}
          </View>

          {/* Birth Date */}
          <View style={dynamicStyles.inputWrapper}>
            <TouchableOpacity
              style={[dynamicStyles.input, errors.birthDate && dynamicStyles.inputError, { justifyContent: 'center' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: birthDate ? colors.text : colors.textMuted, fontSize: 16 }}>
                {birthDate ? new Date(birthDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha de nacimiento'}
              </Text>
            </TouchableOpacity>
            {errors.birthDate ? (
              <Text style={dynamicStyles.errorText}>{errors.birthDate}</Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}
            {showDatePicker && (
              <DateTimePicker
                value={birthDate ? new Date(birthDate) : new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate && event.type !== 'dismissed') {
                    const isoDate = selectedDate.toISOString().split('T')[0];
                    setBirthDate(isoDate);
                    if (errors.birthDate) setErrors(prev => ({ ...prev, birthDate: '' }));
                  }
                }}
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
              />
            )}
          </View>

          <TouchableOpacity style={dynamicStyles.button} onPress={handleNext}>
            <Text style={dynamicStyles.buttonText}>Siguiente</Text>
          </TouchableOpacity>
        </ScrollView>

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

  // ========================================
  // STEP 2: Password
  // ========================================
  return (
    <View style={dynamicStyles.container}>
      <ScrollView contentContainerStyle={dynamicStyles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Image source={require('../../assets/icon.png')} style={styles.icon} resizeMode="contain" />
          <Image source={require('../../assets/nombre.jpeg')} style={styles.logo} resizeMode="contain" />
          <Text style={dynamicStyles.subtitle}>{t('signUpSubtitle')}</Text>
        </View>

        {/* Password */}
        <View style={dynamicStyles.inputWrapper}>
          <View>
            <TextInput
              style={[dynamicStyles.input, errors.password && dynamicStyles.inputError, { paddingLeft: 40 }]}
              placeholder={t('password')}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(v) => { setPassword(v); if (errors.password) setErrors(prev => ({ ...prev, password: '' })); }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={dynamicStyles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Password rules (live) */}
          {password.length > 0 && (
            <View style={dynamicStyles.rulesContainer}>
              {[
                { key: 'length', label: 'Mínimo 8 caracteres', met: passwordChecks.length },
                { key: 'uppercase', label: 'Una letra mayúscula', met: passwordChecks.uppercase },
                { key: 'number', label: 'Un número', met: passwordChecks.number },
                { key: 'special', label: 'Un carácter especial (!@#$%^&*)', met: passwordChecks.special },
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
          {password.length === 0 && <View style={{ marginBottom: 12 }} />}
        </View>

        {/* Confirm Password */}
        <View style={dynamicStyles.inputWrapper}>
          <View>
            <TextInput
              style={[dynamicStyles.input, errors.confirmPassword && dynamicStyles.inputError, { paddingLeft: 40 }]}
              placeholder="Repetir contraseña"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity style={dynamicStyles.passwordToggle} onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? (
            <Text style={dynamicStyles.errorText}>{errors.confirmPassword}</Text>
          ) : confirmPassword.length > 0 && password !== confirmPassword ? (
            <Text style={dynamicStyles.errorText}>Las contraseñas no coinciden</Text>
          ) : (
            <View style={{ marginBottom: 12 }} />
          )}
        </View>

        <TouchableOpacity
          style={[dynamicStyles.button, loading && dynamicStyles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={dynamicStyles.buttonText}>{loading ? t('signUpLoading') : t('signUpButton')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => { setStep(1); setErrors({}); }}>
          <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
          <Text style={dynamicStyles.backBtnText}>Volver a datos personales</Text>
        </TouchableOpacity>
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon={alertIcon}
        iconColor={alertIconColor}
        onClose={() => setAlertVisible(false)}
      />

      {/* ===== OTP MODALS (unchanged from original) ===== */}

      {/* MODAL: Choose OTP Method — Email only */}
      <Modal visible={otpStep === 'choose'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.otpCloseBtn} onPress={() => setOtpStep('idle')}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.otpModalTitle, { color: colors.text }]}>Validar cuenta</Text>
                <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>Te enviaremos un código de verificación a tu correo electrónico</Text>

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
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Enter OTP Code */}
      <Modal visible={otpStep === 'code'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.otpCloseBtn} onPress={() => { setOtpStep('idle'); setOtpCode(''); }}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.otpModalTitle, { color: colors.text }]}>Código de verificación</Text>
                <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>
                  Ingresa el código de 6 dígitos enviado a tu correo
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

                <View style={styles.otpResendRow}>
                  <TouchableOpacity style={styles.otpResendBtn} onPress={handleResendOtp} disabled={otpLoading}>
                    <Ionicons name="mail-outline" size={14} color={colors.primary} />
                    <Text style={[styles.otpResendText, { color: colors.primary }]}>Reenviar por correo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Success */}
      <Modal visible={otpStep === 'success'} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { }}>
          <TouchableOpacity activeOpacity={1} onPress={() => { }}>
            <View style={[styles.otpModal, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              <Text style={[styles.otpModalTitle, { color: colors.text, marginTop: 12 }]}>¡Cuenta creada con éxito!</Text>
              <Text style={[styles.otpModalSubtitle, { color: colors.textSecondary }]}>
                Tu cuenta ha sido verificada. Ya puedes usar la app.
              </Text>
              <TouchableOpacity
                style={[styles.otpVerifyBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={handleSuccessClose}
              >
                <Text style={[styles.otpVerifyBtnText, { color: colors.primaryText }]}>Ir a la app</Text>
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
    marginBottom: 20,
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
  otpCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
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
  otpResendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  otpResendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  otpResendText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
