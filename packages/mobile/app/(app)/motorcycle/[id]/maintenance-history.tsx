import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listMaintenance, MaintenanceRecord } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';

const TYPE_KEYS: Record<string, string> = {
  motor_oil: 'Aceite de motor',
  air_filter: 'Filtro de aire',
  drive_chain: 'Transmisión',
  brakes: 'Frenos',
  spark_plugs: 'Bujías',
  tires: 'Neumáticos',
  battery: 'Batería',
  coolant: 'Refrigerante',
  general: 'General',
};

export default function MaintenanceHistoryScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const typeName = type && TYPE_KEYS[type] ? TYPE_KEYS[type] : 'Mantención';

  useEffect(() => {
    navigation.setOptions({
      title: typeName,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.push(`/(app)/motorcycle/${id}/maintenance`)} style={{ marginLeft: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, typeName, id, router, colors]);

  useEffect(() => {
    loadRecords();
  }, [id]);

  const loadRecords = async () => {
    try {
      const all = await listMaintenance(id);
      const filtered = type ? all.filter((r: MaintenanceRecord) => r.type === type) : all;
      setRecords(filtered.sort((a: MaintenanceRecord, b: MaintenanceRecord) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()));
    } catch (e) {
      console.error('Failed to load maintenance records', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {records.length > 0 ? (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecords(); }} tintColor={colors.primary} />}
          renderItem={({ item: rec }) => (
            <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.historyCardRow}>
                {rec.photoUrl ? (
                  <Image source={{ uri: rec.photoUrl }} style={styles.historyThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.historyThumbPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="build-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.historyCardTitle, { color: colors.text }]}>{rec.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.historyCardMeta, { color: colors.textMuted }]}>
                      {new Date(rec.serviceDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.historyCardMeta, { color: colors.textMuted }]}>
                      {rec.kilometersAtService.toLocaleString('es-CL')} km
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>·</Text>
                    <Ionicons name="cash-outline" size={12} color={colors.success} />
                    <Text style={[styles.historyCardMeta, { color: colors.success }]}>
                      ${rec.cost != null ? rec.cost.toLocaleString('es-CL') : '0'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="build-outline" size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sin registros de mantenimiento</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  historyCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  historyCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  historyThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  historyCardMeta: { fontSize: 12 },
  emptyText: { fontSize: 15, marginTop: 4 },
});
