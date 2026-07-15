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

      {/* Verification Details */}
      {verificada && (
        <View style={[styles.section, { paddingBottom: 4 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Detalles</Text>

          {/* Verification Date */}
          {verificadaEn && (
            <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: '#E6F1FB' }]}>
                <Ionicons name="calendar-outline" size={18} color="#185FA5" />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Fecha de Verificación</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {verificadaEn.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </View>
          )}

          {/* Verification Method */}
          {verificadaPor && (
            <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="document-text-outline" size={18} color="#6B21A8" />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Método de Verificación</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {getVerificationMethodLabel(verificadaPor)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Document Status Section */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Documentos</Text>

        {/* Permiso de Circulación */}
        <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: '#E6F1FB' }]}>
            <Ionicons name="document-text-outline" size={18} color="#185FA5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Permiso de Circulación</Text>
            <Text style={[styles.detailValue, { color: permisoStatus.color }]}>
              {permisoStatus.label}
            </Text>
          </View>
          <Ionicons name={permisoStatus.icon} size={18} color={permisoStatus.color} />
        </View>

        {/* Revisión Técnica */}
        <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: rtStatus.color === '#3D7A2E' ? '#EAF3E6' : rtStatus.color === '#C79000' ? '#FFF6D9' : '#FDEAEA' }]}>
            <Ionicons name="construct-outline" size={18} color={rtStatus.color === '#3D7A2E' ? '#0F6E56' : rtStatus.color === '#C79000' ? '#8A6D00' : '#B42318'} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Revisión Técnica</Text>
            <Text style={[styles.detailValue, { color: rtStatus.color }]}>
              {rtStatus.label}
            </Text>
          </View>
          <Ionicons name={rtStatus.icon} size={18} color={rtStatus.color} />
        </View>

        {/* Licencia */}
        <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: '#FAEEDA' }]}>
            <Ionicons name="card-outline" size={18} color="#854F0B" />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Licencia de Conducir</Text>
            <Text style={[styles.detailValue, { color: licenciaStatus.color }]}>
              {licenciaStatus.label}
            </Text>
          </View>
          <Ionicons name={licenciaStatus.icon} size={18} color={licenciaStatus.color} />
        </View>

        {/* Seguro Obligatorio */}
        <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: '#FBEAF0' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#993556" />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Seguro Obligatorio</Text>
            <Text style={[styles.detailValue, { color: seguroStatus.color }]}>
              {seguroStatus.label}
            </Text>
          </View>
          <Ionicons name={seguroStatus.icon} size={18} color={seguroStatus.color} />
        </View>

        {/* Encargo por Robo */}
        <View style={[styles.detailRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: encargoRobo ? '#FDEAEA' : '#EAF3E6' }]}>
            <Ionicons name={encargoRobo ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18} color={encargoRobo ? '#B42318' : '#3D7A2E'} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Encargo por Robo</Text>
            <Text style={[styles.detailValue, { color: encargoRobo ? '#B42318' : '#3D7A2E' }]}>
              {encargoRobo ? 'Activo' : 'Sin encargo'}
            </Text>
          </View>
          <Ionicons name={encargoRobo ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18} color={encargoRobo ? '#B42318' : '#3D7A2E'} />
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
    marginBottom: 8,
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
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },

  // Detail Row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600' },

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
