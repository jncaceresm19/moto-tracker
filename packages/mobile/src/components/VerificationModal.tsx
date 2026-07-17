import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { verifyMotorcycle, VerifyResult } from '../services/verificationApi';

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

type Step = 'method' | 'padron' | 'carnet' | 'review' | 'result';

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
  const [step, setStep] = useState<Step>(isClaveUnica || isIdentityVerified ? 'padron' : 'method');
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

  const resetState = () => {
    setStep(isClaveUnica || isIdentityVerified ? 'padron' : 'method');
    setLoading(false);
    setResult(null);
    setError(null);
    setPadronUri(null);
    setCarnetFrontUri(null);
    setCarnetBackUri(null);
    setSelfieUri(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const pickImage = (onResult: (uri: string) => void) => {
    setActivePhotoField(() => onResult);
    setShowPhotoModal(true);
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
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      activePhotoField?.(manipulated.uri);
    }
  };

  const handlePickGallery = async () => {
    setShowPhotoModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      activePhotoField?.(manipulated.uri);
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
        selfieUri || undefined
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

  // Simple corner-guide illustration shown inside the empty photo dropzone,
  // so the user knows how to frame the document before shooting.
  // Built with plain Views (no extra dependency like react-native-svg needed).
  const FrameGuide = () => (
    <View style={[styles.frameGuideBox, { borderColor: colors.border }]}>
      <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: '65%' }]} />
      <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: '50%' }]} />
      <View style={[styles.frameGuideLine, { backgroundColor: colors.border, width: '58%' }]} />
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'method':
        // Skip method selection, go directly to padrón
        setStep('padron');
        return null;

      case 'padron':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.ink }]}>{t('verifyMotoPadron')}</Text>

            <View style={[styles.tipBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={[styles.infoCardText, { color: colors.text }]}>
                La foto del padrón debe mostrar claramente la patente y el RUT del titular.
              </Text>
            </View>

            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Asegúrate de que se vea completo y sin reflejos.</Text>

            <View style={[styles.photoFrame, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.photoButton, { borderColor: colors.border }]}
                onPress={() => pickImage(setPadronUri)}
                activeOpacity={0.85}
              >
                {padronUri ? (
                  <Image source={{ uri: padronUri }} style={styles.photoPreview} />
                ) : (
                  <FrameGuide />
                )}
              </TouchableOpacity>
              {!padronUri && (
                <Text style={[styles.photoFrameHint, { color: colors.textMuted }]}>
                  Encuadra el documento dentro del recuadro
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

            <View style={[styles.tipBanner, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="bulb-outline" size={16} color={colors.primary} />
              <Text style={[styles.tipBannerText, { color: colors.primary }]}>
                Usa buena luz y evita sombras sobre el texto.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: padronUri ? colors.primary : colors.border }]}
              onPress={() => handleVerify()}
              disabled={!padronUri || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>Verificar</Text>
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
            >
              {padronUri ? (
                <Image source={{ uri: padronUri }} style={styles.photoPreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, {
                backgroundColor: carnetFrontUri && carnetBackUri && selfieUri && padronUri ? colors.primary : colors.border
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

            {result?.warnings && result.warnings.length > 0 && (
              <View style={[styles.warningsContainer, { backgroundColor: colors.amberBg }]}>
                {result.warnings.map((warning, i) => (
                  <Text key={i} style={[styles.warningText, { color: colors.ink }]}>⚠️ {warning}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={handleClose}>
              <Text style={styles.nextButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('verifyMotoTitle')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          {renderStep()}
        </View>
      </KeyboardAvoidingView>

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  stepContainer: { flex: 1, padding: 20 },
  stepLabel: { fontSize: 12, marginBottom: 4 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, marginBottom: 20 },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  methodButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
  methodButtonSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  // --- New "guided" photo frame (padrón step) ---
  photoFrame: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  photoButton: {
    height: 150,
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
  frameGuideBox: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
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
    marginBottom: 10,
  },
  takePhotoButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  tipBannerText: { fontSize: 12, flex: 1 },
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
  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoCardText: { fontSize: 13, flex: 1, lineHeight: 18 },
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