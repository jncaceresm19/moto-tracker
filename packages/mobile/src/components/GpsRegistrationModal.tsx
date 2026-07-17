import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, TextInput, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';
import { updateMotorcycle } from '../api';

interface GpsRegistrationModalProps {
    visible: boolean;
    onClose: () => void;
    motorcycleId: string;
    currentGpsTracker?: string;
    onSaved: (gpsTracker: string) => void;
}

type Step = 'requirements' | 'imei' | 'config' | 'save';

const STEP_ORDER: Step[] = ['requirements', 'imei', 'config', 'save'];

// TODO: reemplazar por el servidor real cuando el backend de rastreo esté listo.
// Por ahora es solo lo que se muestra al usuario en el comando SMS de ejemplo.
const GPS_SERVER_IP = '0.0.0.0';
const GPS_SERVER_PORT = '5023';

export function GpsRegistrationModal({
    visible,
    onClose,
    motorcycleId,
    currentGpsTracker,
    onSaved,
}: GpsRegistrationModalProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [step, setStep] = useState<Step>('requirements');
    const [imei, setImei] = useState(currentGpsTracker || '');
    const [simPhone, setSimPhone] = useState('');
    const [apn, setApn] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const stepIndex = STEP_ORDER.indexOf(step);

    const resetState = () => {
        setStep('requirements');
        setImei(currentGpsTracker || '');
        setSimPhone('');
        setApn('');
        setSaving(false);
        setSaved(false);
        setError(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const goTo = (next: Step) => setStep(next);

    // Opens the native SMS composer with the command pre-filled.
    // iOS and Android use a slightly different sms: URL format for the body param.
    const openSms = (body: string) => {
        if (!simPhone) return;
        const separator = Platform.OS === 'ios' ? '&' : '?';
        const url = `sms:${simPhone}${separator}body=${encodeURIComponent(body)}`;
        Linking.openURL(url).catch(() => {
            setError('No se pudo abrir la app de mensajes en este dispositivo.');
        });
    };

    const apnCommand = `apn123456#${apn || 'TU_APN'}#`;
    const serverCommand = `adminip123456#${GPS_SERVER_IP}#${GPS_SERVER_PORT}#`;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateMotorcycle(motorcycleId, { gpsTracker: imei });
            setSaved(true);
            onSaved(imei);
        } catch (e: any) {
            setError(e?.message || 'No se pudo guardar el GPS. Intenta nuevamente.');
        } finally {
            setSaving(false);
        }
    };

    const ProgressBar = () => (
        <View style={styles.progressRow}>
            {STEP_ORDER.map((s, i) => (
                <View
                    key={s}
                    style={[
                        styles.progressSegment,
                        { backgroundColor: i <= stepIndex ? colors.primary : colors.border },
                    ]}
                />
            ))}
        </View>
    );

    const renderStep = () => {
        switch (step) {
            case 'requirements':
                return (
                    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={[styles.stepLabel, { color: colors.textMuted }]}>Paso 1 de 4</Text>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>Antes de empezar</Text>
                        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                            Ten esto a mano para que la configuración no falle a mitad de camino.
                        </Text>

                        <View style={[styles.reqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={styles.reqRow}>
                                <Ionicons name="card-outline" size={18} color={colors.primary} style={styles.reqIcon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.reqTitle, { color: colors.text }]}>SIM activa con datos</Text>
                                    <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>Sin PIN de seguridad, con saldo o plan de datos</Text>
                                </View>
                            </View>
                            <View style={styles.reqRow}>
                                <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} style={styles.reqIcon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.reqTitle, { color: colors.text }]}>El GPS encendido y con señal</Text>
                                    <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>Conectado a la batería o cargador de la moto</Text>
                                </View>
                            </View>
                            <View style={[styles.reqRow, { marginBottom: 0 }]}>
                                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} style={styles.reqIcon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.reqTitle, { color: colors.text }]}>Tu celular a mano</Text>
                                    <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>Enviarás comandos por SMS al número de la SIM del GPS</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.tipBanner, { backgroundColor: colors.brandBlueBg }]}>
                            <Ionicons name="bulb-outline" size={16} color={colors.brandBlue} />
                            <Text style={[styles.tipBannerText, { color: colors.brandBlue }]}>
                                El SMS con el comando tiene costo normal de tu operador.
                            </Text>
                        </View>

                        <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={() => goTo('imei')}>
                            <Text style={styles.nextButtonText}>Ya tengo todo, continuar</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );

            case 'imei':
                return (
                    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={[styles.stepLabel, { color: colors.textMuted }]}>Paso 2 de 4</Text>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>Identifica tu GPS</Text>
                        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                            Necesitamos el IMEI, un código de 15 dígitos único de tu dispositivo.
                        </Text>

                        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Número IMEI</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                            placeholder="Ej: 863123456789012"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={15}
                            value={imei}
                            onChangeText={(v) => setImei(v.replace(/[^0-9]/g, ''))}
                        />
                        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>15 dígitos, sin espacios</Text>

                        <View style={[styles.reqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.reqCardTitle, { color: colors.text }]}>¿Dónde lo encuentro?</Text>
                            <View style={styles.numberedRow}>
                                <Text style={[styles.numberedIndex, { color: colors.primary }]}>1.</Text>
                                <Text style={[styles.reqSubtitle, { color: colors.textSecondary, flex: 1 }]}>
                                    Revisa la etiqueta pegada en el propio dispositivo
                                </Text>
                            </View>
                            <View style={[styles.numberedRow, { marginBottom: 0 }]}>
                                <Text style={[styles.numberedIndex, { color: colors.primary }]}>2.</Text>
                                <Text style={[styles.reqSubtitle, { color: colors.textSecondary, flex: 1 }]}>
                                    O envía el SMS <Text style={{ fontWeight: '700' }}>imei123456</Text> al número de la SIM del GPS y te responderá con el código
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: imei.length === 15 ? colors.primary : colors.border }]}
                            onPress={() => goTo('config')}
                            disabled={imei.length !== 15}
                        >
                            <Text style={styles.nextButtonText}>Continuar</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );

            case 'config':
                return (
                    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={[styles.stepLabel, { color: colors.textMuted }]}>Paso 3 de 4</Text>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>Conecta el GPS</Text>
                        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                            Envía estos comandos por SMS al número de la SIM del GPS, en orden.
                        </Text>

                        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Número de la SIM del GPS</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                            placeholder="+56 9 1234 5678"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                            value={simPhone}
                            onChangeText={setSimPhone}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: 12 }]}>APN de tu operador</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                            placeholder="Consulta con tu operador (Movistar, Entel, WOM, Claro)"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            value={apn}
                            onChangeText={setApn}
                        />

                        <View style={[styles.reqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: 16 }]}>
                            <View style={styles.cmdHeaderRow}>
                                <View style={[styles.cmdBadge, { backgroundColor: colors.primary }]}><Text style={styles.cmdBadgeText}>1</Text></View>
                                <Text style={[styles.reqTitle, { color: colors.text }]}>Configurar APN</Text>
                            </View>
                            <View style={[styles.cmdBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <Text style={[styles.cmdText, { color: colors.text }]}>{apnCommand}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.smsButton, { borderColor: colors.border, opacity: simPhone && apn ? 1 : 0.5 }]}
                                onPress={() => openSms(apnCommand)}
                                disabled={!simPhone || !apn}
                            >
                                <Ionicons name="chatbubble-outline" size={15} color={colors.text} />
                                <Text style={[styles.smsButtonText, { color: colors.text }]}>Enviar por SMS</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.reqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={styles.cmdHeaderRow}>
                                <View style={[styles.cmdBadge, { backgroundColor: colors.primary }]}><Text style={styles.cmdBadgeText}>2</Text></View>
                                <Text style={[styles.reqTitle, { color: colors.text }]}>Apuntar al servidor</Text>
                            </View>
                            <View style={[styles.cmdBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <Text style={[styles.cmdText, { color: colors.text }]}>{serverCommand}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.smsButton, { borderColor: colors.border, opacity: simPhone ? 1 : 0.5 }]}
                                onPress={() => openSms(serverCommand)}
                                disabled={!simPhone}
                            >
                                <Ionicons name="chatbubble-outline" size={15} color={colors.text} />
                                <Text style={[styles.smsButtonText, { color: colors.text }]}>Enviar por SMS</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.tipBanner, { backgroundColor: colors.amberBg }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
                            <Text style={[styles.tipBannerText, { color: colors.amber }]}>
                                Envía uno por uno y espera la respuesta antes del siguiente. Los comandos exactos pueden variar según la marca/modelo de tu GPS — revisa su manual si no responde.
                            </Text>
                        </View>

                        <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={() => goTo('save')}>
                            <Text style={styles.nextButtonText}>Ya envié los comandos</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );

            case 'save':
                return (
                    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={[styles.stepLabel, { color: colors.textMuted }]}>Paso 4 de 4</Text>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>
                            {saved ? 'GPS guardado' : 'Guardar GPS en tu moto'}
                        </Text>
                        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                            {saved
                                ? 'Quedará vinculado a esta moto. La conexión en vivo se activará cuando el servidor de rastreo esté listo.'
                                : 'Esto asocia el IMEI a esta moto para que el rastreo lo reconozca más adelante.'}
                        </Text>

                        <View style={[styles.reqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={styles.reqRow}>
                                <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} style={styles.reqIcon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.reqTitle, { color: colors.text }]}>IMEI</Text>
                                    <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>{imei}</Text>
                                </View>
                            </View>
                            <View style={[styles.reqRow, { marginBottom: 0 }]}>
                                <Ionicons
                                    name={saved ? 'checkmark-circle' : 'time-outline'}
                                    size={18}
                                    color={saved ? colors.success : colors.textMuted}
                                    style={styles.reqIcon}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.reqTitle, { color: colors.text }]}>Conexión en vivo</Text>
                                    <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>
                                        {saved ? 'Pendiente — se activará con el servidor de rastreo' : 'Aún no verificada'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {error && (
                            <View style={[styles.errorContainer, { backgroundColor: colors.danger + '15' }]}>
                                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: colors.primary }]}
                            onPress={saved ? handleClose : handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.nextButtonText}>{saved ? 'Finalizar' : 'Guardar'}</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                );
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Registrar GPS</Text>
                        <TouchableOpacity onPress={stepIndex > 0 && !saved ? () => setStep(STEP_ORDER[stepIndex - 1]) : handleClose}>
                            <Text style={{ color: colors.primary, fontSize: 16 }}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>

                    <ProgressBar />

                    {renderStep()}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14 },
    progressSegment: { flex: 1, height: 4, borderRadius: 2 },
    stepContainer: { flex: 1, padding: 20 },
    stepLabel: { fontSize: 12, marginBottom: 4 },
    stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
    stepSubtitle: { fontSize: 14, marginBottom: 18, lineHeight: 19 },
    reqCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
    reqCardTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    reqIcon: { marginTop: 1 },
    reqTitle: { fontSize: 14, fontWeight: '600' },
    reqSubtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    numberedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    numberedIndex: { fontSize: 12, fontWeight: '700', width: 14 },
    tipBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, marginBottom: 16 },
    tipBannerText: { fontSize: 12, flex: 1, lineHeight: 16 },
    inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    fieldHint: { fontSize: 11.5, marginTop: -8, marginBottom: 14 },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        marginBottom: 6,
    },
    cmdHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    cmdBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cmdBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cmdBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
    cmdText: { fontSize: 12.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    smsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
    },
    smsButtonText: { fontSize: 13, fontWeight: '600' },
    nextButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    errorContainer: { padding: 12, borderRadius: 8, marginBottom: 14 },
    errorText: { fontSize: 14, textAlign: 'center' },
});
