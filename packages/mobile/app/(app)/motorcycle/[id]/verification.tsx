import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMotorcycle, Motorcycle, listDocuments, Document } from '../../../../src/api';
import { useLanguage } from '../../../../src/language-context';
import { useTheme } from '../../../../src/theme-context';
import { CustomAlert } from '../../../../src/components/CustomAlert';

export default function VerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]>([]);
  const [alertIcon, setAlertIcon] = useState<keyof typeof Ionicons.glyphMap>('information-circle');
  const [alertIconColor, setAlertIconColor] = useState('#007AFF');

  useEffect(() => {
    navigation.setOptions({
      title: 'Verificación',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/(app)/motorcycle/${id}`)}
          style={{ marginLeft: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, id, router, colors, t]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [moto, docs] = await Promise.all([getMotorcycle(id), listDocuments(id)]);
        setMotorcycle(moto);
        setDocuments(docs);
      } catch (e: any) {
        const msg = e?.status === 401 ? t('sessionExpired') : t('failedToLoad');
        showAlert(t('error'), msg, [{ text: 'OK' }], 'close-circle', '#FF3B30');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const showAlert = (title: string, message?: string, buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [{ text: 'OK' }], icon: keyof typeof Ionicons.glyphMap = 'information-circle', iconColor = '#007AFF') => {
    setAlertTitle(title);
    setAlertMessage(message || '');
    setAlertButtons(buttons);
    setAlertIcon(icon);
    setAlertIconColor(iconColor);
    setAlertVisible(true);
  };

  const getDocumentByType = (type: string): Document | undefined => {
    return documents.find(doc => doc.type === type);
  };

  const getDocumentStatus = (doc: Document | undefined): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } => {
    if (!doc) return { label: 'No registrado', color: '#999', icon: 'help-circle-outline' };

    if (doc.expiryDate) {
      const expiry = new Date(doc.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        return { label: 'Vencido', color: '#B42318', icon: 'close-circle-outline' };
      } else if (daysUntilExpiry <= 30) {
        return { label: `Vence en ${daysUntilExpiry} días`, color: '#C79000', icon: 'time-outline' };
      } else {
        return { label: 'Vigente', color: '#3D7A2E', icon: 'checkmark-circle-outline' };
      }
    }

    if (doc.status === 'valid') {
      return { label: 'Vigente', color: '#3D7A2E', icon: 'checkmark-circle-outline' };
    } else if (doc.status === 'expired') {
      return { label: 'Vencido', color: '#B42318', icon: 'close-circle-outline' };
    }

    return { label: 'Vigente', color: '#3D7A2E', icon: 'checkmark-circle-outline' };
  };

  const getVerificationMethodLabel = (method: string | null): string => {
    switch (method) {
      case 'padron': return 'Padrón';
      case 'clave_unica': return 'Clave Única';
      case 'carnet': return 'Carnet de Identidad';
      default: return 'No especificado';
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!motorcycle) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 16, marginBottom: 16, color: colors.text }}>{t('motorcycleNotFound')}</Text>
      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(app)/motorcycle/${id}`)}>
        <Text style={styles.btnText}>{t('goBack')}</Text>
      </TouchableOpacity>
    </View>
  );

  const verificada = motorcycle.verificada || false;
  const verificadaEn = motorcycle.verificadaEn ? new Date(motorcycle.verificadaEn) : null;
  const verificadaPor = motorcycle.verificadaPor || null;
  const encargoRobo = motorcycle.encargoRobo || false;

  const permisoCirculacion = getDocumentByType('circulation_permit');
  const revisionTecnica = getDocumentByType('technical_review');
  const licencia = getDocumentByType('drivers_license');
  const seguro = getDocumentByType('insurance');

  const permisoStatus = getDocumentStatus(permisoCirculacion);
  const rtStatus = getDocumentStatus(revisionTecnica);
  const licenciaStatus = getDocumentStatus(licencia);
  const seguroStatus = getDocumentStatus(seguro);

  // Lista unificada para renderizar el card agrupado de documentos
  const documentRows = [
    { key: 'permiso', label: 'Permiso de Circulación', icon: 'document-text-outline' as const, status: permisoStatus },
    { key: 'rt', label: 'Revisión Técnica', icon: 'construct-outline' as const, status: rtStatus },
    { key: 'licencia', label: 'Licencia de Conducir', icon: 'card-outline' as const, status: licenciaStatus },
    { key: 'seguro', label: 'Seguro Obligatorio', icon: 'shield-checkmark-outline' as const, status: seguroStatus },
    {
      key: 'encargo',
      label: 'Encargo por Robo',
      icon: (encargoRobo ? 'alert-circle-outline' : 'checkmark-circle-outline') as const,
      status: {
        label: encargoRobo ? 'Activo' : 'Sin encargo',
        color: encargoRobo ? '#B42318' : '#3D7A2E',
        icon: (encargoRobo ? 'alert-circle-outline' : 'checkmark-circle-outline') as const,
      },
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: verificada ? '#EAF3E6' : '#FDEAEA', borderColor: verificada ? '#3D7A2E' : '#B42318' }]}>
        <View style={[styles.statusIconContainer, { backgroundColor: verificada ? '#3D7A2E' : '#B42318' }]}>
          <Ionicons name={verificada ? 'shield-checkmark' : 'shield-close'} size={32} color="#FFFFFF" />
        </View>
        <View style={styles.statusInfo}>
          <Text style={[styles.statusText, { color: verificada ? '#3D7A2E' : '#B42318' }]}>
            {verificada ? 'Moto Verificada' : 'Sin Verificar'}
          </Text>
          <Text style={[styles.statusSubtext, { color: verificada ? '#5A9E44' : '#D14B3F' }]}>
            {verificada
              ? 'Tu moto ha sido verificada correctamente'
              : 'Tu moto aún no ha sido verificada'}
          </Text>
        </View>
      </View>

      {/* Verification Details — agrupado en un solo card con divisores */}
      {verificada && (verificadaEn || verificadaPor) && (
        <View style={[styles.section, { paddingBottom: 4 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Detalles</Text>
          <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {verificadaEn && (
              <>
                <View style={styles.groupRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.groupRowContent}>
                    <Text style={[styles.groupRowLabel, { color: colors.textMuted }]}>Fecha de Verificación</Text>
                    <Text style={[styles.groupRowValue, { color: colors.text }]}>
                      {verificadaEn.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                {verificadaPor && <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />}
              </>
            )}
            {verificadaPor && (
              <View style={styles.groupRow}>
                <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                <View style={styles.groupRowContent}>
                  <Text style={[styles.groupRowLabel, { color: colors.textMuted }]}>Método de Verificación</Text>
                  <Text style={[styles.groupRowValue, { color: colors.text }]}>
                    {getVerificationMethodLabel(verificadaPor)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Document Status Section — agrupado en un solo card con divisores */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Documentos</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {documentRows.map((doc, index) => {
            const isPending = doc.status.color === '#999';
            return (
              <React.Fragment key={doc.key}>
                <View style={[styles.groupRow, isPending && { backgroundColor: colors.primary + '12' }]}>
                  <Ionicons name={doc.icon} size={18} color={isPending ? colors.primary : doc.status.color} />
                  <View style={styles.groupRowContent}>
                    <Text style={[styles.groupRowLabel, { color: colors.textMuted }]}>{doc.label}</Text>
                    <Text style={[styles.groupRowValue, { color: isPending ? colors.primary : doc.status.color }]}>
                      {isPending ? `${doc.status.label}, agregar ahora` : doc.status.label}
                    </Text>
                  </View>
                  <Ionicons
                    name={isPending ? 'chevron-forward' : doc.status.icon}
                    size={18}
                    color={isPending ? colors.primary : doc.status.color}
                  />
                </View>
                {index < documentRows.length - 1 && (
                  <View style={[styles.groupDivider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.section}>
        <View style={[styles.infoCard, { backgroundColor: colors.brandBlueBg, borderColor: colors.brandBlue }]}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue + '99'} style={{ marginRight: 8 }} />
            <Text style={[styles.infoTitle, { color: colors.brandBlue + '99' }]}>¿Qué es la verificación?</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.brandBlue + '99', marginTop: 8 }]}>
            La verificación de vehículos motorizados es un proceso obligatorio que confirma la identidad
            y legalidad de tu moto. Se realiza exclusivamente a través de Padrón para validar que la
            patente coincida con el registro vehicular.
          </Text>
        </View>
      </View>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        icon={alertIcon}
        iconColor={alertIconColor}
        onClose={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    marginBottom: 1,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  statusIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: { flex: 1 },
  statusText: { fontSize: 18, fontWeight: '700' },
  statusSubtext: { fontSize: 13, marginTop: 2 },

  // Sections
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 12
  },

  // Card agrupado (reemplaza los detailRow sueltos)
  groupCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  groupRowContent: { flex: 1 },
  groupRowLabel: { fontSize: 12, marginBottom: 2 },
  groupRowValue: { fontSize: 12, fontWeight: '500' },
  groupDivider: {
    height: 1,
    marginLeft: 46,
  },

  // Info Card
  infoCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  infoText: { fontSize: 13, lineHeight: 18 },
}); 