import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface RainAlertCardProps {
  minutesUntilRain: number;
  probability: number;
  zoneName?: string;
  onDismiss: () => void;
  onPress: () => void;
}

export function RainAlertCard({
  minutesUntilRain,
  probability,
  zoneName,
  onDismiss,
  onPress,
}: RainAlertCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="cloudy-night" size={28} color={colors.amber} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>
          Lluvia en ~{minutesUntilRain} min
        </Text>
        <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
          Probabilidad: {probability}%{zoneName ? ` · ${zoneName}` : ''}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          onDismiss();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={colors.inkFaint} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  dismissBtn: {
    padding: 4,
  },
});
