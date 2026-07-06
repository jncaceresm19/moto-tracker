import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { useAuth } from '../../src/auth-context';
import { listMotorcycles, Motorcycle } from '../../src/api';
import { DashboardPanel } from '../../src/components/DashboardPanel';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
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

  useEffect(() => { loadMotorcycles(); }, [loadMotorcycles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMotorcycles();
    setRefreshing(false);
  };

  const firstMoto = motorcycles[0];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
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
        lastLocationTime={new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
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
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyCardIcon]}>🛡️</Text>
          <Text style={[styles.emptyCardTitle, { color: colors.ink }]}>{t('noActiveAlerts')}</Text>
          <Text style={[styles.emptyCardText, { color: colors.inkFaint }]}>
            {t('theftAlertsEmpty')}
          </Text>
        </View>
      </View>

      {/* Section: Ahorra en tu ruta */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('saveOnRoute')}</Text>
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyCardIcon]}>⛽</Text>
          <Text style={[styles.emptyCardTitle, { color: colors.ink }]}>{t('nearbyOffers')}</Text>
          <Text style={[styles.emptyCardText, { color: colors.inkFaint }]}>
            {t('saveOnRouteEmpty')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
