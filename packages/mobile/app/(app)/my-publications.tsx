import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';
import { TheftAlert, getMyPublications, closeAlert } from '../../src/services/theftAlertService';
import { CustomAlert } from '../../src/components/CustomAlert';
import { formatPlate } from '../../../backend/src/services/plateValidation';
import { getCurrentLocation } from '../../src/services/gasStations';
import { reverseGeocode } from '../../src/services/geocoding';

export default function MyPublicationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const navigation = useNavigation();
  const [publications, setPublications] = useState<TheftAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [recoverModalVisible, setRecoverModalVisible] = useState(false);
  const [recoverAlertId, setRecoverAlertId] = useState<string | null>(null);
  const [recoverLocation, setRecoverLocation] = useState('');
  const [recoverSaving, setRecoverSaving] = useState(false);
  const [recoverGettingLocation, setRecoverGettingLocation] = useState(false);

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

  // Reload when screen regains focus (e.g., after marking as found from home)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadPublications();
    });
    return unsub;
  }, [navigation, loadPublications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPublications();
    setRefreshing(false);
  };

  const handleClose = (alertId: string) => {
    setRecoverAlertId(alertId);
    setRecoverLocation('');
    setRecoverModalVisible(true);
  };

  const handleConfirmRecover = async () => {
    if (!recoverAlertId) return;
    setRecoverSaving(true);
    try {
      // Optimistic update: mark as recovered immediately in UI
      setPublications(prev =>
        prev.map(p => p.id === recoverAlertId ? { ...p, status: 'recovered' as const, closedAt: new Date().toISOString() } : p)
      );
      await closeAlert(recoverAlertId, 'recovered', recoverLocation.trim() || undefined);
      setRecoverModalVisible(false);
      setRecoverAlertId(null);
      setRecoverLocation('');
      await loadPublications();
    } catch (e: any) {
      console.log('[PUBLICATIONS] Error closing:', e?.message);
      setAlertTitle('Error');
      setAlertMessage('No se pudo marcar la alerta como recuperada.');
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } finally {
      setRecoverSaving(false);
    }
  };

  const handleUseCurrentLocationForRecover = async () => {
    setRecoverGettingLocation(true);
    try {
      const { lat, lon } = await getCurrentLocation();
      console.log('[DEBUG] lat/lon:', lat, lon);
      const address = await reverseGeocode(lat, lon);
      console.log('[DEBUG] address:', address);
      if (address) {
        setRecoverLocation(address);
      }
    } catch (e: any) {
      console.log('[PUBLICATIONS] Error getting current location:', e?.message);
    } finally {
      setRecoverGettingLocation(false);
    }
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
            {formatPlate(item.licensePlate)}
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
          style={[styles.closeButton, { borderColor: colors.border }]} activeOpacity={0.8}
          onPress={() => handleClose(item.id)}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
          <Text style={[styles.closeButtonText, { color: colors.green }]}>Marcar como recuperada</Text>
        </TouchableOpacity>
      )}
    </View>
  );



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      {/* Header siempre visible */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('myPublications')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
      )}
      <Modal visible={recoverModalVisible} transparent animationType="fade" onRequestClose={() => setRecoverModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.recoverOverlay}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setRecoverModalVisible(false)} />
          <View style={[styles.recoverCard, { backgroundColor: colors.surface }]}>
            <View style={styles.recoverIconWrap}>
              <Ionicons name="checkmark-circle" size={36} color={colors.green} />
            </View>
            <Text style={[styles.recoverTitle, { color: colors.ink }]}>Marcar como recuperada</Text>
            <Text style={[styles.recoverSubtitle, { color: colors.inkFaint }]}>
              ¿Dónde se encontró la moto? Esta ubicación se guardará en la publicación.
            </Text>
            <TextInput
              style={[styles.recoverInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Ej: Av. Providencia 1234, Providencia"
              placeholderTextColor={colors.inkFaint}
              value={recoverLocation}
              onChangeText={setRecoverLocation}
              onSubmitEditing={Keyboard.dismiss}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.recoverLocationBtn, { borderColor: colors.primary }]}
              onPress={handleUseCurrentLocationForRecover}
              disabled={recoverGettingLocation}
              activeOpacity={0.8}
            >
              {recoverGettingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="location" size={18} color={colors.primary} />
              )}
              <Text style={[styles.recoverLocationBtnText, { color: colors.primary }]}>
                Usar ubicación actual
              </Text>
            </TouchableOpacity>
            <View style={styles.recoverActions}>
              <TouchableOpacity
                style={[styles.recoverBtn, { borderColor: colors.border }]}
                onPress={() => setRecoverModalVisible(false)}
                disabled={recoverSaving}
              >
                <Text style={[styles.recoverBtnText, { color: colors.ink }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recoverBtn, { backgroundColor: colors.green, borderColor: colors.green }]}
                onPress={handleConfirmRecover}
                disabled={recoverSaving}
              >
                {recoverSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.recoverBtnText, { color: '#fff' }]}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600' },
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
  recoverOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  recoverCard: { width: '100%', maxWidth: 340, borderRadius: 16, padding: 20, alignItems: 'center' },
  recoverIconWrap: { marginBottom: 8 },
  recoverTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  recoverSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  recoverInput: { width: '100%', borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  recoverLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: -6,
    marginBottom: 16,
  },
  recoverLocationBtnText: { fontSize: 14, fontWeight: '600' },
  recoverActions: { flexDirection: 'row', gap: 10, width: '100%' },
  recoverBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  recoverBtnText: { fontSize: 15, fontWeight: '600' },
});
