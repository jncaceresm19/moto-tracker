import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../../../src/theme-context';
import { useLanguage } from '../../../../src/language-context';

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('locationPermissionNeeded'));
        setLoading(false);
        return;
      }

      setPermissionGranted(true);

      try {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      } catch {
        // No location yet, but permission is granted
      }
      setLoading(false);

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => setLocation(newLoc)
      );
    })();

    return () => { watchRef.current?.remove(); };
  }, []);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionGranted(true);
      setError(null);
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      } catch {}
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => setLocation(newLoc)
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.inkSoft }]}>{t('gettingLocation')}</Text>
      </View>
    );
  }

  // No permission - show message
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="location-outline" size={48} color={colors.inkFaint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>{error}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
          {t('enableGpsToTrack')}
        </Text>
        <TouchableOpacity style={[styles.enableBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={styles.enableBtnText}>{t('enableGps')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permission granted but no location yet - show placeholder
  if (!location) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="map-outline" size={48} color={colors.inkFaint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('waitingForSignal')}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
          {t('searchingLocation')}
        </Text>
        <View style={styles.infoCard}>
          <View style={styles.infoItem}>
            <Ionicons name="speedometer" size={20} color={colors.green} />
            <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('speed')}</Text>
            <Text style={[styles.infoValue, { color: colors.inkFaint }]}>--</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="compass" size={20} color={colors.brandBlue} />
            <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('heading')}</Text>
            <Text style={[styles.infoValue, { color: colors.inkFaint }]}>--</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={20} color={colors.amber} />
            <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('lastUpdate')}</Text>
            <Text style={[styles.infoValue, { color: colors.inkFaint }]}>--:--</Text>
          </View>
        </View>
      </View>
    );
  }

  // Has location - show map and values
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map placeholder - react-native-maps would go here */}
      <View style={[styles.mapPlaceholder, { backgroundColor: colors.surface }]}>
        <Ionicons name="map-outline" size={64} color={colors.inkFaint} />
        <Text style={[styles.mapText, { color: colors.inkSoft }]}>{t('mapView')}</Text>
        <View style={styles.coordsBox}>
          <Text style={[styles.coords, { color: colors.ink }]}>
            {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
          </Text>
          <Text style={[styles.coordsLabel, { color: colors.inkFaint }]}>{t('currentCoords')}</Text>
        </View>
      </View>

      {/* Bottom info card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoItem}>
          <Ionicons name="speedometer" size={20} color={colors.green} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('speed')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {Math.round((location.coords.speed || 0) * 3.6)} km/h
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="compass" size={20} color={colors.brandBlue} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('heading')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {Math.round(location.coords.heading || 0)}°
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time" size={20} color={colors.amber} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('lastUpdate')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {new Date(location.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 15, marginTop: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, paddingHorizontal: 16 },
  enableBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  enableBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: 16, borderRadius: 18 },
  mapText: { fontSize: 15, marginTop: 8 },
  coordsBox: { alignItems: 'center', marginTop: 20 },
  coords: { fontSize: 15, fontFamily: 'monospace', fontWeight: '600' },
  coordsLabel: { fontSize: 12, marginTop: 4 },
  infoCard: { margin: 16, marginBottom: 24, padding: 16, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center', gap: 4 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, fontWeight: '600', fontFamily: 'monospace' },
});
