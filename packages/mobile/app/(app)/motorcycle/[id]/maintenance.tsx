import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { listMaintenance, createMaintenance, MaintenanceRecord } from '../../../../src/api';

const TYPES = ['oil_change', 'tire_change', 'brake_check', 'spark_plugs', 'technical_review', 'circulation_permit', 'other'];

export default function MaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: 'oil_change', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });

  const load = async () => {
    if (!id) return;
    try {
      setRecords(await listMaintenance(id));
    } catch { Alert.alert('Error', 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleCreate = async () => {
    if (!id || !form.description || !form.kilometersAtService || !form.serviceDate) {
      Alert.alert('Error', 'Fill required fields');
      return;
    }
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
      setForm({ type: 'oil_change', description: '', kilometersAtService: '', serviceDate: '', cost: '', notes: '' });
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Maintenance Records</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No records yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardType}>{item.type.replace('_', ' ')}</Text>
              <Text style={styles.cardDate}>{new Date(item.serviceDate).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <Text style={styles.cardKm}>{item.kilometersAtService.toLocaleString()} km</Text>
            {item.cost != null && <Text style={styles.cardCost}>${item.cost.toLocaleString()}</Text>}
          </View>
        )}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Record</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Description" value={form.description} onChangeText={(t) => setForm((p) => ({ ...p, description: t }))} />
          <TextInput style={styles.input} placeholder="Kilometers" keyboardType="numeric" value={form.kilometersAtService} onChangeText={(t) => setForm((p) => ({ ...p, kilometersAtService: t }))} />
          <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={form.serviceDate} onChangeText={(t) => setForm((p) => ({ ...p, serviceDate: t }))} />
          <TextInput style={styles.input} placeholder="Cost (optional)" keyboardType="numeric" value={form.cost} onChangeText={(t) => setForm((p) => ({ ...p, cost: t }))} />
          <TextInput style={styles.input} placeholder="Notes (optional)" value={form.notes} onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
        </View>
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
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
