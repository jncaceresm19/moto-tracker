import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, MaintenanceRecord } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';

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
  const [form, setForm] = useState({ type: 'motor_oil', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Custom types (user-created)
  const [customTypes, setCustomTypes] = useState<{ key: string; label: string }[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

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
    try { setRecords(await listMaintenance(id)); }
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

  const resetForm = (type: string = 'motor_oil') => setForm({ type, description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });

  const openCreate = () => { resetForm(selectedType || 'motor_oil'); setErrors({}); setShowCreate(true); };

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
      const created = await createMaintenance(id, {
        type: form.type,
        description: form.description,
        kilometersAtService: Number(form.kilometersAtService),
        serviceDate: new Date(form.serviceDate).toISOString(),
        cost: form.cost ? Number(form.cost) : undefined,
        notes: form.notes || undefined,
      });
      setRecords((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
    } catch {
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
        notes: form.notes || null,
      });
      setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditing(null);
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
            return (
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: colors.card }]}
                onPress={() => setSelectedType(item.key)}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICON}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryText, { color: colors.text }]}>{item.labelKey ? t(item.labelKey as any) : item.labelKey}</Text>
                  <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                    {count} {count === 1 ? 'registro' : 'registros'}
                  </Text>
                </View>
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
  // VISTA 2: REGISTROS DE LA CATEGORÍA SELECCIONADA
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredRecords.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={filteredRecords.length > 0 ? <View style={{ height: 8 }} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{CATEGORY_ICON}</Text>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noRecords')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noRecordsSub')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.cardRow}>
              <Text style={[styles.cardDesc, { color: colors.text }]}>{item.description}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{new Date(item.serviceDate).toLocaleDateString()}</Text>
              <Text style={[styles.cardKm, { color: colors.primary }]}>{item.kilometersAtService.toLocaleString()} km</Text>
            </View>
            {item.cost != null && <Text style={[styles.cardCost, { color: colors.success }]}>${item.cost.toLocaleString()}</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
        <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
              <TouchableOpacity onPress={closeModal}><Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text></TouchableOpacity>
            </View>

            {/* Type indicator (read-only, set by category) */}
            <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Text style={{ fontSize: 18 }}>{CATEGORY_ICON}</Text>
              <Text style={{ fontSize: 15, color: colors.text }}>{getLabel(form.type)}</Text>
            </View>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
              placeholder={`${t('description')} *`}
              placeholderTextColor={colors.textMuted}
              value={form.description}
              onChangeText={(text) => { setForm((p) => ({ ...p, description: text })); setErrors((p) => ({ ...p, description: '' })); }}
            />
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

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]}
              placeholder={`${t('notes')} (${t('optional')})`}
              placeholderTextColor={colors.textMuted}
              value={form.notes}
              onChangeText={(text) => setForm((p) => ({ ...p, notes: text }))}
            />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>}
            </TouchableOpacity>
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDesc: { fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardDate: { fontSize: 13 },
  cardKm: { fontSize: 13, fontWeight: '500' },
  cardCost: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  // Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
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
