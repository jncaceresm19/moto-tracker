import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { listKilometers, createKilometer, updateKilometer, deleteKilometer, KilometerEntry } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';

export default function KilometersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<KilometerEntry[]>([]);

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
  const [editing, setEditing] = useState<KilometerEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ readingKm: '', recordedAt: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = async () => {
    if (!id) return;
    try { setEntries(await listKilometers(id)); }
    catch { Alert.alert(t('error'), t('failedToLoad')); }
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
    if (!form.readingKm) newErrors.readingKm = t('required');
    if (!form.recordedAt) newErrors.recordedAt = t('required');
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
      Alert.alert(t('success'), t('readingSaved'));
    } catch {
      Alert.alert(t('error'), t('failedToCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.readingKm) newErrors.readingKm = t('required');
    if (!form.recordedAt) newErrors.recordedAt = t('required');
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
      Alert.alert(t('success'), t('readingUpdated'));
    } catch {
      Alert.alert(t('error'), t('failedToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: KilometerEntry) => {
    Alert.alert(t('deleteEntry'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteKilometer(id, entry.id);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
          } catch { Alert.alert(t('error'), t('failedToDelete')); }
        },
      },
    ]);
  };

  const modalTitle = editing ? t('editReading') : t('newReading');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📏</Text>
            <Text style={styles.empty}>{t('noEntries')}</Text>
            <Text style={styles.emptySub}>{t('noEntriesSub')}</Text>
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
          <TextInput style={styles.input} placeholder="Kilometers *" keyboardType="numeric" value={form.readingKm} onChangeText={(t) => { setForm((p) => ({ ...p, readingKm: t })); setErrors((p) => ({ ...p, readingKm: '' })); }} />
          {errors.readingKm ? <Text style={styles.errorText}>{errors.readingKm}</Text> : null}
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={form.recordedAt ? styles.dateText : styles.datePlaceholder}>
              {form.recordedAt || t('selectDate')}
            </Text>
          </TouchableOpacity>
          {errors.recordedAt ? <Text style={styles.errorText}>{errors.recordedAt}</Text> : null}
          {showDatePicker && (
            <DateTimePicker
              value={form.recordedAt ? new Date(form.recordedAt) : new Date()}
              mode="date"
              display="default"
              onValueChange={(date) => {
                setShowDatePicker(false);
                if (date) {
                  const iso = date.toISOString().split('T')[0];
                  setForm((p) => ({ ...p, recordedAt: iso }));
                  setErrors((p) => ({ ...p, recordedAt: '' }));
                }
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}
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
