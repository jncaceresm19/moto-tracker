import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface TheftConfirmModalProps {
  visible: boolean;
  motorcycleBrand: string;
  motorcycleModel: string;
  distance: number;
  onConfirmOwner: () => void;
  onConfirmTheft: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

type ModalStep = 'confirming' | 'publishing';

export function TheftConfirmModal({
  visible,
  motorcycleBrand,
  motorcycleModel,
  distance,
  onConfirmOwner,
  onConfirmTheft,
  onDismiss,
  loading = false,
}: TheftConfirmModalProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<ModalStep>('confirming');

  const handleConfirmOwner = () => {
    onConfirmOwner();
    setStep('confirming');
  };

  const handleNoOwner = () => {
    setStep('publishing');
  };

  const handleConfirmTheft = () => {
    onConfirmTheft();
    setStep('confirming');
  };

  const handleDismiss = () => {
    onDismiss();
    setStep('confirming');
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {loading ? (
            // Loading state
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.ink }]}>
                Creando alerta...
              </Text>
            </View>
          ) : step === 'confirming' ? (
            // Step 1: ¿Fuiste tú?
            <>
              <View style={[styles.iconContainer, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="warning" size={48} color={colors.amber} />
              </View>
              
              <Text style={[styles.title, { color: colors.ink }]}>
                ¿Fuiste tú el que movió la moto?
              </Text>
              
              <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
                {motorcycleBrand} {motorcycleModel} se movió {Math.round(distance)}m de su última ubicación
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirmOwner}
                >
                  <Text style={styles.primaryButtonText}>SÍ, FUI YO</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={handleNoOwner}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.ink }]}>NO</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Step 2: ¿Publicar como robada?
            <>
              <View style={[styles.iconContainer, { backgroundColor: colors.alertRedBg }]}>
                <Ionicons name="alert-circle" size={48} color={colors.alertRed} />
              </View>
              
              <Text style={[styles.title, { color: colors.ink }]}>
                ¿Deseas publicar como robada?
              </Text>
              
              <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
                Se creará una alerta con los datos de tu moto para que otros usuarios puedan ayudar
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: colors.alertRed }]}
                  onPress={handleConfirmTheft}
                >
                  <Text style={styles.primaryButtonText}>SÍ, PUBLICAR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={handleDismiss}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.ink }]}>NO, GRACIAS</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100',
    gap: 12,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    // backgroundColor set dynamically
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
