import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, Switch, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { changePassword, updateProfile, listMotorcycles, deleteAccount } from '../../src/api';
import { CustomAlert } from '../../src/components/CustomAlert';
import { PhotoPickerModal } from '../../src/components/PhotoPickerModal';
import { hasBiometricHardware, isBiometricEnrolled, isBiometricEnabled, enableBiometric, disableBiometric, resetBiometricPreference, authenticateWithBiometrics } from '../../src/services/biometric';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const { mode, colors, toggleTheme } = useTheme();
  const { language, t, setLanguage } = useLanguage();
  const router = useRouter();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.email?.split('@')[0] || '', email: user?.email || '', phone: (user as any)?.phone || '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [motorcyclesCount, setMotorcyclesCount] = useState<number | null>(null);
  const [motorcyclesVerifiedCount, setMotorcyclesVerifiedCount] = useState<number | null>(null);

  useEffect(() => {
    loadBiometricStatus();
    loadMotorcyclesCount();
  }, []);

  const loadBiometricStatus = async () => {
    const available = await hasBiometricHardware();
    const enabled = await isBiometricEnabled();
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);
  };

  const loadMotorcyclesCount = async () => {
    try {
      const motos = await listMotorcycles();
      setMotorcyclesCount(motos.length);
      setMotorcyclesVerifiedCount(motos.filter((m: any) => m.verificada).length);
    } catch {
      setMotorcyclesCount(null);
      setMotorcyclesVerifiedCount(null);
    }
  };

  const toggleBiometric = async () => {
    if (biometricEnabled) {
      const authenticated = await authenticateWithBiometrics();
      if (authenticated) {
        await disableBiometric();
        setBiometricEnabled(false);
      }
    } else {
      const hasHardware = await hasBiometricHardware();
      if (!hasHardware) {
        showAlert(t('error'), t('noBiometricHardware'), [{ text: 'OK' }], 'finger-print', '#FF3B30');
        return;
      }

      const enrolled = await isBiometricEnrolled();
      if (!enrolled) {
        showAlert(
          t('biometricSetupTitle'),
          t('biometricSetupMessage'),
          [
            { text: t('openSettings'), onPress: () => openDeviceSettings() },
            { text: t('cancel'), style: 'cancel' },
          ],
          'finger-print',
          '#FF3B30'
        );
        return;
      }

      const authenticated = await authenticateWithBiometrics();
      if (authenticated) {
        await enableBiometric();
        setBiometricEnabled(true);
      }
    }
  };

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      try {
        await Linking.openURL('app-settings:');
      } catch {
        // Do nothing
      }
    }
  };

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  const handleChangePassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!passwords.current) newErrors.current = t('currentPassword') + ' required';
    if (!passwords.newPass) newErrors.newPass = t('newPassword') + ' required';
    if (passwords.newPass.length < 6) newErrors.newPass = 'Must be at least 6 characters';
    if (passwords.newPass === passwords.current) newErrors.newPass = t('newPasswordDifferent');
    if (passwords.newPass !== passwords.confirm) newErrors.confirm = 'Passwords do not match';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setSaving(true);
    try {
      await changePassword(passwords.current, passwords.newPass);
      showAlert(t('success'), t('passwordChanged'), [{ text: 'OK' }], 'checkmark-circle', '#34C759');
      setShowChangePassword(false);
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) {
      showAlert(t('error'), e?.message || t('failedToChangePassword'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    const newErrors: Record<string, string> = {};
    if (!profileForm.name.trim()) newErrors.name = 'Name is required';
    if (!profileForm.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) newErrors.email = 'Invalid email';
    if (Object.keys(newErrors).length > 0) { setProfileErrors(newErrors); return; }

    setProfileErrors({});
    setSavingProfile(true);
    try {
      const updateData: { name: string; email: string; phone?: string; avatarUrl?: string } = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
      };

      if (profileForm.phone.trim()) {
        updateData.phone = profileForm.phone.trim();
      }

      if (avatarUri) {
        const file = new File(avatarUri);
        const base64 = await file.base64();
        updateData.avatarUrl = `data:image/jpeg;base64,${base64}`;
      }

      await updateProfile(updateData);
      await refreshUser();
      showAlert(t('success'), t('profileUpdated'), [{ text: 'OK' }], 'checkmark-circle', '#34C759');
      setShowEditProfile(false);
    } catch (e: any) {
      showAlert(t('error'), e?.message || t('failedToUpdateProfile'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setSavingProfile(false);
    }
  };

  const pickAvatarImage = async (fromCamera: boolean) => {
    setShowPhotoModal(false);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert(t('error'), t('cameraPermission'), [{ text: 'OK' }], 'lock-closed', '#FF9500');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.3, base64: true });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSignOut = () => {
    showAlert(t('signOut'), t('signOutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: signOut },
    ], 'log-out-outline', '#FF3B30');
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Eliminar cuenta',
      'Esta acción es permanente y no se puede deshacer. Se eliminarán todos tus datos, motos y registros asociados.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await deleteAccount();
              await signOut();
            } catch (e: any) {
              showAlert(t('error'), e?.message || 'No se pudo eliminar la cuenta', [{ text: 'OK' }], 'close-circle', '#FF3B30');
            }
          }
        },
      ],
      'warning',
      colors.danger
    );
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?';

  const dynamicStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    name: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: colors.textSecondary },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, marginHorizontal: 16 },
    section: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    rowText: { fontSize: 16, color: colors.text },
    logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32, marginHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.danger },
    logoutBtnText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
    version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 16, marginBottom: 32 },
    modal: { flex: 1, backgroundColor: colors.background },
    modalScroll: { padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    cancel: { color: colors.primary, fontSize: 16 },
    input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10, backgroundColor: colors.inputBg, color: colors.text },
    errorText: { color: colors.danger, fontSize: 12, marginBottom: 8, marginTop: -6 },
    saveBtn: { backgroundColor: colors.success, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
    avatarText: { color: colors.primaryText, fontSize: 32, fontWeight: 'bold' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.success },
    badgeText: { color: colors.successText, fontSize: 11, fontWeight: '600' },
    langBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.surfaceSecondary },
    langBtnActive: { backgroundColor: colors.primary },
    langBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    langBtnTextActive: { color: colors.primaryText },
    divider: { height: 1, backgroundColor: colors.border, marginTop: 24 },
    accountInfo: { marginTop: 20, borderRadius: 10, paddingHorizontal: 14, backgroundColor: colors.surfaceSecondary },
    accountInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    accountInfoLabel: { fontSize: 13, flex: 1, color: colors.textSecondary },
    accountInfoValue: { fontSize: 13, fontWeight: '500', color: colors.text },
    deleteAccountBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20, paddingVertical: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.danger },
    deleteAccountBtnText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  });

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* Profile Header */}
      <View style={dynamicStyles.header}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={dynamicStyles.avatarText}>{userInitial}</Text>
          </View>
        )}
        <Text style={dynamicStyles.name}>{user?.name || user?.email?.split('@')[0] || 'User'}</Text>
      </View>

      {/* Account Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('account')}</Text>
      <View style={dynamicStyles.section}>
        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => {
          setProfileForm({ name: user?.name || user?.email?.split('@')[0] || '', email: user?.email || '', phone: (user as any)?.phone || '' });
          setAvatarUri(null);
          setProfileErrors({});
          setShowEditProfile(true);
        }}>
          <View style={styles.rowLeft}>
            <Ionicons name="person-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('editProfile')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => setShowChangePassword(true)}>
          <View style={styles.rowLeft}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('changePassword')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => router.push('/my-publications')}>
          <View style={styles.rowLeft}>
            <Ionicons name="document-text-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('myPublications')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => router.push('/profile/notifications')}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('notifications')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={dynamicStyles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('motoTrakerAccount')}</Text>
          </View>
          <View style={[dynamicStyles.badge, motorcyclesVerifiedCount && motorcyclesVerifiedCount > 0 ? { backgroundColor: colors.success } : { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[dynamicStyles.badgeText, !(motorcyclesVerifiedCount && motorcyclesVerifiedCount > 0) && { color: colors.textSecondary }]}>
              {motorcyclesVerifiedCount && motorcyclesVerifiedCount > 0 ? 'Verificado' : t('connected')}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => router.push('/profile/subscriptions')}>
          <View style={styles.rowLeft}>
            <Ionicons name="diamond-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('subscription')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* App Settings Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('appSettings')}</Text>
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="color-palette-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('theme')}</Text>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.inputBorder, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={dynamicStyles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="language-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('language')}</Text>
          </View>
          <View style={styles.langButtons}>
            <TouchableOpacity
              style={[dynamicStyles.langBtn, language === 'en' && dynamicStyles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[dynamicStyles.langBtnText, language === 'en' && dynamicStyles.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.langBtn, language === 'es' && dynamicStyles.langBtnActive]}
              onPress={() => setLanguage('es')}
            >
              <Text style={[dynamicStyles.langBtnText, language === 'es' && dynamicStyles.langBtnTextActive]}>ES</Text>
            </TouchableOpacity>
          </View>
        </View>

        {biometricAvailable && (
          <TouchableOpacity
            style={dynamicStyles.row}
            activeOpacity={0.8}
            onLongPress={async () => {
              await resetBiometricPreference();
              await loadBiometricStatus();
              showAlert('Debug', t('debugBiometricReset'), [{ text: 'OK' }], 'information-circle', '#007AFF');
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="finger-print-outline" size={20} color={colors.text} />
              <Text style={dynamicStyles.rowText}>{t('biometric')}</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: colors.inputBorder, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={dynamicStyles.row} activeOpacity={0.6} onPress={() => router.push('/profile/tracker')}>
          <View style={styles.rowLeft}>
            <Ionicons name="locate-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('protocolTrakerConfig')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('support')}</Text>
      <View style={dynamicStyles.section}>
        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => showAlert(t('helpTitle'), t('helpMessage'), [{ text: 'OK' }], 'help-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('helpSupport')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => showAlert(t('aboutTitle'), `${t('aboutVersion')}\n\n${t('aboutDescription')}`, [{ text: 'OK' }], 'information-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('about')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => showAlert(t('comingSoon'), t('appTutorialComingSoon'), [{ text: 'OK' }], 'information-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="play-circle-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('appTutorial')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={dynamicStyles.row} activeOpacity={0.6}
          onPress={() =>
            showAlert(
              t('protocolTraker'),
              t('protocolTrakerInfo'),
              [
                { text: t('cancel'), style: 'cancel' },
                { text: t('viewExample'), onPress: () => Linking.openURL('https://es.aliexpress.com/item/1005006121921125.html') },
              ],
              'locate',
              '#007AFF'
            )
          }
        >
          <View style={styles.rowLeft}>
            <Ionicons name="locate-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('protocolTraker')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} activeOpacity={0.6} onPress={() => router.push('/profile/admin')}>
          <View style={styles.rowLeft}>
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('admin')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={dynamicStyles.logoutBtn} activeOpacity={0.7} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={dynamicStyles.logoutBtnText}>{t('signOut')}</Text>
      </TouchableOpacity>

      <Text style={dynamicStyles.version}>{t('aboutVersion')}</Text>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" presentationStyle="pageSheet">
        <View style={[dynamicStyles.modal, dynamicStyles.modalScroll]}>
          <View style={styles.modalHeader}>
            <Text style={dynamicStyles.modalTitle}>{t('changePassword')}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { setShowChangePassword(false); setErrors({}); setPasswords({ current: '', newPass: '', confirm: '' }); }}>
              <Text style={dynamicStyles.cancel}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ position: 'relative' }}>
            <TextInput
              style={[dynamicStyles.input, { paddingRight: 44 }]}
              placeholder={t('currentPassword')}
              placeholderTextColor={colors.textMuted}
              value={passwords.current}
              onChangeText={(t2) => { setPasswords((p) => ({ ...p, current: t2 })); setErrors((p) => ({ ...p, current: '' })); }}
              secureTextEntry={!showCurrent}
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(!showCurrent)}
              style={{ position: 'absolute', right: 12, top: 12 }}
            >
              <Ionicons
                name={showCurrent ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {errors.current ? <Text style={dynamicStyles.errorText}>{errors.current}</Text> : null}

          <View style={{ position: 'relative' }}>
            <TextInput
              style={[dynamicStyles.input, { paddingRight: 44 }]}
              placeholder={t('newPassword')}
              placeholderTextColor={colors.textMuted}
              value={passwords.newPass}
              onChangeText={(t2) => { setPasswords((p) => ({ ...p, newPass: t2 })); setErrors((p) => ({ ...p, newPass: '' })); }}
              secureTextEntry={!showNew}
            />
            <TouchableOpacity
              onPress={() => setShowNew(!showNew)}
              style={{ position: 'absolute', right: 12, top: 12 }}
            >
              <Ionicons
                name={showNew ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {errors.newPass ? <Text style={dynamicStyles.errorText}>{errors.newPass}</Text> : null}

          <View style={{ position: 'relative' }}>
            <TextInput
              style={[dynamicStyles.input, { paddingRight: 44 }]}
              placeholder={t('confirmPassword')}
              placeholderTextColor={colors.textMuted}
              value={passwords.confirm}
              onChangeText={(t2) => { setPasswords((p) => ({ ...p, confirm: t2 })); setErrors((p) => ({ ...p, confirm: '' })); }}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={{ position: 'absolute', right: 12, top: 12 }}
            >
              <Ionicons
                name={showConfirm ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {errors.confirm ? <Text style={dynamicStyles.errorText}>{errors.confirm}</Text> : null}

          <TouchableOpacity style={dynamicStyles.saveBtn} activeOpacity={0.8} onPress={handleChangePassword} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet">
        <View style={dynamicStyles.modal}>
          <ScrollView contentContainerStyle={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{t('editProfile')}</Text>
              <TouchableOpacity activeOpacity={0.6} onPress={() => { setShowEditProfile(false); setProfileErrors({}); }}>
                <Text style={dynamicStyles.cancel}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            {/* Avatar Picker */}
            <TouchableOpacity style={styles.avatarPicker} activeOpacity={0.8} onPress={() => setShowPhotoModal(true)}>
              <View style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                ) : user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarPreview} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryText, fontSize: 32, fontWeight: 'bold' }}>{userInitial}</Text>
                  </View>
                )}
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Ionicons name="camera" size={16} color={colors.primaryText} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Name Input */}
            <TextInput
              style={dynamicStyles.input}
              placeholder={t('name')}
              placeholderTextColor={colors.textMuted}
              value={profileForm.name}
              onChangeText={(v) => { setProfileForm(p => ({ ...p, name: v })); setProfileErrors(p => ({ ...p, name: '' })); }}
            />
            {profileErrors.name ? <Text style={dynamicStyles.errorText}>{profileErrors.name}</Text> : null}

            {/* Email Input */}
            <TextInput
              style={dynamicStyles.input}
              placeholder={t('email')}
              placeholderTextColor={colors.textMuted}
              value={profileForm.email}
              onChangeText={(v) => { setProfileForm(p => ({ ...p, email: v })); setProfileErrors(p => ({ ...p, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {profileErrors.email ? <Text style={dynamicStyles.errorText}>{profileErrors.email}</Text> : null}

            {/* Phone Input */}
            <TextInput
              style={dynamicStyles.input}
              placeholder={t('phone')}
              placeholderTextColor={colors.textMuted}
              value={profileForm.phone}
              onChangeText={(v) => { setProfileForm(p => ({ ...p, phone: v })); }}
              keyboardType="phone-pad"
            />

            <TouchableOpacity style={dynamicStyles.saveBtn} activeOpacity={0.8} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color={colors.success} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={dynamicStyles.divider} />

            {/* Account Info */}
            <View style={dynamicStyles.accountInfo}>
              <View style={[dynamicStyles.accountInfoRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <Text style={dynamicStyles.accountInfoLabel}>{t('email')}</Text>
                <Text style={dynamicStyles.accountInfoValue}>{user?.email || '—'}</Text>
              </View>
              <View style={[dynamicStyles.accountInfoRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <Text style={dynamicStyles.accountInfoLabel}>Miembro desde</Text>
                <Text style={dynamicStyles.accountInfoValue}>
                  {(user as any)?.createdAt
                    ? new Date((user as any).createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </Text>
              </View>
              <View style={[dynamicStyles.accountInfoRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <Ionicons name="bicycle-outline" size={16} color={colors.textMuted} />
                <Text style={dynamicStyles.accountInfoLabel}>Motos registradas</Text>
                <Text style={dynamicStyles.accountInfoValue}>{motorcyclesCount ?? '—'}</Text>
              </View>
              <View style={[dynamicStyles.accountInfoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
                <Text style={dynamicStyles.accountInfoLabel}>Motos verificadas</Text>
                <Text style={dynamicStyles.accountInfoValue}>{motorcyclesVerifiedCount ?? '—'}</Text>
              </View>
            </View>

            {/* Delete Account */}
            <TouchableOpacity style={dynamicStyles.deleteAccountBtn} activeOpacity={0.7} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={dynamicStyles.deleteAccountBtnText}>Eliminar cuenta</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <PhotoPickerModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onCamera={() => pickAvatarImage(true)}
        onGallery={() => pickAvatarImage(false)}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon={alertIcon}
        iconColor={alertIconColor}
        onClose={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPicker: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
});