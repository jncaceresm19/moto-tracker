import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMotorcycle, updateMotorcycle, deleteMotorcycle, Motorcycle } from '../../../src/api';
import { useLanguage } from '../../../src/language-context';
import { CustomAlert } from '../../../src/components/CustomAlert';

export default function MotorcycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', currentKilometers: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');
  const [gpsEnabled, setGpsEnabled] = useState(false);

  const showAlert = (title: string, message?: string, buttons: {text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}[] = [{text: 'OK'}], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
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
      try { setMotorcycle(await getMotorcycle(id)); }
      catch { showAlert(t('error'), t('failedToLoad'), [{text: 'OK'}], 'close-circle', '#FF3B30'); }
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
      });
      setMotorcycle(updated);
      setEditing(false);
      showAlert(t('success'), t('motorcycleUpdated'), [{text: 'OK'}], 'checkmark-circle', '#34C759');
    } catch {
      showAlert(t('error'), t('failedToUpdate'), [{text: 'OK'}], 'close-circle', '#FF3B30');
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
          catch { showAlert(t('error'), t('failedToDelete'), [{text: 'OK'}], 'close-circle', '#FF3B30'); }
        },
      },
    ], 'warning', '#FF9500');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!motorcycle) return <View style={styles.center}><Text>{t('motorcycleNotFound')}</Text></View>;

  const sections = [
    { title: t('maintenanceRecords'), route: `/(app)/motorcycle/${id}/maintenance`, icon: '🔧' },
    { title: t('documents'), route: `/(app)/motorcycle/${id}/documents`, icon: '📄' },
    { title: t('kilometerHistory'), route: `/(app)/motorcycle/${id}/kilometers`, icon: '📏' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{motorcycle.brand}</Text>
          <Text style={styles.model}>{motorcycle.model}</Text>
          <Text style={styles.year}>{motorcycle.year}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>{t('edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>{t('delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>{t('licensePlate')}</Text>
        <Text style={styles.value}>{motorcycle.licensePlate}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>{t('currentKilometers')}</Text>
        <Text style={styles.value}>{motorcycle.currentKilometers.toLocaleString()} km</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections')}</Text>
        {sections.map((s) => (
          <TouchableOpacity key={s.route} style={styles.sectionBtn} onPress={() => router.push(s.route as any)}>
            <Text style={styles.sectionIcon}>{s.icon}</Text>
            <Text style={styles.sectionText}>{s.title}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* GPS Tracking Toggle */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionBtn} onPress={() => setGpsEnabled(!gpsEnabled)}>
          <Text style={styles.sectionIcon}>📍</Text>
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
      </View>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('editMotorcycle')}</Text>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.cancel}>{t('cancel')}</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Brand *" value={form.brand} onChangeText={(t) => { setForm((p) => ({ ...p, brand: t })); setErrors((p) => ({ ...p, brand: '' })); }} />
          {errors.brand ? <Text style={styles.errorText}>{errors.brand}</Text> : null}
          <TextInput style={styles.input} placeholder="Model *" value={form.model} onChangeText={(t) => { setForm((p) => ({ ...p, model: t })); setErrors((p) => ({ ...p, model: '' })); }} />
          {errors.model ? <Text style={styles.errorText}>{errors.model}</Text> : null}
          <TextInput style={styles.input} placeholder="Year *" keyboardType="numeric" value={form.year} onChangeText={(t) => { setForm((p) => ({ ...p, year: t })); setErrors((p) => ({ ...p, year: '' })); }} />
          {errors.year ? <Text style={styles.errorText}>{errors.year}</Text> : null}
          <TextInput style={styles.input} placeholder="License Plate *" value={form.licensePlate} onChangeText={(t) => { setForm((p) => ({ ...p, licensePlate: t })); setErrors((p) => ({ ...p, licensePlate: '' })); }} />
          {errors.licensePlate ? <Text style={styles.errorText}>{errors.licensePlate}</Text> : null}
          <TextInput style={styles.input} placeholder="Current Kilometers" keyboardType="numeric" value={form.currentKilometers} onChangeText={(t) => setForm((p) => ({ ...p, currentKilometers: t }))} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  editBtnText: { color: '#fff', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteBtnText: { color: '#fff', fontWeight: '600' },
  brand: { fontSize: 28, fontWeight: 'bold' },
  model: { fontSize: 20, color: '#333', marginTop: 4 },
  year: { fontSize: 16, color: '#666', marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 16, color: '#666' },
  value: { fontSize: 16, fontWeight: '500' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  sectionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#f8f8f8', borderRadius: 8, marginBottom: 8 },
  sectionIcon: { fontSize: 20, marginRight: 12 },
  sectionText: { fontSize: 16, flex: 1 },
  arrow: { fontSize: 22, color: '#999' },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  cancel: { color: '#007AFF', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  errorText: { color: '#FF3B30', fontSize: 12, marginBottom: 8, marginTop: -6 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F9D63', borderRadius: 10, padding: 12, marginTop: 12 },
  mapBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
