import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';

// --- Datos de maqueta (solo diseño, sin conexión a backend) ---

const METRICS = [
  { label: 'Usuarios activos', value: '3,482' },
  { label: 'Planes pagos', value: '1,207' },
  { label: 'Cuentas eliminadas (30d)', value: '96' },
  { label: 'Valoración promedio al salir', value: '3.2', suffix: ' / 5' },
];

const DELETE_REASONS = [
  { label: 'No encontré lo que buscaba', pct: 38 },
  { label: 'No uso la app seguido', pct: 27 },
  { label: 'Encontré otra app', pct: 18 },
  { label: 'Problemas técnicos', pct: 11 },
  { label: 'Otro motivo', pct: 6 },
];

type Origin = 'google' | 'manual' | 'admin';

type MockUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  plan: string;
  origin: Origin;
  role: 'usuario' | 'admin';
};

const MOCK_USERS: MockUser[] = [
  { id: '1', name: 'Marcela González', email: 'marcela.g@correo.com', initials: 'MG', plan: 'Copiloto', origin: 'google', role: 'usuario' },
  { id: '2', name: 'Roberto Torres', email: 'rtorres@correo.com', initials: 'RT', plan: 'Garage', origin: 'manual', role: 'usuario' },
  { id: '3', name: 'Carla Fuentes', email: 'carla.f@correo.com', initials: 'CF', plan: 'Garage', origin: 'admin', role: 'admin' },
];

const PLAN_OPTIONS = ['Piloto', 'Vigía', 'Copiloto', 'Comandante', 'Garage'];

const originLabel: Record<Origin, string> = {
  google: 'Google',
  manual: 'Manual',
  admin: 'Admin',
};

const originIcon: Record<Origin, keyof typeof Ionicons.glyphMap> = {
  google: 'logo-google',
  manual: 'create-outline',
  admin: 'shield-checkmark-outline',
};

export default function AdminScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  // Puerta de acceso (candado con clave) — solo diseño, cualquier valor "desbloquea"
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(MOCK_USERS[1].id);

  const [showHistory, setShowHistory] = useState(false);

  const selectedUser = MOCK_USERS.find((u) => u.id === selectedUserId) || null;
  const isManual = selectedUser?.origin === 'manual';

  // Plan seleccionado en el picker del panel "Gestionar usuario" (solo diseño)
  const [manualPlan, setManualPlan] = useState<string>(selectedUser?.plan ?? PLAN_OPTIONS[0]);

  useEffect(() => {
    if (selectedUser) setManualPlan(selectedUser.plan);
  }, [selectedUserId]);

  const dynamicStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
      backgroundColor: colors.headerBg,
    },
    headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '600', color: colors.headerTintColor },
    sectionRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 24, marginBottom: 8, marginHorizontal: 16,
    },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
    historyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
      backgroundColor: colors.primary + '15',
    },
    historyBtnText: { fontSize: 12, color: colors.primary, fontWeight: '500' },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
    metricCard: {
      flexBasis: '46%', flexGrow: 1, backgroundColor: colors.surfaceSecondary,
      borderRadius: 10, padding: 14,
    },
    metricLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
    metricValue: { fontSize: 22, fontWeight: '600', color: colors.text },
    metricSuffix: { fontSize: 13, fontWeight: '400', color: colors.textMuted },

    card: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 16, marginHorizontal: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12 },

    reasonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    reasonLabel: { width: 150, fontSize: 12, color: colors.textSecondary },
    reasonTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceSecondary, overflow: 'hidden', marginHorizontal: 8 },
    reasonFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
    reasonPct: { width: 32, fontSize: 12, color: colors.text, textAlign: 'right' },

    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    searchInput: {
      flex: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
      backgroundColor: colors.inputBg, color: colors.text,
    },
    searchBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.primary,
    },
    searchBtnText: { color: colors.primaryText, fontSize: 13, fontWeight: '600' },

    userRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    userRowSelected: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 8 },
    userLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    avatar: {
      width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 12, fontWeight: '600' },
    userName: { fontSize: 14, fontWeight: '500', color: colors.text },
    userEmail: { fontSize: 12, color: colors.textMuted },

    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '600' },

    originCell: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 74 },
    originText: { fontSize: 12, color: colors.textSecondary },

    actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
    actionBtnText: { fontSize: 12, color: colors.text },

    manageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    manageName: { fontSize: 16, fontWeight: '600', color: colors.text },
    manageEmail: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },

    infoBox: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 12, marginBottom: 12 },
    infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    infoValue: { fontSize: 15, fontWeight: '500', color: colors.text },

    readonlyNote: { flexDirection: 'row', gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 12 },
    readonlyNoteText: { fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 18 },

    fieldLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },

    // --- Selector de plan (chips seleccionables) ---
    planChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    planChip: {
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    planChipText: { fontSize: 13, color: colors.text },
    planChipTextActive: { color: colors.primaryText, fontWeight: '600' },

    fieldBlock: { marginBottom: 16 },
    input: {
      borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
      backgroundColor: colors.inputBg, color: colors.text,
    },

    actionsRow: { flexDirection: 'row', gap: 8 },
    revokeBtn: {
      flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8,
      borderWidth: 1, borderColor: colors.danger,
    },
    revokeBtnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
    saveBtn: {
      flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8,
      backgroundColor: colors.primary,
    },
    saveBtnText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },

    // --- Modal de clave (puerta de entrada) ---
    lockOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    lockCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20 },
    lockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    lockTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    lockSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
    lockErrorText: { fontSize: 12, color: colors.danger, marginBottom: 8 },
    lockActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    lockCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    lockCancelBtnText: { color: colors.textSecondary, fontSize: 14 },
    lockConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary },
    lockConfirmBtnText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },

    // --- Modal de historial ---
    historyOverlay: { flex: 1, backgroundColor: colors.background },
    historyModalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    historyModalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    historyClose: { color: colors.primary, fontSize: 15 },
    historyEntry: {
      paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    historyEntryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    historyWho: { fontSize: 13, fontWeight: '600', color: colors.text },
    historyDate: { fontSize: 12, color: colors.textMuted },
    historyWhat: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
    historyPlanChange: { fontSize: 12, color: colors.textMuted },
    historyReason: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  });

  const filteredUsers = MOCK_USERS.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Puerta de acceso: modal de clave sobre pantalla en blanco ---
  if (!unlocked) {
    return (
      <View style={dynamicStyles.container}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={dynamicStyles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>{t('admin')}</Text>
          <View style={dynamicStyles.headerBtn} />
        </View>

        <Modal visible transparent animationType="fade" presentationStyle="overFullScreen">
          <View style={dynamicStyles.lockOverlay}>
            <View style={dynamicStyles.lockCard}>
              <View style={dynamicStyles.lockHeader}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <Text style={dynamicStyles.lockTitle}>Acceso administrador</Text>
              </View>
              <Text style={dynamicStyles.lockSubtitle}>Ingresa tu clave de administrador para continuar.</Text>

              <TextInput
                style={dynamicStyles.input}
                placeholder="Clave de administrador"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={passwordInput}
                onChangeText={(v) => { setPasswordInput(v); setPasswordError(false); }}
              />
              {passwordError ? <Text style={dynamicStyles.lockErrorText}>Clave incorrecta. Inténtalo nuevamente.</Text> : null}

              <View style={dynamicStyles.lockActions}>
                <TouchableOpacity style={dynamicStyles.lockCancelBtn} onPress={() => router.replace('/(app)/profile')}>
                  <Text style={dynamicStyles.lockCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dynamicStyles.lockConfirmBtn}
                  onPress={() => setUnlocked(true)}
                >
                  <Text style={dynamicStyles.lockConfirmBtnText}>Ingresar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={dynamicStyles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>{t('admin')}</Text>
        <View style={dynamicStyles.headerBtn} />
      </View>

      {/* Métricas */}
      <View style={dynamicStyles.sectionRow}>
        <Text style={dynamicStyles.sectionTitle}>Estadísticas</Text>
        <TouchableOpacity style={dynamicStyles.historyBtn} onPress={() => setShowHistory(true)}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={dynamicStyles.historyBtnText}>Historial</Text>
        </TouchableOpacity>
      </View>
      <View style={dynamicStyles.metricsGrid}>
        {METRICS.map((m) => (
          <View key={m.label} style={dynamicStyles.metricCard}>
            <Text style={dynamicStyles.metricLabel}>{m.label}</Text>
            <Text style={dynamicStyles.metricValue}>
              {m.value}
              {m.suffix ? <Text style={dynamicStyles.metricSuffix}>{m.suffix}</Text> : null}
            </Text>
          </View>
        ))}
      </View>

      {/* Motivos de eliminación */}
      <Text style={dynamicStyles.sectionTitle}>Motivos de eliminación de cuenta</Text>
      <View style={dynamicStyles.card}>
        {DELETE_REASONS.map((r) => (
          <View key={r.label} style={dynamicStyles.reasonRow}>
            <Text style={dynamicStyles.reasonLabel}>{r.label}</Text>
            <View style={dynamicStyles.reasonTrack}>
              <View style={[dynamicStyles.reasonFill, { width: `${r.pct}%` }]} />
            </View>
            <Text style={dynamicStyles.reasonPct}>{r.pct}%</Text>
          </View>
        ))}
      </View>

      {/* Buscar usuarios */}
      <Text style={dynamicStyles.sectionTitle}>Buscar usuarios</Text>
      <View style={dynamicStyles.card}>
        <View style={dynamicStyles.searchRow}>
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder="Nombre, correo o ID de usuario"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={dynamicStyles.searchBtn}>
            <Ionicons name="search" size={16} color={colors.primaryText} />
          </TouchableOpacity>
        </View>

        {filteredUsers.map((u) => {
          const selected = u.id === selectedUserId;
          return (
            <TouchableOpacity
              key={u.id}
              style={[dynamicStyles.userRow, selected && dynamicStyles.userRowSelected]}
              activeOpacity={0.6}
              onPress={() => setSelectedUserId(u.id)}
            >
              <View style={dynamicStyles.userLeft}>
                <View style={[dynamicStyles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[dynamicStyles.avatarText, { color: colors.text }]}>{u.initials}</Text>
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text style={dynamicStyles.userName}>{u.name}</Text>
                  <Text style={dynamicStyles.userEmail} numberOfLines={1}>{u.email}</Text>
                </View>
              </View>

              <View style={dynamicStyles.originCell}>
                <Ionicons name={originIcon[u.origin]} size={13} color={colors.textSecondary} />
                <Text style={dynamicStyles.originText}>{originLabel[u.origin]}</Text>
              </View>

              <TouchableOpacity style={dynamicStyles.actionBtn} onPress={() => setSelectedUserId(u.id)}>
                <Text style={dynamicStyles.actionBtnText}>{u.origin === 'google' ? 'Ver' : 'Gestionar'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Gestionar usuario */}
      {selectedUser && (
        <>
          <Text style={dynamicStyles.sectionTitle}>Gestionar usuario</Text>
          <View style={dynamicStyles.card}>
            <View style={dynamicStyles.manageHeader}>
              <Text style={dynamicStyles.manageName}>{selectedUser.name}</Text>
              <View style={[dynamicStyles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[dynamicStyles.badgeText, { color: colors.text }]}>
                  {originLabel[selectedUser.origin]}
                </Text>
              </View>
            </View>
            <Text style={dynamicStyles.manageEmail}>{selectedUser.email}</Text>

            {!isManual ? (
              <>
                <View style={dynamicStyles.infoBox}>
                  <Text style={dynamicStyles.infoLabel}>Plan actual</Text>
                  <Text style={dynamicStyles.infoValue}>{selectedUser.plan}</Text>
                </View>
                <View style={dynamicStyles.readonlyNote}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={dynamicStyles.readonlyNoteText}>
                    {selectedUser.origin === 'google'
                      ? 'Plan gestionado por Google Play. Solo lectura desde este panel: no se puede modificar ni revocar manualmente.'
                      : 'Acceso otorgado como administrador. La gestión de este tipo de acceso se realiza desde otro usuario con permisos.'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Selector de plan: todos los planes disponibles como chips seleccionables */}
                <Text style={dynamicStyles.fieldLabel}>Cambiar plan</Text>
                <View style={dynamicStyles.planChipsRow}>
                  {PLAN_OPTIONS.map((plan) => {
                    const active = plan === manualPlan;
                    return (
                      <TouchableOpacity
                        key={plan}
                        style={[dynamicStyles.planChip, active && dynamicStyles.planChipActive]}
                        activeOpacity={0.7}
                        onPress={() => setManualPlan(plan)}
                      >
                        <Text style={[dynamicStyles.planChipText, active && dynamicStyles.planChipTextActive]}>
                          {plan}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={dynamicStyles.fieldBlock}>
                  <Text style={dynamicStyles.fieldLabel}>Motivo</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Compensación por incidente"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={dynamicStyles.actionsRow}>
                  <TouchableOpacity style={dynamicStyles.revokeBtn}>
                    <Text style={dynamicStyles.revokeBtnText}>Revocar plan manual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={dynamicStyles.saveBtn}>
                    <Text style={dynamicStyles.saveBtnText}>Guardar cambios</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </>
      )}

      <View style={{ height: 32 }} />

      {/* Modal historial de cambios */}
      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
        <View style={dynamicStyles.historyOverlay}>
          <View style={dynamicStyles.historyModalHeader}>
            <Text style={dynamicStyles.historyModalTitle}>Historial de cambios</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Text style={dynamicStyles.historyClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {[
              { who: 'Carla Fuentes', what: 'Cambió el plan manualmente', date: '14 jul 2026', from: 'Piloto', to: 'Garage', reason: 'Compensación por incidente' },
              { who: 'Carla Fuentes', what: 'Otorgó acceso administrador', date: '10 jul 2026', from: '—', to: 'ADMIN', reason: 'Nuevo miembro de soporte' },
              { who: 'Diego Ramírez', what: 'Revocó plan manual', date: '3 jul 2026', from: 'Comandante', to: 'Piloto', reason: 'Solicitud del usuario' },
            ].map((h, i) => (
              <View key={i} style={dynamicStyles.historyEntry}>
                <View style={dynamicStyles.historyEntryTop}>
                  <Text style={dynamicStyles.historyWho}>{h.who}</Text>
                  <Text style={dynamicStyles.historyDate}>{h.date}</Text>
                </View>
                <Text style={dynamicStyles.historyWhat}>{h.what}</Text>
                <Text style={dynamicStyles.historyPlanChange}>{h.from} → {h.to}</Text>
                <Text style={dynamicStyles.historyReason}>Motivo: {h.reason}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}