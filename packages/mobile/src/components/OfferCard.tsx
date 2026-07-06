import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface OfferCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  name: string;
  distance: string;
  price: string;
  savings?: string;
  onPress?: () => void;
}

export function OfferCard({ icon, iconBg, name, distance, price, savings, onPress }: OfferCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.ink} />
      </View>
      <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.distance, { color: colors.inkFaint }]}>{distance}</Text>
      <Text style={[styles.price, { color: colors.ink }]}>{price}</Text>
      {savings ? (
        <View style={[styles.savingsBadge, { backgroundColor: colors.green + '15' }]}>
          <Text style={[styles.savingsText, { color: colors.green }]}>{savings}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 150, borderRadius: 14, borderWidth: 1, padding: 14, marginRight: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 14, fontWeight: '600' },
  distance: { fontSize: 12, marginTop: 2 },
  price: { fontSize: 18, fontWeight: '600', fontFamily: 'monospace', marginTop: 8 },
  savingsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start' },
  savingsText: { fontSize: 11, fontWeight: '600' },
});
