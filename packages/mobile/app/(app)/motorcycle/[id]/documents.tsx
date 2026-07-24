import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { listDocuments, createDocument, updateDocument, deleteDocument, Document, getPermitPaymentUrl, getPermitAppointmentUrl, listMunicipalities, setPermitMunicipality, Municipality } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { useAuth } from '../../../../src/auth-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';
import { extractDocumentData, extractPdfData, OcrResult } from '../../../../src/services/ocrService';
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
  // Municipality picker for create/edit form
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [formMunicipalitySearch, setFormMunicipalitySearch] = useState('');
  const [formMunicipalities, setFormMunicipalities] = useState<Municipality[]>([]);
  const [showFormMunicipalityPicker, setShowFormMunicipalityPicker] = useState(false);
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUri, setCropImageUri] = useState('');
  const [pendingOcrSide, setPendingOcrSide] = useState<'front' | 'back'>('front');
  const [cropMode, setCropMode] = useState<'ocr' | 'photo'>('ocr');

  // Reset internal state when screen regains focus (e.g. after tab switch)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setViewing(null);
      setSelectedType(null);
      setEditing(null);
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
    setShowPhotoModal(false);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert(t('permissionNeeded'), t('permissionMessage'), [{ text: 'OK' }], 'lock-closed', colors.accent);
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1.0, allowsEditing: false });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 2400 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) return;
      // Show crop modal for all photo types
      setPendingOcrSide(photoSide);
      setCropImageUri(manipulated.uri);
      setCropMode('photo');
      setShowCropModal(true);
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
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setForm((p) => ({ ...p, fileUrl: base64 }));
        setErrors((p) => ({ ...p, fileUrl: '' }));

        // Auto-OCR for PDFs on OCR-supported types
        const docType = selectedType || form.type;
        if (file.mimeType === 'application/pdf' && OCR_TYPES.includes(docType)) {
          await handlePdfOcr(base64, docType);
        }
      };
      reader.readAsDataURL(blob);
    }
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
      // Auto-assign municipality for circulation permits
      if (form.type === 'circulation_permit' && selectedMunicipality) {
        try { await setPermitMunicipality(id!, selectedMunicipality.id); } catch { /* ignore */ }
      }
      setDocs((prev) => [created, ...prev]);
      setShowCreate(false);
      resetForm();
      setSelectedMunicipality(null);
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

  // ── OCR Handlers ──────────────────────────────────────────────────────────
  // Process OCR with a base64 image
  const processOcr = async (dataUri: string, docType: string, ocrSide: 'front' | 'back') => {
    setOcrDocumentType(docType);
    setOcrLoading(true);
    setOcrError(undefined);
    setShowOcrReview(true);
    setOcrPhotoUri(dataUri);

    try {
      const ocrResult = await extractDocumentData(dataUri, docType);

      if (ocrResult.error) {
        setOcrError(ocrResult.error);
        setOcrConfidence((ocrResult as any).confidence);
      } else {
        setOcrConfidence((ocrResult as any).confidence);
        const rawResult: Record<string, string | undefined> = {};
        let fields = buildOcrFields(docType, ocrResult as Record<string, string | undefined>);

        // Drivers license: expiry = issueDate + 6 years, day = user's birth day
        if (docType === 'drivers_license' && (ocrResult as any).issueDate && user?.birthDate) {
          const birthDay = parseLocalDate(user.birthDate).getDate();
          const issue = parseLocalDate((ocrResult as any).issueDate);
          const expiry = new Date(issue.getFullYear() + 6, issue.getMonth(), birthDay);
          const iso = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
          (ocrResult as any).expiryDate = iso;
          fields = buildOcrFields(docType, ocrResult as Record<string, string | undefined>);
        }

        fields.forEach(f => { rawResult[f.key] = f.value; });
        setOcrRawResult(rawResult);
        setOcrFields(fields);
      }
    } catch (err) {
      console.error('[OCR] Scan error:', err);
      setOcrError('Error al conectar con el servicio de OCR. Intenta de nuevo.');
      setOcrConfidence(0);
    } finally {
      setOcrLoading(false);
    }
  };

  // Handle crop confirm: run OCR or just store the image
  const handleCropConfirm = async (base64: string) => {
    setShowCropModal(false);
    const dataUri = `data:image/jpeg;base64,${base64}`;

    if (cropMode === 'ocr') {
      const docType = selectedType || form.type;
      await processOcr(dataUri, docType, pendingOcrSide);
    } else {
      // Just store the image (non-OCR flow)
      if (pendingOcrSide === 'back') {
        setForm((p) => ({ ...p, fileUrlBack: dataUri }));
      } else {
        setForm((p) => ({ ...p, fileUrl: dataUri }));
        setErrors((p) => ({ ...p, fileUrl: '' }));
      }
    }
  };

  // Open camera for OCR scan
  const handleScanDocument = async () => {
    setShowPhotoModal(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert(t('permissionNeeded'), t('permissionMessage'), [{ text: 'OK' }], 'lock-closed', colors.accent);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulated.base64) return;

    const docType = selectedType || form.type;
    const isPadron = docType === 'padron';

    // For padron: OCR runs on the BACK photo (where issue date is)
    // For all other 2-photo docs: OCR runs only on the FRONT
    const runOcr = isPadron ? photoSide === 'back' : photoSide === 'front';

    // Use photoSide (the actual side tapped) — NOT a calculated ocrSide
    setPendingOcrSide(photoSide);
    setCropImageUri(manipulated.uri);
    setCropMode(runOcr ? 'ocr' : 'photo');
    setShowCropModal(true);
  };

  // Auto-scan: open camera directly, then crop → OCR
  const handleAutoScan = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert(t('permissionNeeded'), t('permissionMessage'), [{ text: 'OK' }], 'lock-closed', colors.accent);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulated.base64) return;

    const docType = selectedType || form.type;
    const isPadron = docType === 'padron';

    // Auto-scan from front placeholder:
    // For padron: save front photo only (no OCR — issue date is on back)
    // For others: run OCR on front
    setPendingOcrSide('front');
    setCropImageUri(manipulated.uri);
    setCropMode(isPadron ? 'photo' : 'ocr');
    setShowCropModal(true);
  };

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
          const birthDay = parseLocalDate(user.birthDate).getDate();
          const issue = parseLocalDate((ocrResult as any).issueDate);
          const expiry = new Date(issue.getFullYear() + 6, issue.getMonth(), birthDay);
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

    // Store comuna and auto-assign municipality
    if (ocrRawResult.comuna) {
      setOcrComuna(ocrRawResult.comuna);
      if (docType === 'circulation_permit') {
        try {
          const results = await listMunicipalities(ocrRawResult.comuna);
          const match = results.find(m => m.commune.toLowerCase() === ocrRawResult.comuna!.toLowerCase());
          if (match) setSelectedMunicipality(match);
        } catch { /* ignore */ }
      }
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
    handleScanDocument();
  };

  // ── Municipality Actions ──────────────────────────────────────────────────
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalitiesList] = useState<Municipality[]>([]);
  const [municipalityLoading, setMunicipalityLoading] = useState(false);

  const searchMunicipalities = async (query: string) => {
    setMunicipalityLoading(true);
    try {
      const results = await listMunicipalities(query);
      setMunicipalitiesList(results);
    } catch { /* ignore */ }
    setMunicipalityLoading(false);
  };

  const searchFormMunicipalities = async (query: string) => {
    try {
      const results = await listMunicipalities(query);
      setFormMunicipalities(results);
    } catch { /* ignore */ }
  };

  const handlePayPermit = async () => {
    if (!id) return;
    try {
      const result = await getPermitPaymentUrl(id);
      if (result?.url) {
        Linking.openURL(result.url);
      } else {
        setShowMunicipalityPicker(true);
        searchMunicipalities('');
      }
    } catch {
      showAlert('Error', 'No se pudo obtener la URL de pago', [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const handleFindTechPlants = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=plantas+de+revisión+técnica+cercanas`;
    Linking.openURL(url);
  };

  const handleGoToMunicipality = async () => {
    if (!id) return;
    try {
      const result = await getPermitAppointmentUrl(id);
      if (result?.url) {
        Linking.openURL(result.url);
      } else {
        setShowMunicipalityPicker(true);
        searchMunicipalities('');
      }
    } catch {
      showAlert('Error', 'No se pudo obtener la URL de agendar', [{ text: 'OK' }], 'close-circle', colors.danger);
    }
  };

  const handleSelectMunicipality = async (municipality: Municipality) => {
    if (!id) return;
    try {
      await setPermitMunicipality(id, municipality.id);
      setShowMunicipalityPicker(false);
      if (municipality.paymentUrl) {
        Linking.openURL(municipality.paymentUrl);
      }
    } catch {
      showAlert('Error', 'No se pudo guardar la municipalidad', [{ text: 'OK' }], 'close-circle', colors.danger);
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
      // Save municipality for circulation permits
      if (form.type === 'circulation_permit' && selectedMunicipality) {
        try { await setPermitMunicipality(id!, selectedMunicipality.id); } catch { /* ignore */ }
      }
      setDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setEditing(null);
      setSelectedMunicipality(null);
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

  const generatePDF = async (doc: Document) => {
    if (!doc.fileUrl) return null;
    const issuedStr = doc.issueDate ? parseLocalDate(doc.issueDate).toLocaleDateString() : '—';
    const expiresStr = doc.expiryDate ? parseLocalDate(doc.expiryDate).toLocaleDateString() : '—';
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
        .title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
        .title-en { font-size: 13px; color: #888; margin-bottom: 4px; }
        .type { font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .dates { font-size: 13px; color: #666; margin: 10px 0; text-align: center; }
        .img-container { text-align: center; }
        img { max-width: 100%; max-height: 85vh; }
      </style></head>
      <body>
        <div class="header">
          <div class="title">${doc.title}</div>
          <div class="title-en">${TYPE_ENGLISH[doc.type] || doc.type.replace(/_/g, ' ')}</div>
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

  const handleDownloadAll = async () => {
    const docsWithFiles = docs.filter((d) => d.fileUrl);
    if (docsWithFiles.length === 0) {
      showAlert(t('noDocuments'), t('noPhotosSub'), [{ text: 'OK' }], 'document-outline', colors.textMuted);
      return;
    }
    try {
      const issuedStr = (d: Document) => d.issueDate ? parseLocalDate(d.issueDate).toLocaleDateString() : '—';
      const expiresStr = (d: Document) => d.expiryDate ? parseLocalDate(d.expiryDate).toLocaleDateString() : '—';
      const docHtml = docsWithFiles.map((d) => `
        <div style="page-break-before: always; padding-top: 20px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">${d.title}</div>
            <div style="font-size: 13px; color: #888; margin-bottom: 4px;">${TYPE_ENGLISH[d.type] || d.type.replace(/_/g, ' ')}</div>
            <div style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px;">${d.type.replace(/_/g, ' ')}</div>
          </div>
          <div style="font-size: 13px; color: #666; margin: 10px 0; text-align: center;">Emitido: ${issuedStr(d)} | Vence: ${expiresStr(d)}</div>
          <div style="text-align: center;">
            <img src="${d.fileUrl}" style="max-width: 100%; max-height: 85vh;" />
          </div>
          ${d.fileUrlBack ? `<div style="page-break-before: always; text-align: center; padding-top: 20px;"><div style="font-size: 14px; color: #666; margin-bottom: 10px;">Reverso</div><img src="${d.fileUrlBack}" style="max-width: 100%; max-height: 85vh;" /></div>` : ''}
        </div>
      `).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body { margin: 0; padding: 20px; font-family: -apple-system, sans-serif; color: #333; } img { max-width: 100%; max-height: 85vh; }</style></head><body>${docHtml}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri);
    } catch (e: any) {
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', colors.danger);
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
    const photos = filteredDocs.filter((d) => d.fileUrl);
    if (photos.length === 0) {
      showAlert(t('noPhotos'), t('noPhotosSub'), [{ text: 'OK' }], 'information-circle', colors.primary);
      return;
    }

    const pages = photos.map((doc) => {
      const issuedStr = doc.issueDate ? parseLocalDate(doc.issueDate).toLocaleDateString() : '—';
      const expiresStr = doc.expiryDate ? parseLocalDate(doc.expiryDate).toLocaleDateString() : '—';
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
  const closeModal = () => { setShowCreate(false); setEditing(null); setUploadMode('photo'); setPickedFile(null); };

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

            {/* Edit + Delete buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <View>
                {doc.issueDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 0 }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.success} />
                    <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 0 }]}>
                      {t('issued')}: {formatDateEs(doc.issueDate)}
                    </Text>
                  </View>
                )}
                {doc.expiryDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.danger} />
                    <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 0 }]}>
                      {t('expires')}: {formatDateEs(doc.expiryDate)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => handleSaveAsPDF(doc)} style={[styles.iconActionBtn, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
                  <Ionicons name="arrow-down" size={18} color={colors.success} />
                </TouchableOpacity>
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
                <Text style={[styles.payHint, { color: colors.textMuted }]}>Redirige al portal de pago de tu municipalidad</Text>
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
                  onPress={handleGoToMunicipality}>
                  <Ionicons name="map-outline" size={20} color="#fff" />
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
                    <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={OCR_TYPES.includes(form.type) ? () => { setPhotoSide('front'); handleAutoScan(); } : () => showImageOptions('front')}>
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
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={OCR_TYPES.includes(form.type) ? () => { setPhotoSide('front'); handleAutoScan(); } : () => showImageOptions('front')}>
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
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('expiryDate')}</Text>
                  <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.fieldInputText, { color: form.expiryDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.expiryDate ? formatDateEs(form.expiryDate) : 'Selecciona'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger, marginTop: 6 }]}>{errors.expiryDate}</Text> : null}
              {showIssueDatePicker && (
                <DateTimePicker value={form.issueDate ? new Date(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, issueDate: iso })); if (form.expiryDate && new Date(form.expiryDate) >= date) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              {showExpiryDatePicker && (
                <DateTimePicker value={form.expiryDate ? new Date(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, expiryDate: iso })); if (form.issueDate && date < new Date(form.issueDate)) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
              )}
              {form.type === 'circulation_permit' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Municipalidad</Text>
                  <TouchableOpacity
                    style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]}
                    onPress={() => { setShowFormMunicipalityPicker(true); searchFormMunicipalities(''); }}>
                    <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.fieldInputText, { color: selectedMunicipality ? colors.text : colors.textMuted }]} numberOfLines={1}>
                      {selectedMunicipality ? selectedMunicipality.commune : 'Seleccionar municipalidad'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
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
                    <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('chooseFromGallery')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.success }]} onPress={handleScanDocument}><Ionicons name="scan-outline" size={20} color="#fff" /><Text style={[styles.photoOverlayBtnText, { color: '#fff' }]}>Escanear documento</Text></TouchableOpacity>
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

        <ImageCropModal
          visible={showCropModal}
          imageUri={cropImageUri}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropModal(false)}
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
                          onPress={() => Linking.openURL('https://www.registrocivil.cl')}>
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
                        <TouchableOpacity
                          style={[styles.submitBtn, { backgroundColor: colors.success, marginTop: 10 }]}
                          activeOpacity={0.8}
                          onPress={() => Linking.openURL('https://www.agendarhoras.cl')}>
                          <Ionicons name="calendar-outline" size={18} color="#fff" />
                          <Text style={[styles.submitBtnText, { color: '#fff', fontSize: 14 }]}>Agendar hora</Text>
                        </TouchableOpacity>
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
                      onPress={() => Linking.openURL('https://www.registrocivil.cl')}>
                      <Ionicons name="open-outline" size={18} color="#fff" />
                      <Text style={[styles.submitBtnText, { color: '#fff', fontSize: 14 }]}>Ir a Registro Civil</Text>
                    </TouchableOpacity>
                  </ScrollView>
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

          {/* Edit + Delete — same layout as single-doc */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <View>
              {viewing.issueDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 0 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.success} />
                  <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 0 }]}>
                    {t('issued')}: {formatDateEs(viewing.issueDate)}
                  </Text>
                </View>
              )}
              {viewing.expiryDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.danger} />
                  <Text style={[styles.detailDate, { color: colors.textSecondary, marginTop: 0 }]}>
                    {t('expires')}: {formatDateEs(viewing.expiryDate)}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => handleSaveAsPDF(viewing)} style={[styles.iconActionBtn, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
                <Ionicons name="arrow-down" size={18} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(viewing)} style={[styles.iconActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(viewing)} style={[styles.iconActionBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                <Ionicons name="trash" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Download + Share — same as single-doc */}
          {viewing.fileUrl && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flex: 1 }]}
                onPress={() => handleSaveAsPDF(viewing)}
              >
                <Ionicons name="download-outline" size={18} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>{t('download')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flex: 1 }]}
                onPress={() => handleShare(viewing)}
              >
                <Ionicons name="share-outline" size={18} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>↗ {t('share')}</Text>
              </TouchableOpacity>
            </View>
          )}
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
                      {t('expires')}: {formatDateEs(item.expiryDate)}
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
              onPress={() => Linking.openURL('https://www.registrocivil.cl/consultas/multas')}>
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
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={OCR_TYPES.includes(form.type) ? () => { setPhotoSide('front'); handleAutoScan(); } : () => showImageOptions('front')}>
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
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={OCR_TYPES.includes(form.type) ? () => { setPhotoSide('front'); handleAutoScan(); } : () => showImageOptions('front')}>
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('expiryDate')}</Text>
                <TouchableOpacity style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]} onPress={() => setShowExpiryDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.fieldInputText, { color: form.expiryDate ? colors.text : colors.textMuted }]} numberOfLines={1}>{form.expiryDate ? formatDateEs(form.expiryDate) : 'Selecciona'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {errors.expiryDate ? <Text style={[styles.errorText, { color: colors.danger, marginTop: 6 }]}>{errors.expiryDate}</Text> : null}
            {showIssueDatePicker && (
              <DateTimePicker value={form.issueDate ? new Date(form.issueDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowIssueDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, issueDate: iso })); if (form.expiryDate && new Date(form.expiryDate) >= date) setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
            )}
            {showExpiryDatePicker && (
              <DateTimePicker value={form.expiryDate ? new Date(form.expiryDate) : new Date()} mode="date" display="default" onChange={(event: DateTimePickerEvent, date?: Date) => { setShowExpiryDatePicker(false); if (event.type === 'set' && date) { const iso = date.toISOString().split('T')[0]; setForm((p) => ({ ...p, expiryDate: iso })); if (form.issueDate && date < new Date(form.issueDate)) setErrors((p) => ({ ...p, expiryDate: t('expiryBeforeIssue') })); else setErrors((p) => ({ ...p, expiryDate: '' })); } }} />
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
                  <Text style={[styles.photoOverlayTitle, { color: colors.text }]}>{t('changePhoto')}</Text>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage(false)}><Ionicons name="images" size={20} color={colors.primaryText} /><Text style={[styles.photoOverlayBtnText, { color: colors.primaryText }]}>{t('chooseFromGallery')}</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.photoOverlayBtn, { backgroundColor: colors.success }]} onPress={handleScanDocument}><Ionicons name="scan-outline" size={20} color="#fff" /><Text style={[styles.photoOverlayBtnText, { color: '#fff' }]}>Escanear documento</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ImageCropModal
        visible={showCropModal}
        imageUri={cropImageUri}
        onConfirm={handleCropConfirm}
        onCancel={() => setShowCropModal(false)}
      />

      {/* Form Municipality Picker Modal */}
      <Modal visible={showFormMunicipalityPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFormMunicipalityPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.docPortarModal, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="business-outline" size={20} color={colors.brandBlue} />
              <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Seleccionar municipalidad</Text>
              <TouchableOpacity onPress={() => setShowFormMunicipalityPicker(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 12, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              placeholder="Buscar comuna..."
              placeholderTextColor={colors.textMuted}
              value={formMunicipalitySearch}
              onChangeText={(text) => { setFormMunicipalitySearch(text); searchFormMunicipalities(text); }}
            />
            <FlatList
              data={formMunicipalities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}
                  onPress={() => { setSelectedMunicipality(item); setShowFormMunicipalityPicker(false); setFormMunicipalitySearch(''); }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.commune}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>No se encontraron municipalidades</Text>}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Municipality Picker Modal */}
      <Modal visible={showMunicipalityPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowMunicipalityPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.docPortarModal, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            <View style={[styles.docPortarModalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="business-outline" size={20} color={colors.brandBlue} />
              <Text style={[styles.docPortarModalTitle, { color: colors.text }]}>Seleccionar municipalidad</Text>
              <TouchableOpacity onPress={() => setShowMunicipalityPicker(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 12, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              placeholder="Buscar comuna..."
              placeholderTextColor={colors.textMuted}
              value={municipalitySearch}
              onChangeText={(text) => { setMunicipalitySearch(text); searchMunicipalities(text); }}
            />
            {municipalityLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.brandBlue} />
            ) : (
              <FlatList
                data={municipalities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}
                    onPress={() => handleSelectMunicipality(item)}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{item.commune}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.name}</Text>
                    {item.paymentUrl ? (
                      <Text style={{ color: colors.success, fontSize: 11, marginTop: 2 }}>✓ Portal de pago disponible</Text>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Sin portal de pago verificado</Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>No se encontraron municipalidades</Text>}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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