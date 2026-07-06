import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { useAuth } from '../../src/auth-context';
import { listMotorcycles, Motorcycle } from '../../src/api';
import { DashboardPanel } from '../../src/components/DashboardPanel';
import { TheftAlertCard } from '../../src/components/TheftAlertCard';
import { OfferCard } from '../../src/components/OfferCard';
import { GasStation, getNearbyGasStations, getCurrentLocation, BRAND_COLORS } from '../../src/services/gasStations';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMotorcycles = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setMotorcycles(await listMotorcycles());
    } catch {
      // Silent fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadGasStations = useCallback(async () => {
    try {
      const { lat, lon } = await getCurrentLocation();
      console.log('[GAS] Location:', lat, lon);
      const stations = await getNearbyGasStations(lat, lon);
      console.log('[GAS] Found:', stations.length, 'stations');
      setGasStations(stations);
    } catch (e: any) {
      console.log('[GAS] Error:', e?.message || 'Unknown');
    }
  }, []);

  useEffect(() => {
    loadMotorcycles();
    loadGasStations();
  }, [loadMotorcycles, loadGasStations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMotorcycles(), loadGasStations()]);
    setRefreshing(false);
  };

  const firstMoto = motorcycles[0];
  const hasAlerts = false;

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.headerBg }]} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={[styles.brandName, { color: colors.headerTintColor }]}>Moto Tracker</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={19} color={colors.headerTintColor} />
          {hasAlerts && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Dashboard Panel */}
        <DashboardPanel
          motorcycleName={firstMoto ? `${firstMoto.brand} ${firstMoto.model}` : ''}
          plate={firstMoto?.licensePlate}
          status="safe"
          lastLocationTime={new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
          address=""
          timeAgo=""
        />

        {/* Multiple motorcycles indicator */}
        {motorcycles.length > 1 && (
          <Text style={[styles.motoIndicator, { color: colors.inkFaint }]}>
            1 de {motorcycles.length} motos
          </Text>
        )}

        {/* No motorcycles placeholder */}
        {motorcycles.length === 0 && (
          <View style={styles.emptyMotoContainer}>
            <Text style={[styles.emptyMotoText, { color: colors.inkSoft }]}>
              {t('registerFirstMoto')}
            </Text>
          </View>
        )}

        {/* Section: Alertas de robo */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('theftAlerts')}</Text>
          {hasAlerts && firstMoto ? (
            <TheftAlertCard
              title={`${firstMoto.brand} ${firstMoto.model} se movió de su zona segura`}
              metadata={`${firstMoto.licensePlate} · San Juan, Argentina`}
              timeAgo="hace 12 min"
              responses={[
                { name: 'Carlos M.', text: 'Vi la moto por Av. Libertador hace 5 min', timeAgo: 'hace 5 min' },
              ]}
            />
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyCardIcon}>🛡️</Text>
              <Text style={[styles.emptyCardTitle, { color: colors.ink }]}>{t('noActiveAlerts')}</Text>
              <Text style={[styles.emptyCardText, { color: colors.inkFaint }]}>
                {t('theftAlertsEmpty')}
              </Text>
            </View>
          )}
        </View>

        {/* Section: Ahorra en tu ruta */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('saveOnRoute')}</Text>
          {gasStations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offersScroll}>
              {gasStations.map((station) => {
                const brandLower = station.brand.toLowerCase();
                const brandColor = Object.entries(BRAND_COLORS).find(([k]) => brandLower.includes(k))?.[1] || '#F5A623';
                return (
                  <OfferCard
                    key={station.id}
                    brandLogo="flame"
                    brandColor={brandColor}
                    brandName={station.brand || 'Bencinera'}
                    location={station.address || station.name}
                    distance={`${station.distance.toFixed(1)} km`}
                    pricePerLiter={station.pricePerLiter}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyCardIcon}>⛽</Text>
              <Text style={[styles.emptyCardTitle, { color: colors.ink }]}>{t('nearbyOffers')}</Text>
              <Text style={[styles.emptyCardText, { color: colors.inkFaint }]}>
                {t('saveOnRouteEmpty')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 34, height: 34 },
  brandName: { fontSize: 17, fontWeight: '700' },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E14336',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  motoIndicator: { textAlign: 'center', fontSize: 13, marginTop: 8 },
  emptyMotoContainer: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  emptyMotoText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  emptyCardIcon: { fontSize: 32, marginBottom: 10 },
  emptyCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyCardText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  offersScroll: { paddingRight: 16 },
});