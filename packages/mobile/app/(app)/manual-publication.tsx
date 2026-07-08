import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { Motorcycle, listMotorcycles } from '../../src/api';
import { createManualPublication } from '../../src/services/theftAlertService';
import { CustomAlert } from '../../src/components/CustomAlert';
import { PhotoPickerModal } from '../../src/components/PhotoPickerModal';

export default function ManualPublicationScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMoto, setSelectedMoto] = useState<Motorcycle | null>(null);
  const [showMotoPicker, setShowMotoPicker] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
  >([]);

  // Photo state
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const loadMotorcycles = useCallback(async () => {
    try {
      const data = await listMotorcycles();
      setMotorcycles(data);
      if (data.length === 1) {
        setSelectedMoto(data[0]);
      }
    } catch (e: any) {
      console.log('[MANUAL-PUB] Error loading motorcycles:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMotorcycles();
  }, [loadMotorcycles]);

  const handleUseCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAlertTitle(t('permissionNeeded'));
        setAlertMessage(t('locationPermissionNeeded'));
        setAlertButtons([{ text: 'OK', style: 'default' }]);
        setAlertVisible(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get location name
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const parts = [address.street, address.city, address.region].filter(Boolean);
        setLocationName(parts.join(', '));
      }
    } catch (e: any) {
      console.log('[MANUAL-PUB] Error getting location:', e?.message);
      setAlertTitle(t('error'));
      setAlertMessage('No se pudo obtener la ubicación actual');
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMoto) {
      setAlertTitle(t('error'));
      setAlertMessage(t('selectMotorcycle'));
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
      return;
    }

    // Confirm before publishing
    setAlertTitle(t('publishAlert'));
    setAlertMessage(t('publishConfirm'));
    setAlertButtons([
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('publishAlert'),
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await createManualPublication({
              motorcycleId: selectedMoto.id,
              lastLocationName: locationName || undefined,
            });

            setAlertTitle(t('success'));
            setAlertMessage(t('publicationSuccess'));
            setAlertButtons([
              {
                text: 'OK',
                onPress: () => {
                  router.back();
                },
              },
            ]);
            setAlertVisible(true);
          } catch (e: any) {
            console.log('[MANUAL-PUB] Error publishing:', e?.message);
            setAlertTitle(t('error'));
            setAlertMessage(e?.message || t('publicationError'));
            setAlertButtons([{ text: 'OK', style: 'default' }]);
            setAlertVisible(true);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
    setAlertVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={[styles.headerIcon, { backgroundColor: colors.alertRedBg }]}>
              <Ionicons name="alert-circle" size={32} color={colors.alertRed} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.ink }]}>
              {t('manualPublicationTitle')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.inkSoft }]}>
              {t('manualPublicationSubtitle')}
            </Text>
          </View>

          {/* Motorcycle Selector */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.ink }]}>{t('selectMotorcycle')}</Text>

            {motorcycles.length === 0 ? (
              <View style={styles.emptyMoto}>
                <Ionicons name="bicycle-outline" size={32} color={colors.inkFaint} />
                <Text style={[styles.emptyMotoText, { color: colors.inkFaint }]}>
                  {t('noMotorcyclesAvailable')}
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                  onPress={() => setShowMotoPicker(!showMotoPicker)}
                >
                  <Text style={[styles.pickerText, { color: selectedMoto ? colors.ink : colors.inkFaint }]}>
                    {selectedMoto
                      ? `${selectedMoto.brand} ${selectedMoto.model} - ${selectedMoto.licensePlate}`
                      : t('selectMotorcycle')}
                  </Text>
                  <Ionicons
                    name={showMotoPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.inkFaint}
                  />
                </TouchableOpacity>

                {showMotoPicker && (
                  <View style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {motorcycles.map((moto) => (
                      <TouchableOpacity
                        key={moto.id}
                        style={[
                          styles.pickerOption,
                          { borderBottomColor: colors.borderLight },
                          selectedMoto?.id === moto.id && { backgroundColor: colors.brandBlueBg },
                        ]}
                        onPress={() => {
                          setSelectedMoto(moto);
                          setShowMotoPicker(false);
                        }}
                      >
                        <View style={styles.pickerOptionContent}>
                          <Text style={[styles.pickerOptionTitle, { color: colors.ink }]}>
                            {moto.brand} {moto.model}
                          </Text>
                          <Text style={[styles.pickerOptionSubtitle, { color: colors.inkSoft }]}>
                            {moto.licensePlate} · {moto.year}
                          </Text>
                        </View>
                        {selectedMoto?.id === moto.id && (
                          <Ionicons name="checkmark" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Auto-filled data display */}
                {selectedMoto && (
                  <View style={[styles.autoFillInfo, { backgroundColor: colors.brandBlueBg }]}>
                    <Ionicons name="information-circle" size={16} color={colors.primary} />
                    <Text style={[styles.autoFillText, { color: colors.primary }]}>
                      Marca, modelo y patente se completan automáticamente
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Location */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.ink }]}>{t('locationOptional')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.ink }]}
              placeholder={t('locationPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              value={locationName}
              onChangeText={setLocationName}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={[styles.locationBtn, { borderColor: colors.primary }]}
              onPress={handleUseCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="location" size={18} color={colors.primary} />
              )}
              <Text style={[styles.locationBtnText, { color: colors.primary }]}>
                {t('useCurrentLocation')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.ink }]}>{t('additionalNotes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.ink }]}
              placeholder={t('notesPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.alertRed },
              (!selectedMoto || submitting) && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={!selectedMoto || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>{t('publishAlert')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon="help-circle"
        iconColor={colors.primary}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Header
  headerSection: { alignItems: 'center', marginBottom: 24 },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },

  // Sections
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },

  // Picker
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: { fontSize: 15, flex: 1 },
  pickerDropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerOptionContent: { flex: 1 },
  pickerOptionTitle: { fontSize: 15, fontWeight: '600' },
  pickerOptionSubtitle: { fontSize: 13, marginTop: 2 },

  emptyMoto: { alignItems: 'center', paddingVertical: 20 },
  emptyMotoText: { fontSize: 14, marginTop: 8 },

  autoFillInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  autoFillText: { fontSize: 12, flex: 1 },

  // Input
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 80 },

  // Location button
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  locationBtnText: { fontSize: 14, fontWeight: '600' },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
