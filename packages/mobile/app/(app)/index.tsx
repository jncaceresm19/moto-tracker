import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: colors.text }]}>{t('homeTitle')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('homeSubtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});