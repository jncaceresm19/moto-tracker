import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, updateMotorcycle, getMotorcycle, MaintenanceRecord, listKilometers, KilometerEntry } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';
import { createReminder, OilType, getOilInterval } from '../../../../src/services/reminderService';

const CATEGORY_CHIPS: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  motor_oil: { icon: 'water-outline', bg: '#FAEEDA', color: '#854F0B' },
  air_filter: { icon: 'filter-outline', bg: '#E6F1FB', color: '#185FA5' },
  drive_chain: { icon: 'link-outline', bg: '#E1F5EE', color: '#0F6E56' },
  brakes: { icon: 'stop-circle-outline', bg: '#FDEAEA', color: '#B42318' },
  spark_plugs: { icon: 'flash-outline', bg: '#FFF6D9', color: '#8A6D00' },
  battery: { icon: 'battery-charging-outline', bg: '#EAF3E6', color: '#3D7A2E' },
  tires: { icon: 'ellipse-outline', bg: '#EFEAF6', color: '#5B3E9E' },
  coolant: { icon: 'thermometer-outline', bg: '#E1F0FB', color: '#1C6FA5' },
  valve_adjustment: { icon: 'settings-outline', bg: '#F3E8FF', color: '#6B21A8' },
};

const DEFAULT_CHIP = { icon: 'build-outline' as const, bg: '#F1EFE8', color: '#666' };

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

const BRAKE_OPTIONS = [
  { key: 'pastillas_delanteras', label: 'Pastillas delanteras', detail: 'Cada 10.000–20.000 km' },
  { key: 'pastillas_traseras', label: 'Pastillas traseras', detail: 'Cada 8.000–15.000 km' },
  { key: 'liquido_frenos', label: 'Líquido de frenos', detail: 'Cada 2 años' },
  { key: 'balatas', label: 'Balatas', detail: 'Según uso' },
];

const TIRE_OPTIONS = [
  { key: 'delantero', label: 'Delantero', detail: 'Revisar desgaste visual de la banda de rodado' },
  { key: 'trasero', label: 'Trasero', detail: 'Revisar desgaste visual de la banda de rodado' },
];

const BALATAS_USAGE_OPTIONS = [
  {
    key: 'normal',
    label: 'Uso normal (ciudad)',
    checkInterval: 'Cada 5.000 km',
    changeInterval: 'Entre 15.000 y 30.000 km',
  },
  {
    key: 'intensivo',
    label: 'Uso intensivo (delivery, carga, cerros)',
    checkInterval: 'Cada 3.000–5.000 km',
    changeInterval: 'Entre 10.000 y 20.000 km',
  },
];

const MAX_BRAKE_RECORDS = 4;
const MAX_TIRE_RECORDS = 2;

type MaintenanceInterval = { km?: number; months?: number; notes?: string };


const MAINTENANCE_INTERVALS: Record<string, MaintenanceInterval> = {
  air_filter: {
    km: 10000,
    months: 12,
    notes: 'Revisión cada 3.000–4.000 km · Limpieza filtro de espuma (off-road) cada 1.000–2.000 km',
  },
  drive_chain: {
    km: 20000,
    months: 24,
    notes: 'Tensado cada 500–1.000 km · Lubricado cada 300–500 km o después de lavar la moto / lluvia',
  },
  brakes: {
    km: 15000,
    months: 18,
    notes: 'Pastillas traseras cada 8.000–15.000 km (se desgastan más rápido) · Líquido de frenos cada 2 años',
  },
  spark_plugs: {
    km: 10000,
    notes: 'Rango habitual: 8.000–12.000 km',
  },
  battery: {
    months: 6,
    notes: 'Reemplazo estimado cada 2–3 años',
  },
  coolant: {
    months: 24,
  },
  valve_adjustment: {
    km: 18000,
    notes: 'Rango habitual: 12.000–24.000 km',
  },
};

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

function calcProgress(startKm: number, startDate: string, currentKm: number, interval: MaintenanceInterval) {
  const kmDone = interval.km ? Math.max(0, currentKm - startKm) : 0;
  const kmProgress = interval.km ? Math.min(1, kmDone / interval.km) : 0;

  const monthsElapsed = Math.max(0, (Date.now() - new Date(startDate).getTime()) / MONTH_MS);
  const timeProgress = interval.months ? Math.min(1, monthsElapsed / interval.months) : 0;

  return {
    progress: Math.max(kmProgress, timeProgress),
    kmDone: Math.round(kmDone),
    monthsElapsed: Math.round(monthsElapsed),
  };
}
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
  const [pageIdx, setPageIdx] = useState(0);
  const [form, setForm] = useState({ type: 'motor_oil', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [kmEntries, setKmEntries] = useState<KilometerEntry[]>([]);

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

  // Balatas usage modal
  const [showBalatasModal, setShowBalatasModal] = useState(false);
  const [selectedBalatasUsage, setSelectedBalatasUsage] = useState<string | null>(null);

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
      showAlert(t('permissionNeeded'), fromCamera ? t('permissionCamera') : t('permissionGallery'), [{ text: 'OK' }], 'lock-closed', '#FF9500');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) {
        setImageUri(`data:image/jpeg;base64,${manipulated.base64}`);
      }
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
    } catch { }
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
      const [records, moto, kms] = await Promise.all([listMaintenance(id), getMotorcycle(id), listKilometers(id)]);
      setRecords(records);
      setMotorcycleKm(moto.currentKilometers);
      setKmEntries(kms.slice(0, 5));
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
    setForm({ type, description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });
    setImageUri(null);
  };

  const openCreate = () => {
    setForm({ type: selectedType || 'motor_oil', description: '', kilometersAtService: String(motorcycleKm || ''), serviceDate: '', cost: '', notes: '' });
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
      notes: record.notes || '',
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
      const created = await createMaintenance(id, payload);
      setRecords((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();

      // Actualiza el km de la moto SOLO si el km ingresado es mayor al actual,
      // para que no retroceda el kilometraje global (y con él, todas las barras
      // de progreso de otros tipos de mantenimiento) al registrar un servicio
      // pasado o con un km menor al real.
      const enteredKm = Number(form.kilometersAtService);
      if (id && enteredKm > motorcycleKm) {
        try {
          await updateMotorcycle(id as string, { currentKilometers: enteredKm });
          setMotorcycleKm(enteredKm);
        } catch { }
      }

      // El flujo del recordatorio de aceite queda igual, pero ya no controla el update de km
      if (form.type === 'motor_oil') {
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
        } else {
          showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
        }
      } else {
        showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
      }
    } catch (e) {
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

      // Actualiza el km de la moto solo si avanza, igual que en handleCreate
      const enteredKmUpdate = Number(form.kilometersAtService);
      if (id && enteredKmUpdate > motorcycleKm) {
        try {
          await updateMotorcycle(id as string, { currentKilometers: enteredKmUpdate });
          setMotorcycleKm(enteredKmUpdate);
        } catch { }
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

  // Ordenado por fecha de servicio descendente: el [0] es siempre el más reciente,
  // y de él depende el detalle principal, la barra de progreso y el historial.
  const filteredRecords = selectedType
    ? records
      .filter((r) => r.type === selectedType)
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
    : [];

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
                onPress={() => { setSelectedType(item.key); setPageIdx(0); }}
                activeOpacity={0.8}
                onLongPress={isCustom ? () => handleDeleteCustomType(item.key, getLabel(item.key)) : undefined}
              >
                {(() => {
                  const chip = CATEGORY_CHIPS[item.key] || DEFAULT_CHIP;
                  return (
                    <View style={[styles.categoryChip, { backgroundColor: chip.bg }]}>
                      <Ionicons name={chip.icon} size={18} color={chip.color} />
                    </View>
                  );
                })()}
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
          activeOpacity={0.7}
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
  // VISTA 2: DETALLE DEL REGISTRO (estilo documentos)
  // ============================================================
  const currentRecord = filteredRecords.length > 0 ? filteredRecords[Math.min(pageIdx, filteredRecords.length - 1)] : null;
  const oilLabel = currentRecord ? MOTOR_OIL_OPTIONS.find((o) => o.label === currentRecord.description) : null;
  const screenWidth = Dimensions.get('window').width;

  const renderRecordPage = ({ item: rec }: { item: MaintenanceRecord }) => {
    const recOilLabel = rec.type === 'motor_oil' ? MOTOR_OIL_OPTIONS.find((o) => o.label === rec.description) : null;

    return (
      <ScrollView
        key={`${rec.id}-${kmEntries.length}`}
        style={{ width: screenWidth }}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Foto del producto */}
        {rec.photoUrl ? (
          <TouchableOpacity
            style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            activeOpacity={0.9}
            onPress={() => { setViewingPhoto(rec.photoUrl ?? null); setShowPhotoViewer(true); }}
          >
            <Image source={{ uri: rec.photoUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 48 }}>📷</Text>
          </View>
        )}

        {/* Título */}
        <Text style={[styles.detailTitle, { color: colors.text }]}>{rec.description}</Text>

        {/* Fila: datos clave + botones de acción */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.detailDate, { color: colors.textSecondary }]}>
                Fecha: {new Date(rec.serviceDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
              <Text style={[styles.detailDate, { color: colors.textSecondary }]}>
                Kilometraje: {rec.kilometersAtService.toLocaleString('es-CL')} km
              </Text>
            </View>
            {rec.cost != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="cash-outline" size={16} color={colors.success} />
                <Text style={[styles.detailDate, { color: colors.success }]}>
                  Costo: ${rec.cost.toLocaleString('es-CL')}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => openEdit(rec)} style={[styles.iconActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(rec)} style={[styles.iconActionBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
              <Ionicons name="trash" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Próximo cambio + barra de progreso */}
        {rec.type === 'tires' ? (
          <View style={{
            backgroundColor: colors.brandBlueBg,
            borderColor: colors.brandBlue,
            borderWidth: 1,
            borderRadius: 10,
            padding: 14,
            marginTop: 16,
          }}>
            {/* Recordatorio de presión */}
            <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginBottom: 12 }]} />
            <View style={styles.cardRow}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Recordatorio: Presión mensual</Text>
            </View>
            <Text style={[styles.notesText, { color: colors.brandBlue + '99', marginTop: 8 }]}>
              Revisá la presión de ambos neumáticos una vez al mes para un desempeño óptimo y seguridad.
            </Text>
            <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginVertical: 12 }]} />
            {/* Info del neumático */}
            <View style={styles.cardRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Según desgaste visual</Text>
            </View>
            <Text style={[styles.notesText, { color: colors.brandBlue + '99', marginTop: 8 }]}>
              No hay intervalo fijo en km. Revisá visualmente el desgaste de la banda de rodado y cambialo cuando las marcas de desgaste lleguen al nivel mínimo.
            </Text>
          </View>
        ) : rec.type === 'brakes' ? (
          <View style={{
            backgroundColor: colors.brandBlueBg,
            borderColor: colors.brandBlue,
            borderWidth: 1,
            borderRadius: 10,
            padding: 14,
            marginTop: 16,
          }}>
            <View style={styles.cardRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Intervalo de revisión</Text>
            </View>
            <Text style={[styles.notesText, { color: colors.brandBlue + '99', marginTop: 8 }]}>
              {rec.description.includes('Pastillas delanteras') && 'Revisa las pastillas delanteras cada 10.000–20.000 km según tu estilo de conducción.'}
              {rec.description.includes('Pastillas traseras') && 'Revisa las pastillas traseras cada 8.000–15.000 km. Se desgastan más rápido en ciudad.'}
              {rec.description.includes('Líquido de frenos') && 'Cambialo cada 2 años para mantener la eficiencia del frenado. El líquido viejo pierde efectividad.'}
              {rec.description.includes('Balatas') && 'Según el uso seleccionado: revisión y cambio en los intervalos indicados.'}
            </Text>
          </View>
        ) : (() => {
          const interval: MaintenanceInterval | undefined = rec.type === 'motor_oil' && recOilLabel
            ? { ...getOilInterval(recOilLabel.key as OilType), notes: undefined }
            : MAINTENANCE_INTERVALS[rec.type];

          if (!interval) return null;

          const nextKm = interval.km ? rec.kilometersAtService + interval.km : null;
          const nextDate = interval.months
            ? (() => { const d = new Date(rec.serviceDate); d.setMonth(d.getMonth() + interval.months!); return d; })()
            : null;

          const { progress, kmDone, monthsElapsed } = calcProgress(rec.kilometersAtService, rec.serviceDate, motorcycleKm, interval);
          const isOverdue = progress >= 1;
          const kmRemaining = nextKm ? Math.max(0, nextKm - motorcycleKm) : null;

          return (
            <View style={{
              backgroundColor: colors.brandBlueBg,
              borderColor: colors.brandBlue,
              borderWidth: 1,
              borderRadius: 10,
              padding: 14,
              marginTop: 16,
            }}>
              <View style={styles.cardRow}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>{isOverdue ? '⚠️' : '🔔'}</Text>
                <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>
                  {isOverdue ? 'Cambio vencido' : 'Próximo cambio'}
                </Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.brandBlue + '25', marginTop: 12 }]}>
                <View style={[styles.progressFill, {
                  width: `${progress * 100}%`,
                  backgroundColor: isOverdue ? colors.danger : colors.brandBlue,
                }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={[styles.progressLabel, { color: colors.brandBlue + '99' }]}>
                  {nextKm ? `${kmDone.toLocaleString('es-CL')} km recorridos` : `${monthsElapsed} meses transcurridos`}
                </Text>
                <Text style={[styles.progressLabel, { color: isOverdue ? colors.danger : colors.brandBlue + '99' }]}>
                  {isOverdue
                    ? 'Vencido'
                    : kmRemaining != null
                      ? `Faltan ${kmRemaining.toLocaleString('es-CL')} km`
                      : 'Próximo por fecha'}
                </Text>
              </View>

              <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 12 }]} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={16} color={colors.brandBlue + '99'} />
                <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>
                  {nextKm ? `${nextKm.toLocaleString('es-CL')} km` : ''}
                  {nextKm && nextDate ? ' o el ' : ''}
                  {nextDate ? nextDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </Text>
              </View>

              {interval.notes && (
                <Text style={[styles.notesText, { color: colors.brandBlue + '80', marginTop: 8 }]}>
                  {interval.notes}
                </Text>
              )}
            </View>
          );
        })()}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {filteredRecords.length > 0 ? (
        <>
          <FlatList
            data={filteredRecords}
            extraData={kmEntries}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(pageIdx, filteredRecords.length - 1)}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setPageIdx(idx);
            }}
            renderItem={renderRecordPage}
          />

          {/* Historial de Kilómetros */}
          {kmEntries.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }} onPress={() => router.push(`/(app)/motorcycle/${id}/kilometers`)}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('kilometerHistory')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {kmEntries.slice(0, 5).map((entry) => (
                <View key={entry.id} style={[styles.kmEntry, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={styles.kmEntryRow}>
                    <Text style={[styles.kmEntryValue, { color: colors.primary }]}>{entry.readingKm.toLocaleString('es-CL')} km</Text>
                    <Text style={[styles.kmEntryDate, { color: colors.textSecondary }]}>{new Date(entry.recordedAt).toLocaleDateString()}</Text>
                  </View>
                  {entry.notes ? <Text style={[styles.kmEntryNotes, { color: colors.textMuted }]}>{entry.notes}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {/* Page dots */}
          {filteredRecords.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, gap: 6 }}>
              {filteredRecords.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === pageIdx ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i === pageIdx ? colors.primary : colors.textMuted + '40',
                  }}
                />
              ))}
            </View>
          )}
        </>
      ) : (
        /* Sin registro */
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="build-outline" size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noRecords')}</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noRecordsSub')}</Text>
        </View>
      )}

      {/* FAB: + (visible when no records OR when limit not reached for brakes/tires) */}
      {(() => {
        const hasNoRecords = filteredRecords.length === 0;
        const currentCount = filteredRecords.length;
        const isBrakes = selectedType === 'brakes';
        const isTires = selectedType === 'tires';
        const isAtLimit = (isBrakes && currentCount >= MAX_BRAKE_RECORDS) || (isTires && currentCount >= MAX_TIRE_RECORDS);
        const canAdd = hasNoRecords || (!isBrakes && !isTires) || !isAtLimit;
        return canAdd ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>
        ) : null;
      })()}

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
              ) : form.type === 'brakes' ? (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('description')} *</Text>
                  {BRAKE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.oilOption,
                        { borderColor: form.description === opt.label ? colors.primary : colors.inputBorder, backgroundColor: form.description === opt.label ? colors.surfaceSecondary : colors.surface },
                      ]}
                      onPress={() => {
                        if (opt.key === 'balatas') {
                          // Open balatas usage modal first
                          setShowBalatasModal(true);
                        } else {
                          setForm((p) => ({ ...p, description: opt.label }));
                          setErrors((p) => ({ ...p, description: '' }));
                        }
                      }}
                    >
                      <View style={styles.oilOptionRow}>
                        <Text style={[styles.oilOptionTitle, { color: form.description === opt.label ? colors.primary : colors.text }]}>{opt.label}</Text>
                        {form.description === opt.label && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </View>
                      <Text style={[styles.oilOptionDetail, { color: colors.textSecondary }]}>{opt.detail}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : form.type === 'tires' ? (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('description')} *</Text>
                  {TIRE_OPTIONS.map((opt) => (
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
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && date) {
                      const iso = date.toISOString().split('T')[0];
                      setForm((p) => ({ ...p, serviceDate: iso }));
                      setErrors((p) => ({ ...p, serviceDate: '' }));
                    }
                  }}
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
              <Ionicons name="camera" size={20} color={colors.primaryText} />
              <Text style={[styles.photoModalBtnText, { color: colors.primaryText }]}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(false); }}>
              <Ionicons name="images" size={20} color={colors.primaryText} />
              <Text style={[styles.photoModalBtnText, { color: colors.primaryText }]}>Elegir de galería</Text>
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

      {/* Balatas Usage Modal */}
      <Modal visible={showBalatasModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.oilOptionModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.oilOptionModalTitle, { color: colors.text }]}>Uso de balatas</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              Seleccioná el tipo de uso para determinar los intervalos de revisión y cambio
            </Text>
            {BALATAS_USAGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.oilOption,
                  { borderColor: colors.inputBorder, backgroundColor: colors.surfaceSecondary, marginBottom: 12 },
                ]}
                onPress={() => {
                  setSelectedBalatasUsage(opt.key);
                  setShowBalatasModal(false);
                  setForm((p) => ({ ...p, description: `Balatas - ${opt.label}` }));
                  setErrors((p) => ({ ...p, description: '' }));
                }}
              >
                <View style={styles.oilOptionRow}>
                  <Text style={[styles.oilOptionTitle, { color: colors.text }]}>{opt.label}</Text>
                </View>
                <Text style={[styles.oilOptionDetail, { color: colors.textSecondary }]}>
                  Revisión: {opt.checkInterval}{'\n'}Cambio: {opt.changeInterval}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowBalatasModal(false)}
            >
              <Text style={[styles.cancelBtnText, { color: colors.primary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
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
  empty: { textAlign: 'center', marginTop: 8, fontSize: 16 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Detail view (estilo documentos)
  detailContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 6 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  detailDate: { fontSize: 12 },
  pdfThumbnail: {
    marginTop: 4,
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  pdfPreviewImage: { width: '100%', height: 200, borderRadius: 8 },
  noPhoto: { height: 150, borderRadius: 10, marginTop: 4, justifyContent: 'center', alignItems: 'center' },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  cardDate: { fontSize: 11, marginTop: 2 },
  infoCardDivider: { height: 1, marginVertical: 6 },

  // Kilometer History
  kmEntry: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 6,
  },
  kmEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kmEntryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  kmEntryDate: {
    fontSize: 11,
  },
  kmEntryNotes: {
    fontSize: 11,
    marginTop: 3,
  },

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
  oilOptionModal: { borderRadius: 14, padding: 20, width: '90%' },
  oilOptionModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  cancelBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 12 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },

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
  photoModalBtnText: { fontSize: 16, fontWeight: '600' },

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
  categoryChip: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  // Barra de progreso
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Historial
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  notesText: {
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
  },
});