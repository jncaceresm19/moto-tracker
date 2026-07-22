import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onClose: () => void;
}

export function CustomAlert({ visible, title, message, buttons, icon, iconColor, onClose }: CustomAlertProps) {
  const { colors } = useTheme();
  const primary = iconColor || colors.primary;

  const handlePress = (btn: AlertButton) => {
    onClose();
    btn.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: primary + '15' }]}>
              <Ionicons name={icon} size={32} color={primary} />
            </View>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
          <View style={[styles.buttonRow, buttons.length === 1 && { justifyContent: 'center' }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  btn.style === 'cancel'
                    ? { backgroundColor: colors.surfaceSecondary || colors.inputBg }
                    : btn.style === 'destructive'
                      ? styles.destructiveBtn
                      : { backgroundColor: primary },
                  btn.style === 'cancel' && { borderWidth: 1, borderColor: colors.border },
                  buttons.length === 1 && styles.singleBtn,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === 'destructive' && styles.destructiveText,
                    btn.style === 'cancel' && { color: colors.text },
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
  },
  singleBtn: {
    maxWidth: 200,
  },
  destructiveBtn: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveText: {
    color: '#fff',
  },
  destructiveText: {
    color: '#fff',
  },
});
