import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMotorcycle, updateMotorcycle, deleteMotorcycle, Motorcycle, listDocuments, Document, listMaintenance, MaintenanceRecord, listKilometers, KilometerEntry } from '../../../src/api';
import { useLanguage } from '../../../src/language-context';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { getDueRemindersByKm, getReminderMessage, dismissReminder, getOilInterval, OilType } from '../../../src/services/reminderService';
import { getDisplayPlateParts } from '../../../../backend/src/services/plateValidation';

export default function MotorcycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '', gpsTracker: '', color: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [kmEntries, setKmEntries] = useState<KilometerEntry[]>([]);

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
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

  const openEdit = () => {
    if (!motorcycle) return;
    setErrors({});
    setForm({
      brand: motorcycle.brand,
      model: motorcycle.model,
      year: String(motorcycle.year),
      licensePlate: motorcycle.licensePlate,
      currentKilometers: String(motorcycle.currentKilometers),
      gpsTracker: motorcycle.gpsTracker || '',
      color: motorcycle.color || '',
    });
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
        gpsTracker: form.gpsTracker || undefined,
        color: form.color || undefined,
      });
      setMotorcycle(updated);
      setGpsEnabled(!!updated.gpsTracker);
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
    ], 'warning', '#FF9500');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!motorcycle) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 16, marginBottom: 16 }}>{t('motorcycleNotFound')}</Text>
      <TouchableOpacity
        style={[styles.editBtnOld, { backgroundColor: '#007AFF' }]}
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
      title: t('kilometerHistory'),
      route: `/(app)/motorcycle/${id}/kilometers`,
      icon: 'stats-chart-outline' as const,
      chipBg: '#FBEAF0',
      chipColor: '#993556',
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
  const topAlerts = alerts.slice(0, 3);

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
    <ScrollView style={styles.container}>
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

      {/* Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections')}</Text>

        {sections.map((s) => (
          <TouchableOpacity key={s.route} style={styles.sectionBtn} activeOpacity={0.7} onPress={() => router.push(s.route as any)}>
            <View style={[styles.sectionChip, { backgroundColor: s.chipBg }]}>
              <Ionicons name={s.icon} size={18} color={s.chipColor} />
            </View>
            <Text style={styles.sectionText}>{s.title}</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        ))}

        {/* GPS Tracking Toggle */}
        {motorcycle.gpsTracker ? (
          <>
            <TouchableOpacity style={styles.sectionBtn} activeOpacity={0.7} onPress={() => setGpsEnabled(!gpsEnabled)}>
              <View style={[styles.sectionChip, { backgroundColor: '#FAEEDA' }]}>
                <Ionicons name="location-outline" size={18} color="#854F0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionText}>{t('gpsTracking')}</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{gpsEnabled ? t('gpsActive') : t('gpsInactive')}</Text>
              </View>
              <Switch
                value={gpsEnabled}
                onValueChange={setGpsEnabled}
                trackColor={{ false: '#E1E5EC', true: '#1F9D63' }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
            {gpsEnabled && (
              <TouchableOpacity style={styles.mapBtn} onPress={() => router.push(`/(app)/motorcycle/${id}/tracking`)}>
                <Ionicons name="map" size={18} color="#FFFFFF" />
                <Text style={styles.mapBtnText}>{t('viewOnMap')}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={[styles.sectionBtn, { opacity: 0.6 }]}>
            <View style={[styles.sectionChip, { backgroundColor: '#F1EFE8' }]}>
              <Ionicons name="location-outline" size={18} color="#888780" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionText}>{t('gpsTracking')}</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{t('noGpsRegistered')}</Text>
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

      {/* Kilometer History Preview */}
      {kmEntries.length > 0 && (
        <View style={[styles.section, { paddingTop: 0 }]}>
          <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => router.push(`/(app)/motorcycle/${id}/kilometers`)}>
            <Text style={styles.sectionTitle}>{t('kilometerHistory')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
          {kmEntries.slice(0, 5).map((entry) => (
            <View key={entry.id} style={styles.kmEntry}>
              <View style={styles.kmEntryRow}>
                <Text style={styles.kmEntryValue}>{entry.readingKm.toLocaleString('es-CL')} km</Text>
                <Text style={styles.kmEntryDate}>{new Date(entry.recordedAt).toLocaleDateString()}</Text>
              </View>
              {entry.notes ? <Text style={styles.kmEntryNotes}>{entry.notes}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Próximos vencimientos */}
      {topAlerts.length > 0 && (
        <View style={[styles.section, { paddingTop: 0 }]}>
          <Text style={styles.sectionTitle}>Próximos vencimientos</Text>
          {topAlerts.map((a) => (
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
          ))}
        </View>
      )}

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editMotorcycle')}</Text>
              <TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.cancel}>{t('cancel')}</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Brand *" value={form.brand} onChangeText={(txt) => { setForm((p) => ({ ...p, brand: txt })); setErrors((p) => ({ ...p, brand: '' })); }} />
            {errors.brand ? <Text style={styles.errorText}>{errors.brand}</Text> : null}
            <TextInput style={styles.input} placeholder="Model *" value={form.model} onChangeText={(txt) => { setForm((p) => ({ ...p, model: txt })); setErrors((p) => ({ ...p, model: '' })); }} />
            {errors.model ? <Text style={styles.errorText}>{errors.model}</Text> : null}
            <TextInput style={styles.input} placeholder="Year *" keyboardType="numeric" value={form.year} onChangeText={(txt) => { setForm((p) => ({ ...p, year: txt })); setErrors((p) => ({ ...p, year: '' })); }} />
            {errors.year ? <Text style={styles.errorText}>{errors.year}</Text> : null}
            {errors.licensePlate ? <Text style={styles.errorText}>{errors.licensePlate}</Text> : null}
            {motorcycle?.verificada ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: -4 }}>
                <Ionicons name="lock-closed" size={14} color="#999" />
                <Text style={{ fontSize: 12, color: '#999' }}>{t('plateVerifiedCantEdit')}</Text>
              </View>
            ) : null}
            <TextInput style={styles.input} placeholder="License Plate *" value={form.licensePlate} editable={!motorcycle?.verificada} onChangeText={(txt) => { setForm((p) => ({ ...p, licensePlate: txt })); setErrors((p) => ({ ...p, licensePlate: '' })); }} />
            <TextInput style={styles.input} placeholder="Current Kilometers" keyboardType="numeric" value={form.currentKilometers} onChangeText={(txt) => setForm((p) => ({ ...p, currentKilometers: txt }))} />
            <TextInput style={styles.input} placeholder="Color" value={form.color} onChangeText={(txt) => setForm((p) => ({ ...p, color: txt }))} />
            <View style={{ marginTop: 10, marginBottom: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{t('gpsQuestion')}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t('gpsQuestionHint')}</Text>
            </View>
            <TextInput style={styles.input} placeholder={t('gpsIdPlaceholder')} value={form.gpsTracker} onChangeText={(txt) => setForm((p) => ({ ...p, gpsTracker: txt }))} />
            <Text style={{ fontSize: 12, color: '#666', marginTop: 4, marginBottom: 4 }}>{t('gpsQuestionHint2')}</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Old button styles (kept for "motorcycle not found" state)
  editBtnOld: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editBtnOldText: { color: '#fff', fontWeight: '600' },

  // Hero card
  heroCard: {
    borderRadius: 14,
    padding: 16,
    margin: 16,
    marginBottom: 8,
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
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8f8f8',
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
    backgroundColor: '#f8f8f8',
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
    color: '#007AFF',
  },
  kmEntryDate: {
    fontSize: 12,
    color: '#666',
  },
  kmEntryNotes: {
    fontSize: 12,
    color: '#999',
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
    marginBottom: 8,
  },
  alertTitle: { fontSize: 14, fontWeight: '600' },
  alertSubtitle: { fontSize: 12, marginTop: 2 },

  // Modal
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#1F9D63', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F9D63', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 8 },
  mapBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});