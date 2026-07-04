import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { listDocuments, createDocument, Document } from '../../../../src/api';

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'registration', 'other'];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: 'insurance', title: '', fileUrl: '', expiryDate: '' });

  const load = async () => {
    if (!id) return;
    try { setDocs(await listDocuments(id)); }
    catch { Alert.alert('Error', 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleCreate = async () => {
    if (!id || !form.title || !form.fileUrl) {
      Alert.alert('Error', 'Fill required fields');
      return;
    }
    try {
      const created = await createDocument(id, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      });
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ type: 'insurance', title: '', fileUrl: '', expiryDate: '' });
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No documents yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardType}>{item.type.replace('_', ' ')}</Text>
              <Text style={[styles.cardStatus, item.status === 'expired' && styles.expired]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.expiryDate && <Text style={styles.cardExpiry}>Expires: {new Date(item.expiryDate).toLocaleDateString()}</Text>}
          </View>
        )}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Document</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Title" value={form.title} onChangeText={(t) => setForm((p) => ({ ...p, title: t }))} />
          <TextInput style={styles.input} placeholder="File URL" value={form.fileUrl} onChangeText={(t) => setForm((p) => ({ ...p, fileUrl: t }))} />
          <TextInput style={styles.input} placeholder="Expiry date (YYYY-MM-DD, optional)" value={form.expiryDate} onChangeText={(t) => setForm((p) => ({ ...p, expiryDate: t }))} />
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardType: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  cardStatus: { fontSize: 12, color: '#34C759', fontWeight: '500' },
  expired: { color: '#FF3B30' },
  cardTitle: { fontSize: 15, marginTop: 4 },
  cardExpiry: { fontSize: 13, color: '#666', marginTop: 2 },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
