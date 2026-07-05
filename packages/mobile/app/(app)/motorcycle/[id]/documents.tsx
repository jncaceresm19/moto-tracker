import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document } from '../../../../src/api';

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'registration', 'other'];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ type: 'insurance', title: '', fileUrl: '', expiryDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    if (!id) return;
    try { setDocs(await listDocuments(id)); }
    catch { Alert.alert('Error', 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => setForm({ type: 'insurance', title: '', fileUrl: '', expiryDate: '' });

  const openCreate = () => { resetForm(); setErrors({}); setShowCreate(true); };

  const openEdit = (doc: Document) => {
    setErrors({});
    setForm({
      type: doc.type,
      title: doc.title,
      fileUrl: doc.fileUrl,
      expiryDate: doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
    });
    setEditing(doc);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = 'Title is required';
    if (!form.fileUrl) newErrors.fileUrl = 'File URL is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    try {
      const created = await createDocument(id, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      });
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = 'Title is required';
    if (!form.fileUrl) newErrors.fileUrl = 'File URL is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!id || !editing) return;
    try {
      const updated = await updateDocument(id, editing.id, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
      });
      setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setEditing(null);
    } catch { Alert.alert('Error', 'Failed to update'); }
  };

  const handleDelete = (doc: Document) => {
    Alert.alert('Delete Document', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteDocument(id, doc.id);
            setDocs((prev) => prev.filter((d) => d.id !== doc.id));
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  const modalTitle = editing ? 'Edit Document' : 'New Document';
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.empty}>No documents yet</Text>
            <Text style={styles.emptySub}>Tap + to add a document</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardType}>{item.type.replace('_', ' ')}</Text>
              <Text style={[styles.cardStatus, item.status === 'expired' && styles.expired]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.expiryDate && <Text style={styles.cardExpiry}>Expires: {new Date(item.expiryDate).toLocaleDateString()}</Text>}
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
          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={(t) => { setForm((p) => ({ ...p, title: t })); setErrors((p) => ({ ...p, title: '' })); }} />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
          <TextInput style={styles.input} placeholder="File URL *" value={form.fileUrl} onChangeText={(t) => { setForm((p) => ({ ...p, fileUrl: t })); setErrors((p) => ({ ...p, fileUrl: '' })); }} />
          {errors.fileUrl ? <Text style={styles.errorText}>{errors.fileUrl}</Text> : null}
          <TextInput style={styles.input} placeholder="Expiry date (YYYY-MM-DD, optional)" value={form.expiryDate} onChangeText={(t) => setForm((p) => ({ ...p, expiryDate: t }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={modalSave}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
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
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
