import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';

export default function TrackerScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Custom header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('protocolTrakerConfig')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Empty state */}
      <View style={styles.emptyState}>
        <Ionicons name="location-outline" size={48} color={colors.inkFaint} />
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('noTrackers')}</Text>
        <Text style={[styles.emptyText, { color: colors.inkFaint }]}>{t('noTrackersText')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
