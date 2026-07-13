import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, updateMotorcycle, getMotorcycle, MaintenanceRecord } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';
import { createReminder, OilType, getOilInterval } from '../../../../src/services/reminderService';

const CATEGORY_ICON = '🔧';

const DEFAULT_TYPES = [
  { key: 'motor_oil', labelKey: 'motorOil' },
  { key: 'air_filter', labelKey: 'airFilter' },
  { key: 'drive_chain', labelKey: 'driveChain' },
  { key: 'brakes', labelKey: 'brakes' },
  { key: 'spark_plugs', labelKey: 'sparkPlugs' },
  { key: 'battery', labelKey: 'battery' },
  { key: 'tires', labelKey: 'tires' },
  { key: 'coolant', labelKey: 'coolant' },
  { key: 'valve_adjustment', labelKey: 'valveAdjustment' },
];

const CUSTOM_TYPES_KEY = 'custom_maintenance_types';

const MOTOR_OIL_OPTIONS = [
  { key: 'mineral', label: 'Mineral', detail: 'Cada 1.500–2.000 km o 6 meses' },
  { key: 'semi_synthetic', label: 'Semi-sintético', detail: 'Cada 3.000–4.000 km o 6 meses' },
  { key: 'synthetic', label: 'Sintético', detail: 'Cada 5.000–6.000 km (premium hasta 8.000–10.000 km) o 12 meses' },
];

export default function MaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ type: 'motor_oil', description: '', kilometersAtService: '', serviceDate: '', cost: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Custom types (user-created)
  const [customTypes, setCustomTypes] = useState<{ key: string; label: string }[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [lastSavedOilRecord, setLastSavedOilRecord] = useState<{ oilType: OilType; kilometersAtService: number; serviceDate: string } | null>(null);
  const [motorcycleKm, setMotorcycleKm] = useState(0);

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState(colors.primary);

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = colors.primary) => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  // Photo picker functions
  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert(t('permissionNeeded'), fromCamera ? t('permissionCamera') : t('permissionGallery'), [{text: 'OK'}], 'lock-closed', '#FF9500');
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
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        uri = base64;
      }
      setImageUri(uri);
    }
  };

  const showImageOptions = () => {
    setShowPhotoModal(true);
  };

  // Load custom types from AsyncStorage
  const loadCustomTypes = async () => {
    try {
      const stored = await AsyncStorage.getItem(`${CUSTOM_TYPES_KEY}_${id}`);
      if (stored) setCustomTypes(JSON.parse(stored));
    } catch {}
  };

  // Save custom types to AsyncStorage
  const saveCustomTypes = async (types: { key: string; label: string }[]) => {
    setCustomTypes(types);
    await AsyncStorage.setItem(`${CUSTOM_TYPES_KEY}_${id}`, JSON.stringify(types));
  };

  // Navigation header
  useEffect(() => {
    const label = getLabel(selectedType);
    navigation.setOptions({
      title: label || t('maintenance'),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (selectedType) {
              setSelectedType(null);
            } else {
              router.push(`/(app)/motorcycle/${id}`);
            }
          }}
          style={{ marginLeft: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, router, selectedType, t, colors, customTypes]);

  const load = async () => {
    if (!id) return;
    try {
      const [records, moto] = await Promise.all([listMaintenance(id), getMotorcycle(id)]);
      setRecords(records);
      setMotorcycleKm(moto.currentKilometers);
    }
    catch { showAlert(t('error'), t('failedToLoad'), [{ text: 'OK' }], 'close-circle', colors.danger); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); loadCustomTypes(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Build all categories: defaults + custom
  const allTypes = [
    ...DEFAULT_TYPES,
    ...customTypes.map((ct) => ({ key: ct.key, labelKey: ct.label })),
  ];

  const getLabel = (key: string | null): string => {
    if (!key) return '';
    const def = DEFAULT_TYPES.find((d) => d.key === key);
    if (def) return t(def.labelKey as any);
    const custom = customTypes.find((c) => c.key === key);
    if (custom) return custom.label;
    return key;
  };

  const resetForm = (type: string = 'motor_oil') => {
    setForm({ type, description: '', kilometersAtService: '', serviceDate: '', cost: '' });
    setImageUri(null);
  };

  const openCreate = () => {
    setForm({ type: selectedType || 'motor_oil', description: '', kilometersAtService: String(motorcycleKm || ''), serviceDate: '', cost: '' });
    setImageUri(null);
    setErrors({});
    setShowCreate(true);
  };

  const openEdit = (record: MaintenanceRecord) => {
    setErrors({});
    setForm({
      type: record.type,
      description: record.description,
      kilometersAtService: String(record.kilometersAtService),
      serviceDate: record.serviceDate.split('T')[0],
      cost: record.cost != null ? String(record.cost) : '',
    });
    setImageUri(record.photoUrl || null);
    setEditing(record);
  };

  const handleAddCustomType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    const key = `custom_${Date.now()}`;
    const updated = [...customTypes, { key, label: name }];
    await saveCustomTypes(updated);
    setNewTypeName('');
    setShowAddType(false);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.description) newErrors.description = t('required');
    if (!form.kilometersAtService) newErrors.kilometersAtService = t('required');
    if (!form.serviceDate) newErrors.serviceDate = t('required');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        description: form.description,
        kilometersAtService: Number(form.kilometersAtService),
        serviceDate: new Date(form.serviceDate).toISOString(),
        cost: form.cost ? Number(form.cost) : undefined,
        photoUrl: imageUri || undefined,
      };
      console.log('CREATE PAYLOAD:', JSON.stringify({ ...payload, photoUrl: payload.photoUrl ? `[${payload.photoUrl.length} chars]` : undefined }));
      const created = await createMaintenance(id, payload);
      setRecords((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      // Update motorcycle km when saving motor_oil
      if (form.type === 'motor_oil' && id) {
        try { await updateMotorcycle(id as string, { currentKilometers: Number(form.kilometersAtService) }); } catch {}
        const oilTypeMap: Record<string, OilType> = {
          'Mineral': 'mineral',
          'Semi-sintético': 'semi_synthetic',
          'Sintético': 'synthetic',
        };
        const oilType = oilTypeMap[form.description];
        if (oilType) {
          setLastSavedOilRecord({
            oilType,
            kilometersAtService: Number(form.kilometersAtService),
            serviceDate: form.serviceDate,
          });
          setShowReminderModal(true);
        }
      } else {
        showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
      }
    } catch (e) {
      console.error('CREATE MAINTENANCE ERROR:', e);
      showAlert(t('error'), t('failedToCreate'), [{ text: 'OK' }], 'close-circle', colors.danger);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.description) newErrors.description = t('required');
    if (!form.kilometersAtService) newErrors.kilometersAtService = t('required');
    if (!form.serviceDate) newErrors.serviceDate = t('required');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!id || !editing) return;
    setSaving(true);
    try {
      const updated = await updateMaintenance(id, editing.id, {
        type: form.type,
        description: form.description,
        kilometersAtService: Number(form.kilometersAtService),
        serviceDate: new Date(form.serviceDate).toISOString(),
        cost: form.cost ? Number(form.cost) : null,
        photoUrl: imageUri || null,
      });
      setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditing(null);
      // Update motorcycle km when editing motor_oil
      if (form.type === 'motor_oil' && id) {
        try { await updateMotorcycle(id as string, { currentKilometers: Number(form.kilometersAtService) }); } catch {}
      }
      showAlert(t('success'), t('recordUpdated'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
    } catch {
      showAlert(t('error'), t('failedToUpdate'), [{ text: 'OK' }], 'close-circle', colors.danger);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: MaintenanceRecord) => {
    showAlert(t('deleteRecord'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteMaintenance(id, record.id);
            setRecords((prev) => prev.filter((r) => r.id !== record.id));
          } catch { showAlert(t('error'), t('failedToDelete'), [{ text: 'OK' }], 'close-circle', colors.danger); }
        },
      },
    ], 'warning', colors.accent);
  };

  const modalTitle = editing ? t('editRecord') : t('newRecord');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  const filteredRecords = selectedType ? records.filter((r) => r.type === selectedType) : [];
  const hasOilRecord = records.some((r) => r.type === 'motor_oil');

  const isCustomType = (key: string) => customTypes.some((c) => c.key === key);

  const handleDeleteCustomType = (key: string, label: string) => {
    const hasRecords = records.some((r) => r.type === key);
    if (hasRecords) {
      showAlert(
        'No se puede eliminar',
        `Esta categoría tiene registros asociados. Eliminá los registros primero.`,
        [{ text: 'OK' }],
        'close-circle',
        colors.accent
      );
      return;
    }
    showAlert(
      'Eliminar categoría',
      `¿Eliminar "${label}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            const updated = customTypes.filter((c) => c.key !== key);
            await saveCustomTypes(updated);
          },
        },
      ],
      'warning',
      colors.accent
    );
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  // ============================================================
  // VISTA 1: LISTA DE CATEGORÍAS
  // ============================================================
  if (!selectedType) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={allTypes}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const count = records.filter((r) => r.type === item.key).length;
            const isCustom = isCustomType(item.key);
            return (
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: colors.card }]}
                onPress={() => setSelectedType(item.key)}
                onLongPress={isCustom ? () => handleDeleteCustomType(item.key, getLabel(item.key)) : undefined}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICON}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryText, { color: colors.text }]}>{item.labelKey ? t(item.labelKey as any) : item.labelKey}</Text>
                  <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                    {count} {count === 1 ? 'registro' : 'registros'}
                  </Text>
                </View>
                {isCustom && (
                  <TouchableOpacity
                    onPress={() => handleDeleteCustomType(item.key, getLabel(item.key))}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                )}
                <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* FAB: + */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddType(true)}
        >
          <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
        </TouchableOpacity>

        {/* Add Custom Type Modal */}
        <Modal visible={showAddType} transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowAddType(false)}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.addTypeModal, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.addTypeTitle, { color: colors.text }]}>Nueva categoría</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
                    placeholder="Nombre del mantenimiento"
                    placeholderTextColor={colors.textMuted}
                    value={newTypeName}
                    onChangeText={setNewTypeName}
                    autoFocus
                  />
                  <View style={styles.addTypeActions}>
                    <TouchableOpacity onPress={() => setShowAddType(false)} style={[styles.addTypeBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={{ color: colors.text }}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddCustomType}
                      style={[styles.addTypeBtn, { backgroundColor: colors.primary }]}
                      disabled={!newTypeName.trim()}
                    >
                      <Text style={{ color: colors.primaryText, fontWeight: '600' }}>Agregar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
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

  // ============================================================
  // VISTA 2: DETALLE DEL REGISTRO (como documentos)
  // ============================================================
  const record = filteredRecords[0]; // Un solo registro por categoría
  const oilLabel = record ? MOTOR_OIL_OPTIONS.find((o) => o.label === record.description) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={record ? { paddingBottom: 40 } : { flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {record ? (
          <>
            {/* Foto del producto */}
            {record.photoUrl ? (
              <TouchableOpacity onPress={() => { setViewingPhoto(record.photoUrl ?? null); setShowPhotoViewer(true); }}>
                <Image source={{ uri: record.photoUrl }} style={styles.detailImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.detailImage, styles.detailImagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 48 }}>📷</Text>
              </View>
            )}

            <View style={styles.detailContent}>
              {/* Título */}
              <Text style={[styles.detailTitle, { color: colors.text }]}>{record.description}</Text>

              {/* Info row */}
              <View style={[styles.detailInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.detailInfoRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>Fecha:</Text>
                  <Text style={[styles.detailInfoValue, { color: colors.text }]}>{new Date(record.serviceDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </View>
                <View style={[styles.detailInfoDivider, { backgroundColor: colors.border }]} />
                <View style={styles.detailInfoRow}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
                  <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>Kilometraje:</Text>
                  <Text style={[styles.detailInfoValue, { color: colors.text }]}>{record.kilometersAtService.toLocaleString('es-CL')} km</Text>
                </View>
                {record.cost != null && (
                  <>
                    <View style={[styles.detailInfoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.detailInfoRow}>
                      <Ionicons name="cash-outline" size={18} color={colors.success} />
                      <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>Costo:</Text>
                      <Text style={[styles.detailInfoValue, { color: colors.success }]}>${record.cost.toLocaleString('es-CL')}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Próximo cambio (solo aceite) */}
              {record.type === 'motor_oil' && oilLabel && (() => {
                const interval = getOilInterval(oilLabel.key as OilType);
                const nextKm = record.kilometersAtService + interval.km;
                const nextDate = new Date(record.serviceDate);
                nextDate.setMonth(nextDate.getMonth() + interval.months);
                return (
                  <View style={[styles.detailInfoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <View style={styles.detailInfoRow}>
                      <Text style={{ fontSize: 18 }}>🔔</Text>
                      <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>Próximo cambio:</Text>
                    </View>
                    <Text style={[styles.detailInfoValue, { color: colors.primary, marginTop: 6, marginLeft: 26 }]}>
                      {nextKm.toLocaleString('es-CL')} km o el {nextDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                );
              })()}

              {/* Botones editar / eliminar */}
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => openEdit(record)}
                >
                  <Ionicons name="pencil" size={18} color={colors.primaryText} />
                  <Text style={[styles.detailActionText, { color: colors.primaryText }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}
                  onPress={() => handleDelete(record)}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={[styles.detailActionText, { color: '#fff' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          /* Sin registro */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{CATEGORY_ICON}</Text>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noRecords')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noRecordsSub')}</Text>
          </View>
        )}
      </ScrollView>

      {!record && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
        </TouchableOpacity>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
              <TouchableOpacity onPress={closeModal}><Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Type indicator (read-only, set by category) */}
              <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Text style={{ fontSize: 18 }}>{CATEGORY_ICON}</Text>
                <Text style={{ fontSize: 15, color: colors.text }}>{getLabel(form.type)}</Text>
              </View>

              {form.type === 'motor_oil' ? (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('description')} *</Text>
                  {MOTOR_OIL_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.oilOption,
                        { borderColor: form.description === opt.label ? colors.primary : colors.inputBorder, backgroundColor: form.description === opt.label ? colors.surfaceSecondary : colors.surface },
                      ]}
                      onPress={() => { setForm((p) => ({ ...p, description: opt.label })); setErrors((p) => ({ ...p, description: '' })); }}
                    >
                      <View style={styles.oilOptionRow}>
                        <Text style={[styles.oilOptionTitle, { color: form.description === opt.label ? colors.primary : colors.text }]}>{opt.label}</Text>
                        {form.description === opt.label && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </View>
                      <Text style={[styles.oilOptionDetail, { color: colors.textSecondary }]}>{opt.detail}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
                  placeholder={`${t('description')} *`}
                  placeholderTextColor={colors.textMuted}
                  value={form.description}
                  onChangeText={(text) => { setForm((p) => ({ ...p, description: text })); setErrors((p) => ({ ...p, description: '' })); }}
                />
              )}
              {errors.description ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.description}</Text> : null}

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
                placeholder={`${t('kilometers')} *`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={form.kilometersAtService}
                onChangeText={(text) => { setForm((p) => ({ ...p, kilometersAtService: text })); setErrors((p) => ({ ...p, kilometersAtService: '' })); }}
              />
              {errors.kilometersAtService ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.kilometersAtService}</Text> : null}

              <TouchableOpacity style={[styles.input, { borderColor: colors.inputBorder }]} onPress={() => setShowDatePicker(true)}>
                <Text style={{ fontSize: 15, color: form.serviceDate ? colors.text : colors.textMuted }}>
                  {form.serviceDate || t('selectDate')}
                </Text>
              </TouchableOpacity>
              {errors.serviceDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.serviceDate}</Text> : null}

              {showDatePicker && (
                <DateTimePicker
                  value={form.serviceDate ? new Date(form.serviceDate) : new Date()}
                  mode="date"
                  display="default"
                  onValueChange={(_event: any, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) {
                      const iso = date.toISOString().split('T')[0];
                      setForm((p) => ({ ...p, serviceDate: iso }));
                      setErrors((p) => ({ ...p, serviceDate: '' }));
                    }
                  }}
                  onDismiss={() => setShowDatePicker(false)}
                />
              )}

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
                placeholder={`${t('cost')} (${t('optional')})`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={form.cost}
                onChangeText={(text) => setForm((p) => ({ ...p, cost: text }))}
              />

              {/* Photo picker */}
              <TouchableOpacity style={[styles.photoBtn, { borderColor: colors.inputBorder }]} onPress={showImageOptions}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
                    <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>Foto del producto (opcional)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.photoModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.photoModalTitle, { color: colors.text }]}>Foto del producto</Text>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(true); }}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(false); }}>
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>Elegir de galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo Viewer */}
      <Modal visible={showPhotoViewer} animationType="fade" transparent>
        <View style={styles.photoViewerContainer}>
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => { setShowPhotoViewer(false); setViewingPhoto(null); }}>
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewingPhoto && (
            <Image source={{ uri: viewingPhoto }} style={styles.photoViewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Reminder Modal */}
      <Modal visible={showReminderModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            setShowReminderModal(false);
            setLastSavedOilRecord(null);
            showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
              <View style={[styles.reminderModal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.reminderIcon]}>🔔</Text>
                <Text style={[styles.reminderTitle, { color: colors.text }]}>Recordatorio de Aceite</Text>
                <Text style={[styles.reminderMessage, { color: colors.textSecondary }]}>
                  ¿Querés que te recordemos cuándo es el próximo cambio?
                </Text>
                {lastSavedOilRecord && (() => {
                  const interval = getOilInterval(lastSavedOilRecord.oilType);
                  const nextKm = lastSavedOilRecord.kilometersAtService + interval.km;
                  const nextDate = new Date(lastSavedOilRecord.serviceDate);
                  nextDate.setMonth(nextDate.getMonth() + interval.months);
                  const nextDateStr = nextDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
                  const oilLabel = lastSavedOilRecord.oilType === 'mineral' ? 'Mineral' :
                    lastSavedOilRecord.oilType === 'semi_synthetic' ? 'Semi-sintético' : 'Sintético';
                  return (
                    <View style={[styles.reminderInfo, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.reminderInfoTitle, { color: colors.text }]}>Próximo cambio estimado:</Text>
                      <Text style={[styles.reminderInfoText, { color: colors.text }]}>
                        {nextKm.toLocaleString('es-CL')} km o el {nextDateStr}
                      </Text>
                      <Text style={[styles.reminderInfoNote, { color: colors.textMuted }]}>
                        * Aceite {oilLabel} · Intervalo: {interval.km.toLocaleString('es-CL')} km / {interval.months} meses
                      </Text>
                    </View>
                  );
                })()}
                <View style={styles.reminderActions}>
                  <TouchableOpacity
                    style={[styles.reminderBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => {
                      setShowReminderModal(false);
                      setLastSavedOilRecord(null);
                      showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
                    }}
                  >
                    <Text style={{ color: colors.text }}>Ahora no</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reminderBtn, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      if (lastSavedOilRecord && id) {
                        await createReminder(
                          id as string,
                          lastSavedOilRecord.oilType,
                          lastSavedOilRecord.kilometersAtService,
                          lastSavedOilRecord.serviceDate
                        );
                      }
                      setShowReminderModal(false);
                      setLastSavedOilRecord(null);
                      showAlert('Recordatorio guardado', 'Te recordaremos el próximo cambio de aceite.', [{ text: 'OK' }], 'checkmark-circle', colors.success);
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: '600' }}>Recordarme</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryList: { padding: 16 },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryIcon: { fontSize: 20, marginRight: 12 },
  categoryText: { fontSize: 16, fontWeight: '500' },
  categoryCount: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 20 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  emptyContainer: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptySub: { fontSize: 13, marginTop: 4 },
  card: { padding: 14, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  cardInfo: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDesc: { fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardDate: { fontSize: 13 },
  cardKm: { fontSize: 13, fontWeight: '500' },
  cardCost: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  // Detail view (like documents)
  detailImage: { width: '100%', height: 220 },
  detailImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  detailContent: { padding: 20 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  detailInfoCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailInfoLabel: { fontSize: 14 },
  detailInfoValue: { fontSize: 15, fontWeight: '500', flex: 1 },
  detailInfoDivider: { height: 1, marginVertical: 12 },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10 },
  detailActionText: { fontSize: 16, fontWeight: '600' },
  // Photo Viewer
  photoViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  photoViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  photoViewerCloseText: { color: '#fff', fontSize: 24 },
  photoViewerImage: { width: '90%', height: '70%' },
  // Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  inputLabel: { fontSize: 14, marginBottom: 6 },
  oilOption: { borderWidth: 1.5, borderRadius: 8, padding: 12, marginBottom: 8 },
  oilOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  oilOptionTitle: { fontSize: 15, fontWeight: '600' },
  oilOptionDetail: { fontSize: 13, marginTop: 4 },
  // Reminder Modal
  reminderModal: { borderRadius: 14, padding: 24, marginHorizontal: 24, alignItems: 'center' },
  reminderIcon: { fontSize: 48, marginBottom: 12 },
  reminderTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  reminderMessage: { fontSize: 15, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  reminderInfo: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 20, width: '100%' },
  reminderInfoTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  reminderInfoText: { fontSize: 14, textAlign: 'center' },
  reminderInfoNote: { fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  reminderActions: { flexDirection: 'row', gap: 10, width: '100%' },
  reminderBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  // Photo picker
  photoBtn: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, alignItems: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 40, borderRadius: 6 },
  photoPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 13 },
  // Photo modal
  photoModalContent: { borderRadius: 14, padding: 20, marginHorizontal: 24 },
  photoModalClose: { alignSelf: 'flex-end', padding: 4 },
  photoModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  photoModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, marginBottom: 10 },
  photoModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, fontWeight: '300', marginTop: -2 },
  // Add Type Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  addTypeModal: { borderRadius: 14, padding: 20 },
  addTypeTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  addTypeActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addTypeBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
});
