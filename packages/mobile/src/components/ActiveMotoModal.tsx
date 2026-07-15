import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';
import { Motorcycle } from '../api';
import { ActiveMoto, formatActivationTime } from '../services/activeMoto';
import { getDisplayPlateParts } from '../../../backend/src/services/plateValidation';

interface ActiveMotoModalProps {
  visible: boolean;
  onClose: () => void;
  motorcycles: Motorcycle[];
  activeMoto: ActiveMoto | null;
  activationAddress?: string;
  onActivate: (motorcycleId: string) => void;
  onDeactivate: () => void;
  onReportTheft: () => void;
}

export function ActiveMotoModal({
  visible,
  onClose,
  motorcycles,
  activeMoto,
  activationAddress,
  onActivate,
  onDeactivate,
  onReportTheft,
}: ActiveMotoModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const activeMotorcycle = activeMoto
    ? motorcycles.find(m => m.id === activeMoto.motorcycleId)
    : null;


  const formatPlate = (raw: string) => {
    const { letters, numbers } = getDisplayPlateParts(raw);
    return numbers ? `${letters}-${numbers}` : letters;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.container, { backgroundColor: colors.surface }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.ink }]}>
              {activeMoto ? t('activeMoto') : t('selectMoto')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.inkFaint} />
            </TouchableOpacity>
          </View>

          {activeMoto && activeMotorcycle ? (
            // Active moto view
            <View style={styles.activeView}>
              <View style={[styles.activeCard, { backgroundColor: colors.green + '15', borderColor: colors.green }]}>
                <View style={styles.activeHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                  <Text style={[styles.activeLabel, { color: colors.green }]}>{t('activeMoto')}</Text>
                </View>
                <Text style={[styles.motoName, { color: colors.ink }]}>
                  {activeMotorcycle.brand} {activeMotorcycle.model}
                </Text>
                <Text style={[styles.plate, { color: colors.inkFaint }]}>
                  {formatPlate(activeMotorcycle.licensePlate)}
                </Text>
                <Text style={[styles.time, { color: colors.inkFaint }]}>
                  {t('activeSince')} {formatActivationTime(activeMoto.activatedAt)}
                </Text>
                {activeMoto.activationLat && activeMoto.activationLon && (
                  <Text style={[styles.location, { color: colors.inkFaint }]}>
                    {t('parkedAt')} {activationAddress || `${activeMoto.activationLat?.toFixed(4)}, ${activeMoto.activationLon?.toFixed(4)}`}
                  </Text>
                )}
              </View>

              {/* Action buttons */}
              <TouchableOpacity
                style={[styles.deactivateBtn, { borderColor: colors.border }]}
                onPress={() => { onDeactivate(); onClose(); }}
              >
                <Ionicons name="stop-circle-outline" size={20} color={colors.inkFaint} />
                <Text style={[styles.deactivateText, { color: colors.ink }]}>{t('deactivateMoto')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.theftBtn, { backgroundColor: colors.alertRed }]}
                onPress={() => { onReportTheft(); onClose(); }}
              >
                <Ionicons name="alert-circle-outline" size={20} color="#fff" />
                <Text style={styles.theftText}>{t('reportTheft')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Motorcycle selector view
            <ScrollView style={styles.selectorView}>
              {motorcycles.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.inkFaint }]}>
                    {t('registerFirstMoto')}
                  </Text>
                </View>
              ) : (
                motorcycles.map((moto) => (
                  <TouchableOpacity
                    key={moto.id}
                    style={[styles.motoOption, { borderColor: colors.border }]}
                    onPress={() => { onActivate(moto.id); onClose(); }}
                  >
                    <View style={styles.motoOptionContent}>
                      <Text style={[styles.motoOptionName, { color: colors.ink }]}>
                        {moto.brand} {moto.model}
                      </Text>
                      <Text style={[styles.motoOptionPlate, { color: colors.inkFaint }]}>
                        {formatPlate(moto.licensePlate)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  activeView: {
    gap: 12,
  },
  activeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  motoName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  plate: {
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 8,
  },
  time: {
    fontSize: 13,
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deactivateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  theftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  theftText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  selectorView: {
    maxHeight: 300,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  motoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  motoOptionContent: {
    flex: 1,
  },
  motoOptionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  motoOptionPlate: {
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
