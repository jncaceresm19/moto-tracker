import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { useAuth } from '../../src/auth-context';
import { listMotorcycles, Motorcycle } from '../../src/api';
import { DashboardPanel } from '../../src/components/DashboardPanel';
import { TheftAlertCard } from '../../src/components/TheftAlertCard';
import { OfferCard } from '../../src/components/OfferCard';
import { GasStation, getNearbyGasStations, getCurrentLocation, getCachedGasStations, getLastUpdateLabel } from '../../src/services/gasStations';
import { TheftAlert, getTheftAlerts, closeAlert, createTheftAlert } from '../../src/services/theftAlertService';
import { shareToSpecificPlatform } from '../../src/services/shareService';
import { NearbyPlace, getNearbyPlaces } from '../../src/services/nearbyPlaces';
import { PlaceCard } from '../../src/components/PlaceCard';
import { ActiveMoto, getActiveMoto, activateMoto, deactivateMoto, formatActivationTime } from '../../src/services/activeMoto';
import { ActiveMotoModal } from '../../src/components/ActiveMotoModal';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [theftAlerts, setTheftAlerts] = useState<TheftAlert[]>([]);
  const [theftComments, setTheftComments] = useState<Record<string, { id: string; userName: string; userAvatar?: string; text: string; timeAgo: string }[]>>({});
  const [lastGasUpdate, setLastGasUpdate] = useState<string | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [activeMoto, setActiveMoto] = useState<ActiveMoto | null>(null);
  const [showActiveMotoModal, setShowActiveMotoModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'ahora mismo';
    if (minutes < 60) return `hace ${minutes} min`;
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${days}d`;
  };

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
      // First, load cached data immediately for fast display
      const cachedStations = await getCachedGasStations();
      if (cachedStations.length > 0) {
        console.log('[GAS] Loaded', cachedStations.length, 'cached stations');
        setGasStations(cachedStations);
      }

      // Load last update timestamp
      const updateLabel = await getLastUpdateLabel();
      setLastGasUpdate(updateLabel);

      // Then try to refresh from API
      try {
        const { lat, lon } = await getCurrentLocation();
        console.log('[GAS] Location:', lat, lon);
        const stations = await getNearbyGasStations(lat, lon);
        console.log('[GAS] Found:', stations.length, 'stations');
        if (stations.length > 0) {
          console.log('[GAS] First station:', stations[0].brand, stations[0].address, stations[0].price93);
        }
        setGasStations(stations);
        
        // Update timestamp after refresh
        const newLabel = await getLastUpdateLabel();
        setLastGasUpdate(newLabel);
      } catch (locationError: any) {
        console.log('[GAS] Location/API error:', locationError?.message || 'Unknown');
        // Keep cached data if available
      }
    } catch (e: any) {
      console.log('[GAS] Error:', e?.message || 'Unknown');
    }
  }, []);

  const loadTheftAlerts = useCallback(async () => {
    try {
      const alerts = await getTheftAlerts();
      setTheftAlerts(alerts);
    } catch (e: any) {
      console.log('[THEFT] Error loading alerts:', e?.message || 'Unknown');
    }
  }, []);

  const loadNearbyPlaces = useCallback(async () => {
    console.log('[NEARBY] === START loadNearbyPlaces ===');
    try {
      console.log('[NEARBY] Requesting location...');
      const loc = await getCurrentLocation();
      console.log('[NEARBY] Location OK:', loc.lat, loc.lon);
      console.log('[NEARBY] Calling getNearbyPlaces...');
      const places = await getNearbyPlaces(loc.lat, loc.lon);
      console.log('[NEARBY] Places result:', places.length, 'places');
      if (places.length > 0) {
        console.log('[NEARBY] First place:', places[0].name, places[0].category);
      }
      setNearbyPlaces(places);
    } catch (e: any) {
      console.log('[NEARBY] === ERROR ===', e?.message || String(e));
      console.log('[NEARBY] Error name:', e?.name);
      console.log('[NEARBY] Error stack:', e?.stack?.substring(0, 200));
    }
  }, []);

  const loadActiveMoto = useCallback(async () => {
    try {
      const active = await getActiveMoto();
      setActiveMoto(active);
    } catch (e: any) {
      console.log('[ACTIVE_MOTO] Error:', e?.message || 'Unknown');
    }
  }, []);

  useEffect(() => {
    console.log('[NEARBY] useEffect fired');
    // Load cached gas stations immediately on mount (no await - runs in background)
    loadGasStations();
    loadMotorcycles();
    loadTheftAlerts();
    loadNearbyPlaces();
    loadActiveMoto();
  }, [loadMotorcycles, loadGasStations, loadTheftAlerts, loadNearbyPlaces, loadActiveMoto]);

  // Refresh theft alerts when returning from other screens (e.g. manual publication)
  useFocusEffect(
    useCallback(() => {
      loadTheftAlerts();
    }, [loadTheftAlerts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMotorcycles(), loadGasStations(), loadTheftAlerts(), loadNearbyPlaces(), loadActiveMoto()]);
    setRefreshing(false);
  };

  // Prioritize motorcycle with GPS enabled
  const motoWithGps = motorcycles.find(m => m.gpsTracker);
  const defaultMoto = motoWithGps || motorcycles[0];
  const hasGps = !!motoWithGps;
  const hasAlerts = theftAlerts.length > 0;

  const handleMarkAsFound = async (alertId: string) => {
    try {
      await closeAlert(alertId, 'recovered');
      // Refresh alerts — recovered alerts won't show in active list
      await loadTheftAlerts();
    } catch (e: any) {
      console.log('[THEFT] Error marking as found:', e?.message);
    }
  };

  const handleActivateMoto = async (motorcycleId: string) => {
    try {
      let lat: number | undefined;
      let lon: number | undefined;
      
      try {
        const loc = await getCurrentLocation();
        lat = loc.lat;
        lon = loc.lon;
      } catch (e) {
        console.log('[ACTIVE_MOTO] Location error, activating without location');
      }
      
      const active = await activateMoto(motorcycleId, lat, lon);
      setActiveMoto(active);
    } catch (e: any) {
      console.log('[ACTIVE_MOTO] Error activating:', e?.message);
    }
  };

  const handleDeactivateMoto = async () => {
    try {
      await deactivateMoto();
      setActiveMoto(null);
    } catch (e: any) {
      console.log('[ACTIVE_MOTO] Error deactivating:', e?.message);
    }
  };

  const handleReportTheft = async () => {
    if (!activeMoto) return;
    
    const moto = motorcycles.find(m => m.id === activeMoto.motorcycleId);
    if (!moto) return;
    
    try {
      // Create theft alert with activation location
      await createTheftAlert({
        motorcycleId: moto.id,
        lastLatitude: activeMoto.activationLat || 0,
        lastLongitude: activeMoto.activationLon || 0,
        lastLocationName: `Estacionada en ${activeMoto.activationLat?.toFixed(4)}, ${activeMoto.activationLon?.toFixed(4)}`,
      });
      
      // Deactivate after reporting
      await handleDeactivateMoto();
      
      // Refresh alerts
      await loadTheftAlerts();
    } catch (e: any) {
      console.log('[THEFT] Error reporting theft:', e?.message);
    }
  };

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
        {(() => {
          // If there's an active moto, show its info
          const activeMotoMotorcycle = activeMoto ? motorcycles.find(m => m.id === activeMoto.motorcycleId) : null;
          
          // Otherwise show the default moto (with GPS or first one)
          const displayMoto = activeMotoMotorcycle || defaultMoto;
          
          return (
            <DashboardPanel
              motorcycleName={displayMoto ? `${displayMoto.brand} ${displayMoto.model}` : ''}
              plate={displayMoto?.licensePlate}
              status={activeMoto ? 'safe' : 'safe'}
              lastLocationTime={activeMoto ? formatActivationTime(activeMoto.activatedAt) : (hasGps ? new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--')}
              address=""
              timeAgo=""
              hasGps={hasGps}
              isActive={!!activeMoto}
              activatedAt={activeMoto?.activatedAt}
              activationAddress={activeMoto?.activationLat && activeMoto?.activationLon ? `${activeMoto.activationLat.toFixed(4)}, ${activeMoto.activationLon.toFixed(4)}` : undefined}
              onLongPress={() => setShowActiveMotoModal(true)}
            />
          );
        })()}

        {/* Active Moto Modal */}
        <ActiveMotoModal
          visible={showActiveMotoModal}
          onClose={() => setShowActiveMotoModal(false)}
          motorcycles={motorcycles}
          activeMoto={activeMoto}
          onActivate={handleActivateMoto}
          onDeactivate={handleDeactivateMoto}
          onReportTheft={handleReportTheft}
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('theftAlerts')}</Text>
            <TouchableOpacity 
              style={[styles.testBtn, { backgroundColor: colors.alertRed }]}
              onPress={() => {
                const moto = defaultMoto;
                const fakeAlert: TheftAlert = {
                  id: `test-${Date.now()}`,
                  motorcycleId: moto?.id || '',
                  brand: moto?.brand || 'Honda',
                  model: moto?.model || 'CB 500F',
                  licensePlate: moto?.licensePlate || 'AB-12-34',
                  lastLocationName: 'Av. Providencia 1234, Santiago',
                  lastLatitude: -33.4489,
                  lastLongitude: -70.6693,
                  createdAt: new Date(),
                  status: 'active',
                  userId: user?.id || '',
                  photoUrl: moto?.imageUrl || undefined,
                };
                setTheftAlerts(prev => [fakeAlert, ...prev]);
              }}
            >
              <Ionicons name="add-circle-outline" size={14} color="#fff" />
              <Text style={styles.testBtnText}>Simular</Text>
            </TouchableOpacity>
          </View>
          {hasAlerts ? (
            theftAlerts.length === 1 ? (
              <TheftAlertCard
                key={theftAlerts[0].id}
                title={`${theftAlerts[0].brand} ${theftAlerts[0].model} - ROBADA`}
                metadata={theftAlerts[0].lastLocationName || 'Ubicación desconocida'}
                timeAgo={formatTimeAgo(theftAlerts[0].createdAt)}
                photoUrl={theftAlerts[0].photoUrl}
                status={theftAlerts[0].status as 'active' | 'recovered' | 'closed'}
                recoveredAt={theftAlerts[0].recoveredAt}
                alertOwnerId={theftAlerts[0].userId}
                responses={theftComments[theftAlerts[0].id] || []}
                onWhatsApp={() => shareToSpecificPlatform(theftAlerts[0], 'whatsapp')}
                onInstagram={() => shareToSpecificPlatform(theftAlerts[0], 'instagram')}
                onMarkAsFound={() => handleMarkAsFound(theftAlerts[0].id)}
                onComment={(text) => {
                  const alertId = theftAlerts[0].id;
                  const newComment = {
                    id: `comment-${Date.now()}`,
                    userName: user?.name || user?.email?.split('@')[0] || 'Usuario',
                    userAvatar: user?.avatarUrl,
                    text,
                    timeAgo: 'ahora mismo',
                  };
                  setTheftComments(prev => ({
                    ...prev,
                    [alertId]: [...(prev[alertId] || []), newComment],
                  }));
                }}
              />
            ) : (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={Dimensions.get('window').width - 56}
                decelerationRate="fast"
                contentContainerStyle={styles.horizontalScroll}
              >
                {theftAlerts.map((alert) => (
                  <View key={alert.id} style={{ width: Dimensions.get('window').width - 56, marginRight: 12 }}>
                    <TheftAlertCard
                      title={`${alert.brand} ${alert.model} - ROBADA`}
                      metadata={alert.lastLocationName || 'Ubicación desconocida'}
                      timeAgo={formatTimeAgo(alert.createdAt)}
                      photoUrl={alert.photoUrl}
                      status={alert.status as 'active' | 'recovered' | 'closed'}
                      recoveredAt={alert.recoveredAt}
                      alertOwnerId={alert.userId}
                      responses={theftComments[alert.id] || []}
                      onWhatsApp={() => shareToSpecificPlatform(alert, 'whatsapp')}
                      onInstagram={() => shareToSpecificPlatform(alert, 'instagram')}
                      onMarkAsFound={() => handleMarkAsFound(alert.id)}
                      onComment={(text) => {
                        const newComment = {
                          id: `comment-${Date.now()}`,
                          userName: user?.name || user?.email?.split('@')[0] || 'Usuario',
                          userAvatar: user?.avatarUrl,
                          text,
                          timeAgo: 'ahora mismo',
                        };
                        setTheftComments(prev => ({
                          ...prev,
                          [alert.id]: [...(prev[alert.id] || []), newComment],
                        }));
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            )
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
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offersScroll}>
                {gasStations.map((station) => (
                  <OfferCard
                    key={station.id}
                    brandLogo={station.brandLogo}
                    brandName={station.brand}
                    location={`${station.address}${station.comuna ? `, ${station.comuna}` : ''}`}
                    distance={`${station.distance.toFixed(1)} km`}
                    price93={station.price93}
                    price95={station.price95}
                    price97={station.price97}
                  />
                ))}
              </ScrollView>
              {lastGasUpdate && (
                <Text style={[styles.lastUpdateText, { color: colors.inkFaint }]}>
                  Precios {lastGasUpdate}
                </Text>
              )}
            </>
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

        {/* Section: Servicios cercanos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('nearbyServices')}</Text>
          {nearbyPlaces.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offersScroll}>
              {nearbyPlaces.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyCardIcon}>🔧</Text>
              <Text style={[styles.emptyCardTitle, { color: colors.ink }]}>{t('nearbyServicesEmpty')}</Text>
              <Text style={[styles.emptyCardText, { color: colors.inkFaint }]}>
                {t('loadingPlaces')}
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  testBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  emptyCardIcon: { fontSize: 32, marginBottom: 10 },
  emptyCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyCardText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  offersScroll: { paddingRight: 16 },
  horizontalScroll: { paddingRight: 16 },
  lastUpdateText: { fontSize: 11, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
});