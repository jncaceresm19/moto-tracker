import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';

interface PhotoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
}

export function PhotoPickerModal({ visible, onClose, onCamera, onGallery }: PhotoPickerModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('changePhoto')}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onCamera}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.btnText}>{t('takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onGallery}>
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.btnText}>{t('chooseFromGallery')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
