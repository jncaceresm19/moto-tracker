import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';
import { GpsTracker, getGpsTrackers, addGpsTracker, removeGpsTracker } from '../../../src/services/gpsTrackerStorage';

export default function TrackerScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [trackers, setTrackers] = useState<GpsTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [imei, setImei] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTrackers = useCallback(async () => {
    try {
      const data = await getGpsTrackers();
      setTrackers(data);
    } catch (e: any) {
      console.log('[TRACKERS] Error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrackers();
  }, [loadTrackers]);

  const handleAdd = async () => {
    if (imei.length !== 15) return;
    if (!name.trim()) return;

    setSaving(true);
    try {
      await addGpsTracker(imei, name.trim());
      setImei('');
      setName('');
      setShowAddModal(false);
      await loadTrackers();
    } catch (e: any) {
      console.log('[TRACKERS] Error adding:', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Eliminar rastreador',
      '¿Estás seguro de que deseas eliminar este rastreador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removeGpsTracker(id);
            await loadTrackers();
          },
        },
      ]
    );
  };

  const renderRightActions = (progress: any, itemId: string) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(itemId)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.deleteText}>Eliminar</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const dynamicStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
    trackerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    trackerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primary + '15',
    },
    trackerInfo: { flex: 1 },
    trackerName: { fontSize: 15, fontWeight: '600', color: colors.text },
    trackerImei: { fontSize: 13, marginTop: 2, color: colors.textSecondary },
    trackerDate: { fontSize: 12, marginTop: 2, color: colors.textMuted },
    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalContent: { flex: 1, padding: 20 },
    fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: colors.textSecondary },
    fieldHint: { fontSize: 11.5, marginTop: -4, marginBottom: 14, color: colors.textMuted },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      marginBottom: 6,
      color: colors.text,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginTop: 8,
      marginBottom: 16,
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border,
    },
    infoText: { fontSize: 12, flex: 1, lineHeight: 16, color: colors.textSecondary },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: imei.length === 15 && name.trim() ? colors.primary : colors.border,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('protocolTrakerConfig')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : trackers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color={colors.inkFaint} />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('noTrackers')}</Text>
          <Text style={[styles.emptyText, { color: colors.inkFaint }]}>{t('noTrackersText')}</Text>
        </View>
      ) : (
        <FlatList
          data={trackers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={(progress: any) => renderRightActions(progress, item.id)}
              overshootRight={false}
            >
              <View style={dynamicStyles.trackerCard}>
                <View style={dynamicStyles.trackerIcon}>
                  <Ionicons name="location" size={24} color={colors.primary} />
                </View>
                <View style={dynamicStyles.trackerInfo}>
                  <Text style={dynamicStyles.trackerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={dynamicStyles.trackerImei}>
                    IMEI: {item.imei}
                  </Text>
                  <Text style={dynamicStyles.trackerDate}>
                    Registrado: {formatDate(item.createdAt)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Swipeable>
          )}
        />
      )}

      {/* FAB Button */}
      <TouchableOpacity style={dynamicStyles.fab} activeOpacity={0.8} onPress={() => setShowAddModal(true)}>
        <Text style={dynamicStyles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Tracker Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { setShowAddModal(false); setImei(''); setName(''); }}
              style={styles.headerBtn}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>Agregar rastreador</Text>
            <View style={styles.headerBtn} />
          </View>

          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.fieldLabel}>Nombre del rastreador</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Ej: Moto principal"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={dynamicStyles.fieldLabel}>Número IMEI</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Ej: 863123456789012"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={15}
              value={imei}
              onChangeText={(v) => setImei(v.replace(/[^0-9]/g, ''))}
            />
            <Text style={dynamicStyles.fieldHint}>15 dígitos, sin espacios</Text>

            <View style={dynamicStyles.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={dynamicStyles.infoText}>
                El IMEI es un código de 15 dígitos único de tu dispositivo GPS. Lo encuentras en la etiqueta del GPS o enviando "imei123456" por SMS.
              </Text>
            </View>

            <TouchableOpacity
              style={dynamicStyles.saveButton}
              onPress={handleAdd}
              disabled={imei.length !== 15 || !name.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dynamicStyles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    width: 80,
    borderRadius: 12,
  },
  deleteText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
