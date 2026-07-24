import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { verifyMotorcycle, VerifyResult } from '../services/verificationApi';
import { extractDocumentData } from '../services/ocrService';
import { ImageCropModal } from './ImageCropModal';

interface VerificationModalProps {
  visible: boolean;
  onClose: () => void;
  motorcycleId: string;
  motorcycleName: string;
  licensePlate: string;
  isClaveUnica: boolean;
  isIdentityVerified: boolean;
  onVerified: (result: VerifyResult) => void;
}

type Step = 'padron' | 'padron-back' | 'carnet' | 'review' | 'result';

export function VerificationModal({
  visible,
  onClose,
  motorcycleId,
  motorcycleName,
  licensePlate,
  isClaveUnica,
  isIdentityVerified,
  onVerified,
}: VerificationModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  // 'method' step was removed: every flow starts directly at 'padron'.
  const [step, setStep] = useState<Step>('padron');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Photo states
  const [padronUri, setPadronUri] = useState<string | null>(null);
  const [carnetFrontUri, setCarnetFrontUri] = useState<string | null>(null);
  const [carnetBackUri, setCarnetBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activePhotoField, setActivePhotoField] = useState<((uri: string) => void) | null>(null);

  // Padrón back OCR
  const [padronBackUri, setPadronBackUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractedPatente, setExtractedPatente] = useState('');
  const [extractedRut, setExtractedRut] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUri, setCropImageUri] = useState('');

  const resetState = () => {
    setStep('padron');
    setLoading(false);
    setResult(null);
    setError(null);
    setPadronUri(null);
    setPadronBackUri(null);
    setCarnetFrontUri(null);
    setCarnetBackUri(null);
    setSelfieUri(null);
    setExtractedPatente('');
    setExtractedRut('');
    setOcrError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const pickImage = (onResult: (uri: string) => void) => {
    setActivePhotoField(() => onResult);
    setShowPhotoModal(true);
  };

  // Shared post-pick processing so camera and gallery don't duplicate the
  // resize/compress logic.
  // OCR necesita al menos 2400px de ancho para que Tesseract pueda leer texto
  // pequeño como fechas en licencias de conducir.
  const processAndApply = async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    activePhotoField?.(manipulated.uri);
  };

  const handlePickCamera = async () => {
    setShowPhotoModal(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      await processAndApply(result.assets[0].uri);
    }
  };

  const handlePickGallery = async () => {
    setShowPhotoModal(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await processAndApply(result.assets[0].uri);
    }
  };

  // ── Padrón back scan with OCR ────────────────────────────────────────────
  const scanPadronBack = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({ quality: 1.0, allowsEditing: false });
    if (photo.canceled || !photo.assets[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      photo.assets[0].uri,
      [{ resize: { width: 2400 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulated.base64) return;

    setCropImageUri(manipulated.uri);
    setShowCropModal(true);
  };

  const handlePadronBackCropConfirm = async (base64: string) => {
    setShowCropModal(false);
    setOcrLoading(true);
    setOcrError('');

    try {
      const dataUri = `data:image/jpeg;base64,${base64}`;
      setPadronBackUri(dataUri);
      const result = await extractDocumentData(dataUri, 'padron');
      if (result.error) {
        setOcrError(result.error);
      } else {
        setExtractedPatente(result.patente || '');
        setExtractedRut(result.rut || '');
      }
    } catch (e: any) {
      setOcrError(e?.message || 'Error al leer el dorso');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!padronUri) return;

    setLoading(true);
    setError(null);

    try {
      // In production, upload images first and get URLs
      // For now, pass URIs directly (backend needs upload endpoint)
      const result = await verifyMotorcycle(
        motorcycleId,
        padronUri,
        carnetFrontUri || undefined,
        carnetBackUri || undefined,
        selfieUri || undefined,
        padronBackUri || undefined,
        extractedPatente || undefined,
        extractedRut || undefined,
      );

      setResult(result.data);
      setStep('result');
      onVerified(result.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Error al verificar');
    } finally {
      setLoading(false);
    }
  };

  // Blue "scanner-style" corner brackets drawn at the 4 corners of the dropzone,
  // matching the reference mockup.
  const CornerBracket = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const cornerStyleMap: Record<string, any> = {
      tl: { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
      tr: { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
      bl: { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
      br: { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
    };
    return <View style={[styles.cornerBracket, { borderColor: colors.primary }, cornerStyleMap[position]]} />;
  };

  // Corner-guide illustration shown inside the empty photo dropzone, so the
  // user knows how to frame the document before shooting.
  const FrameGuide = () => (
    <>
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />
      <View style={styles.frameGuideBox}>
        <View style={[styles.frameGuideDoc, { borderColor: colors.border }]} />
        <View style={{ gap: 6 }}>
          <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: 46 }]} />
          <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: 46 }]} />
          <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: 32 }]} />
        </View>
      </View>
    </>
  );

  const renderStep = () => {
    switch (step) {
      case 'padron':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textSecondary }]}>{t('verifyMotoPadron')}</Text>

            {/* Single consolidated instruction: what must be visible + how to shoot it. */}
            <View style={[styles.tipBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={[styles.tipBannerText, { color: colors.primary }]}>
                La foto debe mostrar la patente y el RUT del titular, sin reflejos ni sombras.
              </Text>
            </View>

            <View style={[styles.photoFrame, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.photoButton, { borderColor: colors.border }]}
                onPress={() => pickImage(setPadronUri)}
                activeOpacity={0.85}
                accessibilityLabel="Tomar o elegir foto del padrón"
              >
                {padronUri ? (
                  <Image source={{ uri: padronUri }} style={styles.photoPreview} />
                ) : (
                  <FrameGuide />
                )}
              </TouchableOpacity>
              {!padronUri && (
                <Text style={[styles.photoFrameHint, { color: colors.textMuted }]}>
                  Encuadra el padrón dentro del recuadro
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.takePhotoButton, { backgroundColor: colors.primary }]}
              onPress={() => pickImage(setPadronUri)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.takePhotoButtonText}>{padronUri ? 'Tomar otra foto' : 'Tomar foto'}</Text>
            </TouchableOpacity>

            {/* Second banner: how to shoot it (light/shadows), distinct from the
                top banner which says what must be visible (patente/RUT). */}
            <View style={[styles.tipBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Ionicons name="bulb-outline" size={16} color={colors.primary} />
              <Text style={[styles.tipBannerText, { color: colors.primary }]}>
                Usa buena luz y evita sombras sobre el texto.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: padronUri ? colors.primary : colors.surfaceSecondary },
              ]}
              onPress={() => setStep('padron-back')}
              disabled={!padronUri}
            >
              <Text style={[styles.nextButtonText, !padronUri && { color: colors.textMuted }]}>
                Siguiente — escanear dorso
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'padron-back':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textSecondary }]}>Dorso del padrón</Text>

            <View style={[styles.tipBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={[styles.tipBannerText, { color: colors.primary }]}>
                Escanea el dorso del padrón para verificar la patente (PPU) y RUT.
              </Text>
            </View>

            {!padronBackUri ? (
              <TouchableOpacity
                style={[styles.takePhotoButton, { backgroundColor: colors.primary }]}
                onPress={scanPadronBack}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.takePhotoButtonText}>Tomar foto del dorso</Text>
              </TouchableOpacity>
            ) : (
              <>
                {ocrLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 12, fontSize: 14, color: colors.textMuted }}>
                      Leyendo datos del dorso...
                    </Text>
                  </View>
                ) : (
                  <>
                    {extractedPatente && (
                      <View style={[styles.tipBanner, { backgroundColor: colors.green + '20', borderColor: colors.green + '40' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                        <Text style={[styles.tipBannerText, { color: colors.green }]}>
                          Patente detectada: {extractedPatente}
                          {extractedRut ? ` · RUT: ${extractedRut}` : ''}
                        </Text>
                      </View>
                    )}
                    {ocrError && (
                      <View style={[styles.tipBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
                        <Ionicons name="alert-circle" size={16} color={colors.danger} />
                        <Text style={[styles.tipBannerText, { color: colors.danger }]}>
                          {ocrError}
                        </Text>
                      </View>
                    )}
                    {!extractedPatente && !ocrError && (
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16, textAlign: 'center' }}>
                        No se pudieron leer los datos. Podés seguir igual.
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.legacyPhotoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, height: 80 }]}
                      onPress={scanPadronBack}
                    >
                      {padronBackUri ? (
                        <Image source={{ uri: padronBackUri }} style={styles.photoPreview} />
                      ) : (
                        <Ionicons name="camera" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
                      Tocar para tomar otra foto
                    </Text>
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: padronBackUri ? colors.primary : colors.surfaceSecondary, marginTop: 8 },
              ]}
              onPress={() => setStep('padron')}
              disabled={false}
            >
              <Text style={[styles.nextButtonText, !padronBackUri && { color: colors.textMuted }]}>
                Volver a tomar frente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: padronBackUri ? colors.success : colors.primary },
              ]}
              onPress={() => handleVerify()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {padronBackUri ? 'Verificar con dorso' : 'Verificar sin dorso'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'carnet':
        return (
          <ScrollView style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.ink }]}>{t('verifyMotoTitle')}</Text>

            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>{t('verifyMotoCarnetFront')}</Text>
            <TouchableOpacity
              style={[styles.legacyPhotoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => pickImage(setCarnetFrontUri)}
              accessibilityLabel="Tomar o elegir foto frontal del carnet"
            >
              {carnetFrontUri ? (
                <Image source={{ uri: carnetFrontUri }} style={styles.photoPreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>{t('verifyMotoCarnetBack')}</Text>
            <TouchableOpacity
              style={[styles.legacyPhotoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => pickImage(setCarnetBackUri)}
              accessibilityLabel="Tomar o elegir foto trasera del carnet"
            >
              {carnetBackUri ? (
                <Image source={{ uri: carnetBackUri }} style={styles.photoPreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>{t('verifyMotoSelfie')}</Text>
            <TouchableOpacity
              style={[styles.legacyPhotoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => pickImage(setSelfieUri)}
              accessibilityLabel="Tomar selfie"
            >
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.photoPreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>{t('verifyMotoPadron')}</Text>
            <TouchableOpacity
              style={[styles.legacyPhotoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => pickImage(setPadronUri)}
              accessibilityLabel="Tomar o elegir foto del padrón"
            >
              {padronUri ? (
                <Image source={{ uri: padronUri }} style={styles.photoPreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, {
                backgroundColor: carnetFrontUri && carnetBackUri && selfieUri && padronUri ? colors.primary : colors.surfaceSecondary
              }]}
              onPress={() => handleVerify()}
              disabled={!carnetFrontUri || !carnetBackUri || !selfieUri || !padronUri || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>Verificar</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        );

      case 'result':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.resultIcon, { backgroundColor: result?.verificada ? colors.green + '20' : colors.danger + '20' }]}>
              <Ionicons
                name={result?.verificada ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={result?.verificada ? colors.green : colors.danger}
              />
            </View>

            <Text style={[styles.stepTitle, { color: colors.ink }]}>
              {result?.verificada ? t('verifyMotoApproved') : 'Error'}
            </Text>

            {result?.ppuMatch === true && (
              <View style={[styles.warningsContainer, { backgroundColor: colors.green + '20', marginBottom: 12 }]}>
                <Text style={[styles.warningText, { color: colors.green }]}>✅ Patente del dorso coincide con la registrada</Text>
              </View>
            )}
            {result?.ppuMatch === false && (
              <View style={[styles.warningsContainer, { backgroundColor: colors.danger + '15', marginBottom: 12 }]}>
                <Text style={[styles.warningText, { color: colors.danger }]}>⚠️ La patente del dorso no coincide con la registrada</Text>
              </View>
            )}

            {result?.warnings && result.warnings.length > 0 && (
              <View style={[styles.warningsContainer, { backgroundColor: colors.amberBg }]}>
                {result.warnings.map((warning, i) => (
                  <Text key={`${i}-${warning}`} style={[styles.warningText, { color: colors.ink }]}>⚠️ {warning}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={handleClose}>
              <Text style={styles.nextButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.modalScroll}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{t('verifyMotoTitle')}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          {renderStep()}
        </View>
      </KeyboardAvoidingView>

      {/* Crop modal for padrón back */}
      <ImageCropModal
        visible={showCropModal}
        imageUri={cropImageUri}
        onConfirm={handlePadronBackCropConfirm}
        onCancel={() => setShowCropModal(false)}
      />

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.photoModalTitle, { color: colors.text }]}>Agregar foto</Text>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={handlePickCamera}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={[styles.photoModalBtnText, { color: colors.primaryText }]}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={handlePickGallery}>
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={[styles.photoModalBtnText, { color: colors.primaryText }]}>Elegir de galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalScroll: { paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  stepContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  // --- Photo dropzone (padrón step) ---
  photoFrame: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  photoButton: {
    height: 170,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoFrameHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  photoPreview: { width: '100%', height: '100%' },
  cornerBracket: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
  frameGuideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  frameGuideDoc: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  frameGuideLine: {
    height: 3,
    borderRadius: 2,
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  takePhotoButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  tipBannerText: { fontSize: 12, flex: 1, lineHeight: 17 },
  // --- Legacy photo button style (carnet step, kept as-is) ---
  legacyPhotoButton: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  warningsContainer: { padding: 12, borderRadius: 8, marginBottom: 16 },
  warningText: { fontSize: 13, marginBottom: 4 },
  errorContainer: { padding: 12, marginHorizontal: 20, marginTop: 10, borderRadius: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  // Photo modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 8,
  },
  photoModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  photoModalBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});