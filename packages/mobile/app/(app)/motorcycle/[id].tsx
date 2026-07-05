import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getMotorcycle, updateMotorcycle, deleteMotorcycle, Motorcycle } from '../../../src/api';

export default function MotorcycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '' });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try { setMotorcycle(await getMotorcycle(id)); }
      catch { Alert.alert('Error', 'Failed to load motorcycle'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const openEdit = () => {
    if (!motorcycle) return;
    setForm({
      brand: motorcycle.brand,
      model: motorcycle.model,
      year: String(motorcycle.year),
      licensePlate: motorcycle.licensePlate,
      currentKilometers: String(motorcycle.currentKilometers),
    });
    setEditing(true);
  };

  const handleUpdate = async () => {
    if (!id || !form.brand || !form.model || !form.year || !form.licensePlate) {
      Alert.alert('Error', 'Fill required fields');
      return;
    }
    try {
      const updated = await updateMotorcycle(id, {
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        licensePlate: form.licensePlate,
        currentKilometers: form.currentKilometers ? Number(form.currentKilometers) : undefined,
      });
      setMotorcycle(updated);
      setEditing(false);
    } catch { Alert.alert('Error', 'Failed to update'); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Motorcycle', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try { await deleteMotorcycle(id); router.back(); }
          catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!motorcycle) return <View style={styles.center}><Text>Motorcycle not found</Text></View>;

  const sections = [
    { title: 'Maintenance Records', route: `/(app)/motorcycle/${id}/maintenance`, icon: '🔧' },
    { title: 'Documents', route: `/(app)/motorcycle/${id}/documents`, icon: '📄' },
    { title: 'Kilometer History', route: `/(app)/motorcycle/${id}/kilometers`, icon: '📏' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{motorcycle.brand}</Text>
          <Text style={styles.model}>{motorcycle.model}</Text>
          <Text style={styles.year}>{motorcycle.year}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>License Plate</Text>
        <Text style={styles.value}>{motorcycle.licensePlate}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Current Kilometers</Text>
        <Text style={styles.value}>{motorcycle.currentKilometers.toLocaleString()} km</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sections</Text>
        {sections.map((s) => (
          <TouchableOpacity key={s.route} style={styles.sectionBtn} onPress={() => router.push(s.route as any)}>
            <Text style={styles.sectionIcon}>{s.icon}</Text>
            <Text style={styles.sectionText}>{s.title}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Motorcycle</Text>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Brand" value={form.brand} onChangeText={(t) => setForm((p) => ({ ...p, brand: t }))} />
          <TextInput style={styles.input} placeholder="Model" value={form.model} onChangeText={(t) => setForm((p) => ({ ...p, model: t }))} />
          <TextInput style={styles.input} placeholder="Year" keyboardType="numeric" value={form.year} onChangeText={(t) => setForm((p) => ({ ...p, year: t }))} />
          <TextInput style={styles.input} placeholder="License Plate" value={form.licensePlate} onChangeText={(t) => setForm((p) => ({ ...p, licensePlate: t }))} />
          <TextInput style={styles.input} placeholder="Current Kilometers" keyboardType="numeric" value={form.currentKilometers} onChangeText={(t) => setForm((p) => ({ ...p, currentKilometers: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editBtnText: { color: '#fff', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteBtnText: { color: '#fff', fontWeight: '600' },
  brand: { fontSize: 28, fontWeight: 'bold' },
  model: { fontSize: 20, color: '#333', marginTop: 4 },
  year: { fontSize: 16, color: '#666', marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 16, color: '#666' },
  value: { fontSize: 16, fontWeight: '500' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  sectionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#f8f8f8', borderRadius: 8, marginBottom: 8 },
  sectionIcon: { fontSize: 20, marginRight: 12 },
  sectionText: { fontSize: 16, flex: 1 },
  arrow: { fontSize: 22, color: '#999' },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
