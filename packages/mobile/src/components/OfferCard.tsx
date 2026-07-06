import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface OfferCardProps {
  brandLogo?: keyof typeof Ionicons.glyphMap;
  brandColor?: string;
  brandName: string;
  location: string;
  distance: string;
  price93?: number;
  onPress?: () => void;
}

export function OfferCard({
  brandLogo = 'flame',
  brandColor = '#F5A623',
  brandName,
  location,
  distance,
  price93,
  onPress,
}: OfferCardProps) {
  const { colors } = useTheme();

  // Chilean national average for 93
  const avgPrice93 = 1604;
  const savings = price93 ? avgPrice93 - price93 : 0;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      {/* Brand logo */}
      <View style={[styles.logoCircle, { backgroundColor: brandColor + '20' }]}>
        <Ionicons name={brandLogo} size={22} color={brandColor} />
      </View>

      {/* Brand name + location */}
      <View style={styles.nameRow}>
        <Text style={[styles.brandName, { color: colors.ink }]} numberOfLines={1}>{brandName}</Text>
        {location ? <Text style={[styles.location, { color: colors.inkFaint }]} numberOfLines={1}>{location}</Text> : null}
      </View>

      {/* Distance */}
      <Text style={[styles.distance, { color: colors.inkFaint }]}>{distance}</Text>

      {/* Price per liter */}
      {price93 ? (
        <Text style={[styles.price, { color: colors.ink }]}>${price93}/L</Text>
      ) : null}

      {/* Savings badge */}
      {savings > 0 ? (
        <View style={[styles.savingsBadge, { backgroundColor: '#1F9D6315' }]}>
          <Text style={styles.savingsText}>-${savings} vs promedio 93</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 160, borderRadius: 14, borderWidth: 1, padding: 14, marginRight: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  nameRow: { gap: 2 },
  brandName: { fontSize: 14, fontWeight: '600' },
  location: { fontSize: 12 },
  distance: { fontSize: 12, marginTop: 4 },
  price: { fontSize: 20, fontWeight: '700', fontFamily: 'monospace', marginTop: 8 },
  savingsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
  savingsText: { fontSize: 11, fontWeight: '600', color: '#1F9D63' },
});
