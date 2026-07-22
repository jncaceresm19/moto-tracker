import React from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

export interface OcrField {
  key: string;
  label: string;
  value: string;
  editable?: boolean;
  autoCalculated?: boolean;
}

interface OcrReviewModalProps {
  visible: boolean;
  documentType: string;
  loading: boolean;
  fields: OcrField[];
  error?: string;
  confidence?: number; // 0-100
  onFieldChange: (key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  circulation_permit: 'Permiso de Circulación',
  technical_review: 'Revisión Técnica',
  drivers_license: 'Licencia de Conducir',
  padron: 'Padrón del Vehículo',
};

const DOC_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  circulation_permit: 'document-text-outline',
  technical_review: 'construct-outline',
  drivers_license: 'card-outline',
  padron: 'reader-outline',
};

// Reutiliza estos mismos valores en el otro modal (docPortarModal) para que ambos
// tengan exactamente el mismo ancho.
export const MODAL_WIDTH = '92%';
export const MODAL_MAX_WIDTH = 420;

export function OcrReviewModal({
  visible,
  documentType,
  loading,
  fields,
  error,
  confidence,
  onFieldChange,
  onSave,
  onCancel,
  onRetry,
}: OcrReviewModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidingView}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()} style={styles.modalWrapper}>
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              {/* Header — same pattern as docPortarModalHeader */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Ionicons name={DOC_TYPE_ICONS[documentType] || 'scan-outline'} size={18} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {DOC_TYPE_LABELS[documentType] || 'Documento'}
                </Text>
                <TouchableOpacity onPress={onCancel}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content — fixed height for max 3 fields, no scroll needed */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Leyendo documento...
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                    activeOpacity={0.8}
                    onPress={onRetry}
                  >
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Info banner — same pattern as infoCardItem */}
                  <View style={[styles.infoCardItem, { marginTop: 12, marginBottom: 8 }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.infoCardText, { color: colors.text }]}>
                      Revisa y edita los datos antes de guardar
                    </Text>
                  </View>

                  {/* Confidence indicator */}
                  {typeof confidence === 'number' && confidence > 0 && (
                    <View style={[styles.confidenceBar, {
                      backgroundColor: confidence >= 70
                        ? '#22c55e' + '18'
                        : confidence >= 40
                          ? '#eab308' + '18'
                          : '#ef4444' + '18',
                      borderColor: confidence >= 70
                        ? '#22c55e'
                        : confidence >= 40
                          ? '#eab308'
                          : '#ef4444',
                    }]}>
                      <Ionicons
                        name={confidence >= 70 ? 'checkmark-circle' : confidence >= 40 ? 'warning' : 'alert-circle'}
                        size={14}
                        color={confidence >= 70 ? '#22c55e' : confidence >= 40 ? '#eab308' : '#ef4444'}
                      />
                      <Text style={[styles.confidenceText, {
                        color: confidence >= 70 ? '#22c55e' : confidence >= 40 ? '#eab308' : '#ef4444',
                      }]}>
                        {confidence >= 70
                          ? 'Buena lectura'
                          : confidence >= 40
                            ? 'Lectura regular — verificá los campos'
                            : 'Lectura difícil — considerá reintentar con mejor iluminación'}
                      </Text>
                    </View>
                  )}

                  <ScrollView
                    style={styles.fieldsScroll}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {fields.map((field) => (
                      <View key={field.key} style={styles.fieldContainer}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {field.label}
                        </Text>
                        {field.autoCalculated ? (
                          <View style={[styles.autoField, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.autoFieldValue, { color: colors.text }]}>
                              {field.value || '—'}
                            </Text>
                          </View>
                        ) : (
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                            value={field.value}
                            onChangeText={(text) => onFieldChange(field.key, text)}
                            editable={field.editable !== false}
                            placeholder={`Ingresar ${field.label.toLowerCase()}`}
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="words"
                          />
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Footer — side by side buttons */}
              {!loading && !error && (
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.submitBtn, styles.footerBtn, { backgroundColor: colors.textMuted + '40' }]}
                    activeOpacity={0.8}
                    onPress={onCancel}
                  >
                    <Text style={[styles.submitBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, styles.footerBtn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.8}
                    onPress={onSave}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Helper: Build OcrFields from OcrResult per document type ────────────────
export function buildOcrFields(documentType: string, data: Record<string, string | undefined>): OcrField[] {
  const fields: OcrField[] = [];

  const addField = (key: string, label: string, editable = true, autoCalculated = false) => {
    fields.push({ key, label, value: data[key] || '', editable, autoCalculated });
  };

  switch (documentType) {
    case 'circulation_permit':
      addField('comuna', 'Comuna');
      addField('issueDate', 'Fecha de emisión');
      addField('expiryDate', 'Vencimiento (31 marzo)', false, true);
      break;

    case 'technical_review':
      addField('issueDate', 'Fecha de emisión');
      addField('expiryDate', 'Fecha de vencimiento');
      break;

    case 'drivers_license':
      addField('issueDate', 'Fecha de emisión');
      addField('expiryDate', 'Vencimiento (+6 años)', false, true);
      break;

    case 'padron':
      addField('issueDate', 'Fecha de emisión');
      addField('year', 'Año');
      addField('brand', 'Marca');
      addField('model', 'Modelo');
      addField('engineNumber', 'N° Motor');
      addField('chassisNumber', 'N° Chasis');
      addField('serialNumber', 'N° Serie');
      addField('color', 'Color');
      addField('patente', 'Patente (PPU)');
      break;

    case 'insurance':
      addField('issueDate', 'Fecha de emisión');
      addField('expiryDate', 'Vencimiento (31 marzo)', false, true);
      break;
  }

  return fields;
}

// ── Styles matching docPortarModal patterns ──────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  avoidingView: {
    width: '100%',
    alignItems: 'center',
  },
  modalWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  modal: {
    width: MODAL_WIDTH,
    maxWidth: MODAL_MAX_WIDTH,
    borderRadius: 14,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  fieldsScroll: {
    maxHeight: SCREEN_HEIGHT * 0.45,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 15,
  },
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  autoField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  autoFieldValue: {
    fontSize: 16,
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 30,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});