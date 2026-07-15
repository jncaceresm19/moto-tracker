import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { listMotorcycles, createMotorcycle, deleteMotorcycle, Motorcycle } from '../../src/api';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';
import { VerificationModal } from '../../src/components/VerificationModal';
import { getDisplayPlateParts } from '../../../backend/src/services/plateValidation';

export default function MotorcycleListScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', gpsTracker: '', color: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [verifyingMotorcycle, setVerifyingMotorcycle] = useState<Motorcycle | null>(null);

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
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
      showAlert(t('permissionNeeded'), fromCamera ? t('permissionCamera') : t('permissionGallery'), [{ text: 'OK' }], 'lock-closed', '#FF9500');
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
        color: form.color || undefined,
        imageUrl: imageUri || undefined,
      });
      setMotorcycles((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', gpsTracker: '', color: '' });
      setImageUri(null);
      showAlert(t('success'), t('motorcycleUpdated'), [{ text: 'OK' }], 'checkmark-circle', '#34C759');
    } catch {
      showAlert(t('error'), t('failedToCreate'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    showAlert(t('deleteMoto'), t('deleteMotoConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMotorcycle(id);
            setMotorcycles((prev) => prev.filter((m) => m.id !== id));
          } catch {
            showAlert(t('error'), t('failedToDelete'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
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
      height: 90,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 10,
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
      gap: 10,
    },
    photoPlaceholderText: {
      color: colors.textMuted,
      fontSize: 12,
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
    saveBtn: { backgroundColor: colors.success, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  });

  if (loading) {
    return <View style={dynamicStyles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const formatPlate = (raw: string) => {
    const { letters, numbers } = getDisplayPlateParts(raw);
    return numbers ? `${letters}-${numbers}` : letters;
  };

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
              activeOpacity={0.9}
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
                <View style={styles.cardTitleRow}>
                  <Text style={dynamicStyles.cardTitle}>{item.brand} {item.model}</Text>
                  {item.verificada ? (
                    <View style={[styles.verifiedBadge, { backgroundColor: colors.green }]}>
                      <Ionicons name="checkmark-circle" size={12} color="#fff" />
                      <Text style={styles.verifiedText}>{t('verifyMotoApproved')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.verifyButton, { borderColor: colors.primary }]}
                      onPress={() => setVerifyingMotorcycle(item)}
                    >
                      <Ionicons name="shield-checkmark-outline" size={12} color={colors.primary} />
                      <Text style={[styles.verifyButtonText, { color: colors.primary }]}>{t('verifyMotoStart')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={dynamicStyles.cardSub}>{item.year} · {formatPlate(item.licensePlate)}</Text>
                <Text style={dynamicStyles.cardKm}>{item.currentKilometers.toLocaleString()} km</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={dynamicStyles.fab} activeOpacity={0.8} onPress={() => { setErrors({}); setImageUri(null); setShowCreate(true); }}>
        <Text style={dynamicStyles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={dynamicStyles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{t('addMotorcycle')}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={dynamicStyles.cancel}>X</Text></TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
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
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -6, marginBottom: 10 }}>Ingresar patente del permiso de circulación o padrón</Text>
              {errors.licensePlate ? <Text style={dynamicStyles.errorText}>{errors.licensePlate}</Text> : null}
              <TextInput style={dynamicStyles.input} placeholder={t('currentKilometers')} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={form.currentKilometers} onChangeText={(v) => setForm((p) => ({ ...p, currentKilometers: v }))} />
              <TextInput style={dynamicStyles.input} placeholder="Color" placeholderTextColor={colors.textMuted} value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} />
              <View style={{ marginTop: 10, marginBottom: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('gpsQuestion')}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{t('gpsQuestionHint')}</Text>
              </View>
              <TextInput style={dynamicStyles.input} placeholder={t('gpsIdPlaceholder')} placeholderTextColor={colors.textMuted} value={form.gpsTracker} onChangeText={(v) => setForm((p) => ({ ...p, gpsTracker: v }))} />
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 4 }}>{t('gpsQuestionHint2')}</Text>
              <TouchableOpacity style={dynamicStyles.saveBtn} activeOpacity={0.8} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.successText} /> : <Text style={dynamicStyles.saveBtnText}>{t('save')}</Text>}
              </TouchableOpacity>
            </ScrollView>
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

      {verifyingMotorcycle && (
        <VerificationModal
          visible={!!verifyingMotorcycle}
          motorcycleId={verifyingMotorcycle.id}
          motorcycleName={`${verifyingMotorcycle.brand} ${verifyingMotorcycle.model}`}
          licensePlate={verifyingMotorcycle.licensePlate}
          isClaveUnica={!!user?.verificadoClaveunica}
          isIdentityVerified={!!user?.identidadVerificada}
          onClose={() => setVerifyingMotorcycle(null)}
          onVerified={(result) => {
            console.log('Verification result:', result);
            setVerifyingMotorcycle(null);
            loadMotorcycles();
          }}
        />
      )}
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  verifyButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderIcon: {
    fontSize: 22,
    marginBottom: 0,
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