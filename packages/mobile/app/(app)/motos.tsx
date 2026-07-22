import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { listMotorcycles, createMotorcycle, deleteMotorcycle, Motorcycle } from '../../src/api';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { CustomAlert } from '../../src/components/CustomAlert';
import { VerificationModal } from '../../src/components/VerificationModal';
import { ImageCropModal } from '../../src/components/ImageCropModal';
import { OcrReviewModal, buildOcrFields } from '../../src/components/OcrReviewModal';
import { extractDocumentData } from '../../src/services/ocrService';
import { getDisplayPlateParts } from '../../../backend/src/services/plateValidation';

export default function MotorcycleListScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', color: '', engineNumber: '', chassisNumber: '', serialNumber: '' });
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

  // Padrón scan flow
  const [padronScanPhase, setPadronScanPhase] = useState<'idle' | 'front' | 'back'>('idle');
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUri, setCropImageUri] = useState('');
  const [showOcrReview, setShowOcrReview] = useState(false);
  const [ocrFields, setOcrFields] = useState<{ key: string; label: string; value: string; editable?: boolean }[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>(undefined);

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
        // File.base64() from the "new" expo-file-system module was added incrementally
        // across v19 patch releases and can be missing depending on installed version.
        // The legacy readAsStringAsync API is stable across versions, so we use it here
        // as a safe fallback for the rare case ImagePicker doesn't return base64 directly.
        const b64 = await FileSystemLegacy.readAsStringAsync(result.assets[0].uri, {
          encoding: 'base64',
        });
        uri = `data:image/jpeg;base64,${b64}`;
      }
      setImageUri(uri);
    }
  };

  // ── Padrón scan flow ────────────────────────────────────────────────────
  const processPadronOcr = async (base64: string, side: 'front' | 'back') => {
    const dataUri = `data:image/jpeg;base64,${base64}`;
    setShowCropModal(false);
    setOcrLoading(true);
    setOcrError('');
    setShowOcrReview(true);
    try {
      const result = await extractDocumentData(dataUri, 'padron');
      if (result.error) {
        setOcrError(result.error);
        return;
      }
      setOcrConfidence(result.confidence);
      const filtered: Record<string, string | undefined> = {
        issueDate: result.issueDate, patente: result.patente, rut: result.rut,
        brand: result.brand, model: result.model, year: result.year,
        engineNumber: result.engineNumber, chassisNumber: result.chassisNumber,
        serialNumber: result.serialNumber, color: result.color,
      };

      if (side === 'back') {
        // Back: only show patente, rut
        filtered.brand = undefined;
        filtered.model = undefined;
        filtered.year = undefined;
        filtered.engineNumber = undefined;
        filtered.chassisNumber = undefined;
        filtered.serialNumber = undefined;
        filtered.color = undefined;
      } else {
        // Front: only show vehicle fields, not patente/rut
        filtered.patente = undefined;
        filtered.rut = undefined;
      }

      // Check if any meaningful field was actually extracted
      const hasData = side === 'back'
        ? !!(filtered.patente || filtered.rut)
        : !!(filtered.issueDate || filtered.year || filtered.brand || filtered.model ||
          filtered.engineNumber || filtered.chassisNumber || filtered.serialNumber || filtered.color);

      if (!hasData) {
        setOcrError('No se pudieron extraer datos.\nReintentá con mejor iluminación o completá los campos manualmente.');
        return;
      }

      setOcrFields(buildOcrFields('padron', filtered));
    } catch (e: any) {
      setOcrError(e?.message || 'Error al procesar OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  // Show/hide create modal around scan flow to avoid modal stacking issues
  const closeCreateForScan = () => { setShowCreate(false); };
  const reopenCreateAfterScan = () => { setShowCreate(true); };

  const handlePadronOcrSave = () => {
    // Extract values from ocrFields and auto-fill the form
    const ocrData: Record<string, string> = {};
    for (const field of ocrFields) {
      ocrData[field.key] = field.value;
    }

    setForm((prev) => ({
      ...prev,
      ...(ocrData.year ? { year: ocrData.year } : {}),
      ...(ocrData.brand ? { brand: ocrData.brand } : {}),
      ...(ocrData.model ? { model: ocrData.model } : {}),
      ...(ocrData.engineNumber ? { engineNumber: ocrData.engineNumber } : {}),
      ...(ocrData.chassisNumber ? { chassisNumber: ocrData.chassisNumber } : {}),
      ...(ocrData.serialNumber ? { serialNumber: ocrData.serialNumber } : {}),
      ...(ocrData.color ? { color: ocrData.color } : {}),
      ...(ocrData.patente ? { licensePlate: ocrData.patente } : {}),
    }));

    setShowOcrReview(false);

    if (padronScanPhase === 'front') {
      // After front scan, automatically start back scan
      setPadronScanPhase('back');
      // Small delay before opening camera for back
      setTimeout(() => handlePadronScan(), 600);
    } else {
      setPadronScanPhase('idle');
      reopenCreateAfterScan();
    }
  };

  const handlePadronScan = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert(t('permissionNeeded'), t('permissionCamera'), [{ text: 'OK' }], 'lock-closed', '#FF9500');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false });
    if (result.canceled || !result.assets[0]) { reopenCreateAfterScan(); return; }

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulated.base64) { reopenCreateAfterScan(); return; }

    setCropImageUri(manipulated.uri);
    setShowCropModal(true);
  };

  const handlePadronCropConfirm = async (base64: string) => {
    if (padronScanPhase === 'idle') return;
    await processPadronOcr(base64, padronScanPhase);
  };

  const handlePadronRetry = () => {
    setShowOcrReview(false);
    setTimeout(() => { handlePadronScan(); }, 300);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const showImageOptions = () => {
    setShowPhotoModal(true);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.brand) newErrors.brand = t('required');
    if (!form.model) newErrors.model = t('required');
    if (!form.year) newErrors.year = t('required');
    if (!form.licensePlate) newErrors.licensePlate = t('required');
    if (!form.engineNumber) newErrors.engineNumber = t('required');
    if (!form.chassisNumber) newErrors.chassisNumber = t('required');
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
        color: form.color || undefined,
        engineNumber: form.engineNumber || undefined,
        chassisNumber: form.chassisNumber || undefined,
        serialNumber: form.serialNumber || undefined,
        imageUrl: imageUri || undefined,
      });
      setMotorcycles((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', color: '', engineNumber: '', chassisNumber: '', serialNumber: '' });
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
    cancel: { color: colors.textSecondary, fontSize: 16, marginBottom: 15 },
    modalTopRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    modalLogoContainer: {
      alignItems: 'center',
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: -60,
      marginBottom: 30,
    },
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
      borderWidth: 1,
      borderColor: colors.primary,
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
    saveBtn: { backgroundColor: colors.success, borderRadius: 30, padding: 14, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
    // --- Safety / implements info banner (shown above the first listed motorcycle) ---
    // Mismo estilo que las cards de "Requisitos" en documentos.tsx (brandBlue + opacidad)
    safetyCard: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.brandBlueBg,
      borderColor: colors.brandBlue,
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
    },
    safetyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    safetyTitle: { fontSize: 13, fontWeight: '600', color: colors.text + '99' },
    safetyItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    safetyItemText: { fontSize: 11.5, flex: 1, lineHeight: 15, color: colors.text + '99' },

    // ── Nuevos estilos: layout tipo mockup (secciones agrupadas) ──────────

    sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 8, marginHorizontal: 3 },
    sectionCard: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 4,
      marginBottom: 20,
    },
    groupedInput: {
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      marginBottom: 0,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    groupedError: {
      color: colors.danger,
      fontSize: 11,
      paddingHorizontal: 12,
      paddingBottom: 6,
      marginTop: -4,
    },
    scanBtn: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 6,
    },
    scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
    scanHint: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 20,
    },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      borderRadius: 10,
      padding: 12,
      marginBottom: 24,
      overflow: 'hidden',
    },
    photoRowThumb: { width: 40, height: 40, borderRadius: 6, color: colors.primary },
    photoRowText: { fontSize: 13, color: colors.primary, textAlign: 'center', },
  });

  if (loading) {
    return <View style={dynamicStyles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const formatPlate = (raw: string) => {
    const { letters, numbers } = getDisplayPlateParts(raw);
    return numbers ? `${letters}-${numbers}` : letters;
  };

  const SafetyInfoBanner = () => (
    <View style={dynamicStyles.safetyCard}>
      <View style={dynamicStyles.safetyHeader}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
        <Text style={dynamicStyles.safetyTitle}>Seguridad / Implementos</Text>
      </View>
      <View>
        <View style={dynamicStyles.safetyItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
          <Text style={dynamicStyles.safetyItemText}>
            <Text style={{ fontWeight: '600' }}>Casco: </Text>
            cambio cada 5 años o por impacto
          </Text>
        </View>
        <View style={dynamicStyles.safetyItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
          <Text style={dynamicStyles.safetyItemText}>
            <Text style={{ fontWeight: '600' }}>Batería del rastreador GPS: </Text>
            revisión cada 6 meses (si tienes activa esta opción).
          </Text>
        </View>
      </View>
    </View>
  );

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
          ListHeaderComponent={SafetyInfoBanner}
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

      <TouchableOpacity style={dynamicStyles.fab} activeOpacity={0.8} onPress={() => { setErrors({}); setImageUri(null); setPadronScanPhase('idle'); setShowCropModal(false); setShowOcrReview(false); setShowCreate(true); }}>
        <Text style={dynamicStyles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={dynamicStyles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={dynamicStyles.modalTopRow}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={{ marginLeft: 'auto' }}>
                <Text style={dynamicStyles.cancel}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={dynamicStyles.modalLogoContainer}>
                <Image
                  source={require('../../assets/nombre.jpeg')}
                  style={styles.modalLogo}
                  resizeMode="contain"
                />
                <Text style={dynamicStyles.modalSubtitle}>{t('addMotorcycle')}</Text>
              </View>

              {/* Escanear padrón — CTA principal */}
              <TouchableOpacity
                style={dynamicStyles.scanBtn}
                activeOpacity={0.8}
                onPress={() => { setPadronScanPhase('front'); closeCreateForScan(); handlePadronScan(); }}
              >
                <Ionicons name="scan-outline" size={18} color="#fff" />
                <Text style={dynamicStyles.scanBtnText}>Escanear padrón</Text>
              </TouchableOpacity>
              <Text style={dynamicStyles.scanHint}>Completa año, marca, modelo y N° automáticamente</Text>

              {/* Foto — secundaria */}
              <TouchableOpacity activeOpacity={0.7} style={dynamicStyles.photoRow} onPress={showImageOptions}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={dynamicStyles.photoRowThumb} resizeMode="cover" />
                    <Text style={dynamicStyles.photoRowText}>Cambiar foto del vehículo</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                    <Text style={dynamicStyles.photoRowText}>{t('tapToAddMotoPhoto')}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Sección: Identificación */}
              <Text style={dynamicStyles.sectionLabel}>Identificación</Text>
              <View style={dynamicStyles.sectionCard}>
                <TextInput style={dynamicStyles.groupedInput} placeholder={t('year') + ' *'} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={form.year} onChangeText={(v) => { setForm((p) => ({ ...p, year: v })); setErrors((p) => ({ ...p, year: '' })); }} />
                {errors.year ? <Text style={dynamicStyles.groupedError}>{errors.year}</Text> : null}
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder={t('brand') + ' *'} placeholderTextColor={colors.textMuted} value={form.brand} onChangeText={(v) => { setForm((p) => ({ ...p, brand: v })); setErrors((p) => ({ ...p, brand: '' })); }} />
                {errors.brand ? <Text style={dynamicStyles.groupedError}>{errors.brand}</Text> : null}
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder={t('model') + ' *'} placeholderTextColor={colors.textMuted} value={form.model} onChangeText={(v) => { setForm((p) => ({ ...p, model: v })); setErrors((p) => ({ ...p, model: '' })); }} />
                {errors.model ? <Text style={dynamicStyles.groupedError}>{errors.model}</Text> : null}
              </View>

              {/* Sección: Números de identificación */}
              <Text style={dynamicStyles.sectionLabel}>Números de identificación</Text>
              <View style={dynamicStyles.sectionCard}>
                <TextInput style={dynamicStyles.groupedInput} placeholder="N° Motor *" placeholderTextColor={colors.textMuted} value={form.engineNumber} onChangeText={(v) => { setForm((p) => ({ ...p, engineNumber: v })); setErrors((p) => ({ ...p, engineNumber: '' })); }} />
                {errors.engineNumber ? <Text style={dynamicStyles.groupedError}>{errors.engineNumber}</Text> : null}
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder="N° Chasis *" placeholderTextColor={colors.textMuted} value={form.chassisNumber} onChangeText={(v) => { setForm((p) => ({ ...p, chassisNumber: v })); setErrors((p) => ({ ...p, chassisNumber: '' })); }} />
                {errors.chassisNumber ? <Text style={dynamicStyles.groupedError}>{errors.chassisNumber}</Text> : null}
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder="N° Serie" placeholderTextColor={colors.textMuted} value={form.serialNumber} onChangeText={(v) => setForm((p) => ({ ...p, serialNumber: v }))} />
              </View>

              {/* Sección: Otros datos */}
              <Text style={dynamicStyles.sectionLabel}>Otros datos</Text>
              <View style={dynamicStyles.sectionCard}>
                <TextInput style={dynamicStyles.groupedInput} placeholder={t('licensePlate') + ' *'} placeholderTextColor={colors.textMuted} value={form.licensePlate} onChangeText={(v) => { setForm((p) => ({ ...p, licensePlate: v })); setErrors((p) => ({ ...p, licensePlate: '' })); }} />
                <Text style={{ fontSize: 11, color: colors.textMuted, paddingHorizontal: 12, marginTop: -4, marginBottom: 6 }}>Ingresar patente del permiso de circulación o padrón</Text>
                {errors.licensePlate ? <Text style={dynamicStyles.groupedError}>{errors.licensePlate}</Text> : null}
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder={t('currentKilometers')} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={form.currentKilometers} onChangeText={(v) => setForm((p) => ({ ...p, currentKilometers: v }))} />
                <View style={dynamicStyles.divider} />
                <TextInput style={dynamicStyles.groupedInput} placeholder="Color" placeholderTextColor={colors.textMuted} value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} />
              </View>

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

      {/* Padrón scan modals */}
      <ImageCropModal
        visible={showCropModal}
        imageUri={cropImageUri}
        onConfirm={handlePadronCropConfirm}
        onCancel={() => { setShowCropModal(false); reopenCreateAfterScan(); if (padronScanPhase === 'back') { setPadronScanPhase('idle'); } }}
      />

      <OcrReviewModal
        visible={showOcrReview}
        documentType="padron"
        loading={ocrLoading}
        fields={ocrFields}
        error={ocrError}
        confidence={ocrConfidence}
        onFieldChange={(key, value) => {
          setOcrFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
        }}
        onSave={handlePadronOcrSave}
        onCancel={() => { setShowOcrReview(false); setPadronScanPhase('idle'); reopenCreateAfterScan(); }}
        onRetry={handlePadronRetry}
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
  modalLogo: {
    width: 300,
    height: 150,
    marginTop: -30,
  },
});