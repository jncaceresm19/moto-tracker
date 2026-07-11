import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
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

  const pickImage = async (onResult: (uri: string) => void) => {
    // Show options: camera or gallery
    Alert.alert(
      'Agregar foto',
      'Elegí una opción',
      [
        {
          text: 'Tomar foto',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              const manipulated = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 1200 } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
              );
              onResult(manipulated.uri);
            }
          },
        },
        {
          text: 'Elegir de galería',
          onPress: async () => {
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
              onResult(manipulated.uri);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
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
            <Text style={[styles.stepSubtitle, { color: colors.inkSoft }]}>Subí una foto del padrón de tu moto</Text>
            <TouchableOpacity
              style={[styles.photoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => pickImage(setPadronUri)}
            >
              {padronUri ? (
                <Image source={{ uri: padronUri }} style={styles.photoPreview} />
              ) : (
                <>
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>Tomar foto</Text>
                </>
              )}
            </TouchableOpacity>

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
              style={[styles.photoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
              style={[styles.photoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
              style={[styles.photoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
              style={[styles.photoButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>{t('verifyMotoTitle')}</Text>
          <View style={styles.closeButton} />
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {renderStep()}
      </View>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeButton: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  stepContainer: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, marginBottom: 24 },
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
  photoButton: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoButtonText: { marginTop: 8, fontSize: 14, fontWeight: '600' },
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
});
