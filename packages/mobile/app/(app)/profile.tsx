import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { changePassword, updateProfile } from '../../src/api';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const { mode, colors, toggleTheme } = useTheme();
  const { language, t, setLanguage } = useLanguage();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.email?.split('@')[0] || '', email: user?.email || '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');

  const showAlert = (title: string, message?: string, buttons: {text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[] = [{text: 'OK'}], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
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
    if (passwords.newPass !== passwords.confirm) newErrors.confirm = 'Passwords do not match';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setSaving(true);
    try {
      await changePassword(passwords.current, passwords.newPass);
      showAlert(t('success'), t('passwordChanged'), [{text: 'OK'}], 'checkmark-circle', '#34C759');
      setShowChangePassword(false);
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) {
      showAlert(t('error'), e?.message || 'Failed to change password', [{text: 'OK'}], 'close-circle', '#FF3B30');
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
      const updateData: { name: string; email: string; avatarUrl?: string } = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
      };

      // Convert avatar to base64 if picked
      if (avatarUri) {
        const file = new File(avatarUri);
        const base64 = await file.base64();
        updateData.avatarUrl = `data:image/jpeg;base64,${base64}`;
      }

      await updateProfile(updateData);
      await refreshUser();
      showAlert(t('success'), t('profileUpdated'), [{text: 'OK'}], 'checkmark-circle', '#34C759');
      setShowEditProfile(false);
    } catch (e: any) {
      showAlert(t('error'), e?.message || 'Failed to update profile', [{text: 'OK'}], 'close-circle', '#FF3B30');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    showAlert(t('changePhoto'), '', [
      {
        text: t('camera'), onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { showAlert(t('error'), t('cameraPermission'), [{text: 'OK'}], 'lock-closed', '#FF9500'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        }
      },
      {
        text: t('gallery'), onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.3, base64: true });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        }
      },
      { text: t('cancel'), style: 'cancel' },
    ], 'camera', '#007AFF');
  };

  const handleSignOut = () => {
    showAlert(t('signOut'), t('signOutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: signOut },
    ], 'log-out-outline', '#FF3B30');
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
    modal: { flex: 1, padding: 20, backgroundColor: colors.background },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    cancel: { color: colors.primary, fontSize: 16 },
    input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10, backgroundColor: colors.inputBg, color: colors.text },
    errorText: { color: colors.danger, fontSize: 12, marginBottom: 8, marginTop: -6 },
    saveBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
    avatarText: { color: colors.primaryText, fontSize: 32, fontWeight: 'bold' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.success },
    badgeText: { color: colors.successText, fontSize: 11, fontWeight: '600' },
    langBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.surfaceSecondary },
    langBtnActive: { backgroundColor: colors.primary },
    langBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    langBtnTextActive: { color: colors.primaryText },
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
        <Text style={dynamicStyles.email}>{user?.email || 'Not logged in'}</Text>
      </View>

      {/* Account Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('account')}</Text>
      <View style={dynamicStyles.section}>
        <TouchableOpacity style={dynamicStyles.row} onPress={() => {
          setProfileForm({ name: user?.name || user?.email?.split('@')[0] || '', email: user?.email || '' });
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

        <TouchableOpacity style={dynamicStyles.row} onPress={() => setShowChangePassword(true)}>
          <View style={styles.rowLeft}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('changePassword')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={dynamicStyles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('googleAccount')}</Text>
          </View>
          <View style={dynamicStyles.badge}>
            <Text style={dynamicStyles.badgeText}>{t('connected')}</Text>
          </View>
        </View>
      </View>

      {/* App Settings Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('appSettings')}</Text>
      <View style={dynamicStyles.section}>
        <TouchableOpacity style={dynamicStyles.row} onPress={() => showAlert('Coming Soon', 'Notifications settings coming soon.', [{text: 'OK'}], 'information-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('notifications')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

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
      </View>

      {/* Support Section */}
      <Text style={dynamicStyles.sectionTitle}>{t('support')}</Text>
      <View style={dynamicStyles.section}>
        <TouchableOpacity style={dynamicStyles.row} onPress={() => showAlert(t('helpTitle'), t('helpMessage'), [{text: 'OK'}], 'help-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('helpSupport')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={dynamicStyles.row} onPress={() => showAlert(t('aboutTitle'), `${t('aboutVersion')}\n\n${t('aboutDescription')}`, [{text: 'OK'}], 'information-circle', '#007AFF')}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            <Text style={dynamicStyles.rowText}>{t('about')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={dynamicStyles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={dynamicStyles.logoutBtnText}>{t('signOut')}</Text>
      </TouchableOpacity>

      <Text style={dynamicStyles.version}>{t('aboutVersion')}</Text>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" presentationStyle="pageSheet">
        <View style={dynamicStyles.modal}>
          <View style={styles.modalHeader}>
            <Text style={dynamicStyles.modalTitle}>{t('changePassword')}</Text>
            <TouchableOpacity onPress={() => { setShowChangePassword(false); setErrors({}); setPasswords({ current: '', newPass: '', confirm: '' }); }}>
              <Text style={dynamicStyles.cancel}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={dynamicStyles.input}
            placeholder={t('currentPassword')}
            placeholderTextColor={colors.textMuted}
            value={passwords.current}
            onChangeText={(t2) => { setPasswords((p) => ({ ...p, current: t2 })); setErrors((p) => ({ ...p, current: '' })); }}
            secureTextEntry
          />
          {errors.current ? <Text style={dynamicStyles.errorText}>{errors.current}</Text> : null}

          <TextInput
            style={dynamicStyles.input}
            placeholder={t('newPassword')}
            placeholderTextColor={colors.textMuted}
            value={passwords.newPass}
            onChangeText={(t2) => { setPasswords((p) => ({ ...p, newPass: t2 })); setErrors((p) => ({ ...p, newPass: '' })); }}
            secureTextEntry
          />
          {errors.newPass ? <Text style={dynamicStyles.errorText}>{errors.newPass}</Text> : null}

          <TextInput
            style={dynamicStyles.input}
            placeholder={t('confirmPassword')}
            placeholderTextColor={colors.textMuted}
            value={passwords.confirm}
            onChangeText={(t2) => { setPasswords((p) => ({ ...p, confirm: t2 })); setErrors((p) => ({ ...p, confirm: '' })); }}
            secureTextEntry
          />
          {errors.confirm ? <Text style={dynamicStyles.errorText}>{errors.confirm}</Text> : null}

          <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleChangePassword} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet">
        <View style={dynamicStyles.modal}>
          <View style={styles.modalHeader}>
            <Text style={dynamicStyles.modalTitle}>{t('editProfile')}</Text>
            <TouchableOpacity onPress={() => { setShowEditProfile(false); setProfileErrors({}); }}>
              <Text style={dynamicStyles.cancel}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar Picker */}
          <TouchableOpacity style={styles.avatarPicker} onPress={handlePickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
            ) : user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarPreview} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={32} color={colors.primaryText} />
              </View>
            )}
            <Text style={[styles.avatarPickerText, { color: colors.primary }]}>{t('changePhoto')}</Text>
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

          <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? <ActivityIndicator color={colors.accentText} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

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
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarPickerText: {
    fontSize: 14,
    fontWeight: '600',
  },
});