import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { TheftAlert, getMyPublications, closeAlert } from '../../src/services/theftAlertService';
import { CustomAlert } from '../../src/components/CustomAlert';

export default function MyPublicationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [publications, setPublications] = useState<TheftAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);

  const loadPublications = useCallback(async () => {
    try {
      const data = await getMyPublications();
      setPublications(data);
    } catch (e: any) {
      console.log('[PUBLICATIONS] Error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPublications();
    setRefreshing(false);
  };

  const handleClose = (alertId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'recovered' : 'closed';
    const statusText = newStatus === 'recovered' ? 'recuperada' : 'cerrada';

    setAlertTitle(`Marcar como ${statusText}`);
    setAlertMessage(`¿Deseas marcar esta alerta como ${statusText}?`);
    setAlertButtons([
      { text: t('cancel'), style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try {
            await closeAlert(alertId, newStatus);
            await loadPublications();
          } catch (e: any) {
            console.log('[PUBLICATIONS] Error closing:', e?.message);
          }
        },
      },
    ]);
    setAlertVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.alertRed;
      case 'recovered': return colors.green;
      case 'closed': return colors.inkFaint;
      default: return colors.inkFaint;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'recovered': return 'Recuperada';
      case 'closed': return 'Cerrada';
      default: return status;
    }
  };

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

  const renderItem = ({ item }: { item: TheftAlert }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>
            {item.brand} {item.model}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.inkSoft }]}>
            {item.licensePlate}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={14} color={colors.inkFaint} />
          <Text style={[styles.detailText, { color: colors.inkFaint }]}>
            {item.lastLocationName || 'Sin ubicación'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={14} color={colors.inkFaint} />
          <Text style={[styles.detailText, { color: colors.inkFaint }]}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
        {item.responseCount !== undefined && item.responseCount > 0 && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble" size={14} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.inkFaint }]}>
              {item.responseCount} {item.responseCount === 1 ? 'respuesta' : 'respuestas'}
            </Text>
          </View>
        )}
      </View>

      {item.status === 'active' && (
        <TouchableOpacity
          style={[styles.closeButton, { borderColor: colors.border }]}
          onPress={() => handleClose(item.id, item.status)}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
          <Text style={[styles.closeButtonText, { color: colors.green }]}>Marcar como recuperada</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <FlatList
        data={publications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, publications.length === 0 && styles.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.inkFaint} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Sin publicaciones</Text>
            <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
              Las alertas de robo que crees aparecerán aquí
            </Text>
          </View>
        }
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon="help-circle"
        iconColor={colors.primary}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 0 },
  listEmpty: { flexGrow: 1 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 14, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardDetails: { marginTop: 12, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13 },
  closeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  closeButtonText: { fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
