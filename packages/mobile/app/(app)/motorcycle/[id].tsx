import React, { useEffect, useState } from 'react';
import { View, Image, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme-context';
import { getMotorcycle, updateMotorcycle, deleteMotorcycle, Motorcycle, listDocuments, Document, listMaintenance, MaintenanceRecord, listKilometers, KilometerEntry, listMunicipalities, getMunicipality, Municipality } from '../../../src/api';
import { useLanguage } from '../../../src/language-context';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { getDueRemindersByKm, getReminderMessage, dismissReminder, getOilInterval, OilType } from '../../../src/services/reminderService';
import { getDisplayPlateParts } from '../../../../backend/src/services/plateValidation';

export default function MotorcycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', color: '', engineNumber: '', chassisNumber: '', serialNumber: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState(colors.primary);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [kmEntries, setKmEntries] = useState<KilometerEntry[]>([]);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalityResults, setMunicipalityResults] = useState<Municipality[]>([]);
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showAlert(t('permissionNeeded'), fromCamera ? t('permissionCamera') : t('permissionGallery'), [{ text: 'OK' }], 'lock-closed', '#FF9500');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1.0, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1.0, base64: true });

    if (!result.canceled && result.assets[0]) {
      let uri: string;
      if (result.assets[0].base64) {
        uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      } else {
        const b64 = await FileSystemLegacy.readAsStringAsync(result.assets[0].uri, {
          encoding: 'base64',
        });
        uri = `data:image/jpeg;base64,${b64}`;
      }
      setImageUri(uri);
    }
  };

  const showImageOptions = () => {
    setShowPhotoModal(true);
  };

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = colors.primary) => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const moto = await getMotorcycle(id);
        setMotorcycle(moto);
        setGpsEnabled(!!moto.gpsTracker);

        try {
          const [docs, records, kms] = await Promise.all([listDocuments(id), listMaintenance(id), listKilometers(id)]);
          setDocuments(docs);
          setMaintenance(records);
          setKmEntries(kms.slice(0, 5));
        } catch { }

        if (moto.currentKilometers) {
          const dueReminders = await getDueRemindersByKm(moto.currentKilometers);
          if (dueReminders.length > 0) {
            const first = dueReminders[0];
            const msg = getReminderMessage(first, 'km');
            showAlert(msg.title, msg.body, [
              { text: 'OK', onPress: () => dismissReminder(first.id) },
            ], 'alarm-outline', '#FF9500');
          }
        }
      }
      catch (e: any) {
        const msg = e?.status === 401 ? t('sessionExpired') : t('failedToLoad');
        showAlert(t('error'), msg, [{ text: 'OK' }], 'close-circle', '#FF3B30');
      }
      finally { setLoading(false); }
    })();
  }, [id]);

  const searchMunicipalities = async (query: string) => {
    setMunicipalitySearch(query);
    if (query.length < 2) {
      setMunicipalityResults([]);
      return;
    }
    try {
      const results = await listMunicipalities(query);
      setMunicipalityResults(results);
    } catch {
      setMunicipalityResults([]);
    }
  };

  const selectMunicipality = (m: Municipality) => {
    setSelectedMunicipality(m);
    setMunicipalitySearch(m.commune);
    setShowMunicipalityPicker(false);
    setMunicipalityResults([]);
  };

  const openEdit = () => {
    if (!motorcycle) return;
    setErrors({});
    setImageUri(motorcycle.imageUrl || null);
    setForm({
      brand: motorcycle.brand,
      model: motorcycle.model,
      year: String(motorcycle.year),
      licensePlate: motorcycle.licensePlate,
      currentKilometers: String(motorcycle.currentKilometers),
      color: motorcycle.color || '',
      engineNumber: motorcycle.engineNumber || '',
      chassisNumber: motorcycle.chassisNumber || '',
      serialNumber: motorcycle.serialNumber || '',
    });
    if (motorcycle.permitMunicipalityId) {
      getMunicipality(motorcycle.permitMunicipalityId).then(setSelectedMunicipality).catch(() => {});
    } else {
      setSelectedMunicipality(null);
    }
    setEditing(true);
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.brand) newErrors.brand = t('required');
    if (!form.model) newErrors.model = t('required');
    if (!form.year) newErrors.year = t('required');
    if (!form.licensePlate) newErrors.licensePlate = t('required');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const updated = await updateMotorcycle(id, {
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        licensePlate: form.licensePlate,
        currentKilometers: form.currentKilometers ? Number(form.currentKilometers) : undefined,
        color: form.color || undefined,
        engineNumber: form.engineNumber || undefined,
        chassisNumber: form.chassisNumber || undefined,
        serialNumber: form.serialNumber || undefined,
        imageUrl: imageUri || undefined,
        permitMunicipalityId: selectedMunicipality?.id || null,
      });
      setMotorcycle(updated);
      setEditing(false);
      showAlert(t('success'), t('motorcycleUpdated'), [{ text: 'OK' }], 'checkmark-circle', '#34C759');
    } catch (e: any) {
      showAlert(t('error'), t('failedToUpdate'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert(t('deleteMotorcycle'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try { await deleteMotorcycle(id); router.back(); }
          catch { showAlert(t('error'), t('failedToDelete'), [{ text: 'OK' }], 'close-circle', '#FF3B30'); }
        },
      },
    ], 'warning', '#FF3B30');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!motorcycle) return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: 16, marginBottom: 16, color: colors.text }}>{t('motorcycleNotFound')}</Text>
      <TouchableOpacity
        style={[styles.editBtnOld, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(app)/motos')}
      >
        <Text style={styles.editBtnOldText}>{t('goBack')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Sections: icon set, colored chip background, chip icon color
  const sections = [
    {
      title: t('documents'),
      route: `/(app)/motorcycle/${id}/documents`,
      icon: 'document-text-outline' as const,
      chipBg: '#E6F1FB',
      chipColor: '#185FA5',
    },
    {
      title: t('maintenanceRecords'),
      route: `/(app)/motorcycle/${id}/maintenance`,
      icon: 'build-outline' as const,
      chipBg: '#E1F5EE',
      chipColor: '#0F6E56',
    },
    {
      title: 'Verificación',
      route: `/(app)/motorcycle/${id}/verification`,
      icon: motorcycle.verificada ? 'shield-checkmark' as const : 'shield-checkmark-outline' as const,
      chipBg: motorcycle.verificada ? '#EAF3E6' : '#FBEAF0',
      chipColor: motorcycle.verificada ? '#3D7A2E' : '#993556',
    },
    {
      title: 'Combustible',
      route: `/(app)/motorcycle/${id}/fuel`,
      icon: 'water-outline' as const,
      chipBg: '#FFF6D9',
      chipColor: '#8A6D00',
    },
  ];

  const formattedPlate = getDisplayPlateParts(motorcycle.licensePlate);

  // ============================================================
  // Próximos vencimientos: documentos por vencer/vencidos + próximo cambio de aceite
  // ============================================================
  type AlertItem = {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    subColor: string;
    title: string;
    subtitle: string;
    route: string;
    priority: number; // lower = more urgent
  };

  const alerts: AlertItem[] = [];

  documents.forEach((doc) => {
    if (!doc.expiryDate || (doc.status !== 'expired' && doc.status !== 'expiring')) return;
    const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
    const isExpired = doc.status === 'expired';
    alerts.push({
      key: `doc-${doc.id}`,
      icon: isExpired ? 'alert-circle' : 'time-outline',
      bg: isExpired ? '#FDEAEA' : '#FFF6D9',
      border: isExpired ? '#B42318' : '#C79000',
      iconColor: isExpired ? '#B42318' : '#8A6D00',
      titleColor: isExpired ? '#7A1810' : '#6B5400',
      subColor: isExpired ? '#9C3A2E' : '#8A7000',
      title: isExpired ? `${doc.title} vencido` : `${doc.title} vence pronto`,
      subtitle: isExpired ? `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}` : `Vence en ${days} día${days === 1 ? '' : 's'}`,
      route: `/(app)/motorcycle/${id}/documents`,
      priority: isExpired ? 0 : 1,
    });
  });

  const oilRecord = maintenance.find((r) => r.type === 'motor_oil');
  if (oilRecord) {
    const oilTypeMap: Record<string, OilType> = {
      'Mineral': 'mineral',
      'Semi-sintético': 'semi_synthetic',
      'Sintético': 'synthetic',
    };
    const oilType = oilTypeMap[oilRecord.description];
    if (oilType) {
      const interval = getOilInterval(oilType);
      const nextKm = oilRecord.kilometersAtService + interval.km;
      const nextDate = new Date(oilRecord.serviceDate);
      nextDate.setMonth(nextDate.getMonth() + interval.months);
      const kmRemaining = nextKm - motorcycle.currentKilometers;
      const isDue = kmRemaining <= 0 || nextDate.getTime() <= Date.now();
      alerts.push({
        key: 'oil',
        icon: 'water-outline',
        bg: isDue ? '#FDEAEA' : '#E6F1FB',
        border: isDue ? '#B42318' : '#185FA5',
        iconColor: isDue ? '#B42318' : '#185FA5',
        titleColor: isDue ? '#7A1810' : '#123F6D',
        subColor: isDue ? '#9C3A2E' : '#1C6FA5',
        title: isDue ? 'Cambio de aceite atrasado' : 'Próximo cambio de aceite',
        subtitle: isDue
          ? `Debiste cambiarlo a los ${nextKm.toLocaleString('es-CL')} km`
          : `Cambialo a los ${nextKm.toLocaleString('es-CL')} km`,
        route: `/(app)/motorcycle/${id}/maintenance`,
        priority: isDue ? 0 : 2,
      });
    }
  }

  alerts.sort((a, b) => a.priority - b.priority);
  const topAlerts = alerts.slice(0, 1);

  const COLOR_MAP: Record<string, string> = {
    negro: '#1a1a1a',
    blanco: '#e8e8e8',
    rojo: '#8B1E1E',
    azul: '#1a3a6b',
    verde: '#1E5C3A',
    gris: '#4a4a4a',
    amarillo: '#8B7A1E',
    naranja: '#8B4A1E',
    plateado: '#6b6b6b',
    celeste: '#2E5C8B',
  };

  const getHeroColor = (colorName?: string): string => {
    if (!colorName) return '#1a1a1a';
    const normalized = colorName.trim().toLowerCase();
    return COLOR_MAP[normalized] || '#1a1a1a';
  };

  const isLightColor = (hex: string): boolean => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const heroColor = getHeroColor(motorcycle.color);
  const heroTextColor = isLightColor(heroColor) ? '#1a1a1a' : '#FFFFFF';
  const heroSubTextColor = isLightColor(heroColor) ? '#3a3a3a' : '#cfe0f7';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero card: brand/model/year + edit/delete + plate/odo */}
      <View style={[styles.heroCard, { backgroundColor: heroColor }]}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={[styles.heroBrand, { color: heroTextColor }]}>{motorcycle.brand}</Text>
            <Text style={[styles.heroModel, { color: heroSubTextColor }]}>{motorcycle.model} · {motorcycle.year}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroIconBtn} onPress={openEdit}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroIconBtn} onPress={handleDelete}>
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCardsRow}>
          {/* Plate card */}
          <View style={styles.plateCard}>
            <View style={styles.plateHeader}>
              <View style={styles.plateBolt} />
              <Text style={styles.plateChileText}>CHILE</Text>
              <View style={styles.plateBolt} />
            </View>
            {formattedPlate.numbers ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.plateText}>{formattedPlate.letters}</Text>
                <View style={styles.plateDot} />
                <Text style={styles.plateText}>{formattedPlate.numbers}</Text>
              </View>
            ) : (
              <Text style={styles.plateText}>{formattedPlate.letters}</Text>
            )}
          </View>

          {/* Odometer card */}
          <View style={styles.odoCard}>
            <Text style={styles.odoLabel}>ODO</Text>
            <Text style={styles.odoValue}>{motorcycle.currentKilometers.toLocaleString('es-CL')}</Text>
            <Text style={styles.odoLabel}>km</Text>
          </View>
        </View>
      </View>

      {/* Próximos vencimientos */}
      {topAlerts.length > 0 && (() => {
        const a = topAlerts[0];
        const isExpired = a.priority === 0;
        return (
          <View style={[styles.section, { paddingTop: 0 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Próximos vencimientos</Text>
            {isExpired ? (
              <TouchableOpacity
                key={a.key}
                activeOpacity={0.7}
                style={[styles.alertBtn, { backgroundColor: a.bg, borderLeftColor: a.border }]}
                onPress={() => router.push(a.route as any)}
              >
                <Ionicons name={a.icon} size={18} color={a.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: a.titleColor }]}>{a.title}</Text>
                  <Text style={[styles.alertSubtitle, { color: a.subColor }]}>{a.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={a.iconColor} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.alertBtn, { backgroundColor: a.bg, borderLeftColor: a.border }]}>
                <Ionicons name={a.icon} size={18} color={a.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: a.titleColor }]}>{a.title}</Text>
                  <Text style={[styles.alertSubtitle, { color: a.subColor }]}>{a.subtitle}</Text>
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* Sections */}
      <View style={[styles.section, { paddingTop: 4, paddingBottom: 8 }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('sections')}</Text>

        {sections.map((s) => (
          <TouchableOpacity key={s.route} style={[styles.sectionBtn, { backgroundColor: colors.surfaceSecondary }]} activeOpacity={0.7} onPress={() => router.push(s.route as any)}>
            <View style={[styles.sectionChip, { backgroundColor: s.chipBg }]}>
              <Ionicons name={s.icon} size={18} color={s.chipColor} />
            </View>
            <Text style={[styles.sectionText, { color: colors.text }]}>{s.title}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {/* GPS Tracking Toggle */}
        {motorcycle.gpsTracker ? (
          <>
            <TouchableOpacity style={[styles.sectionBtn, { backgroundColor: colors.surfaceSecondary }]} activeOpacity={0.7} onPress={() => setGpsEnabled(!gpsEnabled)}>
              <View style={[styles.sectionChip, { backgroundColor: '#FAEEDA' }]}>
                <Ionicons name="location-outline" size={18} color="#854F0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionText, { color: colors.text }]}>{t('gpsTracking')}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{gpsEnabled ? t('gpsActive') : t('gpsInactive')}</Text>
              </View>
              <Switch
                value={gpsEnabled}
                onValueChange={setGpsEnabled}
                trackColor={{ false: '#E1E5EC', true: '#1F9D63' }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
            {gpsEnabled && (
              <TouchableOpacity style={[styles.mapBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(app)/motorcycle/${id}/tracking`)}>
                <Ionicons name="map" size={18} color="#FFFFFF" />
                <Text style={styles.mapBtnText}>{t('viewOnMap')}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={[styles.sectionBtn, { backgroundColor: colors.surfaceSecondary, opacity: 0.6 }]}>
            <View style={[styles.sectionChip, { backgroundColor: '#F1EFE8' }]}>
              <Ionicons name="location-outline" size={18} color="#888780" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionText, { color: colors.text }]}>{t('gpsTracking')}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t('noGpsRegistered')}</Text>
            </View>
            <Switch
              value={false}
              disabled={true}
              trackColor={{ false: '#E1E5EC', true: '#1F9D63' }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}
      </View>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={styles.modalTopRow}>
              <TouchableOpacity onPress={() => setEditing(false)} style={{ marginLeft: 'auto' }}>
                <Text style={[styles.cancel, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.modalLogoContainer}>
                <Image
                  source={require('../../../assets/nombre.jpeg')}
                  style={styles.modalLogo}
                  resizeMode="contain"
                />
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{t('editMotorcycle')}</Text>
              </View>

              {motorcycle?.verificada && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 12, padding: 8, borderRadius: 8, backgroundColor: colors.amberBg, borderWidth: 1, borderColor: colors.amber }}>
                  <Ionicons name="lock-closed" size={13} color={colors.amber} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 11.5, lineHeight: 15, color: colors.amber, flex: 1 }}>Moto verificada — datos bloqueados por seguridad</Text>
                </View>
              )}

              {/* Photo — the ONLY editable field */}
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={showImageOptions}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <View style={[styles.photoPlaceholder, { borderColor: colors.primary }]}>
                    <Text style={styles.photoPlaceholderIcon}>📷</Text>
                    <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>{t('tapToAddMotoPhoto')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="Year" keyboardType="numeric" value={form.year} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="Brand" value={form.brand} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="Model" value={form.model} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="N° Motor" value={form.engineNumber} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="N° Chasis" value={form.chassisNumber} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="N° Serie" value={form.serialNumber} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="License Plate" value={form.licensePlate} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="Current Kilometers" keyboardType="numeric" value={form.currentKilometers} editable={false} />
              <TextInput style={[styles.input, { color: colors.textMuted, borderColor: colors.inputBorder }]} placeholder="Color" value={form.color} editable={false} />

              {/* Municipality picker */}
              <TouchableOpacity
                style={[styles.input, { borderColor: colors.inputBorder, justifyContent: 'center', minHeight: 44 }]}
                onPress={() => setShowMunicipalityPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: selectedMunicipality ? colors.text : colors.textMuted }}>
                  {selectedMunicipality ? `${selectedMunicipality.commune} — ${selectedMunicipality.name}` : 'Municipalidad (permiso de circulación)'}
                </Text>
              </TouchableOpacity>

              {/* Municipality Search Modal */}
              <Modal visible={showMunicipalityPicker} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={styles.modalTopRowForMuni}>
                      <Text style={[styles.modalDetailTitle, { color: colors.text }]}>Buscar municipalidad</Text>
                      <TouchableOpacity onPress={() => { setShowMunicipalityPicker(false); setMunicipalityResults([]); }}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.muniSearchInput, { color: colors.text, borderColor: colors.inputBorder }]}
                      placeholder="Escribe el nombre de la comuna..."
                      placeholderTextColor={colors.textMuted}
                      value={municipalitySearch}
                      onChangeText={searchMunicipalities}
                      autoFocus
                    />
                    <ScrollView style={{ maxHeight: 300 }}>
                      {municipalityResults.length === 0 && municipalitySearch.length >= 2 ? (
                        <Text style={{ padding: 16, color: colors.textMuted, textAlign: 'center' }}>Sin resultados</Text>
                      ) : municipalitySearch.length < 2 ? (
                        <Text style={{ padding: 16, color: colors.textMuted, textAlign: 'center' }}>Escribí al menos 2 caracteres</Text>
                      ) : (
                        municipalityResults.map((m) => (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.muniItem, { borderBottomColor: colors.border }]}
                            onPress={() => selectMunicipality(m)}
                          >
                            <Text style={{ color: colors.text, fontWeight: '500' }}>{m.commune}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.region}{m.paymentUrl ? ' · Portal disponible' : ''}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleUpdate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.photoModalTitle, { color: colors.text }]}>{t('addMotoPhoto')}</Text>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(true); }}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>{t('takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoModalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowPhotoModal(false); pickImage(false); }}>
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.photoModalBtnText}>{t('chooseFromGallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon={alertIcon}
        iconColor={alertIconColor}
        onClose={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Old button styles (kept for "motorcycle not found" state)
  editBtnOld: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editBtnOldText: { color: '#fff', fontWeight: '600' },

  // Hero card
  heroCard: {
    borderRadius: 14,
    padding: 16,
    margin: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBrand: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroModel: { fontSize: 15, color: '#cfe0f7', marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: 6 },
  heroIconBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 8,
  },
  heroCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  // Plate card
  plateCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  plateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plateBolt: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#1a1a1a',
  },
  plateChileText: {
    color: '#1a1a1a',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  plateText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1a1a1a',
    letterSpacing: 1,
    marginTop: -2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  plateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 4,
  },

  // Odometer card
  odoCard: {
    flex: 1,
    backgroundColor: '#12161c',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
  },
  odoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7fa8c9',
    fontStyle: 'italic',
  },
  odoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#eaf3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },

  // Sections
  section: { padding: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  sectionChip: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionText: { fontSize: 15, flex: 1 },

  // Kilometer History Preview
  kmEntry: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  kmEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kmEntryValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  kmEntryDate: {
    fontSize: 12,
  },
  kmEntryNotes: {
    fontSize: 12,
    marginTop: 4,
  },

  // Alerts (próximos vencimientos)
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 0,
  },
  alertTitle: { fontSize: 14, fontWeight: '600' },
  alertSubtitle: { fontSize: 12, marginTop: 2 },

  // Photo button
  photoBtn: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 10,
  },
  photoPlaceholderIcon: {
    fontSize: 22,
  },
  photoPlaceholderText: {
    fontSize: 12,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalTopRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  modalLogoContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  modalLogo: {
    width: 300,
    height: 150,
    marginTop: -30,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: -60,
    marginBottom: 30,
  },
  cancel: { fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#1F9D63', borderRadius: 30, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F9D63', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 8 },
  mapBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Municipality picker
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 14, padding: 20, width: '100%', maxWidth: 400 },
  modalTopRowForMuni: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalDetailTitle: { fontSize: 18, fontWeight: '600' },
  muniSearchInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15, marginVertical: 12 },
  muniItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
});