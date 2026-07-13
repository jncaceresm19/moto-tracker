import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'padron', 'drivers_license', 'fines'];

const TYPE_KEYS: Record<string, string> = {
  circulation_permit: 'circulationPermit',
  technical_review: 'technicalReview',
  insurance: 'insurance',
  padron: 'padron',
  drivers_license: 'driversLicense',
  fines: 'fines',
};

const CATEGORY_ICONS: Record<string, string> = {
  circulation_permit: '🚦',
  technical_review: '🔍',
  insurance: '🛡️',
  padron: '📋',
  drivers_license: '🪪',
  fines: '💸',
};

// Types where the title is auto-set and non-editable
const FIXED_TITLE_TYPES: Record<string, string> = {
  circulation_permit: 'circulationPermit',
  technical_review: 'technicalReview',
  insurance: 'insurance',
  padron: 'padron',
  drivers_license: 'driversLicense',
};

// Types that allow multiple documents
const MULTI_DOC_TYPES = ['fines'];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<'front' | 'back'>('front');
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ type: 'other', title: '', fileUrl: '', fileUrlBack: '', issueDate: '', expiryDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [showDocPortarModal, setShowDocPortarModal] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: selectedType ? t(TYPE_KEYS[selectedType]) : t('documents'),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (selectedType) {
              setSelectedType(null);
              setViewing(null);
            } else {
              router.push(`/(app)/motorcycle/${id}`);
            }
          }}
          style={{ marginLeft: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, router, selectedType, t, colors]);

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = colors.primary) => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  const load = async () => {
    if (!id) return;
    try { setDocs(await listDocuments(id)); }
    catch { showAlert(t('error'), t('failedToLoad'), [{ text: 'OK' }], 'close-circle', colors.danger); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredDocs = selectedType ? docs.filter((d) => d.type === selectedType) : [];

  const isTitleEditable = !FIXED_TITLE_TYPES[form.type];

  const resetForm = (type: string = 'other') => {
    const titleKey = FIXED_TITLE_TYPES[type];
    setForm({ type, title: titleKey ? t(titleKey) : '', fileUrl: '', fileUrlBack: '', issueDate: '', expiryDate: '' });
  };

  const openCreate = () => { resetForm(selectedType || 'other'); setErrors({}); setShowCreate(true); };

  const openEdit = (doc: Document) => {
    setErrors({});
    setForm({
      type: doc.type,
      title: doc.title,
      fileUrl: doc.fileUrl,
      fileUrlBack: doc.fileUrlBack || '',
      issueDate: doc.issueDate ? doc.issueDate.split('T')[0] : '',
      expiryDate: doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
    });
    setEditing(doc);
    setViewing(null);
  };

  const pickImage = async (fromCamera: boolean) => {
    setShowPhotoModal(false);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert(t('permissionNeeded'), t('permissionMessage'), [{ text: 'OK' }], 'lock-closed', colors.accent);
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) {
        const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
        if (photoSide === 'back') {
          setForm((p) => ({ ...p, fileUrlBack: dataUri }));
        } else {
          setForm((p) => ({ ...p, fileUrl: dataUri }));
          setErrors((p) => ({ ...p, fileUrl: '' }));
        }
      }
    }
  };

  const showImageOptions = (side: 'front' | 'back' = 'front') => {
    setPhotoSide(side);
    setShowPhotoModal(true);
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fileUrl) newErrors.fileUrl = t('required');
    if (form.issueDate && form.expiryDate && new Date(form.expiryDate) < new Date(form.issueDate)) {
      newErrors.expiryDate = t('expiryBeforeIssue');
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const created = await createDocument(id!, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        fileUrlBack: form.fileUrlBack || undefined,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      });
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      // Single-doc types: show detail directly after save
      if (!MULTI_DOC_TYPES.includes(form.type)) {
        setViewing(created);
      } else {
        showAlert(t('success'), t('documentSaved'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
      }
    } catch {
      showAlert(t('error'), t('failedToCreate'), [{ text: 'OK' }], 'close-circle', colors.danger);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fileUrl) newErrors.fileUrl = t('required');
    if (form.issueDate && form.expiryDate && new Date(form.expiryDate) < new Date(form.issueDate)) {
      newErrors.expiryDate = t('expiryBeforeIssue');
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!id || !editing) return;
    setSaving(true);
    try {
      const updated = await updateDocument(id, editing.id, {
        type: form.type,
        title: form.title,
        fileUrl: form.fileUrl,
        fileUrlBack: form.fileUrlBack || null,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
      });
      setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setEditing(null);
      // Single-doc types: show detail directly after save
      if (!MULTI_DOC_TYPES.includes(form.type)) {
        setViewing(updated);
      } else {
        showAlert(t('success'), t('documentUpdated'), [{ text: 'OK' }], 'checkmark-circle', colors.success);
      }
    } catch {
      showAlert(t('error'), t('failedToUpdate'), [{ text: 'OK' }], 'close-circle', colors.danger);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (doc: Document) => {
    showAlert(t('deleteDocument'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteDocument(id, doc.id);
            setDocs((prev) => prev.filter((d) => d.id !== doc.id));
            setViewing(null);
          } catch { showAlert(t('error'), t('failedToDelete'), [{ text: 'OK' }], 'close-circle', colors.danger); }
        },
      },
    ], 'warning', colors.accent);
  };

  const generatePDF = async (doc: Document) => {
    if (!doc.fileUrl) return null;
    const issuedStr = doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '—';
    const expiresStr = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '—';
    const backSection = doc.fileUrlBack
      ? `<div style="page-break-before: always; text-align: center; padding-top: 20px;">
           <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Reverso</div>
           <img src="${doc.fileUrlBack}" style="max-width: 100%; max-height: 85vh;" />
         </div>`
      : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { margin: 0; padding: 20px; font-family: -apple-system, sans-serif; color: #333; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .type { font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .dates { font-size: 13px; color: #666; margin: 10px 0; text-align: center; }
        .img-container { text-align: center; }
        img { max-width: 100%; max-height: 85vh; }
      </style></head>
      <body>
        <div class="header">
          <div class="title">${doc.title}</div>
          <div class="type">${doc.type.replace(/_/g, ' ')}</div>
        </div>
        <div class="dates">Emitido: ${issuedStr} | Vence: ${expiresStr}</div>
        <div class="img-container">
          <img src="${doc.fileUrl}" />
        </div>
        ${backSection}
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
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const handleBulkSaveAsPDF = async () => {
    const photos = filteredDocs.filter((d) => d.fileUrl);
    if (photos.length === 0) {
      showAlert(t('noPhotos'), t('noPhotosSub'), [{ text: 'OK' }], 'information-circle', colors.primary);
      return;
    }

    const pages = photos.map((doc) => {
      const issuedStr = doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '—';
      const expiresStr = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '—';
      return `
        <div style="page-break-after: always; padding: 20px; text-align: center;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">${doc.title}</div>
          <div style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px;">${doc.type.replace(/_/g, ' ')}</div>
          <div style="font-size: 13px; color: #666; margin: 10px 0;">Emitido: ${issuedStr} | Vence: ${expiresStr}</div>
          <img src="${doc.fileUrl}" style="max-width: 100%; max-height: 80vh;" />
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; color: #333; }
      </style></head>
      <body>${pages}</body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri);
    } catch (e: any) {
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const handleShare = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const uri = await generatePDF(doc);
      if (uri) await Sharing.shareAsync(uri);
    } catch (e: any) {
      showAlert(t('error'), t('failedToShare'), [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const modalTitle = editing ? t('editDocument') : t('newDocument');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  // ============================================================
  // VISTA 1: LISTA DE CATEGORÍAS
  // ============================================================
  if (!selectedType) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={TYPES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          ListHeaderComponent={
            <View style={[styles.infoBanner, { backgroundColor: colors.brandBlueBg, borderColor: colors.brandBlue }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue} />
              <Text style={[styles.infoBannerText, { color: colors.text }]}>{t('documentsDisclaimer')}</Text>
            </View>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => setShowDocPortarModal(true)}
              >
                <Ionicons name="help-circle-outline" size={20} color="#fff" />
                <Text style={[styles.submitBtnText, { color: '#fff' }]}>¿Qué documentos debo portar?</Text>
              </TouchableOpacity>
            </>
          }
          renderItem={({ item }) => {
            const docsForType = docs.filter((d) => d.type === item);
            const count = docsForType.length;
            return (
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: colors.card }]}
                onPress={() => {
                  setSelectedType(item);
                }}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[item]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryText, { color: colors.text }]}>{t(TYPE_KEYS[item])}</Text>
                  <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                    {count} {count === 1 ? t('documents').replace(/s$/, '') : t('documents')}
                  </Text>
                </View>
                <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
              </TouchableOpacity>
            );
          }}
        />

        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          buttons={alertButtons}
          icon={alertIcon}
          iconColor={alertIconColor}
          onClose={() => setAlertVisible(false)}
        />

        {/* Modal: ¿Qué documentos debo portar? */}
        <Modal visible={showDocPortarModal} transparent animationType="fade">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDocPortarModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface }]}>
                  <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="shield-outline" size={22} color={colors.primary} />
                    <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>En un control policial te piden</Text>
                    <TouchableOpacity onPress={() => setShowDocPortarModal(false)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                    <View style={{ marginTop: 12 }}>
                      <View style={styles.infoCardItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>Cédula de identidad</Text>
                      </View>
                      <View style={styles.infoCardItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>Licencia de conducir Clase C</Text>
                      </View>
                      <View style={styles.infoCardItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>Permiso de circulación vigente</Text>
                      </View>
                      <View style={styles.infoCardItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>SOAP vigente</Text>
                      </View>
                      <View style={styles.infoCardItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>Revisión técnica (u homologación si es nueva)</Text>
                      </View>
                    </View>
                    <View style={[styles.infoCardDivider, { backgroundColor: colors.border, marginTop: 12 }]} />
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                      <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.infoCardText, { color: colors.textMuted, flex: 1 }]}>El padrón no es obligatorio portarlo físicamente, pero se recomienda</Text>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ============================================================
  // VISTA 2: DOCUMENTO DE LA CATEGORÍA SELECCIONADA
  // ============================================================

  const isMultiDoc = MULTI_DOC_TYPES.includes(selectedType!);

  // --- Single-doc type: show detail directly inline (or empty state) ---
  if (!isMultiDoc) {
    const doc = filteredDocs[0]; // undefined if no docs

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {doc ? (
          <ScrollView contentContainerStyle={styles.detailContent}>
            {/* Photo with status badge overlay */}
            <View>
              {((doc.type === 'drivers_license' || doc.type === 'technical_review') && doc.fileUrlBack) ? (
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted, marginBottom: 6 }]}>{doc.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text>
                    <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewing(doc); setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                      <Image source={{ uri: doc.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted, marginBottom: 6 }]}>{doc.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text>
                    <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewing(doc); setViewingPhoto('back'); setShowPhotoViewer(true); }}>
                      <Image source={{ uri: doc.fileUrlBack }} style={styles.pdfPreviewImage} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : doc.fileUrl ? (
                <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewing(doc); setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                  <Image source={{ uri: doc.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.noPhoto, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ color: colors.textMuted }}>{t('noDocumentAttached')}</Text>
                </View>
              )}
              {/* Status badge overlay */}
              <View style={[styles.statusBadgeOverlay, {
                backgroundColor: doc.status === 'expired' ? colors.danger : doc.status === 'expiring' ? colors.accent : colors.success,
              }]}>
                <Text style={styles.statusBadgeOverlayText}>
                  {doc.status === 'expired' ? t('expired') : doc.status === 'expiring' ? t('expiring') : t('valid')}
                </Text>
              </View>
            </View>

            {/* Edit + Delete buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <View>
                {doc.issueDate && <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 0 }]}>{t('issued')}: {new Date(doc.issueDate).toLocaleDateString()}</Text>}
                {doc.expiryDate && <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 4 }]}>{t('expires')}: {new Date(doc.expiryDate).toLocaleDateString()}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openEdit(doc)} style={[styles.iconActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(doc)} style={[styles.iconActionBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Ionicons name="trash" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Requisitos Permiso de Circulación */}
            {doc.type === 'circulation_permit' && (
              <View style={{
                backgroundColor: colors.brandBlueBg,
                borderColor: colors.brandBlue,
                borderWidth: 1,
                borderRadius: 10,
                padding: 14,
                marginTop: 16,
              }}>
                <View style={styles.cardRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Requisitos Permiso de Circulación</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Revisión técnica al día</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>SOAP vigente (hasta 31 de marzo del año siguiente)</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Sin multas de tránsito impagas</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>No estar en el Registro de Pasajeros Infractores</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Permiso de circulación del año anterior + padrón del vehículo</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.brandBlue + '99'} />
                  <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Plazo: 1 feb – 31 mar</Text>
                </View>
              </View>
            )}

            {/* Requisitos SOAP */}
            {doc.type === 'insurance' && (
              <View style={{
                backgroundColor: colors.brandBlueBg,
                borderColor: colors.brandBlue,
                borderWidth: 1,
                borderRadius: 10,
                padding: 14,
                marginTop: 16,
              }}>
                <View style={styles.cardRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Requisitos SOAP</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Patente del vehículo</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>RUT del propietario/contratante</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Moto nueva: se contrata junto a la inscripción</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Moto usada: vigencia desde el 1 de abril</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.brandBlue + '99'} />
                  <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Plazo: hasta 31 de marzo</Text>
                </View>
              </View>
            )}

            {/* Información relevante del Padrón */}
            {doc.type === 'padron' && (
              <View style={{
                backgroundColor: colors.brandBlueBg,
                borderColor: colors.brandBlue,
                borderWidth: 1,
                borderRadius: 10,
                padding: 14,
                marginTop: 16,
              }}>
                <View style={styles.cardRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Información relevante</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Obligatorio portarlo para circular</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>No caduca mientras no cambie de dueño</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Si se pierde, se saca duplicado online con ClaveÚnica</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.brandBlue + '99'} />
                  <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Multa por no portarlo: hasta 0,5 UTM</Text>
                </View>
              </View>
            )}

            {/* Requisitos Licencia de Conducir */}
            {doc.type === 'drivers_license' && (
              <View style={{
                backgroundColor: colors.brandBlueBg,
                borderColor: colors.brandBlue,
                borderWidth: 1,
                borderRadius: 10,
                padding: 14,
                marginTop: 16,
              }}>
                <View style={styles.cardRow}>
                  <Ionicons name="card-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Requisitos Licencia (Clase C)</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Cédula de identidad vigente</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Licencia anterior (para renovación)</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Exámenes de reflejos, vista y teórico</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>No estar en el RPI ni con deudas de pensión de alimentos</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={16} color={colors.brandBlue + '99'} />
                  <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Vigencia: 6 años</Text>
                </View>
              </View>
            )}
            {/* Requisitos Revisión Técnica */}
            {doc.type === 'technical_review' && (
              <View style={{
                backgroundColor: colors.brandBlueBg,
                borderColor: colors.brandBlue,
                borderWidth: 1,
                borderRadius: 10,
                padding: 14,
                marginTop: 16,
              }}>
                <View style={styles.cardRow}>
                  <Ionicons name="construct-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.text + '99' }]}>Requisitos Revisión Técnica</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Certificado de revisión técnica anterior</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Certificado de emisión de gases anterior</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Permiso de circulación al día</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Moto nueva sin revisión previa: certificado de homologación + padrón</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ marginTop: 4 }}>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="time-outline" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>Moto nueva: exenta los primeros 36-48 meses desde inscripción</Text>
                  </View>
                  <View style={styles.infoCardItem}>
                    <Ionicons name="time-outline" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.infoCardText, { color: colors.text + '99' }]}>5-9 años: cada 2 años · 10+ años: cada año</Text>
                  </View>
                </View>
                <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.brandBlue + '99'} />
                  <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Multa por no tenerla al día: 1 a 1,5 UTM</Text>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Empty state: no document yet */
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>📄</Text>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noDocuments')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noDocumentsSub')}</Text>
          </View>
        )}

        {/* FAB: only show when no document exists */}
        {!doc && (
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>
        )}

        {/* Photo Viewer */}
        <Modal visible={showPhotoViewer} animationType="fade" transparent>
          <View style={styles.photoViewerContainer}>
            <TouchableOpacity style={styles.photoViewerClose} onPress={() => setShowPhotoViewer(false)}>
              <Text style={styles.photoViewerCloseText}>✕</Text>
            </TouchableOpacity>
            {viewing && (
              <Image
                source={{ uri: viewingPhoto === 'back' && viewing.fileUrlBack ? viewing.fileUrlBack : viewing.fileUrl }}
                style={styles.photoViewerImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.photoViewerActions}>
              <TouchableOpacity style={[styles.photoViewerBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => viewing && handleSaveAsPDF(viewing)}>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.photoViewerBtnText}>{t('download')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoViewerBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => viewing && handleShare(viewing)}>
                <Text style={styles.photoViewerBtnText}>↗ {t('share')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Create/Edit Modal */}
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={[styles.modal, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
                <TouchableOpacity onPress={closeModal}><Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text></TouchableOpacity>
              </View>
              {(form.type === 'drivers_license' || form.type === 'technical_review') ? (
                <View style={{ gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('front')}>
                    {form.fileUrl ? (
                      <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.photoPlaceholder, { borderColor: colors.border }]}>
                        <Text style={styles.photoPlaceholderIcon}>📷</Text>
                        <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{form.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('back')}>
                    {form.fileUrlBack ? (
                      <Image source={{ uri: form.fileUrlBack }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.photoPlaceholder, { borderColor: colors.border }]}>
                        <Text style={styles.photoPlaceholderIcon}>📷</Text>
                        <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{form.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('front')}>
                  {form.fileUrl ? (
                    <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.border }]}>
                      <Text style={styles.photoPlaceholderIcon}>📷</Text>
                      <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{t('tapToAddPhoto')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {errors.fileUrl ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.fileUrl}</Text> : null}
              {isTitleEditable ? (
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]} placeholder={t('title')} placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(text) => setForm((p) => ({ ...p, title: text }))} />
              ) : (
                <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={{ fontSize: 15, color: colors.text }}>{form.title}</Text></View>
              )}
              <TouchableOpacity style={[styles.input, { borderColor: colors.inputBorder }]} onPress={() => setShowIssueDatePicker(true)}>
                <Text style={{ fontSize: 15, color: form.issueDate ? colors.text : colors.textMuted }}>{form.issueDate || t('issueDate')}</Text>
              </TouchableOpacity>
              {showIssueDatePicker && (
                <DateTimePicker value={form.issueDate ? new Date(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, issueDate: iso })); if (form.expiryDate && new Date(form.expiryDate) >= date) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              <TouchableOpacity style={[styles.input, { borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
                <Text style={{ fontSize: 15, color: form.expiryDate ? colors.text : colors.textMuted }}>{form.expiryDate || t('expiryDate')}</Text>
              </TouchableOpacity>
              {errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.expiryDate}</Text> : null}
              {showExpiryDatePicker && (
                <DateTimePicker value={form.expiryDate ? new Date(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, expiryDate: iso })); if (form.issueDate && date < new Date(form.issueDate)) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>}
              </TouchableOpacity>
              {showPhotoModal && (
                <View style={styles.photoOverlay}>
                  <TouchableOpacity style={styles.photoOverlayBg} onPress={() => setShowPhotoModal(false)} activeOpacity={1} />
                  <View style={[styles.photoOverlayContent, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity style={styles.photoOverlayClose} onPress={() => setShowPhotoModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                    <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}><Ionicons name="camera" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('takePhoto')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('chooseFromGallery')}</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />
      </View>
    );
  }

  // --- Multi-doc types: list view with cards + modal detail ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredDocs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredDocs.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={filteredDocs.length > 0 ? <View style={{ height: 8 }} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noDocuments')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noDocumentsSub')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => setViewing(item)}>
            <View style={styles.cardRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardStatus, item.status === 'expired' && { color: colors.danger }, item.status === 'expiring' && { color: colors.accent }, item.status === 'valid' && { color: colors.success }]}>
                {item.status === 'expired' ? t('expired') : item.status === 'expiring' ? t('expiring') : t('valid')}
              </Text>
            </View>
            {item.issueDate && <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{t('issued')}: {new Date(item.issueDate).toLocaleDateString()}</Text>}
            {item.expiryDate && <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{t('expires')}: {new Date(item.expiryDate).toLocaleDateString()}</Text>}
          </TouchableOpacity>
        )}
      />

      {filteredDocs.some((d) => d.fileUrl) && (
        <TouchableOpacity style={[styles.bulkFab, { backgroundColor: colors.success }]} onPress={handleBulkSaveAsPDF}>
          <Ionicons name="download-outline" size={24} color={colors.successText} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
        <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
      </TouchableOpacity>

      {/* Detail Modal (multi-doc types) */}
      <Modal visible={viewing !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setViewing(null)}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>{t('done')}</Text>
            </TouchableOpacity>
            <View style={styles.detailActions}>
              <TouchableOpacity onPress={() => viewing && openEdit(viewing)} style={styles.editBtn}>
                <Ionicons name="pencil" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => viewing && handleDelete(viewing)} style={styles.deleteBtn}>
                <Ionicons name="trash" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
          {viewing && (
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailTitleRow}>
                <Text style={[styles.detailTitle, { color: colors.text, flex: 1 }]}>{viewing.title}</Text>
                <View style={[styles.detailStatusBadge, {
                  backgroundColor: viewing.status === 'expired' ? colors.danger + '15' : viewing.status === 'expiring' ? colors.accent + '15' : colors.success + '15',
                  borderColor: viewing.status === 'expired' ? colors.danger : viewing.status === 'expiring' ? colors.accent : colors.success,
                }]}>
                  <Text style={[styles.detailStatusText, {
                    color: viewing.status === 'expired' ? colors.danger : viewing.status === 'expiring' ? colors.accent : colors.success,
                  }]}>
                    {viewing.status === 'expired' ? t('expired') : viewing.status === 'expiring' ? t('expiring') : t('valid')}
                  </Text>
                </View>
              </View>
              {viewing.issueDate && <Text style={[styles.detailDate, { color: colors.textSecondary }]}>{t('issued')}: {new Date(viewing.issueDate).toLocaleDateString()}</Text>}
              {viewing.expiryDate && <Text style={[styles.detailDate, { color: colors.textSecondary }]}>{t('expires')}: {new Date(viewing.expiryDate).toLocaleDateString()}</Text>}
              {viewing.type === 'drivers_license' && viewing.fileUrlBack ? (
                <View style={{ gap: 10, marginTop: 20 }}>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted, marginBottom: 6 }]}>{t('frontPhoto')}</Text>
                    <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                      <Image source={{ uri: viewing.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted, marginBottom: 6 }]}>{t('backPhoto')}</Text>
                    <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewingPhoto('back'); setShowPhotoViewer(true); }}>
                      <Image source={{ uri: viewing.fileUrlBack }} style={styles.pdfPreviewImage} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : viewing.fileUrl ? (
                <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => { setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                  <Image source={{ uri: viewing.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.noPhoto, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ color: colors.textMuted }}>{t('noDocumentAttached')}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Photo Viewer */}
      <Modal visible={showPhotoViewer} animationType="fade" transparent>
        <View style={styles.photoViewerContainer}>
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => setShowPhotoViewer(false)}>
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewing?.fileUrl && (
            <Image
              source={{ uri: viewingPhoto === 'back' && viewing.fileUrlBack ? viewing.fileUrlBack : viewing.fileUrl }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.photoViewerActions}>
            <TouchableOpacity style={[styles.photoViewerBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => viewing && handleSaveAsPDF(viewing)}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.photoViewerBtnText}>{t('download')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoViewerBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => viewing && handleShare(viewing)}>
              <Text style={styles.photoViewerBtnText}>↗ {t('share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
              <TouchableOpacity onPress={closeModal}><Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text></TouchableOpacity>
            </View>
            {(form.type === 'drivers_license' || form.type === 'technical_review') ? (
              <View style={{ gap: 10, marginBottom: 12 }}>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('front')}>
                  {form.fileUrl ? (<Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />) : (<View style={[styles.photoPlaceholder, { borderColor: colors.border }]}><Text style={styles.photoPlaceholderIcon}>📷</Text><Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{form.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text></View>)}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('back')}>
                  {form.fileUrlBack ? (<Image source={{ uri: form.fileUrlBack }} style={styles.photoPreview} resizeMode="cover" />) : (<View style={[styles.photoPlaceholder, { borderColor: colors.border }]}><Text style={styles.photoPlaceholderIcon}>📷</Text><Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{form.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text></View>)}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('front')}>
                {form.fileUrl ? (<Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />) : (<View style={[styles.photoPlaceholder, { borderColor: colors.border }]}><Text style={styles.photoPlaceholderIcon}>📷</Text><Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{t('tapToAddPhoto')}</Text></View>)}
              </TouchableOpacity>
            )}
            {errors.fileUrl ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.fileUrl}</Text> : null}
            {isTitleEditable ? (
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.inputBorder }]} placeholder={t('title')} placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(text) => setForm((p) => ({ ...p, title: text }))} />
            ) : (
              <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={{ fontSize: 15, color: colors.text }}>{form.title}</Text></View>
            )}
            <TouchableOpacity style={[styles.input, { borderColor: colors.inputBorder }]} onPress={() => setShowIssueDatePicker(true)}>
              <Text style={{ fontSize: 15, color: form.issueDate ? colors.text : colors.textMuted }}>{form.issueDate || t('issueDate')}</Text>
            </TouchableOpacity>
            {showIssueDatePicker && (
              <DateTimePicker value={form.issueDate ? new Date(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, issueDate: iso })); if (form.expiryDate && new Date(form.expiryDate) >= date) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
            )}
            <TouchableOpacity style={[styles.input, { borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
              <Text style={{ fontSize: 15, color: form.expiryDate ? colors.text : colors.textMuted }}>{form.expiryDate || t('expiryDate')}</Text>
            </TouchableOpacity>
            {errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.expiryDate}</Text> : null}
            {showExpiryDatePicker && (
              <DateTimePicker value={form.expiryDate ? new Date(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, expiryDate: iso })); if (form.issueDate && date < new Date(form.issueDate)) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
            )}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>}
            </TouchableOpacity>
            {showPhotoModal && (
              <View style={styles.photoOverlay}>
                <TouchableOpacity style={styles.photoOverlayBg} onPress={() => setShowPhotoModal(false)} activeOpacity={1} />
                <View style={[styles.photoOverlayContent, { backgroundColor: colors.surface }]}>
                  <TouchableOpacity style={styles.photoOverlayClose} onPress={() => setShowPhotoModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                  <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}><Ionicons name="camera" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('takePhoto')}</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('chooseFromGallery')}</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryList: { padding: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  infoBannerText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryIcon: { fontSize: 20, marginRight: 12 },
  categoryText: { fontSize: 16, fontWeight: '500' },
  categoryCount: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 20 },
  empty: { textAlign: 'center', marginTop: 40 },
  emptyContainer: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptySub: { fontSize: 13, marginTop: 4 },
  card: { padding: 14, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  cardStatus: { fontSize: 12, fontWeight: '500' },
  cardDate: { fontSize: 11, marginTop: 2 },
  // Detail Modal
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  detailContent: { padding: 20 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  detailStatusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statusBadgeOverlay: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  statusBadgeOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detailDate: { fontSize: 15, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  pdfThumbnail: {
    marginTop: 20,
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  pdfPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  pdfIcon: { fontSize: 48, marginBottom: 8 },
  pdfName: { fontSize: 14, fontWeight: '600' },
  pdfHint: { fontSize: 12, marginTop: 4 },
  noPhoto: { height: 150, borderRadius: 10, marginTop: 16, justifyContent: 'center', alignItems: 'center' },
  // Info card (requisitos)
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 20 },
  infoCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  infoCardItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  infoCardCheck: { fontSize: 11 },
  infoCardText: { fontSize: 11.5, flex: 1, lineHeight: 15 },
  infoCardDivider: { height: 1, marginVertical: 6 },
  infoCardDeadline: { fontSize: 13, fontWeight: '600' },
  // Doc portar button + modal
  docPortarModal: { borderRadius: 14, padding: 20, marginHorizontal: 24 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  docPortarModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1 },
  docPortarModalTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  // Photo Viewer
  photoViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  photoViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  photoViewerCloseText: { color: '#fff', fontSize: 24 },
  photoViewerImage: { width: '90%', height: '70%' },
  photoViewerActions: { flexDirection: 'row', gap: 20, marginTop: 20 },
  photoViewerBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, gap: 8 },
  photoViewerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Create/Edit Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  photoBtn: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  photoPlaceholderIcon: { fontSize: 32, marginBottom: 6 },
  photoPlaceholderText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  errorText: { fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, fontWeight: '300', marginTop: -2 },
  bulkFab: {
    position: 'absolute',
    bottom: 92,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  photoOverlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  photoOverlayContent: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    zIndex: 1000,
  },
  photoOverlayClose: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  photoOverlayTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 8,
  },
  photoOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  photoOverlayBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});