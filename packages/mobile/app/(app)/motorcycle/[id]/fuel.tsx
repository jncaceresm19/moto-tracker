import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, RefreshControl, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getMotorcycle, Motorcycle, listFuelRecords, createFuelRecord, deleteFuelRecord, FuelRecord } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';

type FuelSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
};

export default function FuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [motorcycleKm, setMotorcycleKm] = useState(0);

  // Modal state for records CRUD
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ stationName: '', liters: '', pricePerLiter: '', location: '', octane: '', kilometersAtFill: '', recordedAt: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');

  useEffect(() => {
    const titles: Record<string, string> = {
      records: 'Registro de Cargas',
      consumption: 'Consumo Promedio',
      charts: 'Gráficos',
    };
    navigation.setOptions({
      title: selectedSection ? titles[selectedSection] ?? 'Combustible' : 'Combustible',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (selectedSection) {
              setSelectedSection(null);
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
  }, [navigation, id, router, colors, t, selectedSection]);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [moto, fuelRecords] = await Promise.all([getMotorcycle(id), listFuelRecords(id)]);
      setMotorcycle(moto);
      setMotorcycleKm(moto.currentKilometers);
      setRecords(fuelRecords);
    } catch (e: any) {
      const msg = e?.status === 401 ? t('sessionExpired') : t('failedToLoad');
      showAlert(t('error'), msg, [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  // --- Records CRUD ---
  const openCreate = () => {
    setForm({ stationName: '', liters: '', pricePerLiter: '', location: '', octane: '', kilometersAtFill: String(motorcycleKm || ''), recordedAt: new Date().toISOString().split('T')[0] });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setErrors({});
  };

  const getLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('permissionNeeded'), t('locationPermissionNeeded'), [{ text: 'OK' }], 'location-outline', '#FF9500');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const parts = [address.street, address.city, address.region].filter(Boolean);
        setForm((p) => ({ ...p, location: parts.join(', ') }));
      }
    } catch (e: any) {
      console.log('[FUEL] Error getting location:', e?.message);
      showAlert(t('error'), 'No se pudo obtener la ubicación actual', [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.liters || isNaN(Number(form.liters)) || Number(form.liters) <= 0) newErrors.liters = t('required');
    if (!form.pricePerLiter || isNaN(Number(form.pricePerLiter)) || Number(form.pricePerLiter) <= 0) newErrors.pricePerLiter = t('required');
    if (!form.recordedAt) newErrors.recordedAt = t('required');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setSaving(true);
    try {
      const data = {
        stationName: form.stationName || undefined,
        liters: Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        location: form.location || undefined,
        octane: form.octane || undefined,
        kilometersAtFill: form.kilometersAtFill && !isNaN(Number(form.kilometersAtFill)) ? Number(form.kilometersAtFill) : undefined,
        recordedAt: new Date(form.recordedAt).toISOString(),
      };

      await createFuelRecord(id, data);
      closeModal();
      await loadData();
      showAlert(t('success'), t('recordSaved'), [{ text: 'OK' }], 'checkmark-circle', '#34C759');
    } catch (e: any) {
      showAlert(t('error'), t('failedToSave'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: FuelRecord) => {
    showAlert(t('deleteRecord'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          try {
            await deleteFuelRecord(id, record.id);
            await loadData();
          } catch {
            showAlert(t('error'), t('failedToDelete'), [{ text: 'OK' }], 'close-circle', '#FF3B30');
          }
        },
      },
    ], 'warning', '#FF9500');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // --- Stats ---
  const totalSpent = records.reduce((sum, r) => sum + r.totalCost, 0);
  const totalLiters = records.reduce((sum, r) => sum + r.liters, 0);

  // --- Consumption Calculation ---
  const consumptionData = useMemo(() => {
    const sorted = [...records]
      .filter((r) => r.kilometersAtFill != null)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    const entries: { index: number; kmDiff: number; liters: number; kmPerLiter: number; date: string }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const kmDiff = curr.kilometersAtFill! - prev.kilometersAtFill!;
      if (kmDiff <= 0) continue;
      entries.push({
        index: i,
        kmDiff,
        liters: curr.liters,
        kmPerLiter: kmDiff / curr.liters,
        date: curr.recordedAt,
      });
    }
    const avg = entries.length > 0 ? entries.reduce((s, e) => s + e.kmPerLiter, 0) / entries.length : 0;
    const maxConsumption = entries.length > 0 ? Math.max(...entries.map((e) => e.kmPerLiter)) : 0;
    return { entries, avg, maxConsumption };
  }, [records]);

  // --- Monthly Expenses ---
  const monthlyExpenses = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      const monthKey = new Date(r.recordedAt).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      map.set(monthKey, (map.get(monthKey) || 0) + r.totalCost);
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const [mA, yA] = a[0].split(' ');
        const [mB, yB] = b[0].split(' ');
        return parseInt(yA) - parseInt(yB) || 0;
      });
  }, [records]);

  // --- Current Year Data (calendar year, resets Jan 1) ---
  const currentYear = new Date().getFullYear();
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const currentYearMonthly = useMemo(() => {
    const byMonth = new Array(12).fill(0);
    for (const r of records) {
      const d = new Date(r.recordedAt);
      if (d.getFullYear() === currentYear) {
        byMonth[d.getMonth()] += r.totalCost;
      }
    }
    return byMonth; // [eneTotal, febTotal, ...]
  }, [records, currentYear]);

  const currentYearTotal = useMemo(() => currentYearMonthly.reduce((s, v) => s + v, 0), [currentYearMonthly]);

  // --- Sections ---
  const sections: FuelSection[] = [
    {
      id: 'records',
      title: 'Registro de Cargas',
      subtitle: `${records.length} carga${records.length !== 1 ? 's' : ''} registrada${records.length !== 1 ? 's' : ''}`,
      icon: 'list-outline',
      iconBg: '#E6F1FB',
      iconColor: '#185FA5',
    },
    {
      id: 'total',
      title: 'Total Gastado',
      subtitle: totalSpent > 0 ? `$${totalSpent.toLocaleString('es-CL')} en ${totalLiters.toFixed(1)}L` : 'Sin registros aún',
      icon: 'wallet-outline',
      iconBg: '#E1F5EE',
      iconColor: '#0F6E56',
    },
    {
      id: 'consumption',
      title: 'Consumo Promedio',
      subtitle: consumptionData.avg > 0 ? `${consumptionData.avg.toFixed(1)} km/L` : 'km/L de tu moto',
      icon: 'speedometer-outline',
      iconBg: '#FAEEDA',
      iconColor: '#854F0B',
    },
    {
      id: 'graphics',
      title: 'Gráficos',
      subtitle: currentYearTotal > 0 ? `$${currentYearTotal.toLocaleString('es-CL')} en ${currentYear}` : 'Sin datos este año',
      icon: 'bar-chart-outline',
      iconBg: '#F3E8FF',
      iconColor: '#6B21A8',
    },
  ];

  const handleSectionPress = (section: FuelSection) => {
    if (section.id === 'records') {
      setSelectedSection('records');
    } else if (section.id === 'total') {
      showAlert('Total Gastado', totalSpent > 0
        ? `Has gastado un total de $${totalSpent.toLocaleString('es-CL')} en ${totalLiters.toFixed(1)} litros de combustible.`
        : 'Aún no tienes registros de combustible.', [{ text: 'OK' }], 'wallet-outline', '#0F6E56');
    } else if (section.id === 'consumption') {
      setSelectedSection('consumption');
    } else if (section.id === 'graphics') {
      setSelectedSection('charts');
    }
  };

  const renderSection = ({ item }: { item: FuelSection }) => (
    <TouchableOpacity
      style={[styles.sectionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => handleSectionPress(item)}
    >
      <View style={[styles.sectionChip, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={20} color={item.iconColor} />
      </View>
      <View style={styles.sectionContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderRecord = ({ item }: { item: FuelRecord }) => (
    <View style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Top row: Station name + Total pill + Trash button */}
      <View style={styles.recordTopRow}>
        <View style={styles.recordTopLeft}>
          <Text style={[styles.recordStation, { color: colors.text }]} numberOfLines={1}>
            {item.stationName || 'Sin nombre'}
          </Text>
          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>${item.totalCost.toLocaleString('es-CL')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Divider + price per liter / liters / octane */}
      <View style={[styles.recordBottomRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.recordPrice, { color: colors.textMuted }]}>${item.pricePerLiter.toLocaleString('es-CL')}/L</Text>
        <Text style={[styles.recordLiters, { color: colors.textMuted }]}>{item.liters.toFixed(1)} L{item.octane ? ` · ${item.octane} octanos` : ''}</Text>
      </View>

      {/* Kilometers at fill */}
      {item.kilometersAtFill != null && (
        <View style={styles.recordKmRow}>
          <Ionicons name="speedometer-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.recordKm, { color: colors.textMuted }]}>{item.kilometersAtFill.toLocaleString('es-CL')} km</Text>
        </View>
      )}

      {/* Date with calendar icon */}
      <View style={styles.recordDateRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
        <Text style={[styles.recordDate, { color: colors.textMuted }]}>{formatDate(item.recordedAt)}</Text>
      </View>

      {/* Location if exists */}
      {item.location ? (
        <View style={[styles.recordLocation, { borderTopColor: colors.border }]}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.recordLocationText, { color: colors.textMuted }]} numberOfLines={1}>{item.location}</Text>
        </View>
      ) : null}
    </View>
  );
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  // --- Records List View ---
  if (selectedSection === 'records') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {records.length > 0 ? (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderRecord}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="water-outline" size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('noRecords')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('noRecordsSub')}</Text>
          </View>
        )}

        {/* FAB: + */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Text style={[styles.fabText, { color: '#fff' }]}>+</Text>
        </TouchableOpacity>

        {/* Create Modal */}
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={[styles.modal, { backgroundColor: colors.background }]}>
              <View style={styles.modalTopRow}>
                <TouchableOpacity onPress={closeModal} style={{ marginLeft: 'auto' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                <View style={styles.modalLogoContainer}>
                  <Image
                    source={require('../../../../assets/nombre.jpeg')}
                    style={styles.modalLogo}
                    resizeMode="contain"
                  />
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Nueva Carga</Text>
                </View>

                {/* Total destacado */}
                <View style={[styles.totalHero, { backgroundColor: colors.primary }]}>
                  <Text style={styles.totalHeroLabel}>Total de esta carga</Text>
                  <Text style={styles.totalHeroValue}>
                    {form.liters && form.pricePerLiter
                      ? `$${(Number(form.liters) * Number(form.pricePerLiter)).toLocaleString('es-CL')}`
                      : '$0'}
                  </Text>
                  <Text style={styles.totalHeroSub}>
                    {form.liters || '0'} L × ${form.pricePerLiter || '0'}
                  </Text>
                </View>

                {/* Litros + Precio como stat boxes */}
                <View style={styles.statRow}>
                  <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: errors.liters ? colors.danger : colors.border }]}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('liters')} *</Text>
                    <TextInput
                      style={[styles.statInput, { color: colors.text }]}
                      placeholder="5.5"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={form.liters}
                      onChangeText={(txt) => { setForm((p) => ({ ...p, liters: txt })); setErrors((p) => ({ ...p, liters: '' })); }}
                    />
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: errors.pricePerLiter ? colors.danger : colors.border }]}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Precio/Litro *</Text>
                    <TextInput
                      style={[styles.statInput, { color: colors.text }]}
                      placeholder="1200"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={form.pricePerLiter}
                      onChangeText={(txt) => { setForm((p) => ({ ...p, pricePerLiter: txt })); setErrors((p) => ({ ...p, pricePerLiter: '' })); }}
                    />
                  </View>
                </View>
                {errors.liters ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.liters}</Text> : null}
                {errors.pricePerLiter ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.pricePerLiter}</Text> : null}

                {/* Octanaje */}
                <View style={styles.octaneRow}>
                  {(["93'", "95'", "97'"] as const).map((val) => (
                    <TouchableOpacity
                      key={val}
                      activeOpacity={0.7}
                      style={[
                        styles.octaneBtn,
                        { borderColor: colors.inputBorder, backgroundColor: colors.surface },
                        form.octane === val && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setForm((p) => ({ ...p, octane: p.octane === val ? '' : val }))}
                    >
                      <Text style={[styles.octaneBtnText, { color: colors.text }, form.octane === val && { color: '#fff' }]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Bencinera, ubicación, km, fecha — card agrupada */}
                <View style={[styles.groupCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={styles.groupRow}>
                    <Ionicons name="storefront-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.groupInput, { color: colors.text }]}
                      placeholder="Bencinera (ej: Copec, Shell...)"
                      placeholderTextColor={colors.textMuted}
                      value={form.stationName}
                      onChangeText={(txt) => setForm((p) => ({ ...p, stationName: txt }))}
                    />
                  </View>
                  <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.groupRow}>
                    <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.groupInput, { color: colors.text }]}
                      placeholder={t('locationPlaceholderFuel')}
                      placeholderTextColor={colors.textMuted}
                      value={form.location}
                      onChangeText={(txt) => setForm((p) => ({ ...p, location: txt }))}
                    />
                    <TouchableOpacity onPress={getLocation} disabled={gettingLocation}>
                      {gettingLocation ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.groupInlineAction, { color: colors.primary }]}>GPS</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.groupRow}>
                    <Ionicons name="speedometer-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.groupInput, { color: colors.text }]}
                      placeholder="Kilometraje al cargar"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={form.kilometersAtFill}
                      onChangeText={(txt) => setForm((p) => ({ ...p, kilometersAtFill: txt }))}
                    />
                  </View>
                  <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />

                  <TouchableOpacity style={styles.groupRow} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.groupInput, { color: form.recordedAt ? colors.text : colors.textMuted, paddingVertical: 13 }]}>
                      {form.recordedAt ? formatDate(form.recordedAt) : t('selectDate')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.recordedAt ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.recordedAt}</Text> : null}

                {showDatePicker && (
                  <DateTimePicker
                    value={form.recordedAt ? new Date(form.recordedAt) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && date) {
                        const iso = date.toISOString().split('T')[0];
                        setForm((p) => ({ ...p, recordedAt: iso }));
                        setErrors((p) => ({ ...p, recordedAt: '' }));
                      }
                    }}
                  />
                )}

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </ScrollView>
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
      </View>
    );
  }

  // --- Consumption View ---
  if (selectedSection === 'consumption') {
    const { entries, avg } = consumptionData;
    const hasKmData = records.some((r) => r.kilometersAtFill != null);

    if (records.length === 0) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="speedometer-outline" size={56} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.empty, { color: colors.textMuted }]}>Sin datos de consumo</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>Registra cargas de combustible con kilometraje para ver tu consumo promedio.</Text>
          <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {!hasKmData ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="speedometer-outline" size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.empty, { color: colors.textMuted }]}>Sin datos de consumo</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }, { textAlign: 'center' }]}>
                Para calcular el consumo necesitas registrar el kilometraje al momento de cargar combustible.
              </Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="speedometer-outline" size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.empty, { color: colors.textMuted }]}>Se necesitan al menos 2 cargas con km</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }, { textAlign: 'center' }]}>
                El consumo se calcula comparando el kilometraje entre dos cargas consecutivas.
              </Text>
            </View>
          ) : (
            <>
              {/* Average consumption card */}
              <View style={[styles.avgCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.avgIconWrap, { backgroundColor: '#FAEEDA' }]}>
                  <Ionicons name="speedometer-outline" size={24} color="#854F0B" />
                </View>
                <View style={styles.avgValueRow}>
                  <Text style={[styles.avgValue, { color: colors.text }]}>{avg.toFixed(1)}</Text>
                  <Text style={[styles.avgUnit, { color: colors.textMuted }]}>km/L</Text>
                </View>
                <Text style={[styles.avgLabel, { color: colors.text }]}>Consumo promedio</Text>
                <Text style={[styles.avgSub, { color: colors.textMuted }]}>
                  Basado en {entries.length} tramo{entries.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Info card explaining how it works */}
              <View style={[styles.consumptionInfoCard, { backgroundColor: colors.brandBlueBg }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.brandBlue} style={{ marginRight: 6 }} />
                  <Text style={[styles.infoTitle, { color: colors.brandBlue }]}>¿Cómo se calcula?</Text>
                </View>
                <Text style={[styles.consumptionInfoText, { color: colors.brandBlue }]}>
                  Cada barra compara el kilometraje entre dos cargas consecutivas. Ej: si cargaste con 5.000 km y después con 5.200 km, y pusiste 5 litros, rindió 40 km/L en ese tramo. Solo aparecen tramos donde ambas cargas tienen kilometraje registrado.
                </Text>
              </View>

              {/* Last consumptions */}
              <Text style={[styles.sectionTitleDetail, { color: colors.textMuted }]}>Últimos consumos</Text>
              <View style={[styles.consumptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[...entries].reverse().slice(0, 10).map((entry, i, arr) => {
                  const barWidth = avg > 0 ? (entry.kmPerLiter / (avg * 1.5)) * 100 : 0;
                  const date = new Date(entry.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                  const isLast = i === arr.length - 1;
                  return (
                    <View key={i} style={[styles.consumptionRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <View style={styles.consumptionLeft}>
                        <Text style={[styles.consumptionDate, { color: colors.text }]}>{date}</Text>
                        <Text style={[styles.consumptionDetail, { color: colors.textMuted }]}>
                          {entry.liters.toFixed(1)} L · {entry.kmDiff.toLocaleString('es-CL')} km
                        </Text>
                      </View>
                      <View style={styles.consumptionBar}>
                        <View style={[styles.consumptionBarTrack, { backgroundColor: colors.border }]}>
                          <View style={[styles.consumptionBarFill, { width: `${Math.min(barWidth, 100)}%`, backgroundColor: colors.primary }]} />
                        </View>
                      </View>
                      <Text style={[styles.consumptionValue, { color: colors.text }]}>{entry.kmPerLiter.toFixed(1)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          buttons={alertButtons}
          icon={alertIcon}
          iconColor={alertIconColor}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    );
  }

  // --- Charts View ---
  if (selectedSection === 'charts') {
    const { entries, avg, maxConsumption } = consumptionData;
    const maxExpense = monthlyExpenses.length > 0 ? Math.max(...monthlyExpenses.map(([, v]) => v)) : 0;

    if (records.length === 0) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="bar-chart-outline" size={56} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.empty, { color: colors.textMuted }]}>Sin datos para gráficos</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>Registra cargas de combustible para ver tendencias de consumo y gastos.</Text>
          <CustomAlert visible={alertVisible} title={alertTitle} message={alertMessage} buttons={alertButtons} icon={alertIcon} iconColor={alertIconColor} onClose={() => setAlertVisible(false)} />
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Consumption trend */}
          <Text style={[styles.sectionTitleDetail, { color: colors.textMuted }]}>Tendencia de Consumo</Text>
          {entries.length === 0 ? (
            <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 20, alignItems: 'center' }]}>
              <Ionicons name="speedometer-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptySub, { color: colors.textMuted, marginTop: 8, textAlign: 'center' }]}>
                Registra al menos 2 cargas con kilometraje para ver tendencias.
              </Text>
            </View>
          ) : (
            <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, paddingHorizontal: 16 }]}>
              {[...entries].reverse().slice(0, 10).map((entry, i, arr) => {
                const pct = maxConsumption > 0 ? (entry.kmPerLiter / maxConsumption) * 100 : 0;
                const date = new Date(entry.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                const isLow = entry.kmPerLiter < avg * 0.85;
                const isLast = i === arr.length - 1;
                return (
                  <View key={i} style={[styles.chartRow, isLast && { borderBottomWidth: 0 }, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.chartLabel, { color: colors.text }]}>{date}</Text>
                    <View style={styles.chartBarTrack}>
                      <View style={[styles.chartBarFill, {
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: isLow ? colors.danger : colors.success,
                      }]} />
                    </View>
                    <Text style={[styles.chartValue, { color: colors.text }]}>{entry.kmPerLiter.toFixed(1)}</Text>
                  </View>
                );
              })}
              <View style={[styles.chartAvgRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.chartAvg, { color: colors.textSecondary }]}>
                  Promedio: {avg.toFixed(1)} km/L
                </Text>
              </View>
            </View>
          )}
          <Text style={[styles.chartSub, { color: colors.textMuted }]}>km/L por carga (últimas 10)</Text>

          {/* Current year - 12 month comparison grid */}
          <Text style={[styles.sectionTitleDetail, { color: colors.textMuted, marginTop: 28 }]}>Comparativa {currentYear}</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.yearGrid}>
              {MONTH_LABELS.map((label, i) => {
                const total = currentYearMonthly[i];
                const pct = currentYearTotal > 0 ? (total / currentYearTotal) * 100 : 0;
                const isCurrentMonth = i === new Date().getMonth();
                return (
                  <View key={i} style={styles.yearGridItem}>
                    {total > 0 && (
                      <Text style={[styles.yearGridValue, { color: colors.text }]}>{`$${(total / 1000).toFixed(1)}k`}</Text>
                    )}
                    <View style={styles.yearGridTrack}>
                      <View style={[styles.yearGridFill, {
                        height: total > 0 ? `${Math.max(pct, 4)}%` : 2,
                        backgroundColor: total > 0 ? colors.primary : colors.border,
                      }]} />
                    </View>
                    <Text style={[styles.yearGridMonth, { color: isCurrentMonth ? colors.primary : colors.textMuted, fontWeight: isCurrentMonth ? '600' : '400' }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={[styles.chartSub, { color: colors.textMuted }]}>Gasto por mes en el año calendario</Text>

          {/* Annual total */}
          <Text style={[styles.sectionTitleDetail, { color: colors.textMuted, marginTop: 28 }]}>Gasto Anual {currentYear}</Text>
          <View style={[styles.avgCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 0 }]}>
            <View style={[styles.avgIconWrap, { backgroundColor: '#E1F5EE' }]}>
              <Ionicons name="wallet-outline" size={22} color="#0F6E56" />
            </View>
            <Text style={[styles.avgValue, { color: colors.text }]}>${currentYearTotal.toLocaleString('es-CL')}</Text>
            <Text style={[styles.avgLabel, { color: colors.text }]}>gastado en {currentYear}</Text>
            <View style={[styles.infoRow, { marginTop: 8, gap: 5 }]}>
              <Ionicons name="refresh-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.avgSub, { color: colors.textMuted, marginTop: 0 }]}>
                Se reinicia el 31 de diciembre
              </Text>
            </View>
          </View>
        </ScrollView>

        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          buttons={alertButtons}
          icon={alertIcon}
          iconColor={alertIconColor}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    );
  }

  // --- Main Menu View ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: '#FFF6D9', borderColor: '#C79000' }]}>
        <View style={[styles.headerIcon, { backgroundColor: '#8A6D00' }]}>
          <Ionicons name="water" size={28} color="#FFFFFF" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Combustible</Text>
          <Text style={styles.headerSubtitle}>Gestiona los registros de carga de tu moto</Text>
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderSection}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={[styles.infoCard, { backgroundColor: colors.brandBlueBg, borderColor: colors.brandBlue }]}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
              <Text style={[styles.infoTitle, { color: colors.brandBlue + '99' }]}>¿Por qué registrar tu combustible?</Text>
            </View>
            <Text style={[styles.infoText, { color: colors.brandBlue + '99', marginTop: 8 }]}>
              Llevar un registro de tus cargas te permite calcular el consumo real de tu moto, detectar
              variaciones en el rendimiento y estimar tu gasto mensual en combustible.
            </Text>
          </View>
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 8, fontSize: 16 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Header Card
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    marginBottom: 8,
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#6B5400' },
  headerSubtitle: { fontSize: 13, marginTop: 2, color: '#8A7000' },

  // Section Button
  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
  },
  sectionChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContent: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  sectionTitleDetail: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },

  // Record Card
  recordCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordTopLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalPill: {
    backgroundColor: '#E1F5EE',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  totalPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F6E56',
  },
  recordBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 8,
    marginBottom: 8,
  },
  recordPrice: { fontSize: 13 },
  recordLiters: { fontSize: 14, fontWeight: '700' },
  recordDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  recordDate: { fontSize: 12 },
  recordStation: { fontSize: 15, fontWeight: '600' },
  deleteBtn: { padding: 4, marginLeft: 'auto' },
  recordTotal: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  recordLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  recordLocationText: { fontSize: 12, flex: 1 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, fontWeight: '300', marginTop: -2 },

  // Location Button
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  locationBtnText: { fontSize: 14, fontWeight: '600' },

  // Octane Selector
  octaneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  octaneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  octaneBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalTopRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
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
  totalHero: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalHeroLabel: { fontSize: 12, color: '#fff', opacity: 0.85 },
  totalHeroValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 4 },
  totalHeroSub: { fontSize: 12, color: '#fff', opacity: 0.85, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  statLabel: { fontSize: 11, marginBottom: 6 },
  statInput: { fontSize: 18, fontWeight: '600', padding: 0 },
  groupCard: { borderWidth: 1, borderRadius: 12, marginTop: 16, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  groupInput: { flex: 1, fontSize: 14, paddingVertical: 13 },
  groupInlineAction: { fontSize: 12, fontWeight: '500' },
  groupDivider: { height: 1, marginHorizontal: 14 },
  inputLabel: { fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  errorText: { fontSize: 12, marginBottom: 8, marginTop: -2 },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 18, fontWeight: '700' },
  saveBtn: {
    borderRadius: 30,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  infoText: { fontSize: 13, lineHeight: 18 },

  // Consumption view — info card (dedicated, does not affect other screens)
  consumptionInfoCard: {
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  consumptionInfoText: { fontSize: 12, lineHeight: 18, marginTop: 8 },

  // Record kilometers
  recordKmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordKm: { fontSize: 12 },

  // Average consumption
  avgCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  avgIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avgValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  avgValue: { fontSize: 42, fontWeight: '500' },
  avgUnit: { fontSize: 14 },
  avgLabel: { fontSize: 13, fontWeight: '600', marginTop: 14 },
  avgSub: { fontSize: 12, marginTop: 2 },

  // Section label
  sectionLabel: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

  // Consumption list card + rows
  consumptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  consumptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  consumptionLeft: { minWidth: 64 },
  consumptionDate: { fontSize: 13 },
  consumptionDetail: { fontSize: 11, marginTop: 2 },
  consumptionBar: { flex: 1 },
  consumptionBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  consumptionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  consumptionValue: { fontSize: 14, fontWeight: '500', minWidth: 40, textAlign: 'right' },

  // Chart card
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  chartLabel: { fontSize: 11, width: 44 },
  chartBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  chartValue: { fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' },
  chartAvgRow: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 12,
    alignItems: 'center',
  },
  chartAvg: { fontSize: 12, textAlign: 'center' },
  chartSub: { fontSize: 12, marginTop: 6 },

  // Year grid (12-month comparison)
  yearGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 8,
    height: 150,
  },
  yearGridItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  yearGridMonth: { fontSize: 9, marginTop: 5 },
  yearGridTrack: {
    width: 8,
    flex: 1,
    justifyContent: 'flex-end',
    maxHeight: 90,
  },
  yearGridFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  yearGridValue: { fontSize: 9, marginBottom: 4, fontWeight: '500' },
});