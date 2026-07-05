import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth-context';
import { changePassword } from '../../src/api';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!passwords.current) newErrors.current = 'Current password is required';
    if (!passwords.newPass) newErrors.newPass = 'New password is required';
    if (passwords.newPass.length < 6) newErrors.newPass = 'Must be at least 6 characters';
    if (passwords.newPass !== passwords.confirm) newErrors.confirm = 'Passwords do not match';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setSaving(true);
    try {
      await changePassword(passwords.current, passwords.newPass);
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePassword(false);
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitial}</Text>
        </View>
        <Text style={styles.name}>{user?.email?.split('@')[0] || 'User'}</Text>
        <Text style={styles.email}>{user?.email || 'Not logged in'}</Text>
      </View>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Coming Soon', 'Edit profile will be available soon.')}>
          <View style={styles.rowLeft}>
            <Ionicons name="person-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Edit Profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => setShowChangePassword(true)}>
          <View style={styles.rowLeft}>
            <Ionicons name="lock-closed-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Google Account', user?.email || 'Not connected')}>
          <View style={styles.rowLeft}>
            <Ionicons name="logo-google" size={20} color="#333" />
            <Text style={styles.rowText}>Google Account</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Connected</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App Settings Section */}
      <Text style={styles.sectionTitle}>App Settings</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Coming Soon', 'Notifications settings coming soon.')}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Coming Soon', 'Theme settings coming soon.')}>
          <View style={styles.rowLeft}>
            <Ionicons name="color-palette-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Theme</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Coming Soon', 'Language settings coming soon.')}>
          <View style={styles.rowLeft}>
            <Ionicons name="language-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Language</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('Help', 'For support, contact us at support@mototracker.app')}>
          <View style={styles.rowLeft}>
            <Ionicons name="help-circle-outline" size={20} color="#333" />
            <Text style={styles.rowText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert('About', 'Moto Tracker v1.0.0\nTrack your motorcycle maintenance and documents.')}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={20} color="#333" />
            <Text style={styles.rowText}>About</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Moto Tracker v1.0.0</Text>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => { setShowChangePassword(false); setErrors({}); setPasswords({ current: '', newPass: '', confirm: '' }); }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Current Password"
            value={passwords.current}
            onChangeText={(t) => { setPasswords((p) => ({ ...p, current: t })); setErrors((p) => ({ ...p, current: '' })); }}
            secureTextEntry
          />
          {errors.current ? <Text style={styles.errorText}>{errors.current}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="New Password"
            value={passwords.newPass}
            onChangeText={(t) => { setPasswords((p) => ({ ...p, newPass: t })); setErrors((p) => ({ ...p, newPass: '' })); }}
            secureTextEntry
          />
          {errors.newPass ? <Text style={styles.errorText}>{errors.newPass}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            value={passwords.confirm}
            onChangeText={(t) => { setPasswords((p) => ({ ...p, confirm: t })); setErrors((p) => ({ ...p, confirm: '' })); }}
            secureTextEntry
          />
          {errors.confirm ? <Text style={styles.errorText}>{errors.confirm}</Text> : null}

          <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    fontSize: 16,
    color: '#333',
  },
  badge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  // Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
