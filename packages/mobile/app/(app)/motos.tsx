import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { listMotorcycles, createMotorcycle, deleteMotorcycle, Motorcycle } from '../../src/api';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function MotorcycleListScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', gpsTracker: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
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

  const loadMotorcycles = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await listMotorcycles();
      setMotorcycles(data);
    } catch (e: any) {
      console.log('[MOTOS] Error:', e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMotorcycles();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMotorcycles();
    setRefreshing(false);
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert('Permission needed', `Please grant ${fromCamera ? 'camera' : 'gallery'} permission.`, [{text: 'OK'}], 'lock-closed', '#FF9500');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });

    if (!result.canceled && result.assets[0]) {
      let uri: string;
      if (result.assets[0].base64) {
        uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      } else {
        const b64 = await new File(result.assets[0].uri).base64();
        uri = `data:image/jpeg;base64,${b64}`;
      }
      setImageUri(uri);
    }
  };

  const showImageOptions = () => {
    setShowPhotoModal(true);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.brand) newErrors.brand = t('required');
    if (!form.model) newErrors.model = t('required');
    if (!form.year) newErrors.year = t('required');
    if (!form.licensePlate) newErrors.licensePlate = t('required');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const created = await createMotorcycle({
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        licensePlate: form.licensePlate,
        currentKilometers: form.currentKilometers ? Number(form.currentKilometers) : undefined,
        gpsTracker: form.gpsTracker || undefined,
        imageUrl: imageUri || undefined,
      });
      setMotorcycles((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', gpsTracker: '' });
      setImageUri(null);
      showAlert(t('success'), t('motorcycleUpdated'), [{text: 'OK'}], 'checkmark-circle', '#34C759');
    } catch {
      showAlert(t('error'), t('failedToCreate'), [{text: 'OK'}], 'close-circle', '#FF3B30');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    showAlert('Delete', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMotorcycle(id);
            setMotorcycles((prev) => prev.filter((m) => m.id !== id));
          } catch {
            showAlert('Error', 'Failed to delete', [{text: 'OK'}], 'close-circle', '#FF3B30');
          }
        },
      },
    ]);
  };

  const dynamicStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
    empty: { fontSize: 18, color: colors.text, marginBottom: 4 },
    emptySub: { fontSize: 14, color: colors.textMuted },
    card: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardImagePlaceholder: {
      width: '100%',
      height: 140,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    cardSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    cardKm: { fontSize: 14, color: colors.primary, marginTop: 4 },
    modal: { flex: 1, padding: 20, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    cancel: { color: colors.primary, fontSize: 16 },
    photoBtn: {
      width: '100%',
      height: 160,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: colors.surfaceSecondary,
    },
    photoPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 10,
    },
    photoPlaceholderText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      marginBottom: 10,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    errorText: { color: colors.danger, fontSize: 12, marginBottom: 8, marginTop: -6 },
    saveBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  });

  if (loading) {
    return <View style={dynamicStyles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={dynamicStyles.container}>
      {motorcycles.length === 0 ? (
        <View style={dynamicStyles.center}>
          <Text style={styles.emptyIcon}>🏍️</Text>
          <Text style={dynamicStyles.empty}>{t('noMotorcycles')}</Text>
          <Text style={dynamicStyles.emptySub}>{t('noMotorcyclesSub')}</Text>
        </View>
      ) : (
        <FlatList
          data={motorcycles}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={dynamicStyles.card}
              onPress={() => router.push(`/(app)/motorcycle/${item.id}`)}
              onLongPress={() => handleDelete(item.id, `${item.brand} ${item.model}`)}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={dynamicStyles.cardImagePlaceholder}>
                  <Text style={styles.cardImagePlaceholderText}>🏍️</Text>
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={dynamicStyles.cardTitle}>{item.brand} {item.model}</Text>
                <Text style={dynamicStyles.cardSub}>{item.year} · {item.licensePlate}</Text>
                <Text style={dynamicStyles.cardKm}>{item.currentKilometers.toLocaleString()} km</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={dynamicStyles.fab} onPress={() => { setErrors({}); setImageUri(null); setShowCreate(true); }}>
        <Text style={dynamicStyles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={dynamicStyles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{t('addMotorcycle')}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={dynamicStyles.cancel}>X</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={dynamicStyles.photoBtn} onPress={showImageOptions}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={dynamicStyles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={dynamicStyles.photoPlaceholderText}>{t('tapToAddMotoPhoto')}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput style={dynamicStyles.input} placeholder={t('brand') + ' *'} placeholderTextColor={colors.textMuted} value={form.brand} onChangeText={(v) => { setForm((p) => ({ ...p, brand: v })); setErrors((p) => ({ ...p, brand: '' })); }} />
            {errors.brand ? <Text style={dynamicStyles.errorText}>{errors.brand}</Text> : null}
            <TextInput style={dynamicStyles.input} placeholder={t('model') + ' *'} placeholderTextColor={colors.textMuted} value={form.model} onChangeText={(v) => { setForm((p) => ({ ...p, model: v })); setErrors((p) => ({ ...p, model: '' })); }} />
            {errors.model ? <Text style={dynamicStyles.errorText}>{errors.model}</Text> : null}
            <TextInput style={dynamicStyles.input} placeholder={t('year') + ' *'} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={form.year} onChangeText={(v) => { setForm((p) => ({ ...p, year: v })); setErrors((p) => ({ ...p, year: '' })); }} />
            {errors.year ? <Text style={dynamicStyles.errorText}>{errors.year}</Text> : null}
            <TextInput style={dynamicStyles.input} placeholder={t('licensePlate') + ' *'} placeholderTextColor={colors.textMuted} value={form.licensePlate} onChangeText={(v) => { setForm((p) => ({ ...p, licensePlate: v })); setErrors((p) => ({ ...p, licensePlate: '' })); }} />
            {errors.licensePlate ? <Text style={dynamicStyles.errorText}>{errors.licensePlate}</Text> : null}
            <TextInput style={dynamicStyles.input} placeholder={t('currentKilometers') + ' (' + t('optional') + ')'} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={form.currentKilometers} onChangeText={(v) => setForm((p) => ({ ...p, currentKilometers: v }))} />
            <View style={{ marginTop: 10, marginBottom: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('gpsQuestion')}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{t('gpsQuestionHint')}</Text>
            </View>
            <TextInput style={dynamicStyles.input} placeholder={t('gpsIdPlaceholder')} placeholderTextColor={colors.textMuted} value={form.gpsTracker} onChangeText={(v) => setForm((p) => ({ ...p, gpsTracker: v }))} />
            <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.photoModalTitle, { color: colors.text }]}>{t('addMotoPhoto')}</Text>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(true); }}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>{t('takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(false); }}>
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>{t('chooseFromGallery')}</Text>
            </TouchableOpacity>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  cardImage: {
    width: '100%',
    height: 140,
  },
  cardImagePlaceholderText: {
    fontSize: 48,
  },
  cardInfo: {
    padding: 16,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 8,
  },
  photoModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  photoModalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});