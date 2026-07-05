import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document } from '../../../../src/api';

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'registration', 'other'];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ type: 'insurance', title: '', fileUrl: '', issueDate: '', expiryDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

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

  const resetForm = () => setForm({ type: 'insurance', title: '', fileUrl: '', issueDate: '', expiryDate: '' });

  const openCreate = () => { resetForm(); setErrors({}); setShowCreate(true); };

  const openEdit = (doc: Document) => {
    setErrors({});
    setForm({
      type: doc.type,
      title: doc.title,
      fileUrl: doc.fileUrl,
      issueDate: doc.issueDate ? doc.issueDate.split('T')[0] : '',
      expiryDate: doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
    });
    setEditing(doc);
    setViewing(null);
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', `Please grant ${fromCamera ? 'camera' : 'gallery'} permission.`);
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });

    if (!result.canceled && result.assets[0]) {
      let uri: string;
      if (result.assets[0].base64) {
        uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      } else {
        // Fallback: read file as base64 if ImagePicker didn't return it
        const b64 = await new File(result.assets[0].uri).base64();
        uri = `data:image/jpeg;base64,${b64}`;
      }
      setForm((p) => ({ ...p, fileUrl: uri }));
      setErrors((p) => ({ ...p, fileUrl: '' }));
    }
  };

  const showImageOptions = () => {
    Alert.alert('Add Document Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickImage(true) },
      { text: 'Choose from Gallery', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = 'Title is required';
    if (!form.fileUrl) newErrors.fileUrl = 'Document photo is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const created = await createDocument(id!, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      });
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      Alert.alert('Success', 'Document saved');
    } catch {
      Alert.alert('Error', 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = 'Title is required';
    if (!form.fileUrl) newErrors.fileUrl = 'Document photo is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!id || !editing) return;
    setSaving(true);
    try {
      const updated = await updateDocument(id, editing.id, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
      });
      setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setEditing(null);
      Alert.alert('Success', 'Document updated');
    } catch {
      Alert.alert('Error', 'Failed to update');
    } finally {
      setSaving(false);
    }
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
            setViewing(null);
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  const writeBase64ToFile = async (fileUrl: string, filename: string): Promise<File> => {
    const base64 = fileUrl.includes('base64,') ? fileUrl.split('base64,')[1] : fileUrl;
    const file = new File(Paths.cache, filename);
    await file.write(base64, { encoding: 'base64' });
    return file;
  };

  const handleBulkDownload = async () => {
    const photos = docs.filter((d) => d.fileUrl);
    if (photos.length === 0) {
      Alert.alert('No photos', 'No documents with photos to download.');
      return;
    }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant media library permission to save.');
      return;
    }
    try {
      let saved = 0;
      for (const doc of photos) {
        const filename = `${doc.title.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
        const file = await writeBase64ToFile(doc.fileUrl, filename);
        await MediaLibrary.saveToLibraryAsync(file.uri);
        saved++;
      }
      Alert.alert('Done', `${saved} document photo${saved > 1 ? 's' : ''} saved to your gallery.`);
    } catch (e: any) {
      Alert.alert('Error', `Failed to save: ${e?.message || e}`);
    }
  };

  const handleBulkShare = async () => {
    const photos = docs.filter((d) => d.fileUrl);
    if (photos.length === 0) {
      Alert.alert('No photos', 'No documents with photos to share.');
      return;
    }
    try {
      for (const doc of photos) {
        const filename = `${doc.title.replace(/\s+/g, '_')}.jpg`;
        const file = await writeBase64ToFile(doc.fileUrl, filename);
        await Sharing.shareAsync(file.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', `Failed to share: ${e?.message || e}`);
    }
  };

  const handleShare = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const filename = `${doc.title.replace(/\s+/g, '_')}.jpg`;
      const file = await writeBase64ToFile(doc.fileUrl, filename);
      await Sharing.shareAsync(file.uri);
    } catch (e: any) {
      Alert.alert('Error', `Failed to share: ${e?.message || e}`);
    }
  };

  const handleDownload = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant media library permission to save.');
        return;
      }
      const filename = `${doc.title.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      const file = await writeBase64ToFile(doc.fileUrl, filename);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      Alert.alert('Saved', `${doc.title} saved to your gallery`);
    } catch (e: any) {
      Alert.alert('Error', `Failed to save: ${e?.message || e}`);
    }
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
        <View style={styles.headerActions}>
          {docs.some((d) => d.fileUrl) && (
            <View style={styles.bulkActions}>
              <TouchableOpacity style={styles.bulkBtn} onPress={handleBulkDownload}>
                <Text style={styles.bulkBtnText}>⬇ All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={handleBulkShare}>
                <Text style={styles.bulkBtnText}>↗ All</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
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
            onPress={() => setViewing(item)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardType}>{item.type.replace('_', ' ')}</Text>
              <Text style={[styles.cardStatus, item.status === 'expired' && styles.expired]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.issueDate && <Text style={styles.cardDate}>Issued: {new Date(item.issueDate).toLocaleDateString()}</Text>}
            {item.expiryDate && <Text style={styles.cardDate}>Expires: {new Date(item.expiryDate).toLocaleDateString()}</Text>}
          </TouchableOpacity>
        )}
      />

      {/* Detail Modal */}
      <Modal visible={viewing !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setViewing(null)}>
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
            <View style={styles.detailActions}>
              <TouchableOpacity onPress={() => viewing && openEdit(viewing)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => viewing && handleDelete(viewing)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {viewing && (
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailType}>{viewing.type.replace('_', ' ')}</Text>
              <Text style={styles.detailTitle}>{viewing.title}</Text>
              {viewing.issueDate && <Text style={styles.detailDate}>Issued: {new Date(viewing.issueDate).toLocaleDateString()}</Text>}
              {viewing.expiryDate && <Text style={styles.detailDate}>Expires: {new Date(viewing.expiryDate).toLocaleDateString()}</Text>}

              {viewing.fileUrl ? (
                <TouchableOpacity onPress={() => setShowPhotoViewer(true)}>
                  <Image source={{ uri: viewing.fileUrl }} style={styles.detailImage} resizeMode="contain" />
                  <Text style={styles.viewPhotoHint}>Tap to view full size</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noPhoto}>
                  <Text style={styles.noPhotoText}>No photo available</Text>
                </View>
              )}

              <View style={styles.detailBtnRow}>
                <TouchableOpacity style={styles.detailActionBtn} onPress={() => viewing && handleDownload(viewing)}>
                  <Text style={styles.detailActionBtnText}>⬇ Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailActionBtn} onPress={() => viewing && handleShare(viewing)}>
                  <Text style={styles.detailActionBtnText}>↗ Share</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoViewer} animationType="fade" transparent>
        <View style={styles.photoViewerContainer}>
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => setShowPhotoViewer(false)}>
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewing?.fileUrl && (
            <Image source={{ uri: viewing.fileUrl }} style={styles.photoViewerImage} resizeMode="contain" />
          )}
          <View style={styles.photoViewerActions}>
            <TouchableOpacity style={styles.photoViewerBtn} onPress={() => viewing && handleDownload(viewing)}>
              <Text style={styles.photoViewerBtnText}>⬇ Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoViewerBtn} onPress={() => viewing && handleShare(viewing)}>
              <Text style={styles.photoViewerBtnText}>↗ Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity onPress={closeModal}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.photoBtn} onPress={showImageOptions}>
            {form.fileUrl ? (
              <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Tap to add document photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {errors.fileUrl ? <Text style={styles.errorText}>{errors.fileUrl}</Text> : null}

          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={(t) => { setForm((p) => ({ ...p, title: t })); setErrors((p) => ({ ...p, title: '' })); }} />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

          <TouchableOpacity style={styles.input} onPress={() => setShowIssueDatePicker(true)}>
            <Text style={form.issueDate ? styles.dateText : styles.datePlaceholder}>
              {form.issueDate || 'Issue date (optional)'}
            </Text>
          </TouchableOpacity>
          {showIssueDatePicker && (
            <DateTimePicker
              value={form.issueDate ? new Date(form.issueDate) : new Date()}
              mode="date"
              display="default"
              onValueChange={(date) => {
                setShowIssueDatePicker(false);
                if (date) {
                  const iso = date.toISOString().split('T')[0];
                  setForm((p) => ({ ...p, issueDate: iso }));
                }
              }}
              onDismiss={() => setShowIssueDatePicker(false)}
            />
          )}

          <TouchableOpacity style={styles.input} onPress={() => setShowExpiryDatePicker(true)}>
            <Text style={form.expiryDate ? styles.dateText : styles.datePlaceholder}>
              {form.expiryDate || 'Expiry date (optional)'}
            </Text>
          </TouchableOpacity>
          {showExpiryDatePicker && (
            <DateTimePicker
              value={form.expiryDate ? new Date(form.expiryDate) : new Date()}
              mode="date"
              display="default"
              onValueChange={(date) => {
                setShowExpiryDatePicker(false);
                if (date) {
                  const iso = date.toISOString().split('T')[0];
                  setForm((p) => ({ ...p, expiryDate: iso }));
                }
              }}
              onDismiss={() => setShowExpiryDatePicker(false)}
            />
          )}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkActions: { flexDirection: 'row', gap: 6 },
  bulkBtn: { backgroundColor: '#34C759', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  bulkBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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
  cardDate: { fontSize: 13, color: '#666', marginTop: 2 },
  // Detail Modal
  detailContainer: { flex: 1, backgroundColor: '#fff' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  done: { color: '#007AFF', fontSize: 16 },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editBtnText: { color: '#fff', fontWeight: '600' },
  deleteBtnText: { color: '#FF3B30', fontSize: 14 },
  detailContent: { padding: 20 },
  detailType: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize', color: '#666' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  detailDate: { fontSize: 15, color: '#666', marginTop: 8 },
  detailImage: { width: '100%', height: 300, borderRadius: 10, marginTop: 16, backgroundColor: '#f0f0f0' },
  viewPhotoHint: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 6 },
  noPhoto: { height: 150, borderRadius: 10, marginTop: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  noPhotoText: { color: '#999' },
  detailBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  detailActionBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, alignItems: 'center' },
  detailActionBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  // Photo Viewer
  photoViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  photoViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  photoViewerCloseText: { color: '#fff', fontSize: 24 },
  photoViewerImage: { width: '90%', height: '70%' },
  photoViewerActions: { flexDirection: 'row', gap: 20, marginTop: 20 },
  photoViewerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  photoViewerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Create/Edit Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  photoBtn: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  photoPlaceholderIcon: { fontSize: 32, marginBottom: 6 },
  photoPlaceholderText: { color: '#999', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  dateText: { fontSize: 15, color: '#333' },
  datePlaceholder: { fontSize: 15, color: '#999' },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
