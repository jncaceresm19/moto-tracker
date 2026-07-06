import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { listMaintenance, createMaintenance, updateMaintenance, deleteMaintenance, MaintenanceRecord } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';

const TYPES = ['oil_change', 'tire_change', 'brake_check', 'spark_plugs', 'technical_review', 'circulation_permit', 'other'];

const TYPE_KEYS: Record<string, string> = {
  oil_change: 'oilChange',
  tire_change: 'tireChange',
  brake_check: 'brakeCheck',
  spark_plugs: 'sparkPlugs',
  technical_review: 'technicalReview',
  circulation_permit: 'circulationPermit',
  other: 'other',
};

export default function MaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.push(`/(app)/motorcycle/${id}`)} style={{ marginLeft: 12 }}>
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, router]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ type: 'oil_change', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setRecords(await listMaintenance(id));
    } catch { Alert.alert(t('error'), t('failedToLoad')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => setForm({ type: 'oil_change', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });

  const openCreate = () => { resetForm(); setErrors({}); setShowCreate(true); };

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
      Alert.alert(t('success'), t('recordSaved'));
    } catch {
      Alert.alert(t('error'), t('failedToCreate'));
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
      Alert.alert(t('success'), t('recordUpdated'));
    } catch {
      Alert.alert(t('error'), t('failedToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: MaintenanceRecord) => {
    Alert.alert(t('deleteRecord'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteMaintenance(id, record.id);
            setRecords((prev) => prev.filter((r) => r.id !== record.id));
          } catch { Alert.alert(t('error'), t('failedToDelete')); }
        },
      },
    ]);
  };

  const modalTitle = editing ? t('editRecord') : t('newRecord');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={records.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔧</Text>
            <Text style={styles.empty}>{t('noRecords')}</Text>
            <Text style={styles.emptySub}>{t('noRecordsSub')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardType}>{t(TYPE_KEYS[item.type] as any || 'other')}</Text>
              <Text style={styles.cardDate}>{new Date(item.serviceDate).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <Text style={styles.cardKm}>{item.kilometersAtService.toLocaleString()} km</Text>
            {item.cost != null && <Text style={styles.cardCost}>${item.cost.toLocaleString()}</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity onPress={closeModal}><Text style={styles.cancel}>{t('cancel')}</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Description *" value={form.description} onChangeText={(t) => { setForm((p) => ({ ...p, description: t })); setErrors((p) => ({ ...p, description: '' })); }} />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          <TextInput style={styles.input} placeholder="Kilometers *" keyboardType="numeric" value={form.kilometersAtService} onChangeText={(t) => { setForm((p) => ({ ...p, kilometersAtService: t })); setErrors((p) => ({ ...p, kilometersAtService: '' })); }} />
          {errors.kilometersAtService ? <Text style={styles.errorText}>{errors.kilometersAtService}</Text> : null}
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={form.serviceDate ? styles.dateText : styles.datePlaceholder}>
              {form.serviceDate || t('selectDate')}
            </Text>
          </TouchableOpacity>
          {errors.serviceDate ? <Text style={styles.errorText}>{errors.serviceDate}</Text> : null}
          {showDatePicker && (
            <DateTimePicker
              value={form.serviceDate ? new Date(form.serviceDate) : new Date()}
              mode="date"
              display="default"
              onValueChange={(date) => {
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
          <TextInput style={styles.input} placeholder="Cost (optional)" keyboardType="numeric" value={form.cost} onChangeText={(t) => setForm((p) => ({ ...p, cost: t }))} />
          <TextInput style={styles.input} placeholder="Notes (optional)" value={form.notes} onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={modalSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  emptyContainer: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#ccc', marginTop: 4 },
  card: { padding: 14, marginHorizontal: 16, marginTop: 8, backgroundColor: '#f8f8f8', borderRadius: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardType: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  cardDate: { fontSize: 13, color: '#666' },
  cardDesc: { fontSize: 15, marginTop: 4 },
  cardKm: { fontSize: 13, color: '#007AFF', marginTop: 2 },
  cardCost: { fontSize: 13, color: '#34C759', marginTop: 2 },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  dateText: { fontSize: 15, color: '#333' },
  datePlaceholder: { fontSize: 15, color: '#999' },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
