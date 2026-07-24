import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';
import { Motorcycle } from '../api';
import { ActiveMoto, formatActivationTime } from '../services/activeMoto';
import { formatPlate } from '../../../backend/src/services/plateValidation';

interface ActiveMotoModalProps {
  visible: boolean;
  onClose: () => void;
  motorcycles: Motorcycle[];
  activeMoto: ActiveMoto | null;
  activationAddress?: string;
  onActivate: (motorcycleId: string, activationPhotoUrl?: string) => void;
  onDeactivate: () => void;
  onReportTheft: () => void;
}

export function ActiveMotoModal({
  visible,
  onClose,
  motorcycles,
  activeMoto,
  activationAddress,
  onActivate,
  onDeactivate,
  onReportTheft,
}: ActiveMotoModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [selectedMoto, setSelectedMoto] = useState<Motorcycle | null>(null);
  const [showPhotoStep, setShowPhotoStep] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeMotorcycle = activeMoto
    ? motorcycles.find(m => m.id === activeMoto.motorcycleId)
    : null;

  const handleSelectMoto = (moto: Motorcycle) => {
    setSelectedMoto(moto);
    setPhotoUri(null);
    setShowPhotoStep(true);
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) {
        setPhotoUri(`data:image/jpeg;base64,${manipulated.base64}`);
      }
    }
  };

  const handleActivateWithPhoto = async () => {
    if (!selectedMoto) return;
    setSaving(true);
    try {
      onActivate(selectedMoto.id, photoUri || undefined);
      setShowPhotoStep(false);
      setSelectedMoto(null);
      setPhotoUri(null);
      onClose();
    } catch (e) {
      console.log('[ACTIVATE] Error:', e);
      onActivate(selectedMoto.id);
      setShowPhotoStep(false);
      setSelectedMoto(null);
      setPhotoUri(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSkipPhoto = () => {
    if (!selectedMoto) return;
    onActivate(selectedMoto.id);
    setShowPhotoStep(false);
    setSelectedMoto(null);
    setPhotoUri(null);
    onClose();
  };

  const handleBackToSelector = () => {
    setShowPhotoStep(false);
    setSelectedMoto(null);
    setPhotoUri(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.container, { backgroundColor: colors.surface }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: colors.ink }]}>
                {activeMoto ? t('activeMoto') : showPhotoStep ? 'Foto de la moto' : t('selectMoto')}
              </Text>
              {showPhotoStep && selectedMoto && (
                <Text style={[styles.headerSubtitle, { color: colors.inkFaint }]}>
                  {selectedMoto.brand} {selectedMoto.model} · {formatPlate(selectedMoto.licensePlate)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={showPhotoStep ? handleBackToSelector : onClose}>
              <Ionicons name="close" size={24} color={colors.inkFaint} />
            </TouchableOpacity>
          </View>

          {activeMoto && activeMotorcycle ? (
            // Active moto view
            <View style={styles.activeView}>
              <View style={[styles.activeCard, { backgroundColor: colors.green + '15', borderColor: colors.green }]}>
                <View style={styles.activeHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                  <Text style={[styles.activeLabel, { color: colors.green }]}>{t('activeMoto')}</Text>
                </View>
                <Text style={[styles.motoName, { color: colors.ink }]}>
                  {activeMotorcycle.brand} {activeMotorcycle.model}
                </Text>
                <Text style={[styles.plate, { color: colors.inkFaint }]}>
                  {formatPlate(activeMotorcycle.licensePlate)}
                </Text>
                <Text style={[styles.time, { color: colors.inkFaint }]}>
                  {t('activeSince')} {formatActivationTime(activeMoto.activatedAt)}
                </Text>
                {activeMoto.activationLat && activeMoto.activationLon && (
                  <Text style={[styles.location, { color: colors.inkFaint }]}>
                    {t('parkedAt')} {activationAddress || `${activeMoto.activationLat?.toFixed(4)}, ${activeMoto.activationLon?.toFixed(4)}`}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.deactivateBtn, { borderColor: colors.border }]}
                onPress={() => { onDeactivate(); onClose(); }}
              >
                <Ionicons name="stop-circle-outline" size={20} color={colors.inkFaint} />
                <Text style={[styles.deactivateText, { color: colors.ink }]}>{t('deactivateMoto')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.theftBtn, { backgroundColor: colors.alertRed }]}
                onPress={() => { onReportTheft(); onClose(); }}
              >
                <Ionicons name="alert-circle-outline" size={20} color="#fff" />
                <Text style={styles.theftText}>{t('reportTheft')}</Text>
              </TouchableOpacity>
            </View>
          ) : showPhotoStep && selectedMoto ? (
            // Photo step view
            <View style={styles.photoStepView}>
              {photoUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreviewImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.removePhotoBtn, { backgroundColor: colors.danger }]}
                    onPress={() => setPhotoUri(null)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.removePhotoText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.photoCaptureZone, { borderColor: colors.border, backgroundColor: colors.surface2 || colors.surface }]}
                  onPress={handlePickPhoto}
                >
                  <View style={[styles.photoCaptureIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="camera" size={26} color={colors.primary} />
                  </View>
                  <Text style={[styles.photoCaptureTitle, { color: colors.ink }]}>Tomar foto</Text>
                  <Text style={[styles.photoCaptureHint, { color: colors.inkFaint }]}>
                    Se mostrará en la alerta de robo si reportas un siniestro.
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.activateBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleActivateWithPhoto}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.activateBtnText}>
                      {photoUri ? 'Activar con foto' : 'Activar sin foto'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipPhotoBtn}
                onPress={handleSkipPhoto}
                disabled={saving}
              >
                <Text style={[styles.skipPhotoText, { color: colors.inkFaint }]}>Saltar y activar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Motorcycle selector view
            <ScrollView style={styles.selectorView}>
              {motorcycles.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.inkFaint }]}>
                    {t('registerFirstMoto')}
                  </Text>
                </View>
              ) : (
                motorcycles.map((moto) => (
                  <TouchableOpacity
                    key={moto.id}
                    style={[styles.motoOption, { borderColor: colors.border }]}
                    onPress={() => handleSelectMoto(moto)}
                  >
                    <View style={styles.motoOptionContent}>
                      <Text style={[styles.motoOptionName, { color: colors.ink }]}>
                        {moto.brand} {moto.model}
                      </Text>
                      <Text style={[styles.motoOptionPlate, { color: colors.inkFaint }]}>
                        {formatPlate(moto.licensePlate)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  activeView: {
    gap: 12,
  },
  activeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  motoName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  plate: {
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 8,
  },
  time: {
    fontSize: 13,
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 30,
    borderWidth: 1,
  },
  deactivateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  theftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 30,
  },
  theftText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  selectorView: {
    maxHeight: 300,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  motoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  motoOptionContent: {
    flex: 1,
  },
  motoOptionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  motoOptionPlate: {
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  photoStepView: {
    gap: 12,
  },
  photoCaptureZone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  photoCaptureIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCaptureTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoCaptureHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  photoPreview: {
    alignItems: 'center',
    gap: 10,
  },
  photoPreviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 30,
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  skipPhotoBtn: {
    alignItems: 'center',
    padding: 8,
  },
  skipPhotoText: {
    fontSize: 13,
  },
});