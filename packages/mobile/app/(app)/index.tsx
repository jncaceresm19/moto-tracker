import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { listMotorcycles, createMotorcycle, deleteMotorcycle, Motorcycle } from '../../src/api';
import { useAuth } from '../../src/auth-context';

export default function MotorcycleListScreen() {
  const { signOut } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadMotorcycles = async () => {
    try {
      setMotorcycles(await listMotorcycles());
    } catch {
      Alert.alert('Error', 'Failed to load motorcycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMotorcycles(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMotorcycles();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.brand) newErrors.brand = 'Brand is required';
    if (!form.model) newErrors.model = 'Model is required';
    if (!form.year) newErrors.year = 'Year is required';
    if (!form.licensePlate) newErrors.licensePlate = 'License plate is required';
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
      });
      setMotorcycles((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '' });
      Alert.alert('Success', 'Motorcycle added');
    } catch {
      Alert.alert('Error', 'Failed to create motorcycle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMotorcycle(id);
            setMotorcycles((prev) => prev.filter((m) => m.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Motorcycles</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setErrors({}); setShowCreate(true); }}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.logout}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {motorcycles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏍️</Text>
          <Text style={styles.empty}>No motorcycles yet</Text>
          <Text style={styles.emptySub}>Tap + to add your first motorcycle</Text>
        </View>
      ) : (
        <FlatList
          data={motorcycles}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/motorcycle/${item.id}`)}
              onLongPress={() => handleDelete(item.id, `${item.brand} ${item.model}`)}
            >
              <Text style={styles.cardTitle}>{item.brand} {item.model}</Text>
              <Text style={styles.cardSub}>{item.year} · {item.licensePlate}</Text>
              <Text style={styles.cardKm}>{item.currentKilometers.toLocaleString()} km</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Motorcycle</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Brand *" value={form.brand} onChangeText={(t) => { setForm((p) => ({ ...p, brand: t })); setErrors((p) => ({ ...p, brand: '' })); }} />
          {errors.brand ? <Text style={styles.errorText}>{errors.brand}</Text> : null}
          <TextInput style={styles.input} placeholder="Model *" value={form.model} onChangeText={(t) => { setForm((p) => ({ ...p, model: t })); setErrors((p) => ({ ...p, model: '' })); }} />
          {errors.model ? <Text style={styles.errorText}>{errors.model}</Text> : null}
          <TextInput style={styles.input} placeholder="Year *" keyboardType="numeric" value={form.year} onChangeText={(t) => { setForm((p) => ({ ...p, year: t })); setErrors((p) => ({ ...p, year: '' })); }} />
          {errors.year ? <Text style={styles.errorText}>{errors.year}</Text> : null}
          <TextInput style={styles.input} placeholder="License Plate *" value={form.licensePlate} onChangeText={(t) => { setForm((p) => ({ ...p, licensePlate: t })); setErrors((p) => ({ ...p, licensePlate: '' })); }} />
          {errors.licensePlate ? <Text style={styles.errorText}>{errors.licensePlate}</Text> : null}
          <TextInput style={styles.input} placeholder="Current km (optional)" keyboardType="numeric" value={form.currentKilometers} onChangeText={(t) => setForm((p) => ({ ...p, currentKilometers: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  logout: { color: '#FF3B30', fontSize: 14 },
  empty: { fontSize: 18, color: '#999', marginBottom: 4 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptySub: { fontSize: 14, color: '#ccc' },
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#666', marginTop: 4 },
  cardKm: { fontSize: 14, color: '#007AFF', marginTop: 4 },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
