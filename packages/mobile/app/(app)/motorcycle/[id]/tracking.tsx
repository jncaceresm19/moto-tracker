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
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('locationPermissionNeeded'));
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setLoading(false);

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => setLocation(newLoc)
      );
    })();

    return () => { watchRef.current?.remove(); };
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.inkSoft }]}>{t('gettingLocation')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="location-outline" size={48} color={colors.inkFaint} />
        <Text style={[styles.errorText, { color: colors.ink }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace(`/(app)/motorcycle/${id}`)}>
          <Text style={styles.retryBtnText}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map placeholder - react-native-maps would go here */}
      <View style={[styles.mapPlaceholder, { backgroundColor: colors.surface }]}>
        <Ionicons name="map-outline" size={64} color={colors.inkFaint} />
        <Text style={[styles.mapText, { color: colors.inkSoft }]}>{t('mapView')}</Text>
        {location && (
          <View style={styles.coordsBox}>
            <Text style={[styles.coords, { color: colors.ink }]}>
              {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
            </Text>
            <Text style={[styles.coordsLabel, { color: colors.inkFaint }]}>{t('currentCoords')}</Text>
          </View>
        )}
      </View>

      {/* Bottom info card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoItem}>
          <Ionicons name="speedometer" size={20} color={colors.green} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('speed')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {location ? `${Math.round((location.coords.speed || 0) * 3.6)} km/h` : '--'}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="compass" size={20} color={colors.brandBlue} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('heading')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {location ? `${Math.round(location.coords.heading || 0)}°` : '--'}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time" size={20} color={colors.amber} />
          <Text style={[styles.infoLabel, { color: colors.inkFaint }]}>{t('lastUpdate')}</Text>
          <Text style={[styles.infoValue, { color: colors.ink }]}>
            {location ? new Date(location.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--'}
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
  errorText: { fontSize: 16, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
