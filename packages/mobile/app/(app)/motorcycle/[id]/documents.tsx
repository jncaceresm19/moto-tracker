import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document, getPermitPaymentUrl, getPermitAppointmentUrl, listMunicipalities, updateMotorcycle, Municipality } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { useAuth } from '../../../../src/auth-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';
import { extractPdfData, OcrResult } from '../../../../src/services/ocrService';
import { OcrReviewModal, buildOcrFields, OcrField } from '../../../../src/components/OcrReviewModal';
import { ImageCropModal } from '../../../../src/components/ImageCropModal';


// Parse date as LOCAL (avoids UTC midnight shifting the day back)
// Handles both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ"
function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.split('T')[0]; // "2026-04-02" or "2026-04-02T00:00:00.000Z" → "2026-04-02"
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateEs(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/** Format a Date as YYYY-MM-DD using LOCAL getters (safe across timezones). */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TYPES = ['circulation_permit', 'technical_review', 'insurance', 'padron', 'drivers_license', 'fines'];

const TYPE_KEYS: Record<string, string> = {
  circulation_permit: 'circulationPermit',
  technical_review: 'technicalReview',
  insurance: 'insurance',
  padron: 'padron',
  drivers_license: 'driversLicense',
  fines: 'fines',
};

const CATEGORY_CHIPS: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  circulation_permit: { icon: 'document-text-outline', bg: '#E6F1FB', color: '#185FA5' },
  technical_review: { icon: 'construct-outline', bg: '#E1F5EE', color: '#0F6E56' },
  insurance: { icon: 'shield-checkmark-outline', bg: '#FBEAF0', color: '#993556' },
  padron: { icon: 'reader-outline', bg: '#F3E8FF', color: '#6B21A8' },
  drivers_license: { icon: 'card-outline', bg: '#FAEEDA', color: '#854F0B' },
  fines: { icon: 'cash-outline', bg: '#FDEAEA', color: '#B42318' },
};

// Types where the title is auto-set and non-editable
const FIXED_TITLE_TYPES: Record<string, string> = {
  circulation_permit: 'circulationPermit',
  technical_review: 'technicalReview',
  insurance: 'insurance',
  padron: 'padron',
  drivers_license: 'driversLicense',
};

// Types that support OCR scanning
const OCR_TYPES = ['circulation_permit', 'technical_review', 'drivers_license', 'padron', 'insurance'];

// Types that allow multiple documents
const MULTI_DOC_TYPES = ['fines'];

const TYPE_ENGLISH: Record<string, string> = {
  circulation_permit: 'Circulation Permit',
  technical_review: 'Technical Review',
  insurance: 'Insurance',
  padron: 'Vehicle Registration',
  drivers_license: "Driver's License",
  fines: 'Fines',
};

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { user } = useAuth();

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
  const [showFileNamePrompt, setShowFileNamePrompt] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [downloadDocs, setDownloadDocs] = useState<Document[]>([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [showDocPortarModal, setShowDocPortarModal] = useState(false);
  const [showTechReviewInstructivo, setShowTechReviewInstructivo] = useState(false);
  const [showLicenseInstructivo, setShowLicenseInstructivo] = useState(false);
  const [showPadronDuplicado, setShowPadronDuplicado] = useState(false);
  const [showLicensePresencialModal, setShowLicensePresencialModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'photo' | 'file'>('photo');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showOcrReview, setShowOcrReview] = useState(false);
  const [ocrFields, setOcrFields] = useState<OcrField[]>([]);
  const [ocrError, setOcrError] = useState<string | undefined>();
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>();
  const [ocrDocumentType, setOcrDocumentType] = useState('');
  const [ocrRawResult, setOcrRawResult] = useState<Record<string, string | undefined>>({});
  const [ocrComuna, setOcrComuna] = useState<string | undefined>();
  const [ocrPhotoUri, setOcrPhotoUri] = useState<string | null>(null);
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUri, setCropImageUri] = useState('');
  const [pendingOcrSide, setPendingOcrSide] = useState<'front' | 'back'>('front');
  const [cropMode, setCropMode] = useState<'ocr' | 'photo'>('ocr');
  // Municipality picker state (for circulation_permit + license appointment)
  const [muniSearch, setMuniSearch] = useState('');
  const [muniResults, setMuniResults] = useState<Municipality[]>([]);
  const [showMuniPicker, setShowMuniPicker] = useState(false);
  const [selMuni, setSelMuni] = useState<Municipality | null>(null);
  const [muniPickerMode, setMuniPickerMode] = useState<'permit' | 'license'>('permit');

  // Reset internal state when screen regains focus (e.g. after tab switch)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setViewing(null);
      setSelectedType(null);
      setEditing(null);
      setShowMuniPicker(false);
      setSelMuni(null);
      setMuniSearch('');
      setMuniResults([]);
      setMuniPickerMode('permit');
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      title: selectedType ? t(TYPE_KEYS[selectedType]) : t('documents'),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (viewing) {
              setViewing(null);
            } else if (selectedType) {
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
  }, [navigation, id, router, selectedType, viewing, t, colors]);

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

  const isCirculationPermitOpen = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-indexed
    const day = now.getDate();
    // Open between February 1 and March 31
    return (month === 2 && day >= 1) || month === 3;
  };

  const isTitleEditable = !FIXED_TITLE_TYPES[form.type];

  const resetForm = (type: string = 'other') => {
    const titleKey = FIXED_TITLE_TYPES[type];
    setForm({ type, title: titleKey ? t(titleKey) : '', fileUrl: '', fileUrlBack: '', issueDate: '', expiryDate: '' });
    setUploadMode('photo');
    setPickedFile(null);
    setOcrPhotoUri(null);
    setSelMuni(null);
    setMuniSearch('');
    setMuniResults([]);
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
    // Set upload mode based on document type
    if (doc.fileUrl?.startsWith('data:application/pdf')) {
      setUploadMode('file');
      setPickedFile({ uri: doc.fileUrl, name: doc.title + '.pdf', mimeType: 'application/pdf' });
    } else {
      setUploadMode('photo');
      setPickedFile(null);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setShowPhotoModal(false);
      showAlert(t('permissionNeeded'), t('permissionMessage'), [{ text: 'OK' }], 'lock-closed', colors.accent);
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1.0, allowsEditing: false });

    setShowPhotoModal(false);

    if (!result.canceled && result.assets[0]) {
      setCropImageUri(result.assets[0].uri);
      // Small delay ensures React commits the photo modal close before opening crop
      setTimeout(() => setShowCropModal(true), 100);
    }
  };

  const handleCropConfirm = (base64: string) => {
    setShowCropModal(false);
    const dataUri = `data:image/jpeg;base64,${base64}`;
    if (photoSide === 'back') {
      setForm((p) => ({ ...p, fileUrlBack: dataUri }));
    } else {
      setForm((p) => ({ ...p, fileUrl: dataUri }));
      setErrors((p) => ({ ...p, fileUrl: '' }));
    }
  };

  const showImageOptions = (side: 'front' | 'back' = 'front') => {
    setPhotoSide(side);
    setShowPhotoModal(true);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const file = result.assets[0];
      setPickedFile({ uri: file.uri, name: file.name, mimeType: file.mimeType || 'application/pdf' });
      try {
        const ef = new File(file.uri);
        const b64 = await ef.base64();
        const mimeType = file.mimeType || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${b64}`;
        setForm((p) => ({ ...p, fileUrl: dataUri }));
        setErrors((p) => ({ ...p, fileUrl: '' }));

        // Auto-OCR for PDFs on OCR-supported types
        const docType = selectedType || form.type;
        if (file.mimeType === 'application/pdf' && OCR_TYPES.includes(docType)) {
          await handlePdfOcr(dataUri, docType);
        }
      } catch (e: any) {
        console.error('[pickFile] error:', e?.message || e);
        showAlert('Error', 'No se pudo leer el archivo: ' + (e?.message || 'error desconocido'), [{ text: 'OK' }], 'close-circle', colors.danger);
      }
    }
  };

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fileUrl) newErrors.fileUrl = t('required');
    if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
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
        issueDate: form.issueDate ? form.issueDate + 'T00:00:00.000Z' : undefined,
        expiryDate: form.expiryDate ? form.expiryDate + 'T00:00:00.000Z' : undefined,
      });
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      // Asignar municipalidad: picker manual tiene prioridad, después OCR
      const muniId = selMuni?.id
        || (ocrComuna && (form.type === 'circulation_permit' || form.type === 'padron')
          ? await (async () => {
              try {
                const matches = await listMunicipalities(ocrComuna);
                const exact = matches.find((m) => m.commune.toLowerCase() === ocrComuna.toLowerCase());
                return exact?.id;
              } catch { return undefined; }
            })()
          : undefined);
      if (muniId) {
        try { await updateMotorcycle(id!, { permitMunicipalityId: muniId }); } catch { /* silencioso */ }
      }
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

  // Auto-calculate expiry for drivers license photo: issueDate + 6 years, birth day/month
  useEffect(() => {
    if (form.type === 'drivers_license' && form.issueDate && user?.birthDate) {
      const birthDate = parseLocalDate(user.birthDate);
      const birthDay = birthDate.getDate();
      const birthMonth = birthDate.getMonth();
      const issue = parseLocalDate(form.issueDate);
      const expiry = new Date(issue.getFullYear() + 6, birthMonth, birthDay);
      const iso = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
      setForm((p) => ({ ...p, expiryDate: iso }));
    }
  }, [form.type, form.issueDate, user?.birthDate]);

  // PDF OCR: extract text from PDF and run through parser
  const handlePdfOcr = async (pdfBase64: string, docType: string) => {
    setOcrDocumentType(docType);
    setOcrLoading(true);
    setOcrError(undefined);
    setShowOcrReview(true);

    try {
      const ocrResult = await extractPdfData(pdfBase64, docType);

      if (ocrResult.error) {
        setOcrError(ocrResult.error);
        setOcrConfidence((ocrResult as any).confidence);
      } else {
        setOcrConfidence((ocrResult as any).confidence);
        const rawResult: Record<string, string | undefined> = {};
        let fields = buildOcrFields(docType, ocrResult as Record<string, string | undefined>);

        if (docType === 'drivers_license' && (ocrResult as any).issueDate && user?.birthDate) {
          const birthDate = parseLocalDate(user.birthDate);
          const birthDay = birthDate.getDate();
          const birthMonth = birthDate.getMonth();
          const issue = parseLocalDate((ocrResult as any).issueDate);
          const expiry = new Date(issue.getFullYear() + 6, birthMonth, birthDay);
          const iso = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
          (ocrResult as any).expiryDate = iso;
          fields = buildOcrFields(docType, ocrResult as Record<string, string | undefined>);
        }

        fields.forEach(f => { rawResult[f.key] = f.value; });
        setOcrRawResult(rawResult);
        setOcrFields(fields);
      }
    } catch (err) {
      console.error('[OCR] PDF error:', err);
      setOcrError('Error al procesar el PDF. Intenta de nuevo.');
      setOcrConfidence(0);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrFieldChange = (key: string, value: string) => {
    setOcrFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
    setOcrRawResult(prev => ({ ...prev, [key]: value }));
  };

  const handleOcrSave = async () => {
    setShowOcrReview(false);
    const docType = ocrDocumentType;

    // Store comuna for Google Maps actions and auto-fill municipality field
    if (ocrRawResult.comuna) {
      setOcrComuna(ocrRawResult.comuna);
      // Auto-fill selMuni and persist so "Paga tu permiso" works right away
      listMunicipalities(ocrRawResult.comuna).then((results) => {
        const exact = results.find((m) => m.commune.toLowerCase() === ocrRawResult.comuna!.toLowerCase());
        if (exact) {
          setSelMuni(exact);
          updateMotorcycle(id!, { permitMunicipalityId: exact.id }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Set form directly — do NOT call openCreate() (it resets everything)
    // OCR photo goes to the correct side depending on document type
    const isBackOcr = docType === 'padron';
    const titleKey = FIXED_TITLE_TYPES[docType];
    setForm((prev) => ({
      type: docType,
      title: titleKey ? t(titleKey) : '',
      fileUrl: isBackOcr ? prev.fileUrl : (ocrPhotoUri || prev.fileUrl),
      fileUrlBack: isBackOcr ? (ocrPhotoUri || prev.fileUrlBack) : prev.fileUrlBack,
      issueDate: ocrRawResult.issueDate || '',
      expiryDate: ocrRawResult.expiryDate || '',
    }));
    setErrors({});
    setShowCreate(true);
  };

  const handleOcrRetry = () => {
    setOcrError(undefined);
    setOcrFields([]);
    setShowOcrReview(false);
    // OCR is only available via file upload — open file picker
    pickFile();
  };

  // ── Municipality Picker ──────────────────────────────────────────────────
  const searchMunis = async (query: string) => {
    setMuniSearch(query);
    if (query.length < 2) { setMuniResults([]); return; }
    try {
      const results = await listMunicipalities(query);
      setMuniResults(results);
    } catch { setMuniResults([]); }
  };

  const selectMuni = async (m: Municipality) => {
    setShowMuniPicker(false);
    setMuniResults([]);
    setMuniSearch('');

    if (muniPickerMode === 'license') {
      // License appointment: open municipality appointment URL or fallback
      if (m.appointmentUrl) {
        Linking.openURL(m.appointmentUrl);
      } else {
        Linking.openURL('https://www.agendarhoras.cl');
      }
      return;
    }

    // Permit mode: save to motorcycle + show in form
    setSelMuni(m);
    setMuniSearch(m.commune);
    try { await updateMotorcycle(id!, { permitMunicipalityId: m.id }); } catch { /* silencioso */ }
  };

  // ── Municipal Portal Actions ─────────────────────────────────────────────
  const handlePayPermit = async () => {
    try {
      const result = await getPermitPaymentUrl(id);
      if (!result?.municipality) {
        showAlert('Sin municipalidad', 'Asigná una municipalidad editando la moto o escaneando el padrón.', [{ text: 'OK' }], 'information-circle', colors.accent);
        return;
      }
      if (!result?.url) {
        showAlert('No disponible', `${result.municipality.commune} aún no tiene portal de pago registrado.`, [{ text: 'OK' }], 'information-circle', colors.accent);
        return;
      }
      await Linking.openURL(result.url);
    } catch {
      showAlert('Error', 'No se pudo obtener el enlace de pago.', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    }
  };

  const handleFindTechPlants = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=plantas+de+revisión+técnica+cercanas`;
    Linking.openURL(url);
  };

  const handleGoToMunicipality = async () => {
    try {
      const result = await getPermitAppointmentUrl(id);
      if (!result?.municipality) {
        showAlert('Sin municipalidad', 'Asigná una municipalidad editando la moto o escaneando el padrón.', [{ text: 'OK' }], 'information-circle', colors.accent);
        return;
      }
      if (!result?.url) {
        showAlert('No disponible', `${result.municipality.commune} aún no tiene portal web registrado.`, [{ text: 'OK' }], 'information-circle', colors.accent);
        return;
      }
      await Linking.openURL(result.url);
    } catch {
      showAlert('Error', 'No se pudo obtener el enlace.', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    }
  };

  const handleLicenseAppointment = async () => {
    try {
      const result = await getPermitAppointmentUrl(id);
      if (result?.url) {
        await Linking.openURL(result.url);
        return;
      }
      // No municipality set or no appointment URL → mostrar modal presencial
      if (!result?.municipality) {
        showAlert('Sin municipalidad', 'Asigná una comuna en tu permiso de circulación para agendar hora.', [{ text: 'OK' }], 'information-circle', colors.accent);
      } else {
        setShowLicensePresencialModal(true);
      }
    } catch {
      showAlert('Error', 'No se pudo obtener el enlace.', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fileUrl) newErrors.fileUrl = t('required');
    if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
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
        issueDate: form.issueDate ? form.issueDate + 'T00:00:00.000Z' : null,
        expiryDate: form.expiryDate ? form.expiryDate + 'T00:00:00.000Z' : null,
      });
      setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setEditing(null);
      // Asignar municipalidad desde el picker manual (solo permiso de circulación)
      if (selMuni && form.type === 'circulation_permit') {
        try { await updateMotorcycle(id!, { permitMunicipalityId: selMuni.id }); } catch { /* silencioso */ }
      }
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
    ], 'warning', colors.danger);
  };

  /** Resolve the display image for a document:
   *  - For non-PDF docs: use fileUrl directly
   *  - For PDF docs with a pre-converted JPEG: use fileUrlGenerated
   *  - For PDF docs without a pre-converted JPEG: return null (show fallback text) */
  const resolveDocImage = (doc: Document, side: 'front' | 'back'): string | null => {
    const url = side === 'front' ? doc.fileUrl : doc.fileUrlBack;
    const generated = side === 'front' ? doc.fileUrlGenerated : doc.fileUrlBackGenerated;
    if (!url) return null;
    if (!url.startsWith('data:application/pdf')) return url;     // regular image → use directly
    if (generated && generated.startsWith('data:image/jpeg;base64,')) return generated; // pre-converted JPEG
    return null; // PDF without conversion → show fallback text
  };

  const generatePDF = async (doc: Document) => {
    if (!doc.fileUrl) return null;
    const isPdf = doc.fileUrl.startsWith('data:application/pdf');
    const mainImg = resolveDocImage(doc, 'front');
    const backImg = resolveDocImage(doc, 'back');
    const issuedStr = doc.issueDate ? parseLocalDate(doc.issueDate).toLocaleDateString() : '—';
    const expiresStr = doc.expiryDate ? parseLocalDate(doc.expiryDate).toLocaleDateString() : '—';
    const showExpiry = doc.expiryDate && doc.type !== 'padron';
    const datesHtml = showExpiry
      ? `<div style="font-size: 13px; color: #666; margin: 10px 0; text-align: center;">Emitido: ${issuedStr} | Vence: ${expiresStr}</div>`
      : `<div style="font-size: 13px; color: #666; margin: 10px 0; text-align: center;">Emitido: ${issuedStr}</div>`;
    const imgHtml = mainImg
      ? `<div style="text-align: center;"><img src="${mainImg}" style="max-width: 100%; max-height: 85vh;" /></div>`
      : isPdf
        ? `<div style="text-align: center; padding: 30px; color: #999; font-size: 14px;">Documento PDF adjunto (no se pudo convertir a imagen)</div>`
        : '';
    const backSection = backImg
      ? `<div style="page-break-before: always; text-align: center; padding-top: 20px;">
           <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Reverso</div>
           <img src="${backImg}" style="max-width: 100%; max-height: 85vh;" />
         </div>`
      : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { margin: 0; padding: 20px; font-family: -apple-system, sans-serif; color: #333; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
        .dates { font-size: 13px; color: #666; margin: 10px 0; text-align: center; }
        img { max-width: 100%; max-height: 85vh; }
      </style></head>
      <body>
        <div class="header">
          <div class="title">${doc.title}</div>
        </div>
        ${datesHtml}
        ${imgHtml}
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
      if (uri) {
        const src = new File(uri);
        const docName = doc.title || t('document');
        const out = new File(Paths.cache, docName + '.pdf');
        src.move(out);
        await Sharing.shareAsync(out.uri);
      }
    } catch (e: any) {
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const handleDownloadAll = async () => {
    const docsWithFiles = docs.filter((d) => d.fileUrl && d.type !== 'fines');
    if (docsWithFiles.length === 0) {
      showAlert(t('noDocuments'), t('noPhotosSub'), [{ text: 'OK' }], 'document-outline', colors.textMuted);
      return;
    }
    setDownloadDocs(docsWithFiles);
    setShowFileNamePrompt(true);
  };

  const doDownloadAll = async (fileName: string) => {
    setShowFileNamePrompt(false);
    const docsWithFiles = downloadDocs;
    try {
      const issuedStr = (d: Document) => d.issueDate ? parseLocalDate(d.issueDate).toLocaleDateString() : '—';
      const expiresStr = (d: Document) => d.expiryDate ? parseLocalDate(d.expiryDate).toLocaleDateString() : '—';
      const docSections = docsWithFiles.map((d) => {
        const mainImg = resolveDocImage(d, 'front');
        const backImg = resolveDocImage(d, 'back');
        const showExpiry = d.expiryDate && d.type !== 'padron';
        const datesLine = showExpiry
          ? `Emitido: ${issuedStr(d)} | Vence: ${expiresStr(d)}`
          : `Emitido: ${issuedStr(d)}`;
        const isPdf = d.fileUrl.startsWith('data:application/pdf');
        const imgHtml = mainImg
          ? `<img src="${mainImg}" style="max-width: 100%; max-height: 85vh;" />`
          : isPdf
            ? `<div style="text-align: center; padding: 30px; color: #999; font-size: 14px;">Documento PDF adjunto (no se pudo convertir a imagen)</div>`
            : '';
        const backSection = backImg
          ? `<div style="page-break-before: always; text-align: center; padding-top: 20px;"><div style="font-size: 14px; color: #666; margin-bottom: 10px;">Reverso</div><img src="${backImg}" style="max-width: 100%; max-height: 85vh;" /></div>`
          : '';
        return `
        <div style="page-break-before: always; padding-top: 20px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">${d.title}</div>
          </div>
          <div style="font-size: 13px; color: #666; margin: 10px 0; text-align: center;">${datesLine}</div>
          <div style="text-align: center;">${imgHtml}</div>
          ${backSection}
        </div>`;
      });
      const docHtml = docSections.join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body { margin: 0; padding: 20px; font-family: -apple-system, sans-serif; color: #333; } img { max-width: 100%; max-height: 85vh; }</style></head><body>${docHtml}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const src = new File(uri);
      const out = new File(Paths.cache, fileName.endsWith('.pdf') ? fileName : fileName + '.pdf');
      src.move(out);
      await Sharing.shareAsync(out.uri);
    } catch (e: any) {
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', colors.danger);
    } finally {
      setDownloadFileName('');
    }
  };

  const openPDF = async (dataUri: string) => {
    try {
      const base64 = dataUri.replace(/^data:application\/pdf;base64,/, '');
      const fileName = 'doc_' + Date.now() + '.pdf';
      const file = new File(Paths.cache, fileName);
      file.create();
      file.write(base64, { encoding: 'base64' });
      // Print API can render PDFs - opens native print/share dialog with preview
      await Print.printAsync({ uri: file.uri });
    } catch (e: any) {
      // Fallback: Sharing (gives "Open with" options)
      try {
        const base64_2 = dataUri.replace(/^data:application\/pdf;base64,/, '');
        const file2 = new File(Paths.cache, 'doc_fb_' + Date.now() + '.pdf');
        file2.create();
        file2.write(base64_2, { encoding: 'base64' });
        await Sharing.shareAsync(file2.uri, { mimeType: 'application/pdf' });
      } catch (e2: any) {
        showAlert(t('error'), 'No se pudo abrir el PDF: ' + (e2?.message || String(e2)), [{ text: 'OK' }], 'close-circle', colors.danger);
      }
    }
  };

  const handleBulkSaveAsPDF = async () => {
    const photos = filteredDocs.filter((d) => d.fileUrl && d.type !== 'fines');
    if (photos.length === 0) {
      showAlert(t('noPhotos'), t('noPhotosSub'), [{ text: 'OK' }], 'information-circle', colors.primary);
      return;
    }
    setDownloadDocs(photos);
    setShowFileNamePrompt(true);
  };

  const handleShare = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const uri = await generatePDF(doc);
      if (uri) {
        const src = new File(uri);
        const docName = doc.title || t('document');
        const out = new File(Paths.cache, docName + '.pdf');
        src.move(out);
        await Sharing.shareAsync(out.uri);
      }
    } catch (e: any) {
      showAlert(t('error'), t('failedToShare'), [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const modalTitle = editing ? t('editDocument') : t('newDocument');
  const modalSave = editing ? handleUpdate : handleCreate;
  const showModal = showCreate || editing !== null;
  const closeModal = () => { setShowCreate(false); setEditing(null); setUploadMode('photo'); setPickedFile(null); setSelMuni(null); setMuniSearch(''); setMuniResults([]); };

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
          scrollEnabled
          ListHeaderComponent={
            <>
              <View style={[styles.headerCard, { backgroundColor: '#E6F1FB', borderColor: '#185FA5' }]}>
                <View style={[styles.headerIcon, { backgroundColor: '#185FA5' }]}>
                  <Ionicons name="document-text" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.headerTitle, { color: '#0C447C' }]}>Documentos</Text>
                  <Text style={[styles.headerSubtitle, { color: '#1C6FA5' }]}>Gestiona los documentos de tu moto</Text>
                </View>
              </View>
            </>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
                onPress={handleDownloadAll}
              >
                <View style={[styles.categoryChip, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="download-outline" size={18} color={colors.success} />
                </View>
                <Text style={[styles.categoryCount, { color: colors.text, fontSize: 14 }]}>Descargar todos los documentos en PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowDocPortarModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Documentos obligatorios en controles
                </Text>
              </TouchableOpacity>
              <Text style={[styles.payHint, { color: colors.textMuted }]}>{t('documentsDisclaimer')}</Text>

            </>
          }
          renderItem={({ item }) => {
            const docsForType = docs.filter((d) => d.type === item);
            const count = docsForType.length;
            return (
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedType(item);
                }}
              >
                <View style={[styles.categoryChip, { backgroundColor: CATEGORY_CHIPS[item].bg }]}>
                  <Ionicons name={CATEGORY_CHIPS[item].icon} size={18} color={CATEGORY_CHIPS[item].color} />
                </View>
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
                    <Ionicons
                      name="help-circle-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Documentación requerida</Text>
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
                      <Text style={[styles.infoCardText, { color: colors.textMuted, flex: 1 }]}>El padrón no es obligatorio portarlo físicamente en un control policial, pero se recomienda</Text>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
        {/* File name prompt for bulk PDF download */}
        <Modal visible={showFileNamePrompt} animationType="fade" transparent onRequestClose={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface, alignItems: 'center', paddingTop: 28, position: 'relative' }]}>
                  <TouchableOpacity style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons name="download-outline" size={28} color={colors.success} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16, textAlign: 'center' }}>Descargar documentos</Text>
                  <View style={{ width: '100%' }}>
                    <TextInput
                      style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder, color: colors.text, fontSize: 16, padding: 12, borderRadius: 10 }]}
                      placeholder="documentos.pdf"
                      placeholderTextColor={colors.textMuted}
                      value={downloadFileName}
                      onChangeText={setDownloadFileName}
                      autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.surfaceSecondary, flex: 1, marginTop: 0 }]} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                        <Text style={[styles.saveBtnText, { color: colors.text }]}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0 }]} onPress={() => doDownloadAll(downloadFileName || 'documentos.pdf')}>
                        <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>Descargar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
          <ScrollView contentContainerStyle={styles.detailContent} scrollEnabled={doc.type !== 'circulation_permit'}>
            {/* Photo with status badge overlay */}
            <View>
              {doc.fileUrl?.startsWith('data:application/pdf') ? (
                <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: 16 }]} activeOpacity={0.9} onPress={() => openPDF(doc.fileUrl!)}>
                  <Ionicons name="document-text" size={48} color={colors.primary} />
                  <Text style={[styles.pdfName, { color: colors.text, marginTop: 8 }]}>{doc.title}</Text>
                  <Text style={[styles.pdfHint, { color: colors.textMuted }]}>Toca para abrir el PDF</Text>
                </TouchableOpacity>
              ) : ((doc.type === 'drivers_license' || doc.type === 'technical_review' || doc.type === 'padron') && doc.fileUrlBack) ? (
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted }]}>{doc.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text>
                    <View>
                      <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} activeOpacity={0.9} onPress={() => { setViewing(doc); setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                        <Image source={{ uri: doc.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                      </TouchableOpacity>
                      <View style={[styles.statusBadgeOverlay, {
                        backgroundColor: doc.status === 'expired' ? colors.danger : doc.status === 'expiring' ? colors.accent : colors.success,
                      }]}>
                        <Text style={styles.statusBadgeOverlayText}>
                          {doc.status === 'expired' ? t('expired') : doc.status === 'expiring' ? t('expiring') : t('valid')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View>
                    <Text style={[styles.pdfHint, { color: colors.textMuted, marginBottom: 6 }]}>{doc.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text>
                    <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} activeOpacity={0.9} onPress={() => { setViewing(doc); setViewingPhoto('back'); setShowPhotoViewer(true); }}>
                      <Image source={{ uri: doc.fileUrlBack }} style={styles.pdfPreviewImage} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : doc.fileUrl ? (
                <View>
                  <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} activeOpacity={0.9} onPress={() => { setViewing(doc); setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                    <Image source={{ uri: doc.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                  </TouchableOpacity>
                  <View style={[styles.statusBadgeOverlay, {
                    backgroundColor: doc.status === 'expired' ? colors.danger : doc.status === 'expiring' ? colors.accent : colors.success,
                  }]}>
                    <Text style={styles.statusBadgeOverlayText}>
                      {doc.status === 'expired' ? t('expired') : doc.status === 'expiring' ? t('expiring') : t('valid')}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.noPhoto, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ color: colors.textMuted }}>{t('noDocumentAttached')}</Text>
                </View>
              )}
            </View>

            {/* Dates card */}
            {(doc.issueDate || doc.expiryDate) && (
              <View style={[styles.datesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {doc.issueDate && (
                  <View style={styles.datesCardCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="calendar-outline" size={16} color={colors.success} />
                      <Text style={[styles.datesCardLabel, { color: colors.textMuted }]}>{t('issued')}</Text>
                    </View>
                    <Text style={[styles.datesCardValue, { color: colors.text }]}>{formatDateEs(doc.issueDate)}</Text>
                  </View>
                )}
                {doc.issueDate && doc.expiryDate && <View style={[styles.datesCardDivider, { backgroundColor: colors.border }]} />}
                {doc.expiryDate && (
                  <View style={styles.datesCardCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="calendar-outline" size={16} color={colors.danger} />
                      <Text style={[styles.datesCardLabel, { color: colors.textMuted }]}>{doc.type === 'padron' ? 'Vencimiento' : t('expires')}</Text>
                    </View>
                    <Text style={[styles.datesCardValue, { color: colors.text }]} numberOfLines={1}>{doc.type === 'padron' ? 'No tiene vencimiento' : formatDateEs(doc.expiryDate)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Actions card */}
            <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => handleSaveAsPDF(doc)} style={[styles.actionsCardBtn, { borderColor: colors.success }]}>
                <Ionicons name="download-outline" size={18} color={colors.success} />
                <Text style={[styles.actionsCardBtnText, { color: colors.success }]}>{t('download')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(doc)} style={[styles.actionsCardBtn, { borderColor: colors.primary }]}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionsCardBtnText, { color: colors.primary }]}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(doc)} style={[styles.actionsCardBtn, { borderColor: colors.danger }]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.actionsCardBtnText, { color: colors.danger }]}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>

            {/* Requisitos Permiso de Circulación */}
            {doc.type === 'circulation_permit' && (
              <>
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

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.success, marginTop: 12 }]}
                  activeOpacity={0.8}
                  onPress={handlePayPermit}>
                  <Ionicons name="wallet-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Paga tu permiso</Text>
                </TouchableOpacity>
                <Text style={[styles.payHint, { color: colors.textMuted }]}>Opción hábil entre el 1 de febrero y el 31 de marzo</Text>
              </>
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
              <>
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
                <Text style={[styles.payHint2, { color: colors.textMuted }]}>¿Perdiste o dañaste tu padrón?</Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 12 }]} activeOpacity={0.8}
                  onPress={() => setShowPadronDuplicado(true)}>
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Sacar duplicado</Text>
                </TouchableOpacity>
                <Text style={[styles.payHint, { color: colors.textMuted }]}>Sigue los pasos para obtener tu duplicado</Text>
              </>
            )}

            {/* Requisitos Licencia de Conducir */}
            {doc.type === 'drivers_license' && (
              <>
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
                <Text style={[styles.payHint2, { color: colors.textMuted }]}>¿Extravío o robo?</Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 12 }]} activeOpacity={0.8}
                  onPress={() => setShowLicenseInstructivo(true)}>
                  <Ionicons name="book-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Ver instructivo</Text>
                </TouchableOpacity>
                <Text style={[styles.payHint2, { color: colors.textMuted }]}>¿Necesitas renovar tu licencia de conducir?</Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.success, marginTop: 12 }]} activeOpacity={0.8}
                  onPress={handleLicenseAppointment}>
                  <Ionicons name="calendar-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Agendar hora</Text>
                </TouchableOpacity>
              </>
            )}
            {/* Requisitos Revisión Técnica */}
            {doc.type === 'technical_review' && (
              <>
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
                  </View>
                  <View style={[styles.infoCardDivider, { backgroundColor: colors.brandBlue, opacity: 0.25, marginTop: 10 }]} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.brandBlue + '99'} />
                    <Text style={[styles.cardDate, { color: colors.brandBlue + '99', fontWeight: '600' }]}>Multa por no tenerla al día: 1 a 1,5 UTM</Text>
                  </View>
                </View>

                <Text style={[styles.payHint2, { color: colors.textMuted }]}>¿Qué necesito para aprobar la revisión técnica?</Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 12 }]} activeOpacity={0.8}
                  onPress={() => setShowTechReviewInstructivo(true)}>
                  <Ionicons name="book-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Ver instructivo</Text>
                </TouchableOpacity>
                <Text style={[styles.payHint, { color: colors.textMuted }]}>Procura cumplir con todos estos requisitos previo a tu cita</Text>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.success, marginTop: 12 }]} activeOpacity={0.8}
                  onPress={handleFindTechPlants}>
                  <Ionicons name="map-outline" size={20} color="#fff" />
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Buscar plantas de revisión</Text>
                </TouchableOpacity>
                <Text style={[styles.payHint, { color: colors.textMuted }]}>El valor de la revisión técnica puede variar según la Planta de Revisión Técnica (PRT). Consulta el precio vigente al momento de reservar tu hora.</Text>
              </>
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
              <View style={styles.modalTopRow}>
                <TouchableOpacity onPress={closeModal} style={{ marginLeft: 'auto' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.modalLogoContainer, { borderBottomColor: colors.border }]}>
                <Image
                  source={require('../../../../assets/nombre.jpeg')}
                  style={styles.modalLogo}
                  resizeMode="contain"
                />
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{modalTitle}</Text>
              </View>
              {/* Upload mode toggle — segmented pill control */}
              <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity
                  style={[styles.segmentedOption, uploadMode === 'photo' && [styles.segmentedOptionActive, { backgroundColor: colors.card, borderColor: colors.primary }]]}
                  onPress={() => { setUploadMode('photo'); setPickedFile(null); }}
                >
                  <Ionicons name="camera-outline" size={16} color={uploadMode === 'photo' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.segmentedOptionText, { color: uploadMode === 'photo' ? colors.primary : colors.textMuted }]}>Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentedOption, uploadMode === 'file' && [styles.segmentedOptionActive, { backgroundColor: colors.card, borderColor: colors.primary }]]}
                  onPress={() => { setUploadMode('file'); if (!pickedFile && form.fileUrl?.startsWith('data:application/pdf')) setPickedFile({ uri: form.fileUrl, name: form.title + '.pdf', mimeType: 'application/pdf' }); }}
                >
                  <Ionicons name="document-outline" size={16} color={uploadMode === 'file' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.segmentedOptionText, { color: uploadMode === 'file' ? colors.primary : colors.textMuted }]}>Subir archivo</Text>
                </TouchableOpacity>
              </View>
              {uploadMode === 'photo' && (
                (form.type === 'drivers_license' || form.type === 'technical_review' || form.type === 'padron') ? (
                  <View style={{ gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setPhotoSide('front'); showImageOptions('front'); }}>
                      {form.fileUrl && !form.fileUrl?.startsWith('data:application/pdf') ? (
                        <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                      ) : (
                        <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                          <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="camera-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{form.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text>
                          <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('back')}>
                      {form.fileUrlBack ? (
                        <Image source={{ uri: form.fileUrlBack }} style={styles.photoPreview} resizeMode="cover" />
                      ) : (
                        <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                          <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="camera-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{form.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text>
                          <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setPhotoSide('front'); showImageOptions('front'); }}>
                    {form.fileUrl && !form.fileUrl?.startsWith('data:application/pdf') ? (
                      <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                          <Ionicons name="camera-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{t('tapToAddPhoto')}</Text>
                        <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              )}
              {/* File picker */}
              {uploadMode === 'file' && (
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary, marginBottom: 12 }]} onPress={pickFile}>
                  {pickedFile ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <Ionicons name="document-text" size={24} color={colors.primary} />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{pickedFile.name}</Text>
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{pickedFile.mimeType === 'application/pdf' ? 'PDF' : 'Imagen'}</Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} style={{ position: 'absolute', top: 8, right: 8 }} />
                    </View>
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                      <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="document-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>Toca para seleccionar archivo</Text>
                      <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>PDF o imagen</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {errors.fileUrl ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.fileUrl}</Text> : null}
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{isTitleEditable ? t('title') : 'Tipo de documento'}</Text>
                {isTitleEditable ? (
                  <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                    <TextInput style={[styles.fieldInput, { color: colors.text }]} placeholder={t('title')} placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(text) => setForm((p) => ({ ...p, title: text }))} />
                  </View>
                ) : (
                  <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 14, color: colors.text }}>{form.title}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('issueDate')}</Text>
                  <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowIssueDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.fieldInputText, { color: form.issueDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.issueDate ? formatDateEs(form.issueDate) : 'Selecciona'}</Text>
                  </TouchableOpacity>
                </View>
                {form.type !== 'padron' && (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('expiryDate')}</Text>
                    <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.fieldInputText, { color: form.expiryDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.expiryDate ? formatDateEs(form.expiryDate) : 'Selecciona'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {form.type !== 'padron' && errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger, marginTop: 6 }]}>{errors.expiryDate}</Text> : null}
              {showIssueDatePicker && (
                <DateTimePicker value={form.issueDate ? parseLocalDate(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { setForm((p) => ({ ...p, issueDate: toLocalDateStr(date) })); if (form.expiryDate && form.expiryDate >= toLocalDateStr(date)) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              {form.type !== 'padron' && showExpiryDatePicker && (
                <DateTimePicker value={form.expiryDate ? parseLocalDate(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { setForm((p) => ({ ...p, expiryDate: toLocalDateStr(date) })); if (form.issueDate && toLocalDateStr(date) < form.issueDate) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              {/* Comuna (solo permiso de circulación) */}
              {form.type === 'circulation_permit' && (
                <>
                  <View style={{ marginTop: 12, marginBottom: 4 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Comuna</Text>
                    <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => { setMuniPickerMode('permit'); setShowMuniPicker(true); }} activeOpacity={0.7}>
                      <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.fieldInputText, { color: selMuni ? colors.text : colors.textMuted }]} numberOfLines={1}>
                        {selMuni ? `${selMuni.commune} — ${selMuni.name}` : 'Seleccionar comuna...'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="save-outline" size={18} color={colors.primaryText} />
                    <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {showPhotoModal && (
                <View style={styles.photoOverlay}>
                  <TouchableOpacity style={styles.photoOverlayBg} onPress={() => setShowPhotoModal(false)} activeOpacity={1} />
                  <View style={[styles.photoOverlayContent, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity style={styles.photoOverlayClose} onPress={() => setShowPhotoModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                    <View style={[styles.photoOverlayIconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="camera" size={28} color={colors.primary} />
                    </View>
                    <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}><Ionicons name="camera" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>Abrir cámara</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.text} /><Text style={[styles.photoOverlayBtnText, { color: colors.text }]}>Elegir de galería</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />

        <OcrReviewModal
          visible={showOcrReview}
          documentType={ocrDocumentType}
          loading={ocrLoading}
          fields={ocrFields}
          error={ocrError}
          confidence={ocrConfidence}
          onFieldChange={handleOcrFieldChange}
          onSave={handleOcrSave}
          onCancel={() => setShowOcrReview(false)}
          onRetry={handleOcrRetry}
        />

        {/* Modal: Instructivo Revisión Técnica */}
        <Modal visible={showTechReviewInstructivo} transparent animationType="fade">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowTechReviewInstructivo(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface }]}>
                  <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="construct-outline" size={18} color={colors.primary} />
                    <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Para aprobar debes tener</Text>
                    <TouchableOpacity onPress={() => setShowTechReviewInstructivo(false)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                    <View style={{ marginTop: 12 }}>
                      {[
                        'Patente visible, fijada y legible',
                        'Carrocería sin fisuras ni soldaduras',
                        'Apoyapiés en buen estado',
                        'Focos, espejos retrovisores y reflectantes presentes y sin quiebres',
                        'Asiento bien fijado',
                        'Escape sin fugas ni roturas',
                        'Neumáticos con surco suficiente',
                        'Luces de viraje, freno y posición funcionando',
                        'Luces correctamente alineadas',
                        'Emisión de gases dentro de norma',
                      ].map((item, i) => (
                        <View key={i} style={styles.infoCardItem}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={[styles.infoCardText, { color: colors.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.infoCardDivider, { backgroundColor: colors.border, marginTop: 12 }]} />
                    <View style={{ marginTop: 4 }}>
                      <Text style={[styles.infoCardText, { color: colors.text, fontWeight: '600', marginBottom: 4 }]}>Defectos graves impiden aprobar hasta ser corregidos</Text>
                      <Text style={[styles.infoCardText, { color: colors.textMuted }]}>Plazo de 15 días corridos para volver con tarifa rebajada (después, se paga revisión completa nuevamente)</Text>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* Modal: Instructivo Licencia de Conducir */}
        <Modal visible={showLicenseInstructivo} transparent animationType="fade">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLicenseInstructivo(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface }]}>
                  <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="card-outline" size={18} color={colors.primary} />
                    <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Extravío o Robo de Licencia</Text>
                    <TouchableOpacity onPress={() => setShowLicenseInstructivo(false)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                    <View style={{ marginTop: 12 }}>
                      <View style={{ marginBottom: 16 }}>
                        <View style={styles.infoCardItem}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={[styles.infoCardText, { color: colors.text, fontWeight: '600' }]}>Extravío</Text>
                        </View>
                        <Text style={[styles.infoCardText, { color: colors.textMuted, marginLeft: 22, marginTop: 4 }]}>Bloquea la licencia. Puedes realizar el bloqueo temporal en línea con tu ClaveÚnica a través del Registro Civil.</Text>
                        <TouchableOpacity
                          style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
                          activeOpacity={0.8}
                          onPress={() => Linking.openURL('https://www.registrocivil.cl/principal/servicios-en-linea/bloqueo-temporal-licencia-de-conducir')}>
                          <Ionicons name="open-outline" size={18} color="#fff" />
                          <Text style={[styles.submitBtnText, { color: '#fff', fontSize: 14 }]}>Ir a Registro Civil</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.infoCardDivider, { backgroundColor: colors.border }]} />

                      <View style={{ marginTop: 16 }}>
                        <View style={styles.infoCardItem}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={[styles.infoCardText, { color: colors.text, fontWeight: '600' }]}>Robo</Text>
                        </View>
                        <Text style={[styles.infoCardText, { color: colors.textMuted, marginLeft: 22, marginTop: 4 }]}>Denuncia el robo, bloquea la licencia y solicita el duplicado en la municipalidad.</Text>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* Modal: Duplicado Padrón */}
        <Modal visible={showPadronDuplicado} transparent animationType="fade">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPadronDuplicado(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface }]}>
                  <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="reader-outline" size={18} color={colors.primary} />
                    <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Sacar duplicado del Padrón</Text>
                    <TouchableOpacity onPress={() => setShowPadronDuplicado(false)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.infoCardText, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>El procedimiento:</Text>
                      {[
                        'Ingresa al portal del Registro Civil.',
                        'Selecciona Vehículos → Certificado de inscripción (Padrón).',
                        'Inicia sesión con tu ClaveÚnica.',
                        'Ingresa la patente de la moto.',
                        'Paga el valor del trámite (actualmente $1.560).',
                        'Descarga el documento en formato PDF.',
                      ].map((item, i) => (
                        <View key={i} style={[styles.infoCardItem, { alignItems: 'flex-start' }]}>
                          <Text style={{ fontSize: 11.5, lineHeight: 15, fontWeight: '700', color: colors.text, width: 16 }}>{i + 1}.</Text>
                          <Text style={[styles.infoCardText, { color: colors.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                      activeOpacity={0.8}
                      onPress={() => Linking.openURL('https://www.registrocivil.cl/principal/servicios-en-linea/')}>
                      <Ionicons name="open-outline" size={18} color="#fff" />
                      <Text style={[styles.submitBtnText, { color: '#fff', fontSize: 14 }]}>Ir a Registro Civil</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* File name prompt for bulk PDF download */}
        <Modal visible={showFileNamePrompt} animationType="fade" transparent onRequestClose={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
                <View style={[styles.docPortarModal, { backgroundColor: colors.surface, alignItems: 'center', paddingTop: 28, position: 'relative' }]}>
                  <TouchableOpacity style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons name="download-outline" size={28} color={colors.success} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16, textAlign: 'center' }}>Descargar documentos</Text>
                  <View style={{ width: '100%' }}>
                    <TextInput
                      style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder, color: colors.text, fontSize: 16, padding: 12, borderRadius: 10 }]}
                      placeholder="documentos.pdf"
                      placeholderTextColor={colors.textMuted}
                      value={downloadFileName}
                      onChangeText={setDownloadFileName}
                      autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.surfaceSecondary, flex: 1, marginTop: 0 }]} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                        <Text style={[styles.saveBtnText, { color: colors.text }]}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0 }]} onPress={() => doDownloadAll(downloadFileName || 'documentos.pdf')}>
                        <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>Descargar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // --- Multi-doc types: list view with cards + inline detail ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {viewing ? (
        <ScrollView contentContainerStyle={styles.detailContent}>
          {/* Photo with status badge overlay — same as single-doc detail */}
          <View>
            {viewing.fileUrl?.startsWith('data:application/pdf') ? (
              <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: 16 }]} activeOpacity={0.9} onPress={() => openPDF(viewing.fileUrl!)}>
                <Ionicons name="document-text" size={48} color={colors.primary} />
                <Text style={[styles.pdfName, { color: colors.text, marginTop: 8 }]}>{viewing.title}</Text>
                <Text style={[styles.pdfHint, { color: colors.textMuted }]}>Toca para abrir el PDF</Text>
              </TouchableOpacity>
            ) : viewing.fileUrl ? (
              <View>
                <TouchableOpacity style={[styles.pdfThumbnail, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} activeOpacity={0.9} onPress={() => { setViewingPhoto('front'); setShowPhotoViewer(true); }}>
                  <Image source={{ uri: viewing.fileUrl }} style={styles.pdfPreviewImage} resizeMode="contain" />
                </TouchableOpacity>
                <View style={[styles.statusBadgeOverlay, {
                  backgroundColor: viewing.status === 'expired' ? colors.danger : viewing.status === 'expiring' ? colors.accent : colors.success,
                }]}>
                  <Text style={styles.statusBadgeOverlayText}>
                    {viewing.status === 'expired' ? t('expired') : viewing.status === 'expiring' ? t('expiring') : t('valid')}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.noPhoto, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ color: colors.textMuted }}>{t('noDocumentAttached')}</Text>
              </View>
            )}
          </View>

          {/* Dates card — same layout as single-doc */}
          {(viewing.issueDate || viewing.expiryDate) && (
            <View style={[styles.datesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {viewing.issueDate && (
                <View style={styles.datesCardCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.success} />
                    <Text style={[styles.datesCardLabel, { color: colors.textMuted }]}>{t('issued')}</Text>
                  </View>
                  <Text style={[styles.datesCardValue, { color: colors.text }]}>{formatDateEs(viewing.issueDate)}</Text>
                </View>
              )}
              {viewing.issueDate && viewing.expiryDate && <View style={[styles.datesCardDivider, { backgroundColor: colors.border }]} />}
              {viewing.expiryDate && (
                <View style={styles.datesCardCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.danger} />
                    <Text style={[styles.datesCardLabel, { color: colors.textMuted }]}>{viewing.type === 'padron' ? 'Vencimiento' : t('expires')}</Text>
                  </View>
                  <Text style={[styles.datesCardValue, { color: colors.text }]} numberOfLines={1}>{viewing.type === 'padron' ? 'No tiene vencimiento' : formatDateEs(viewing.expiryDate)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Actions card — same layout as single-doc */}
          <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => handleSaveAsPDF(viewing)} style={[styles.actionsCardBtn, { borderColor: colors.success }]}>
              <Ionicons name="download-outline" size={18} color={colors.success} />
              <Text style={[styles.actionsCardBtnText, { color: colors.success }]}>{t('download')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEdit(viewing)} style={[styles.actionsCardBtn, { borderColor: colors.primary }]}>
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionsCardBtnText, { color: colors.primary }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(viewing)} style={[styles.actionsCardBtn, { borderColor: colors.danger }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.actionsCardBtnText, { color: colors.danger }]}>{t('delete')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <FlatList
            data={filteredDocs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={filteredDocs.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListHeaderComponent={filteredDocs.length > 0 ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.brandBlueBg, borderColor: colors.brandBlue, marginHorizontal: 16, marginTop: 12 }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue} />
                <Text style={[styles.infoBannerText, { color: colors.text }]}>{t('finesDisclaimer')}</Text>
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noDocuments')}</Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noDocumentsSub')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card, borderLeftColor: colors.primary }]}
                activeOpacity={0.8}
                onPress={() => setViewing(item)}
              >
                <View style={styles.cardRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardStatus, item.status === 'expired' && { color: colors.danger }, item.status === 'expiring' && { color: colors.accent }, item.status === 'valid' && { color: colors.success }]}>
                    {item.status === 'expired' ? t('expired') : item.status === 'expiring' ? t('expiring') : t('valid')}
                  </Text>
                </View>
                {item.issueDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Ionicons name="calendar-outline" size={13} color={colors.success} />
                    <Text style={[styles.cardDate, { color: colors.textSecondary, marginTop: 0 }]}>
                      {t('issued')}: {formatDateEs(item.issueDate)}
                    </Text>
                  </View>
                )}
                {item.expiryDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Ionicons name="calendar-outline" size={13} color={colors.danger} />
                    <Text style={[styles.cardDate, { color: colors.textSecondary, marginTop: 0 }]}>
                      {item.type === 'padron' ? 'No tiene vencimiento' : `${t('expires')}: ${formatDateEs(item.expiryDate)}`}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />

          {filteredDocs.some((d) => d.fileUrl) && (
            <TouchableOpacity style={[styles.bulkFab, { backgroundColor: colors.success }]} onPress={handleBulkSaveAsPDF}>
              <Ionicons name="download-outline" size={24} color={colors.successText} />
            </TouchableOpacity>
          )}
          {selectedType === 'fines' && (
            <TouchableOpacity
              style={[styles.bulkFab, { backgroundColor: colors.primary, bottom: 148 }]}
              onPress={() => Linking.openURL('https://rrvv.fiscalizacion.cl/MTTVias2019/')}>
              <Ionicons name="search-outline" size={22} color={colors.primaryText} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <Text style={[styles.fabText, { color: colors.primaryText }]}>+</Text>
          </TouchableOpacity>
        </>
      )}

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



      {/* Create/Edit Modal (multi-doc types: fines) */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={styles.modalTopRow}>
              <TouchableOpacity onPress={closeModal} style={{ marginLeft: 'auto' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalLogoContainer, { borderBottomColor: colors.border }]}>
              <Image
                source={require('../../../../assets/nombre.jpeg')}
                style={styles.modalLogo}
                resizeMode="contain"
              />
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{modalTitle}</Text>
            </View>
            {/* Upload mode toggle — segmented pill control */}
            <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceSecondary }]}>
              <TouchableOpacity
                style={[styles.segmentedOption, uploadMode === 'photo' && [styles.segmentedOptionActive, { backgroundColor: colors.card, borderColor: colors.primary }]]}
                onPress={() => { setUploadMode('photo'); setPickedFile(null); }}
              >
                <Ionicons name="camera-outline" size={16} color={uploadMode === 'photo' ? colors.primary : colors.textMuted} />
                <Text style={[styles.segmentedOptionText, { color: uploadMode === 'photo' ? colors.primary : colors.textMuted }]}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentedOption, uploadMode === 'file' && [styles.segmentedOptionActive, { backgroundColor: colors.card, borderColor: colors.primary }]]}
                onPress={() => { setUploadMode('file'); if (!pickedFile && form.fileUrl?.startsWith('data:application/pdf')) setPickedFile({ uri: form.fileUrl, name: form.title + '.pdf', mimeType: 'application/pdf' }); }}
              >
                <Ionicons name="document-outline" size={16} color={uploadMode === 'file' ? colors.primary : colors.textMuted} />
                <Text style={[styles.segmentedOptionText, { color: uploadMode === 'file' ? colors.primary : colors.textMuted }]}>Subir archivo</Text>
              </TouchableOpacity>
            </View>
            {uploadMode === 'photo' && (
              (form.type === 'drivers_license' || form.type === 'technical_review' || form.type === 'padron') ? (
                <View style={{ gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setPhotoSide('front'); showImageOptions('front'); }}>
                    {form.fileUrl && !form.fileUrl?.startsWith('data:application/pdf') ? (
                      <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                          <Ionicons name="camera-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{form.type === 'technical_review' ? 'Revisión Técnica' : t('frontPhoto')}</Text>
                        <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => showImageOptions('back')}>
                    {form.fileUrlBack ? (
                      <Image source={{ uri: form.fileUrlBack }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                          <Ionicons name="camera-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{form.type === 'technical_review' ? 'Emisión de Gases' : t('backPhoto')}</Text>
                        <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setPhotoSide('front'); showImageOptions('front'); }}>
                  {form.fileUrl && !form.fileUrl?.startsWith('data:application/pdf') ? (
                    <Image source={{ uri: form.fileUrl }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                      <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="camera-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>{t('tapToAddPhoto')}</Text>
                      <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>Toca para capturar</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            )}
            {/* File picker */}
            {uploadMode === 'file' && (
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary, marginBottom: 12 }]} onPress={pickFile}>
                {pickedFile ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                    <Ionicons name="document-text" size={28} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{pickedFile.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{pickedFile.mimeType === 'application/pdf' ? 'PDF' : 'Imagen'}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  </View>
                ) : (
                  <View style={[styles.photoPlaceholder, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                    <View style={[styles.photoPlaceholderIconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="document-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.photoPlaceholderTitle, { color: colors.text }]}>Toca para seleccionar archivo</Text>
                    <Text style={[styles.photoPlaceholderSubtitle, { color: colors.textMuted }]}>PDF o imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            {errors.fileUrl ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.fileUrl}</Text> : null}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{isTitleEditable ? t('title') : 'Tipo de documento'}</Text>
              {isTitleEditable ? (
                <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                  <TextInput style={[styles.fieldInput, { color: colors.text }]} placeholder={t('title')} placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(text) => setForm((p) => ({ ...p, title: text }))} />
                </View>
              ) : (
                <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, color: colors.text }}>{form.title}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('issueDate')}</Text>
                <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowIssueDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.fieldInputText, { color: form.issueDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.issueDate ? formatDateEs(form.issueDate) : 'Selecciona'}</Text>
                </TouchableOpacity>
              </View>
              {form.type !== 'padron' && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('expiryDate')}</Text>
                  <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.fieldInputText, { color: form.expiryDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.expiryDate ? formatDateEs(form.expiryDate) : 'Selecciona'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {form.type !== 'padron' && errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger, marginTop: 6 }]}>{errors.expiryDate}</Text> : null}
            {showIssueDatePicker && (
              <DateTimePicker value={form.issueDate ? parseLocalDate(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { setForm((p) => ({ ...p, issueDate: toLocalDateStr(date) })); if (form.expiryDate && form.expiryDate >= toLocalDateStr(date)) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
            )}
            {form.type !== 'padron' && showExpiryDatePicker && (
              <DateTimePicker value={form.expiryDate ? parseLocalDate(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { setForm((p) => ({ ...p, expiryDate: toLocalDateStr(date) })); if (form.issueDate && toLocalDateStr(date) < form.issueDate) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
            )}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={modalSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primaryText} /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="save-outline" size={18} color={colors.primaryText} />
                  <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>{t('save')}</Text>
                </View>
              )}
            </TouchableOpacity>
            {showPhotoModal && (
              <View style={styles.photoOverlay}>
                <TouchableOpacity style={styles.photoOverlayBg} onPress={() => setShowPhotoModal(false)} activeOpacity={1} />
                <View style={[styles.photoOverlayContent, { backgroundColor: colors.surface }]}>
                  <TouchableOpacity style={styles.photoOverlayClose} onPress={() => setShowPhotoModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                  <View style={[styles.photoOverlayIconCircle, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="camera" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}><Ionicons name="camera" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>Abrir cámara</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.text} /><Text style={[styles.photoOverlayBtnText, { color: colors.text }]}>Elegir de galería</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />

      {/* File name prompt for bulk PDF download */}
      <Modal visible={showFileNamePrompt} animationType="fade" transparent onRequestClose={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
              <View style={[styles.docPortarModal, { backgroundColor: colors.surface, alignItems: 'center', paddingTop: 28, position: 'relative' }]}>
                <TouchableOpacity style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="download-outline" size={28} color={colors.success} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16, textAlign: 'center' }}>Descargar documentos</Text>
                <View style={{ width: '100%' }}>
                  <TextInput
                    style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder, color: colors.text, fontSize: 16, padding: 12, borderRadius: 10 }]}
                    placeholder="documentos.pdf"
                    placeholderTextColor={colors.textMuted}
                    value={downloadFileName}
                    onChangeText={setDownloadFileName}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.surfaceSecondary, flex: 1, marginTop: 0 }]} onPress={() => { setShowFileNamePrompt(false); setDownloadFileName(''); }}>
                      <Text style={[styles.saveBtnText, { color: colors.text }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0 }]} onPress={() => doDownloadAll(downloadFileName || 'documentos.pdf')}>
                      <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>Descargar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <OcrReviewModal
        visible={showOcrReview}
        documentType={ocrDocumentType}
        loading={ocrLoading}
        fields={ocrFields}
        error={ocrError}
        confidence={ocrConfidence}
        onFieldChange={handleOcrFieldChange}
        onSave={handleOcrSave}
        onCancel={() => setShowOcrReview(false)}
        onRetry={handleOcrRetry}
      />

      {/* Municipality picker modal — shared by permit form and license appointment */}
      <Modal visible={showMuniPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowMuniPicker(false); setMuniResults([]); }}>
          <View style={[styles.docPortarModal, { backgroundColor: colors.surface, maxWidth: 400, maxHeight: '60%' }]}> 
            <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
              <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>{muniPickerMode === 'license' ? 'Agendar hora — Buscar comuna' : 'Buscar comuna'}</Text>
              <TouchableOpacity onPress={() => { setShowMuniPicker(false); setMuniResults([]); }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 10, fontSize: 15, marginVertical: 12, backgroundColor: colors.inputBg || colors.surfaceSecondary, color: colors.text }}
              placeholder="Escribe el nombre de la comuna..."
              placeholderTextColor={colors.textMuted}
              value={muniSearch}
              onChangeText={searchMunis}
              autoFocus
            />
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {muniResults.length === 0 && muniSearch.length >= 2 ? (
                <Text style={{ padding: 16, color: colors.textMuted, textAlign: 'center' }}>Sin resultados</Text>
              ) : muniSearch.length < 2 ? (
                <Text style={{ padding: 16, color: colors.textMuted, textAlign: 'center' }}>Escribí al menos 2 caracteres</Text>
              ) : (
                muniResults.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={{ paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => selectMuni(m)}
                  >
                    <Text style={{ color: colors.text, fontWeight: '500' }}>{m.commune}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.region}{m.paymentUrl ? ' · Portal disponible' : ''}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ImageCropModal
        visible={showCropModal}
        imageUri={cropImageUri}
        onConfirm={handleCropConfirm}
        onCancel={() => setShowCropModal(false)}
      />

      {/* Modal: Licencia presencial */}
      <Modal visible={showLicensePresencialModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLicensePresencialModal(false)}>
          <View style={[styles.docPortarModal, { backgroundColor: colors.surface, alignItems: 'center', paddingTop: 28 }]}>
            <TouchableOpacity style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} onPress={() => setShowLicensePresencialModal(false)}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Ionicons name="business-outline" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12, textAlign: 'center' }}>Trámite presencial</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 }}>
              Para renovar tu licencia de conducir en esta comuna debes ir de manera presencial a la Dirección de Tránsito. Consultá los horarios de atención en el sitio web de tu municipalidad.
            </Text>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 20, width: '100%' }]}
              onPress={() => setShowLicensePresencialModal(false)}
            >
              <Text style={[styles.submitBtnText, { color: '#fff' }]}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  // Dates card (Emitido / Vence) — two columns side by side
  datesCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 12,
  },
  datesCardCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  datesCardDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  datesCardLabel: {
    fontSize: 11,
    marginBottom: 1,
  },
  datesCardValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Actions card (Descargar / Editar / Eliminar) — outline buttons in a row
  actionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  actionsCardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionsCardBtnText: {
    fontSize: 11,
    fontWeight: '600',
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
  card: {
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 4,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '600', flex: 1, marginBottom: 5 },
  cardStatus: { fontSize: 12, fontWeight: '500' },
  cardDate: { fontSize: 11, marginTop: 2 },
  // Detail content shared by single-doc and multi-doc inline detail
  detailContent: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 6 },
  statusBadgeOverlay: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  statusBadgeOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detailDate: { fontSize: 12, marginTop: 8 },
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  // Upload mode segmented control (Foto / Subir archivo)
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    marginTop: -30
  },
  segmentedOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentedOptionActive: {
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  photoBtn: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 5,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  photoPlaceholderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoPlaceholderTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  photoPlaceholderSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  photoPlaceholderIcon: { fontSize: 32, marginBottom: 6 },
  photoPlaceholderText: { fontSize: 14 },
  // Form fields with floating uppercase labels + inline icon
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
    marginTop: 8
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  fieldInputText: {
    fontSize: 13,
    flex: 1,
  },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  errorText: { fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { borderRadius: 30, padding: 14, alignItems: 'center', marginTop: 25 },
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
  photoOverlayIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoOverlayTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
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
    borderRadius: 30,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },

  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  payHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
  payHint2: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  categoryChip: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  modalTopRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  modalLogoContainer: {
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  modalLogo: {
    width: 300,
    height: 150,
    marginTop: -30
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: -60,
    marginBottom: 30
  },
});