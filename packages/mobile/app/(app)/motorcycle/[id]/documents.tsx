import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'registration', 'other'];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.push(`/(app)/motorcycle/${id}`)} style={{ marginLeft: 12 }}>
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, router]);
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
    catch { Alert.alert(t('error'), t('failedToLoad')); }
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
      Alert.alert(t('permissionNeeded'), t('permissionMessage'));
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
        const file = new File(result.assets[0].uri);
        const b64 = await file.base64();
        uri = `data:image/jpeg;base64,${b64}`;
      }
      setForm((p) => ({ ...p, fileUrl: uri }));
      setErrors((p) => ({ ...p, fileUrl: '' }));
    }
  };

  const showImageOptions = () => {
    Alert.alert(t('addDocumentPhoto'), t('chooseOption'), [
      { text: t('takePhoto'), onPress: () => pickImage(true) },
      { text: t('chooseFromGallery'), onPress: () => pickImage(false) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = t('required');
    if (!form.fileUrl) newErrors.fileUrl = t('required');
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
      Alert.alert(t('success'), t('documentSaved'));
    } catch {
      Alert.alert(t('error'), t('failedToCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = t('required');
    if (!form.fileUrl) newErrors.fileUrl = t('required');
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
      Alert.alert(t('success'), t('documentUpdated'));
    } catch {
      Alert.alert(t('error'), t('failedToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (doc: Document) => {
    Alert.alert(t('deleteDocument'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteDocument(id, doc.id);
            setDocs((prev) => prev.filter((d) => d.id !== doc.id));
            setViewing(null);
          } catch { Alert.alert(t('error'), t('failedToDelete')); }
        },
      },
    ]);
  };

  const generatePDF = async (doc: Document) => {
    if (!doc.fileUrl) return null;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;">
        <img src="${doc.fileUrl}" style="max-width:100%;max-height:100vh;" />
      </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
  };

  const handleSaveAsPDF = async (doc: Document) => {
    try {
      const uri = await generatePDF(doc);
      if (uri) await Sharing.shareAsync(uri);
    } catch (e: any) {
      Alert.alert(t('error'), `Failed to save: ${e?.message || e}`);
    }
  };

  const handleBulkSaveAsPDF = async () => {
    const photos = docs.filter((d) => d.fileUrl);
    if (photos.length === 0) {
      Alert.alert(t('noPhotos'), t('noPhotosSub'));
      return;
    }
    try {
      for (const doc of photos) {
        const uri = await generatePDF(doc);
        if (uri) await Sharing.shareAsync(uri);
      }
    } catch (e: any) {
      Alert.alert(t('error'), `Failed to save: ${e?.message || e}`);
    }
  };

  const handleShare = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const uri = await generatePDF(doc);
      if (uri) await Sharing.shareAsync(uri);
    } catch (e: any) {
      Alert.alert(t('error'), `Failed to share: ${e?.message || e}`);
    }
  };

  const modalTitle = editing ? t('editDocument') : t('newDocument');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      {docs.some((d) => d.fileUrl) && (
        <TouchableOpacity style={styles.bulkBtn} onPress={handleBulkSaveAsPDF}>
          <Text style={styles.bulkBtnText}>📄 {t('saveAll')}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.empty}>{t('noDocuments')}</Text>
            <Text style={styles.emptySub}>{t('noDocumentsSub')}</Text>
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
            {item.issueDate && <Text style={styles.cardDate}>{t('issued')}: {new Date(item.issueDate).toLocaleDateString()}</Text>}
            {item.expiryDate && <Text style={styles.cardDate}>{t('expires')}: {new Date(item.expiryDate).toLocaleDateString()}</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal visible={viewing !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setViewing(null)}>
              <Text style={styles.done}>{t('done')}</Text>
            </TouchableOpacity>
            <View style={styles.detailActions}>
              <TouchableOpacity onPress={() => viewing && openEdit(viewing)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>{t('edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => viewing && handleDelete(viewing)}>
                <Text style={styles.deleteBtnText}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {viewing && (
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailType}>{viewing.type.replace('_', ' ')}</Text>
              <Text style={styles.detailTitle}>{viewing.title}</Text>
              {viewing.issueDate && <Text style={styles.detailDate}>{t('issued')}: {new Date(viewing.issueDate).toLocaleDateString()}</Text>}
              {viewing.expiryDate && <Text style={styles.detailDate}>{t('expires')}: {new Date(viewing.expiryDate).toLocaleDateString()}</Text>}

              {viewing.fileUrl ? (
                <TouchableOpacity style={styles.pdfThumbnail} onPress={() => setShowPhotoViewer(true)}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfName}>{viewing.title}.pdf</Text>
                  <Text style={styles.pdfHint}>{t('tapToView')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noPhoto}>
                  <Text style={styles.noPhotoText}>{t('noDocumentAttached')}</Text>
                </View>
              )}
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
            <TouchableOpacity style={styles.photoViewerBtn} onPress={() => viewing && handleSaveAsPDF(viewing)}>
              <Text style={styles.photoViewerBtnText}>📥 {t('saveAsPdf')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoViewerBtn} onPress={() => viewing && handleShare(viewing)}>
              <Text style={styles.photoViewerBtnText}>↗ {t('share')}</Text>
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
            <TouchableOpacity onPress={closeModal}><Text style={styles.cancel}>{t('cancel')}</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.photoBtn} onPress={showImageOptions}>
            {form.fileUrl ? (
              <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>{t('tapToAddPhoto')}</Text>
              </View>
            )}
          </TouchableOpacity>
          {errors.fileUrl ? <Text style={styles.errorText}>{errors.fileUrl}</Text> : null}

          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={(t) => { setForm((p) => ({ ...p, title: t })); setErrors((p) => ({ ...p, title: '' })); }} />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

          <TouchableOpacity style={styles.input} onPress={() => setShowIssueDatePicker(true)}>
            <Text style={form.issueDate ? styles.dateText : styles.datePlaceholder}>
              {form.issueDate || t('issueDate')}
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
              {form.expiryDate || t('expiryDate')}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkBtn: { backgroundColor: '#34C759', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  bulkBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  addBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  emptyContainer: { alignItems: 'center' },
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
  pdfThumbnail: {
    marginTop: 20,
    padding: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  pdfIcon: { fontSize: 48, marginBottom: 8 },
  pdfName: { fontSize: 14, fontWeight: '600', color: '#333' },
  pdfHint: { fontSize: 12, color: '#999', marginTop: 4 },
  noPhoto: { height: 150, borderRadius: 10, marginTop: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  noPhotoText: { color: '#999' },
  // Photo Viewer
  photoViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  photoViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  photoViewerCloseText: { color: '#fff', fontSize: 24 },
  photoViewerImage: { width: '90%', height: '70%' },
  photoViewerActions: { flexDirection: 'row', gap: 20, marginTop: 20 },
  photoViewerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  photoViewerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
