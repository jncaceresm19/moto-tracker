import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { listKilometers, createKilometer, updateKilometer, deleteKilometer, KilometerEntry } from '../../../../src/api';

export default function KilometersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entries, setEntries] = useState<KilometerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<KilometerEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ readingKm: '', recordedAt: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = async () => {
    if (!id) return;
    try { setEntries(await listKilometers(id)); }
    catch { Alert.alert('Error', 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => setForm({ readingKm: '', recordedAt: '', notes: '' });

  const openCreate = () => { resetForm(); setErrors({}); setShowCreate(true); };

  const openEdit = (entry: KilometerEntry) => {
    setErrors({});
    setForm({
      readingKm: String(entry.readingKm),
      recordedAt: entry.recordedAt.split('T')[0],
      notes: entry.notes || '',
    });
    setEditing(entry);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.readingKm) newErrors.readingKm = 'Kilometers is required';
    if (!form.recordedAt) newErrors.recordedAt = 'Date is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const created = await createKilometer(id, {
        readingKm: Number(form.readingKm),
        recordedAt: new Date(form.recordedAt).toISOString(),
        notes: form.notes || undefined,
      });
      setEntries((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      Alert.alert('Success', 'Reading saved');
    } catch {
      Alert.alert('Error', 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.readingKm) newErrors.readingKm = 'Kilometers is required';
    if (!form.recordedAt) newErrors.recordedAt = 'Date is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!id || !editing) return;
    setSaving(true);
    try {
      const updated = await updateKilometer(id, editing.id, {
        readingKm: Number(form.readingKm),
        recordedAt: new Date(form.recordedAt).toISOString(),
        notes: form.notes || null,
      });
      setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
      setEditing(null);
      Alert.alert('Success', 'Reading updated');
    } catch {
      Alert.alert('Error', 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: KilometerEntry) => {
    Alert.alert('Delete Entry', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteKilometer(id, entry.id);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  const modalTitle = editing ? 'Edit Reading' : 'New Reading';
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kilometer History</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📏</Text>
            <Text style={styles.empty}>No readings yet</Text>
            <Text style={styles.emptySub}>Tap + to record mileage</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardKm}>{item.readingKm.toLocaleString()} km</Text>
              <Text style={styles.cardDate}>{new Date(item.recordedAt).toLocaleDateString()}</Text>
            </View>
            {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
          </TouchableOpacity>
        )}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity onPress={closeModal}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Kilometers *" keyboardType="numeric" value={form.readingKm} onChangeText={(t) => { setForm((p) => ({ ...p, readingKm: t })); setErrors((p) => ({ ...p, readingKm: '' })); }} />
          {errors.readingKm ? <Text style={styles.errorText}>{errors.readingKm}</Text> : null}
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={form.recordedAt ? styles.dateText : styles.datePlaceholder}>
              {form.recordedAt || 'Select date *'}
            </Text>
          </TouchableOpacity>
          {errors.recordedAt ? <Text style={styles.errorText}>{errors.recordedAt}</Text> : null}
          {showDatePicker && (
            <DateTimePicker
              value={form.recordedAt ? new Date(form.recordedAt) : new Date()}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) {
                  const iso = date.toISOString().split('T')[0];
                  setForm((p) => ({ ...p, recordedAt: iso }));
                  setErrors((p) => ({ ...p, recordedAt: '' }));
                }
              }}
            />
          )}
          <TextInput style={styles.input} placeholder="Notes (optional)" value={form.notes} onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={modalSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
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
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#ccc', marginTop: 4 },
  card: { padding: 14, marginHorizontal: 16, marginTop: 8, backgroundColor: '#f8f8f8', borderRadius: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardKm: { fontSize: 18, fontWeight: '600', color: '#007AFF' },
  cardDate: { fontSize: 13, color: '#666' },
  cardNotes: { fontSize: 13, color: '#666', marginTop: 4 },
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
});
