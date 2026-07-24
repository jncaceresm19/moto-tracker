import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, ActivityIndicator, Alert, Animated, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';
import { GpsTracker, getGpsTrackers, addGpsTracker, removeGpsTracker } from '../../../src/services/gpsTrackerStorage';

const TOTAL_STEPS = 5;

export default function TrackerScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [trackers, setTrackers] = useState<GpsTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [step, setStep] = useState(1);
  const [imei, setImei] = useState('');
  const [name, setName] = useState('');
  const [simConfirmed, setSimConfirmed] = useState(false);
  const [installConfirmed, setInstallConfirmed] = useState(false);
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

  const resetWizard = () => {
    setStep(1);
    setImei('');
    setName('');
    setSimConfirmed(false);
    setInstallConfirmed(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetWizard();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSaveTracker = async () => {
    if (imei.length !== 15 || !name.trim()) return;
    setSaving(true);
    try {
      await addGpsTracker(imei, name.trim());
      await loadTrackers();
      goNext();
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
    modalTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      marginBottom: 4,
    },
    stepIndicator: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
    modalLogoContainer: { alignItems: 'center', marginBottom: 4 },
    modalLogo: { width: 260, height: 130, marginTop: -20 },
    modalSubtitle: { fontSize: 14, fontWeight: '500', marginTop: -50, marginBottom: 24, color: colors.textMuted },
    stepDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
    stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
    stepDotActive: { width: 18, backgroundColor: colors.primary },
    stepTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: colors.primary, textAlign: 'center' },
    stepBody: { fontSize: 13, lineHeight: 21, marginBottom: 16, color: colors.textSecondary, textAlign: 'center' },
    stepIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 16,
      backgroundColor: colors.primary + '15',
    },
    bulletCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.brandBlueBg,
      borderColor: colors.primary,
    },
    bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
    bulletIconWrap: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
      backgroundColor: colors.primary,
    },
    bulletText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.primary },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginTop: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    checkRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0D' },
    checkRowText: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, marginHorizontal: 16, marginLeft: 1 },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      marginBottom: 0,
      color: colors.text,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12, color: colors.textSecondary },
    fieldHint: { fontSize: 11.5, marginTop: 4, marginBottom: 6, color: colors.textMuted },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginTop: 12,
      backgroundColor: colors.brandBlueBg,
      borderColor: colors.primary,
    },
    infoText: { fontSize: 12, flex: 1, lineHeight: 16, color: colors.primary },
    successIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 20,
      backgroundColor: colors.success + '18',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    backBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: 30,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    nextBtn: {
      flex: 2,
      paddingVertical: 15,
      borderRadius: 30,
      alignItems: 'center',
    },
    nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });

  const canGoNextFromDatosStep = imei.length === 15 && !!name.trim();

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <View style={dynamicStyles.stepIconWrap}>
              <Ionicons name="hardware-chip-outline" size={26} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.stepTitle}>Paso 1 · Compra tu GPS</Text>
            <Text style={dynamicStyles.stepBody}>
              Necesitas un rastreador 4G que hable protocolo abierto (GT06 o H02). Evita los que solo funcionan con 2G o con una app cerrada.
            </Text>
            <View style={dynamicStyles.bulletCard}>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Tracker moto básico 4G, protocolo GT06/H02, con corte de corriente</Text>
              </View>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Tracker compacto oculto con batería de respaldo interna</Text>
              </View>
              <View style={[dynamicStyles.bulletRow, { marginBottom: 0 }]}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Confirma con el vendedor: "4G" + "protocolo GT06 o H02"</Text>
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <View style={dynamicStyles.stepIconWrap}>
              <Ionicons name="cellular-outline" size={26} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.stepTitle}>Paso 2 · Contrata tu SIM IoT</Text>
            <Text style={dynamicStyles.stepBody}>
              Tu GPS necesita una SIM M2M/IoT (no una SIM normal de celular) para poder enviar su ubicación.
            </Text>
            <View style={dynamicStyles.bulletCard}>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Pide un plan "solo datos" — no necesitas voz ni SMS</Text>
              </View>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Un GPS consume muy poco: 50-100 MB al mes son suficientes</Text>
              </View>
              <View style={[dynamicStyles.bulletRow, { marginBottom: 0 }]}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Precio aproximado: $1.000 a $5.000 CLP al mes según proveedor</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[dynamicStyles.checkRow, simConfirmed && dynamicStyles.checkRowActive]}
              onPress={() => setSimConfirmed((v) => !v)}
            >
              <Ionicons
                name={simConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={simConfirmed ? colors.primary : colors.textMuted}
              />
              <Text style={dynamicStyles.checkRowText}>Ya contraté mi SIM IoT</Text>
            </TouchableOpacity>
          </>
        );
      case 3:
        return (
          <>
            <View style={dynamicStyles.stepIconWrap}>
              <Ionicons name="construct-outline" size={26} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.stepTitle}>Paso 3 · Instala y configura</Text>
            <Text style={dynamicStyles.stepBody}>
              Configura la SIM en el GPS e instálalo en tu moto antes de continuar.
            </Text>
            <View style={dynamicStyles.bulletCard}>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Inserta la SIM y configura el APN según las instrucciones de tu proveedor (normalmente por SMS)</Text>
              </View>
              <View style={dynamicStyles.bulletRow}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Conecta el GPS a la batería de la moto siguiendo el manual del fabricante</Text>
              </View>
              <View style={[dynamicStyles.bulletRow, { marginBottom: 0 }]}>
                <View style={dynamicStyles.bulletIconWrap}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                <Text style={dynamicStyles.bulletText}>Enciéndelo y espera 1-2 minutos a que capte señal GPS y 4G</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[dynamicStyles.checkRow, installConfirmed && dynamicStyles.checkRowActive]}
              onPress={() => setInstallConfirmed((v) => !v)}
            >
              <Ionicons
                name={installConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={installConfirmed ? colors.primary : colors.textMuted}
              />
              <Text style={dynamicStyles.checkRowText}>Ya lo instalé y configuré</Text>
            </TouchableOpacity>
          </>
        );
      case 4:
        return (
          <>
            <View style={dynamicStyles.stepIconWrap}>
              <Ionicons name="location-outline" size={26} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.stepTitle}>Paso 4 · Datos del rastreador</Text>
            <Text style={dynamicStyles.stepBody}>
              Ingresa un nombre para identificarlo y su número IMEI.
            </Text>

            <Text style={dynamicStyles.sectionTitle}>Nombre del rastreador</Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Ej: Moto principal"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={dynamicStyles.sectionTitle}>Número IMEI</Text>
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
          </>
        );
      case 5:
        return (
          <>
            <View style={dynamicStyles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            </View>
            <Text style={[dynamicStyles.stepTitle, { textAlign: 'center' }]}>¡Rastreador guardado!</Text>
            <Text style={[dynamicStyles.stepBody, { textAlign: 'center' }]}>
              "{name}" quedó registrado en tu cuenta. En cuanto tu GPS esté encendido y con señal, podrás verlo en el mapa desde aquí.
            </Text>
            <View style={dynamicStyles.infoCard}>
              <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={dynamicStyles.infoText}>
                El seguimiento en tiempo real estará disponible próximamente. Por ahora tu rastreador queda guardado y listo.
              </Text>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (step === 5) {
      return (
        <View style={dynamicStyles.footer}>
          <TouchableOpacity style={[dynamicStyles.nextBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={closeModal}>
            <Text style={dynamicStyles.nextBtnText}>Listo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const isDatosStep = step === 4;
    const nextDisabled = isDatosStep ? !canGoNextFromDatosStep || saving : false;

    return (
      <View style={dynamicStyles.footer}>
        {step > 1 && (
          <TouchableOpacity style={dynamicStyles.backBtn} onPress={goBack}>
            <Text style={dynamicStyles.backBtnText}>Atrás</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[dynamicStyles.nextBtn, { backgroundColor: nextDisabled ? colors.border : colors.primary }]}
          onPress={isDatosStep ? handleSaveTracker : goNext}
          disabled={nextDisabled}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={dynamicStyles.nextBtnText}>{isDatosStep ? 'Guardar' : 'Siguiente'}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={styles.headerBtn}>
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

      {/* Add Tracker Modal — step-by-step wizard */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={dynamicStyles.modal}>
            <View style={dynamicStyles.modalTopRow}>
              <TouchableOpacity onPress={closeModal} style={{ marginLeft: 'auto' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.modalLogoContainer}>
                <Image
                  source={require('../../../assets/nombre.jpeg')}
                  style={dynamicStyles.modalLogo}
                  resizeMode="contain"
                />
                <Text style={dynamicStyles.modalSubtitle}>Agregar rastreador</Text>
              </View>

              <View style={dynamicStyles.stepDotsRow}>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <View
                    key={i}
                    style={[dynamicStyles.stepDot, i + 1 === step && dynamicStyles.stepDotActive]}
                  />
                ))}
              </View>

              {renderStepContent()}
            </ScrollView>

            {renderFooter()}
          </View>
        </KeyboardAvoidingView>
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